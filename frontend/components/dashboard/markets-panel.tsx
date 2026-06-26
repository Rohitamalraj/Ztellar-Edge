"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import type { AssetSymbol } from "@/hooks/use-positions"

interface MarketAsset {
  symbol: AssetSymbol
  name: string
  price: number
  change24h: number
}

const MOCK_ASSETS: MarketAsset[] = [
  { symbol: "sAAPL", name: "Apple Inc.", price: 192.35, change24h: 1.24 },
  { symbol: "sTSLA", name: "Tesla Inc.", price: 248.12, change24h: -2.87 },
  { symbol: "sNVDA", name: "NVIDIA Corp.", price: 875.44, change24h: 3.15 },
]

interface MarketsPanelProps {
  selected: AssetSymbol
  onSelect: (asset: AssetSymbol) => void
}

export function MarketsPanel({ selected, onSelect }: MarketsPanelProps) {
  return (
    <div className="h-full border border-foreground/10 flex flex-col">
      <div className="px-4 py-3 border-b border-foreground/10">
        <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Markets</h2>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {MOCK_ASSETS.map((asset) => {
          const isPositive = asset.change24h >= 0
          const isSelected = asset.symbol === selected
          return (
            <button
              key={asset.symbol}
              onClick={() => onSelect(asset.symbol)}
              className={`w-full flex items-center justify-between px-4 py-4 border-b border-foreground/5 hover:bg-foreground/[0.02] transition-colors text-left ${
                isSelected ? "bg-foreground/[0.03]" : ""
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{asset.symbol}</span>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{asset.name}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">${asset.price.toFixed(2)}</div>
                <div className={`flex items-center justify-end gap-0.5 text-xs font-mono mt-0.5 ${isPositive ? "text-green-700" : "text-red-600"}`}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isPositive ? "+" : ""}{asset.change24h.toFixed(2)}%
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="px-4 py-3 border-t border-foreground/10">
        <p className="font-mono text-[10px] text-muted-foreground">Prices via Reflector Oracle · Testnet</p>
      </div>
    </div>
  )
}

export { MOCK_ASSETS }
