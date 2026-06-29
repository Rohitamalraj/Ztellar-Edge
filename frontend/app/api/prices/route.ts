import { NextResponse } from "next/server"

// Strip "s" prefix to get real Yahoo Finance tickers
const SYMBOL_MAP: Record<string, string> = {
  sAAPL: "AAPL",
  sTSLA: "TSLA",
  sNVDA: "NVDA",
  sMSFT: "MSFT",
  sAMZN: "AMZN",
  sGOOG: "GOOG",
  sMETA: "META",
  sNFLX: "NFLX",
  sAMD:  "AMD",
  sJPM:  "JPM",
  sSPY:  "SPY",
  sPFE:  "PFE",
}

const CACHE_MS = 15_000
let cache: { data: Record<string, unknown>; at: number } | null = null

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  Accept: "application/json",
}

async function fetchQuote(yahooSymbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=2d`
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 15 } })
  if (!res.ok) throw new Error(`Yahoo Finance ${yahooSymbol}: ${res.status}`)
  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta
  if (!meta) throw new Error(`No meta for ${yahooSymbol}`)
  const price: number = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0
  const prev: number  = meta.chartPreviousClose ?? meta.previousClose ?? price
  const change24h = prev > 0 ? ((price - prev) / prev) * 100 : 0
  return { price, change24h, prev, volume: meta.regularMarketVolume ?? 0 }
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(cache.data)
  }

  const synthSymbols = Object.keys(SYMBOL_MAP)
  const results = await Promise.allSettled(
    synthSymbols.map((sym) => fetchQuote(SYMBOL_MAP[sym]))
  )

  const data: Record<string, unknown> = {}
  synthSymbols.forEach((sym, i) => {
    const r = results[i]
    data[sym] = r.status === "fulfilled"
      ? r.value
      : { price: 0, change24h: 0, prev: 0, volume: 0, error: true }
  })

  cache = { data, at: Date.now() }
  return NextResponse.json(data)
}
