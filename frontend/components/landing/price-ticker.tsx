"use client"

import { useEffect, useState } from "react"

interface TickerItem {
  symbol: string
  price: number
  change: number
}

const SEED: TickerItem[] = [
  { symbol: "sAAPL", price: 192.35, change: 1.24 },
  { symbol: "sTSLA", price: 248.12, change: -2.87 },
  { symbol: "sNVDA", price: 875.44, change: 3.15 },
  { symbol: "sAAPL", price: 192.35, change: 1.24 },
  { symbol: "sTSLA", price: 248.12, change: -2.87 },
  { symbol: "sNVDA", price: 875.44, change: 3.15 },
]

export function PriceTicker() {
  const [items, setItems] = useState<TickerItem[]>(SEED)

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch("/api/prices")
        const data = await res.json()
        const updated: TickerItem[] = [
          { symbol: "sAAPL", price: data.sAAPL?.price ?? 192.35, change: data.sAAPL?.change24h ?? 0 },
          { symbol: "sTSLA", price: data.sTSLA?.price ?? 248.12, change: data.sTSLA?.change24h ?? 0 },
          { symbol: "sNVDA", price: data.sNVDA?.price ?? 875.44, change: data.sNVDA?.change24h ?? 0 },
        ]
        // duplicate for infinite scroll
        setItems([...updated, ...updated, ...updated])
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
            <span className="font-mono text-xs">${item.price.toFixed(2)}</span>
            <span className={`font-mono text-[10px] ${item.change >= 0 ? "text-green-700" : "text-red-600"}`}>
              {item.change >= 0 ? "▲" : "▼"} {Math.abs(item.change).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
