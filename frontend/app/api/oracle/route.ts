import { NextResponse } from "next/server"
import {
  rpc,
  Keypair,
  Contract,
  Account,
  TransactionBuilder,
  Networks,
  xdr,
  nativeToScVal,
  BASE_FEE,
} from "@stellar/stellar-sdk"

const RPC_URL = "https://soroban-testnet.stellar.org"
const NETWORK_PASSPHRASE = Networks.TESTNET

// Asset order must match vault constants (ASSET_AAPL=0 … ASSET_PFE=11)
const TICKERS = ["AAPL","TSLA","NVDA","MSFT","AMZN","GOOG","META","NFLX","AMD","JPM","SPY","PFE"]
const SYNTH   = ["sAAPL","sTSLA","sNVDA","sMSFT","sAMZN","sGOOG","sMETA","sNFLX","sAMD","sJPM","sSPY","sPFE"]

async function fetchPrice(ticker: string): Promise<number | null> {
  try {
    const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    })
    if (!resp.ok) return null
    const data  = await resp.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } }
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    return price && price > 0 ? price : null
  } catch {
    return null
  }
}

const server = new rpc.Server(RPC_URL, { allowHttp: false })

async function sendAndWait(tx: Parameters<typeof server.sendTransaction>[0]) {
  const submit = await server.sendTransaction(tx)
  if (submit.status === "ERROR") throw new Error("Oracle TX error: " + JSON.stringify(submit.errorResult))
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const s = await server.getTransaction(submit.hash)
    if (s.status === rpc.Api.GetTransactionStatus.SUCCESS) return submit.hash
    if (s.status === rpc.Api.GetTransactionStatus.FAILED)  throw new Error("Oracle TX failed on-chain")
  }
  throw new Error("Oracle TX timed out")
}

export async function POST() {
  try {
    const adminSecret = process.env.ADMIN_SECRET
    const vaultId     = process.env.NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID
    if (!adminSecret || !vaultId) {
      return NextResponse.json({ error: "Oracle not configured" }, { status: 503 })
    }

    // Fetch all 12 prices in parallel
    const fetched = await Promise.all(TICKERS.map(fetchPrice))

    // Build prices map for response
    const priceMap: Record<string, number> = {}
    fetched.forEach((p, i) => { if (p) priceMap[SYNTH[i]] = p })

    // Build ScVal Vec<i128>
    const priceMicros = fetched.map((p) =>
      nativeToScVal(p !== null ? BigInt(Math.round(p * 1_000_000)) : 0n, { type: "i128" })
    )
    const pricesVec = xdr.ScVal.scvVec(priceMicros)

    const kp    = Keypair.fromSecret(adminSecret)
    const admin = kp.publicKey()

    const acctData = await server.getAccount(admin)
    const acct     = new Account(admin, acctData.sequenceNumber())

    const vault = new Contract(vaultId)
    const tx = new TransactionBuilder(acct, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(vault.call("set_prices", pricesVec))
      .setTimeout(180)
      .build()

    const sim = await server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) throw new Error("Oracle sim error: " + sim.error)

    const prepared = rpc.assembleTransaction(tx, sim).build()
    prepared.sign(kp)

    const hash = await sendAndWait(prepared as Parameters<typeof server.sendTransaction>[0])
    return NextResponse.json({ success: true, hash, prices: priceMap, updatedAt: Date.now() })
  } catch (err) {
    console.error("[oracle] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Oracle error" },
      { status: 500 }
    )
  }
}

// GET returns just the current Yahoo prices without pushing on-chain
export async function GET() {
  const fetched = await Promise.all(TICKERS.map(fetchPrice))
  const priceMap: Record<string, number> = {}
  fetched.forEach((p, i) => { if (p) priceMap[SYNTH[i]] = p })
  return NextResponse.json({ prices: priceMap, updatedAt: Date.now() })
}
