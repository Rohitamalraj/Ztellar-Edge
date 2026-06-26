/**
 * Wallet scoring oracle — reads public Stellar Horizon data and
 * computes a risk score [0, 100] that determines the user's ZK tier.
 *
 * Scoring factors (all public, on-chain data only):
 *   - Account age / ledger longevity                     (0-25 pts)
 *   - Transaction volume (capped at 500 txs)             (0-25 pts)
 *   - Balance diversity (number of trustlines)           (0-25 pts)
 *   - Recent activity (txs in last 30 days approximated) (0-25 pts)
 */

import { NextRequest, NextResponse } from "next/server"

const HORIZON_URL = "https://horizon-testnet.stellar.org"

interface HorizonAccount {
  id: string
  sequence: string
  num_subentries: number
  last_modified_ledger: number
  thresholds: { low_threshold: number; med_threshold: number; high_threshold: number }
  balances: Array<{ asset_type: string; balance: string; asset_code?: string }>
}

interface HorizonTxPage {
  _embedded: {
    records: Array<{ created_at: string; successful: boolean }>
  }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")
  if (!address || !/^G[A-Z2-7]{55}$/.test(address)) {
    return NextResponse.json({ error: "Invalid Stellar address" }, { status: 400 })
  }

  try {
    // Fetch account data
    const accountRes = await fetch(`${HORIZON_URL}/accounts/${address}`, {
      next: { revalidate: 60 },
    })
    if (!accountRes.ok) {
      if (accountRes.status === 404) {
        return NextResponse.json({ score: 0, tier: 1, reason: "Account not found on testnet" })
      }
      throw new Error(`Horizon error: ${accountRes.status}`)
    }
    const account: HorizonAccount = await accountRes.json()

    // Fetch recent transactions (up to 200)
    const txRes = await fetch(
      `${HORIZON_URL}/accounts/${address}/transactions?order=desc&limit=200`,
      { next: { revalidate: 60 } }
    )
    const txData: HorizonTxPage = txRes.ok ? await txRes.json() : { _embedded: { records: [] } }
    const txs = txData._embedded.records.filter((t) => t.successful)

    // ── Scoring ────────────────────────────────────────────────────────────
    let score = 0

    // 1. Account longevity (sequence number as proxy for ledger age)
    // Testnet: current ledger ~55M; sequence starts at (creation_ledger << 32)
    const seq = BigInt(account.sequence)
    const creationLedger = Number(seq >> 32n)
    // Rough current ledger estimate (testnet)
    const APPROX_CURRENT_LEDGER = 55_000_000
    const ageInLedgers = Math.max(0, APPROX_CURRENT_LEDGER - creationLedger)
    // ~1 ledger per 5 seconds, 30 days = 518400 ledgers
    const ageDays = ageInLedgers / (86400 / 5)
    score += Math.min(25, Math.floor(ageDays / 30) * 5) // 5 pts per month, max 25

    // 2. Transaction volume
    const txCount = txs.length
    score += Math.min(25, Math.floor((txCount / 500) * 25))

    // 3. Balance diversity (trustlines)
    const trustlines = account.balances.filter((b) => b.asset_type !== "native").length
    score += Math.min(25, trustlines * 5)

    // 4. Recent activity (txs in the records with last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const recentTxCount = txs.filter(
      (t) => new Date(t.created_at).getTime() > thirtyDaysAgo
    ).length
    score += Math.min(25, Math.floor((recentTxCount / 50) * 25))

    score = Math.min(100, Math.max(0, score))

    const tier: 1 | 2 | 3 | 4 =
      score >= 75 ? 4 : score >= 50 ? 3 : score >= 25 ? 2 : 1

    return NextResponse.json({
      score,
      tier,
      breakdown: {
        longevity: Math.min(25, Math.floor(ageDays / 30) * 5),
        volume: Math.min(25, Math.floor((txCount / 500) * 25)),
        diversity: Math.min(25, trustlines * 5),
        activity: Math.min(25, Math.floor((recentTxCount / 50) * 25)),
      },
      meta: {
        txCount,
        trustlines,
        recentTxCount,
        ageDays: Math.round(ageDays),
      },
    })
  } catch (err) {
    console.error("[score oracle]", err)
    return NextResponse.json({ error: "Failed to score wallet" }, { status: 500 })
  }
}
