"use client"

import { TrendingUp, TrendingDown } from "lucide-react"
import type { AssetSymbol } from "@/hooks/use-positions"
import type { Prices } from "@/hooks/use-prices"

const ASSET_META: { symbol: AssetSymbol; name: string }[] = [
  { symbol: "sAAPL", name: "Apple Inc." },
  { symbol: "sTSLA", name: "Tesla Inc." },
  { symbol: "sNVDA", name: "NVIDIA Corp." },
]

interface MarketsPanelProps {
  selected: AssetSymbol
  onSelect: (asset: AssetSymbol) => void
  prices: Prices
}

export function MarketsPanel({ selected, onSelect, prices }: MarketsPanelProps) {
  return (
    <div className="h-full border border-foreground/10 flex flex-col">
      <div className="px-4 py-3 border-b border-foreground/10">
        <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Markets</h2>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {ASSET_META.map(({ symbol, name }) => {
          const { price, change24h, prev } = prices[symbol]
          const isPositive = change24h >= 0
          const isSelected = symbol === selected
          const flash = price > prev ? "text-green-700" : price < prev ? "text-red-600" : ""

          return (
            <button
              key={symbol}
              onClick={() => onSelect(symbol)}
              className={`w-full flex items-center justify-between px-4 py-4 border-b border-foreground/5 hover:bg-foreground/[0.02] transition-colors text-left ${
                isSelected ? "bg-foreground/[0.03]" : ""
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{symbol}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-foreground" />}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{name}</div>
              </div>
              <div className="text-right">
                <div className={`font-mono text-sm transition-colors duration-300 ${flash}`}>
                  ${price.toFixed(2)}
                </div>
                <div
                  className={`flex items-center justify-end gap-0.5 text-xs font-mono mt-0.5 ${
                    isPositive ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isPositive ? "+" : ""}
                  {change24h.toFixed(2)}%
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="px-4 py-3 border-t border-foreground/10">
        <p className="font-mono text-[10px] text-muted-foreground">Prices via Synth Vault · Testnet</p>
      </div>
    </div>
  )
}

export { ASSET_META }
