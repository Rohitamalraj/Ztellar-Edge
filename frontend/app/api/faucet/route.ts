import { NextRequest, NextResponse } from "next/server"
import {
  rpc,
  Keypair,
  Contract,
  Account,
  TransactionBuilder,
  Networks,
  nativeToScVal,
  BASE_FEE,
} from "@stellar/stellar-sdk"

const RPC_URL = "https://soroban-testnet.stellar.org"
const NETWORK_PASSPHRASE = Networks.TESTNET

// 100 USDC — Stellar classic USDC uses 7 decimals (1 USDC = 10_000_000 units)
const FAUCET_AMOUNT = BigInt(100) * BigInt(10_000_000)
const FAUCET_USDC   = 100

const server = new rpc.Server(RPC_URL, { allowHttp: false })

async function sendAndWait(tx: Parameters<typeof server.sendTransaction>[0]) {
  const submit = await server.sendTransaction(tx)
  if (submit.status === "ERROR") {
    throw new Error("Faucet TX failed to submit: " + JSON.stringify(submit.errorResult))
  }
  const hash = submit.hash
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const poll = await server.getTransaction(hash)
    if (poll.status === rpc.Api.GetTransactionStatus.SUCCESS) return hash
    if (poll.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error("Faucet TX failed on-chain")
    }
  }
  throw new Error("Faucet TX timed out")
}

export async function POST(req: NextRequest) {
  try {
    const { wallet } = await req.json() as { wallet?: string }
    if (!wallet || typeof wallet !== "string" || wallet.length < 32) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
    }

    const adminSecret = process.env.ADMIN_SECRET
    const sacId       = process.env.NEXT_PUBLIC_USDC_CONTRACT_ID
    if (!adminSecret || !sacId) {
      return NextResponse.json({ error: "Faucet not configured" }, { status: 503 })
    }

    const kp    = Keypair.fromSecret(adminSecret)
    const admin = kp.publicKey()

    const acctData = await server.getAccount(admin)
    const acct     = new Account(admin, acctData.sequenceNumber())

    // SAC transfer: transfer(from: admin, to: wallet, amount: i128)
    // Admin's signature on this TX satisfies require_auth() for admin as `from`.
    const contract = new Contract(sacId)
    const tx = new TransactionBuilder(acct, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "transfer",
          nativeToScVal(admin,         { type: "address" }),
          nativeToScVal(wallet,        { type: "address" }),
          nativeToScVal(FAUCET_AMOUNT, { type: "i128"    }),
        )
      )
      .setTimeout(180)
      .build()

    const simResult = await server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(simResult)) {
      throw new Error("Faucet sim error: " + simResult.error)
    }
    const prepared = rpc.assembleTransaction(tx, simResult).build()
    prepared.sign(kp)

    const hash = await sendAndWait(prepared as Parameters<typeof server.sendTransaction>[0])
    return NextResponse.json({ success: true, hash, amount: FAUCET_USDC })
  } catch (err) {
    console.error("[faucet] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Faucet error" },
      { status: 500 }
    )
  }
}
