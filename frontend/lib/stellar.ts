/**
 * Soroban contract interaction helpers for Ztellar Edge.
 * Uses @stellar/stellar-sdk's rpc.Server for simulation and submission.
 */

import {
  rpc,
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

// G2: [[x_c1, x_c0], [y_c1, y_c0], ["1","0"]] → 192 bytes
export function g2ToBytes(
  point: [[string, string], [string, string], [string, string]]
): Uint8Array {
  const x_c1 = decimalToBytes(point[0][0], 48)
  const x_c0 = decimalToBytes(point[0][1], 48)
  const y_c1 = decimalToBytes(point[1][0], 48)
  const y_c0 = decimalToBytes(point[1][1], 48)
  const out = new Uint8Array(192)
  out.set(x_c1, 0)
  out.set(x_c0, 48)
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
  const entries = signals.map((s) =>
    xdr.ScVal.scvBytes(Buffer.from(frToBytes(s)))
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
  if (!CONTRACTS.ZK_VERIFIER) {
    throw new Error("ZK_VERIFIER contract ID not configured")
  }

  const aBytes = g1ToBytes(proof.pi_a)
  const bBytes = g2ToBytes(proof.pi_b)
  const cBytes = g1ToBytes(proof.pi_c)

  const contract = new Contract(CONTRACTS.ZK_VERIFIER)

  // Build the transaction
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

  // Simulate to get resource fees
  const simResult = await RPC_SERVER.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`)
  }
  const preparedTx = rpc.assembleTransaction(tx, simResult).build()

  // Sign with Freighter
  const txXdr = preparedTx.toXDR()
  const signResult = await freighter.signTransaction(txXdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  // signResult is a string (signed XDR)
  const signedXdr = typeof signResult === "string" ? signResult : (signResult as { signedTxXdr: string }).signedTxXdr

  // Submit and poll
  const submitResult = await RPC_SERVER.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE) as any
  )
  if (submitResult.status === "ERROR") {
    throw new Error(`Submission failed: ${submitResult.errorResult?.toXDR("base64")}`)
  }

  // Poll for confirmation
  const hash = submitResult.hash
  let attempts = 0
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 2000))
    const txResult = await RPC_SERVER.getTransaction(hash)
    if (txResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      const returnVal = txResult.returnValue
      if (!returnVal) throw new Error("No return value from contract")
      return Number(scValToNative(returnVal))
    }
    if (txResult.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error("Transaction failed on-chain")
    }
    attempts++
  }
  throw new Error("Transaction timed out waiting for confirmation")
}

/**
 * Read the current tier for a wallet from the TierManager contract (free, no auth).
 */
export async function readTier(walletAddress: string): Promise<number> {
  if (!CONTRACTS.TIER_MANAGER) return 0
  try {
    const contract = new Contract(CONTRACTS.TIER_MANAGER)
    const sourceAccount = await RPC_SERVER.getAccount(walletAddress)
    const tx = new TransactionBuilder(sourceAccount, {
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
    if (rpc.Api.isSimulationError(sim)) return 0
    if (!("result" in sim) || !sim.result?.retval) return 0
    return Number(scValToNative(sim.result.retval))
  } catch {
    return 0
  }
}
