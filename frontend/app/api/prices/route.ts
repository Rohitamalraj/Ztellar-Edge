import { NextResponse } from "next/server"

const SYMBOLS = ["AAPL", "TSLA", "NVDA"]
const CACHE_MS = 10_000
let cache: { data: Record<string, unknown>; at: number } | null = null

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  Accept: "application/json",
}

async function fetchQuote(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 10 } })
  if (!res.ok) throw new Error(`Yahoo Finance ${symbol}: ${res.status}`)
  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta
  if (!meta) throw new Error(`No meta for ${symbol}`)
  const price: number = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0
  const prev: number = meta.chartPreviousClose ?? meta.previousClose ?? price
  const change24h = prev > 0 ? ((price - prev) / prev) * 100 : 0
  return { price, change24h, prev, volume: meta.regularMarketVolume ?? 0 }
}

export async function GET() {
  // Serve from cache if fresh
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(cache.data)
  }

  try {
    const results = await Promise.allSettled(SYMBOLS.map(fetchQuote))
    const data: Record<string, unknown> = {}
    SYMBOLS.forEach((sym, i) => {
      const r = results[i]
      data[`s${sym}`] = r.status === "fulfilled"
        ? r.value
        : { price: 0, change24h: 0, prev: 0, volume: 0, error: true }
    })
    cache = { data, at: Date.now() }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch prices" },
      { status: 502 }
    )
  }
}
