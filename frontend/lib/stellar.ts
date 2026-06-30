/**
 * Soroban contract interaction helpers for Ztellar Edge.
 * Uses @stellar/stellar-sdk's rpc.Server for simulation and submission.
 */

import {
  rpc,
  Account,
  Contract,
  TransactionBuilder,
  Networks,
  xdr,
  nativeToScVal,
  scValToNative,
  BASE_FEE,
} from "@stellar/stellar-sdk"
import * as freighter from "@stellar/freighter-api"
import { CONTRACTS, SOROBAN_RPC_URL, STELLAR_NETWORK } from "./contracts"

const RPC_SERVER = new rpc.Server(SOROBAN_RPC_URL, { allowHttp: false })

const NETWORK_PASSPHRASE =
  STELLAR_NETWORK === "mainnet"
    ? Networks.PUBLIC
    : Networks.TESTNET

// ──────────────────────────────────────────────────────────────────────────────
// BLS12-381 byte serialization
// snarkjs produces field elements as decimal BigInt strings.
// G1 affine point = x (48 bytes BE) || y (48 bytes BE) = 96 bytes
// G2 affine point = x_c1 (48) || x_c0 (48) || y_c1 (48) || y_c0 (48) = 192 bytes
// Fr scalar = 32 bytes BE
// ──────────────────────────────────────────────────────────────────────────────

function bigintToBytes(n: bigint, length: number): Uint8Array {
  const buf = new Uint8Array(length)
  for (let i = length - 1; i >= 0; i--) {
    buf[i] = Number(n & 0xffn)
    n >>= 8n
  }
  return buf
}

function decimalToBytes(dec: string, length: number): Uint8Array {
  return bigintToBytes(BigInt(dec), length)
}

// G1: [x, y, "1"] → 96 bytes
export function g1ToBytes(point: [string, string, string]): Uint8Array {
  const x = decimalToBytes(point[0], 48)
  const y = decimalToBytes(point[1], 48)
  const out = new Uint8Array(96)
  out.set(x, 0)
  out.set(y, 48)
  return out
}

// G2: [[c0_x, c1_x], [c0_y, c1_y], ["1","0"]] → 192 bytes
// ffjavascript/snarkjs Fp2 JSON: [c0, c1] — c0 (real) at [0], c1 (imaginary) at [1]
// Soroban Bls12381G2Affine (blst): X_c1 || X_c0 || Y_c1 || Y_c0 — imaginary FIRST
export function g2ToBytes(
  point: [[string, string], [string, string], [string, string]]
): Uint8Array {
  const x_c0 = decimalToBytes(point[0][0], 48)  // real, index [0]
  const x_c1 = decimalToBytes(point[0][1], 48)  // imaginary, index [1]
  const y_c0 = decimalToBytes(point[1][0], 48)
  const y_c1 = decimalToBytes(point[1][1], 48)
  const out = new Uint8Array(192)
  out.set(x_c1, 0)    // imaginary (index [1]) FIRST — blst/Soroban
  out.set(x_c0, 48)   // real (index [0]) SECOND
  out.set(y_c1, 96)
  out.set(y_c0, 144)
  return out
}

// Fr: decimal string → 32 bytes BE
export function frToBytes(dec: string): Uint8Array {
  return decimalToBytes(dec, 32)
}

// ──────────────────────────────────────────────────────────────────────────────
// XDR helpers
// ──────────────────────────────────────────────────────────────────────────────

function bytesToScVal(bytes: Uint8Array): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(bytes))
}

function makeG1ScVal(bytes: Uint8Array): xdr.ScVal {
  return bytesToScVal(bytes)
}

function makeG2ScVal(bytes: Uint8Array): xdr.ScVal {
  return bytesToScVal(bytes)
}

function makeProofScVal(
  aBytes: Uint8Array,
  bBytes: Uint8Array,
  cBytes: Uint8Array
): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("a"),
      val: makeG1ScVal(aBytes),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("b"),
      val: makeG2ScVal(bBytes),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("c"),
      val: makeG1ScVal(cBytes),
    }),
  ])
}

function makePubSignalsScVal(signals: string[]): xdr.ScVal {
  // Fr in soroban-sdk wraps U256, so TryFromVal expects ScvU256 not ScvBytes.
  // Sending ScvBytes here causes Vec<Fr>::get() to call unwrap_optimized() on
  // a ConversionError, which panics → WasmVm InvalidAction / UnreachableCodeReached.
  const entries = signals.map((s) =>
    nativeToScVal(BigInt(s), { type: "u256" })
  )
  return xdr.ScVal.scvVec(entries)
}

// ──────────────────────────────────────────────────────────────────────────────
// Contract calls
// ──────────────────────────────────────────────────────────────────────────────

export interface SnarkjsProof {
  pi_a: [string, string, string]
  pi_b: [[string, string], [string, string], [string, string]]
  pi_c: [string, string, string]
}

/**
 * Submit a Groth16 proof to the ZKVerifier Soroban contract.
 * Simulates first to determine fees, then signs with Freighter and submits.
 * Returns the verified tier number (1-4).
 */
export async function submitZkProof(
  walletAddress: string,
  proof: SnarkjsProof,
  publicSignals: string[]
): Promise<number> {
  console.group("🌟 [ZE] submitZkProof")
  console.log("contract:", CONTRACTS.ZK_VERIFIER)
  console.log("wallet:", walletAddress)

  if (!CONTRACTS.ZK_VERIFIER) {
    console.error("❌ ZK_VERIFIER not configured")
    console.groupEnd()
    throw new Error("ZK_VERIFIER contract ID not configured")
  }

  const aBytes = g1ToBytes(proof.pi_a)
  const bBytes = g2ToBytes(proof.pi_b)
  const cBytes = g1ToBytes(proof.pi_c)
  console.log("proof bytes — pi_a:", aBytes.length, "pi_b:", bBytes.length, "pi_c:", cBytes.length)

  const contract = new Contract(CONTRACTS.ZK_VERIFIER)

  console.log("⏳ fetching account sequence…")
  const sourceAccount = await RPC_SERVER.getAccount(walletAddress)
  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "verify_and_register",
        nativeToScVal(walletAddress, { type: "address" }),
        makeProofScVal(aBytes, bBytes, cBytes),
        makePubSignalsScVal(publicSignals)
      )
    )
    .setTimeout(180)
    .build()

  console.log("⏳ simulating transaction…")
  const simResult = await RPC_SERVER.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simResult)) {
    console.error("❌ simulation error:", simResult.error)
    console.groupEnd()
    throw new Error(`Simulation failed: ${simResult.error}`)
  }
  console.log("✅ simulation OK — assembling…")
  const preparedTx = rpc.assembleTransaction(tx, simResult).build()

  console.log("⏳ requesting Freighter signature…")
  const txXdr = preparedTx.toXDR()
  const signResult = await freighter.signTransaction(txXdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  const signedXdr = typeof signResult === "string" ? signResult : (signResult as { signedTxXdr: string }).signedTxXdr
  console.log("✅ signed")

  console.log("⏳ submitting to Soroban RPC…")
  const submitResult = await RPC_SERVER.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE) as any
  )
  if (submitResult.status === "ERROR") {
    console.error("❌ submission error:", submitResult.errorResult?.toXDR("base64"))
    console.groupEnd()
    throw new Error(`Submission failed: ${submitResult.errorResult?.toXDR("base64")}`)
  }

  const hash = submitResult.hash
  console.log("tx hash:", hash)
  console.log("⏳ polling for confirmation…")

  let attempts = 0
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 2000))
    const txResult = await RPC_SERVER.getTransaction(hash)
    console.log(`  poll ${attempts + 1}/30 — status: ${txResult.status}`)
    if (txResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      const returnVal = txResult.returnValue
      if (!returnVal) throw new Error("No return value from contract")
      const tier = Number(scValToNative(returnVal))
      console.log("✅ verified! tier:", tier)
      console.groupEnd()
      return tier
    }
    if (txResult.status === rpc.Api.GetTransactionStatus.FAILED) {
      console.error("❌ transaction failed on-chain")
      console.groupEnd()
      throw new Error("Transaction failed on-chain")
    }
    attempts++
  }
  console.error("❌ timed out after 30 polls")
  console.groupEnd()
  throw new Error("Transaction timed out waiting for confirmation")
}

/**
 * Read the current tier for a wallet from the TierManager contract (free, no auth).
 */
export async function readTier(walletAddress: string): Promise<number> {
  console.log("🌟 [ZE] readTier — wallet:", walletAddress, "contract:", CONTRACTS.TIER_MANAGER)
  if (!CONTRACTS.TIER_MANAGER) {
    console.warn("[ZE] readTier: TIER_MANAGER not configured, returning 0")
    return 0
  }
  try {
    const contract = new Contract(CONTRACTS.TIER_MANAGER)
    const account = new Account(walletAddress, "0")
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "tier_of",
          nativeToScVal(walletAddress, { type: "address" })
        )
      )
      .setTimeout(30)
      .build()

    const sim = await RPC_SERVER.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      console.warn("[ZE] readTier sim error:", sim.error)
      return 0
    }
    if (!("result" in sim) || !sim.result?.retval) {
      console.warn("[ZE] readTier: no retval from sim")
      return 0
    }
    const tier = Number(scValToNative(sim.result.retval))
    console.log("✅ [ZE] readTier result:", tier)
    return tier
  } catch (e) {
    console.warn("[ZE] readTier threw:", e)
    return 0
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Asset / direction constants (must match synth_vault contract)
// ──────────────────────────────────────────────────────────────────────────────

export const ASSET_ID: Record<string, number> = {
  sAAPL: 0, sTSLA: 1, sNVDA: 2,
  sMSFT: 3, sAMZN: 4, sGOOG: 5,
  sMETA: 6, sNFLX: 7, sAMD:  8,
  sJPM:  9, sSPY: 10, sPFE: 11,
}
export const ASSET_SYMBOL: Record<number, string> = {
  0: "sAAPL", 1: "sTSLA", 2: "sNVDA",
  3: "sMSFT", 4: "sAMZN", 5: "sGOOG",
  6: "sMETA", 7: "sNFLX", 8: "sAMD",
  9: "sJPM", 10: "sSPY", 11: "sPFE",
}
export const DIR_ID: Record<string, number> = { LONG: 0, SHORT: 1 }
export const DIR_SYMBOL: Record<number, string> = { 0: "LONG", 1: "SHORT" }
const MICRO = 1_000_000 // 6-decimal fixed point used by vault

// ──────────────────────────────────────────────────────────────────────────────
// Helper: read-only simulation (no auth, no sequence number needed)
// ──────────────────────────────────────────────────────────────────────────────

async function simulateReadOnly(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourceAddress: string
): Promise<xdr.ScVal | null> {
  console.log(`🌟 [ZE] simulateReadOnly — ${method} (${contractId.slice(0, 8)}…)`)
  const contract = new Contract(contractId)
  const account = new Account(sourceAddress, "0")
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()

  const sim = await RPC_SERVER.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) {
    console.warn(`[ZE] simulateReadOnly ${method} error:`, sim.error)
    return null
  }
  if (!("result" in sim) || !sim.result?.retval) {
    console.warn(`[ZE] simulateReadOnly ${method}: no retval`)
    return null
  }
  console.log(`✅ [ZE] simulateReadOnly ${method} OK`)
  return sim.result.retval
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: state-changing call (requires Freighter signing)
// ──────────────────────────────────────────────────────────────────────────────

async function submitVaultCall(
  walletAddress: string,
  method: string,
  args: xdr.ScVal[]
): Promise<xdr.ScVal> {
  console.group(`🌟 [ZE] submitVaultCall — ${method}`)
  console.log("wallet:", walletAddress, "contract:", CONTRACTS.SYNTH_VAULT)

  if (!CONTRACTS.SYNTH_VAULT) {
    console.error("❌ SYNTH_VAULT not configured")
    console.groupEnd()
    throw new Error("SYNTH_VAULT contract ID not configured")
  }

  const contract = new Contract(CONTRACTS.SYNTH_VAULT)
  console.log("⏳ fetching account sequence…")
  const sourceAccount = await RPC_SERVER.getAccount(walletAddress)
  console.log("sequence:", sourceAccount.sequenceNumber())

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build()

  console.log("⏳ simulating…")
  const simResult = await RPC_SERVER.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simResult)) {
    console.error("❌ simulation error:", simResult.error)
    console.groupEnd()
    throw new Error(`Simulation failed: ${simResult.error}`)
  }
  console.log("✅ simulation OK — assembling…")
  const preparedTx = rpc.assembleTransaction(tx, simResult).build()

  console.log("⏳ requesting Freighter signature…")
  const txXdr = preparedTx.toXDR()
  const { signTransaction } = await import("@stellar/freighter-api")
  const signResult = await signTransaction(txXdr, { networkPassphrase: NETWORK_PASSPHRASE })
  const signedXdr =
    typeof signResult === "string"
      ? signResult
      : (signResult as { signedTxXdr: string }).signedTxXdr
  console.log("✅ signed")

  console.log("⏳ submitting…")
  const submitResult = await RPC_SERVER.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE) as Parameters<typeof RPC_SERVER.sendTransaction>[0]
  )
  if (submitResult.status === "ERROR") {
    console.error("❌ submission error:", submitResult.errorResult?.toXDR("base64"))
    console.groupEnd()
    throw new Error(`Submission failed: ${submitResult.errorResult?.toXDR("base64")}`)
  }

  const hash = submitResult.hash
  console.log("tx hash:", hash)
  console.log("⏳ polling…")

  let attempts = 0
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 2000))
    const txResult = await RPC_SERVER.getTransaction(hash)
    console.log(`  poll ${attempts + 1}/30 — ${txResult.status}`)
    if (txResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      if (!txResult.returnValue) throw new Error("No return value")
      console.log("✅ confirmed")
      console.groupEnd()
      return txResult.returnValue
    }
    if (txResult.status === rpc.Api.GetTransactionStatus.FAILED) {
      console.error("❌ failed on-chain")
      console.groupEnd()
      throw new Error("Transaction failed on-chain")
    }
    attempts++
  }
  console.error("❌ timed out")
  console.groupEnd()
  throw new Error("Transaction timed out")
}

// ──────────────────────────────────────────────────────────────────────────────
// Vault: open position
// collateralUSDC is in whole USDC units (e.g. 100 → 100 USDC)
// Returns the on-chain position ID as a string
// ──────────────────────────────────────────────────────────────────────────────

export async function openVaultPosition(
  walletAddress: string,
  assetId: number,
  directionId: number,
  leverage: number,
  collateralUSDC: number
): Promise<string> {
  const collateralMicro = BigInt(Math.round(collateralUSDC * MICRO))
  console.log("📊 [ZE] openVaultPosition", {
    asset: ASSET_SYMBOL[assetId],
    direction: DIR_SYMBOL[directionId],
    leverage: `${leverage}x`,
    collateral: `$${collateralUSDC} USDC (${collateralMicro} micro)`,
  })
  const retval = await submitVaultCall(walletAddress, "open_position", [
    nativeToScVal(walletAddress, { type: "address" }),
    nativeToScVal(assetId, { type: "u32" }),
    nativeToScVal(directionId, { type: "u32" }),
    nativeToScVal(leverage, { type: "u32" }),
    nativeToScVal(collateralMicro, { type: "i128" }),
  ])
  const positionId = String(scValToNative(retval))
  console.log("✅ [ZE] openVaultPosition — positionId:", positionId)
  return positionId
}

// ──────────────────────────────────────────────────────────────────────────────
// Vault: close position
// Returns realised PnL in USDC (positive = profit, negative = loss)
// ──────────────────────────────────────────────────────────────────────────────

export async function closeVaultPosition(
  walletAddress: string,
  positionId: string
): Promise<number> {
  console.log("📊 [ZE] closeVaultPosition — id:", positionId)
  const retval = await submitVaultCall(walletAddress, "close_position", [
    nativeToScVal(walletAddress, { type: "address" }),
    nativeToScVal(BigInt(positionId), { type: "u64" }),
  ])
  const pnlMicro = BigInt(String(scValToNative(retval)))
  const pnl = Number(pnlMicro) / MICRO
  console.log(`✅ [ZE] closeVaultPosition — PnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} USDC`)
  return pnl
}

// ──────────────────────────────────────────────────────────────────────────────
// USDC: get balance for a wallet (read-only)
// Returns balance in whole USDC (e.g. 1000.50)
// ──────────────────────────────────────────────────────────────────────────────

export async function getUserUsdcBalance(walletAddress: string): Promise<number> {
  if (!CONTRACTS.USDC_TOKEN) return 0
  try {
    const retval = await simulateReadOnly(
      CONTRACTS.USDC_TOKEN,
      "balance",
      [nativeToScVal(walletAddress, { type: "address" })],
      walletAddress
    )
    if (!retval) return 0
    const micro = BigInt(String(scValToNative(retval)))
    return Number(micro) / MICRO
  } catch {
    return 0
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Vault: get price for one asset (read-only, no auth)
// Returns price in whole USD (e.g. 192.35)
// Falls back to default if contract not reachable
// ──────────────────────────────────────────────────────────────────────────────

const PRICE_FALLBACK: Record<number, number> = { 0: 192.35, 1: 248.12, 2: 875.44 }

export async function getVaultPrice(assetId: number, sourceAddress: string): Promise<number> {
  if (!CONTRACTS.SYNTH_VAULT) return PRICE_FALLBACK[assetId] ?? 0
  try {
    const retval = await simulateReadOnly(
      CONTRACTS.SYNTH_VAULT,
      "get_price",
      [nativeToScVal(assetId, { type: "u32" })],
      sourceAddress
    )
    if (!retval) return PRICE_FALLBACK[assetId] ?? 0
    const priceMicro = BigInt(String(scValToNative(retval)))
    return Number(priceMicro) / MICRO
  } catch {
    return PRICE_FALLBACK[assetId] ?? 0
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Vault: get all position IDs for a wallet (read-only)
// ──────────────────────────────────────────────────────────────────────────────

export async function getWalletPositionIds(walletAddress: string): Promise<string[]> {
  console.log("📊 [ZE] getWalletPositionIds — wallet:", walletAddress)
  if (!CONTRACTS.SYNTH_VAULT) {
    console.warn("[ZE] getWalletPositionIds: SYNTH_VAULT not configured")
    return []
  }
  try {
    const retval = await simulateReadOnly(
      CONTRACTS.SYNTH_VAULT,
      "get_wallet_positions",
      [nativeToScVal(walletAddress, { type: "address" })],
      walletAddress
    )
    if (!retval) return []
    const ids = scValToNative(retval) as bigint[]
    const result = ids.map(String)
    console.log("✅ [ZE] getWalletPositionIds:", result)
    return result
  } catch (e) {
    console.warn("[ZE] getWalletPositionIds threw:", e)
    return []
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Vault: get a single position by ID (read-only)
// Returns null if position doesn't exist
// ──────────────────────────────────────────────────────────────────────────────

export interface VaultPosition {
  id: string
  asset: string
  direction: string
  leverage: number
  entryPrice: number
  collateralUSDC: number
  openedAt: Date
}

export async function getVaultPosition(
  positionId: string,
  sourceAddress: string
): Promise<VaultPosition | null> {
  console.log("📊 [ZE] getVaultPosition — id:", positionId)
  if (!CONTRACTS.SYNTH_VAULT) return null
  try {
    const retval = await simulateReadOnly(
      CONTRACTS.SYNTH_VAULT,
      "get_position",
      [nativeToScVal(BigInt(positionId), { type: "u64" })],
      sourceAddress
    )
    if (!retval) return null
    const raw = scValToNative(retval) as Record<string, unknown> | null
    if (!raw) return null
    const position: VaultPosition = {
      id: String(raw.id),
      asset: ASSET_SYMBOL[Number(raw.asset)] ?? "sAAPL",
      direction: DIR_SYMBOL[Number(raw.direction)] ?? "LONG",
      leverage: Number(raw.leverage),
      entryPrice: Number(BigInt(String(raw.entry_price))) / MICRO,
      collateralUSDC: Number(BigInt(String(raw.collateral))) / MICRO,
      openedAt: new Date(Number(raw.opened_at) * 1000),
    }
    console.log("✅ [ZE] getVaultPosition:", position)
    return position
  } catch (e) {
    console.warn("[ZE] getVaultPosition threw:", e)
    return null
  }
}
