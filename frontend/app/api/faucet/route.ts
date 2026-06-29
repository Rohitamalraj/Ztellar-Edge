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
const FAUCET_AMOUNT = BigInt(1_000) * BigInt(1_000_000) // 1000 TUSDC (6 decimals)

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
    const tusdcId     = process.env.NEXT_PUBLIC_USDC_CONTRACT_ID
    if (!adminSecret || !tusdcId) {
      return NextResponse.json({ error: "Faucet not configured" }, { status: 503 })
    }

    const kp    = Keypair.fromSecret(adminSecret)
    const admin = kp.publicKey()

    const acctData = await server.getAccount(admin)
    const acct     = new Account(admin, acctData.sequenceNumber())

    const contract = new Contract(tusdcId)
    const tx = new TransactionBuilder(acct, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "admin_mint",
          nativeToScVal(wallet, { type: "address" }),
          nativeToScVal(FAUCET_AMOUNT, { type: "i128" }),
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
    return NextResponse.json({ success: true, hash, amount: 1000 })
  } catch (err) {
    console.error("[faucet] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Faucet error" },
      { status: 500 }
    )
  }
}
