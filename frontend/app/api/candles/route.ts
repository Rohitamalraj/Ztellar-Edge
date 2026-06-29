import { NextResponse } from "next/server"

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  Accept: "application/json",
}

const INTERVAL_MAP: Record<string, { interval: string; range: string }> = {
  "1m":  { interval: "1m",  range: "1d"  },
  "5m":  { interval: "5m",  range: "5d"  },
  "15m": { interval: "15m", range: "1mo" },
  "1h":  { interval: "60m", range: "1mo" },
  "4h":  { interval: "60m", range: "3mo" },
  "1D":  { interval: "1d",  range: "1y"  },
  "1W":  { interval: "1wk", range: "5y"  },
}

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rawSymbol = searchParams.get("symbol") ?? "sAAPL"
  const timeframe = searchParams.get("timeframe") ?? "1D"

  // Strip 's' prefix: sAAPL → AAPL
  const symbol = rawSymbol.startsWith("s") ? rawSymbol.slice(1) : rawSymbol
  const { interval, range } = INTERVAL_MAP[timeframe] ?? INTERVAL_MAP["1D"]

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) throw new Error(`Yahoo Finance ${symbol}: ${res.status}`)
    const json = await res.json()

    const result = json?.chart?.result?.[0]
    if (!result) throw new Error("No result data")

    const timestamps: number[] = result.timestamp ?? []
    const quote = result.indicators?.quote?.[0] ?? {}
    const opens: number[] = quote.open ?? []
    const highs: number[] = quote.high ?? []
    const lows: number[] = quote.low ?? []
    const closes: number[] = quote.close ?? []
    const volumes: number[] = quote.volume ?? []

    const candles: Candle[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const o = opens[i], h = highs[i], l = lows[i], c = closes[i]
      if (o == null || h == null || l == null || c == null) continue
      candles.push({
        time: timestamps[i],
        open: o,
        high: h,
        low: l,
        close: c,
        volume: volumes[i] ?? 0,
      })
    }

    return NextResponse.json({ symbol, timeframe, candles })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch candles" },
      { status: 502 }
    )
  }
}
