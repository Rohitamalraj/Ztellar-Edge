"use client"

import { useEffect, useState } from "react"

interface TickerItem {
  symbol: string
  price: number
  change: number
}

const TICKER_SYMBOLS = [
  "sAAPL", "sTSLA", "sNVDA", "sMSFT", "sAMZN",
  "sGOOG", "sMETA", "sNFLX", "sAMD",  "sJPM",
]

const SEED: TickerItem[] = [
  { symbol: "sAAPL", price: 211.45, change:  1.24 },
  { symbol: "sTSLA", price: 248.12, change: -2.87 },
  { symbol: "sNVDA", price: 135.80, change:  3.15 },
  { symbol: "sMSFT", price: 452.86, change: -0.69 },
  { symbol: "sAMZN", price: 215.45, change:  0.83 },
  { symbol: "sGOOG", price: 185.37, change:  0.50 },
  { symbol: "sMETA", price: 681.42, change:  1.40 },
  { symbol: "sNFLX", price: 1291.5, change: -1.35 },
  { symbol: "sAMD",  price: 172.18, change: -2.33 },
  { symbol: "sJPM",  price: 272.90, change:  1.58 },
]

export function PriceTicker() {
  const [items, setItems] = useState<TickerItem[]>([...SEED, ...SEED])

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch("/api/prices")
        const data = await res.json()
        const updated: TickerItem[] = TICKER_SYMBOLS.map((sym) => ({
          symbol: sym,
          price: data[sym]?.price ?? SEED.find((s) => s.symbol === sym)?.price ?? 0,
          change: data[sym]?.change24h ?? 0,
        }))
        setItems([...updated, ...updated])
      } catch {
        // keep seed
      }
    }
    fetchPrices()
    const id = setInterval(fetchPrices, 15_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="border-y border-foreground/10 overflow-hidden bg-background/60 backdrop-blur-sm">
      <div className="flex items-center marquee whitespace-nowrap" style={{ width: "max-content" }}>
        {items.map((item, i) => (
          <div key={i} className="inline-flex items-center gap-3 px-8 py-2.5 border-r border-foreground/5">
            <span className="font-mono text-xs font-semibold">{item.symbol}</span>
            <span className="font-mono text-xs">
              ${item.price >= 1000
                ? item.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : item.price.toFixed(2)}
            </span>
            <span className={`font-mono text-[10px] ${item.change >= 0 ? "text-green-700" : "text-red-600"}`}>
              {item.change >= 0 ? "▲" : "▼"} {Math.abs(item.change).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
