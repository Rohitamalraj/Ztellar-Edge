"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { AssetSymbol } from "@/hooks/use-positions"
import type { AssetPrice } from "@/hooks/use-prices"
import type { Candle } from "@/app/api/candles/route"

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D", "1W"] as const
type Timeframe = (typeof TIMEFRAMES)[number]

interface CandlestickChartProps {
  asset: AssetSymbol
  priceData: AssetPrice
}

export function CandlestickChart({ asset, priceData }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<unknown>(null)
  const seriesRef = useRef<unknown>(null)
  const candlesRef = useRef<Candle[]>([])
  const [timeframe, setTimeframe] = useState<Timeframe>("1D")
  const [candles, setCandles] = useState<Candle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCandles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/candles?symbol=${asset}&timeframe=${timeframe}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const fetched = data.candles ?? []
      candlesRef.current = fetched
      setCandles(fetched)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chart data")
    } finally {
      setIsLoading(false)
    }
  }, [asset, timeframe])

  useEffect(() => { fetchCandles() }, [fetchCandles])

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return
    let destroyed = false

    import("lightweight-charts").then(({ createChart, ColorType, CandlestickSeries }) => {
      if (destroyed || !containerRef.current) return

      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#71717a",
        },
        grid: {
          vertLines: { color: "rgba(0,0,0,0.05)" },
          horzLines: { color: "rgba(0,0,0,0.05)" },
        },
        crosshair: { mode: 1 },
        rightPriceScale: {
          borderColor: "rgba(0,0,0,0.1)",
          textColor: "#71717a",
        },
        timeScale: {
          borderColor: "rgba(0,0,0,0.1)",
          timeVisible: true,
          secondsVisible: false,
        },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      })

      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#15803d",
        downColor: "#dc2626",
        borderUpColor: "#15803d",
        borderDownColor: "#dc2626",
        wickUpColor: "#15803d",
        wickDownColor: "#dc2626",
      })

      chartRef.current = chart
      seriesRef.current = series

      // Flush any candles that arrived before the chart finished initializing
      if (candlesRef.current.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        series.setData(candlesRef.current.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })) as any)
        chart.timeScale().fitContent()
      }

      const ro = new ResizeObserver(() => {
        if (containerRef.current && chart) {
          chart.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          })
        }
      })
      ro.observe(containerRef.current)

      return () => { ro.disconnect() }
    })

    return () => {
      destroyed = true
      if (chartRef.current) {
        (chartRef.current as { remove: () => void }).remove()
        chartRef.current = null
        seriesRef.current = null
      }
    }
  }, [])

  // Update series data when candles change
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return
    const series = seriesRef.current as {
      setData: (d: unknown[]) => void
      update: (d: unknown) => void
    }
    const formatted = candles.map((c) => ({
      time: c.time as unknown,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    series.setData(formatted)
    ;(chartRef.current as { timeScale: () => { fitContent: () => void } })
      ?.timeScale()
      ?.fitContent()
  }, [candles])

  // Push latest price as last candle update
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return
    const last = candles[candles.length - 1]
    const series = seriesRef.current as { update: (d: unknown) => void }
    series.update({
      time: last.time as unknown,
      open: last.open,
      high: Math.max(last.high, priceData.price),
      low: Math.min(last.low, priceData.price),
      close: priceData.price,
    })
  }, [priceData.price, candles])

  const isPositive = priceData.change24h >= 0

  return (
    <div className="h-full border border-foreground/10 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-foreground/10 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-medium">{asset}</span>
          <span className="font-mono text-lg font-semibold">${priceData.price.toFixed(2)}</span>
          <span className={`font-mono text-xs ${isPositive ? "text-green-700" : "text-red-600"}`}>
            {isPositive ? "+" : ""}{priceData.change24h.toFixed(2)}%
          </span>
        </div>
        {/* Timeframe tabs */}
        <div className="flex items-center gap-px">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`font-mono text-[10px] px-2 py-1 transition-colors ${
                timeframe === tf
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/60">
            <span className="font-mono text-xs text-muted-foreground animate-pulse">Loading chart…</span>
          </div>
        )}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="font-mono text-xs text-muted-foreground">
              Chart unavailable · {error}
            </span>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>

      <div className="px-4 py-2 border-t border-foreground/10 flex items-center justify-between shrink-0">
        <p className="font-mono text-[10px] text-muted-foreground">Yahoo Finance · 10s delayed</p>
        {priceData.volume > 0 && (
          <p className="font-mono text-[10px] text-muted-foreground">
            Vol {(priceData.volume / 1_000_000).toFixed(1)}M
          </p>
        )}
      </div>
    </div>
  )
}
