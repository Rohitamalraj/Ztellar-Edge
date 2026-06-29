"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown, Search } from "lucide-react"
import type { AssetSymbol } from "@/hooks/use-positions"
import type { Prices } from "@/hooks/use-prices"
import { TokenLogo } from "@/components/ui/token-logo"
import { marketStatusLabel } from "@/lib/market-hours"

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
  const [search, setSearch] = useState("")
  const status = marketStatusLabel()
  const isOpen = status === "Open"

  const filtered = ASSET_META.filter(
    ({ symbol, name }) =>
      search === "" ||
      symbol.toLowerCase().includes(search.toLowerCase()) ||
      name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full border border-foreground/10 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-foreground/10 flex items-center justify-between">
        <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Markets</h2>
        <span
          className={`font-mono text-[10px] px-1.5 py-0.5 border ${
            isOpen
              ? "border-green-700/30 text-green-700 bg-green-700/5"
              : "border-foreground/20 text-muted-foreground"
          }`}
        >
          {status}
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-foreground/5">
        <div className="flex items-center gap-2 border border-foreground/10 px-2 py-1.5">
          <Search className="w-3 h-3 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/50 min-w-0"
          />
        </div>
      </div>

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="font-mono text-xs text-muted-foreground">No results</span>
          </div>
        ) : (
          filtered.map(({ symbol, name }) => {
            const { price, change24h, prev } = prices[symbol]
            const isPositive = change24h >= 0
            const isSelected = symbol === selected
            const flash = price > prev
              ? "text-green-700"
              : price < prev
              ? "text-red-600"
              : "text-foreground"

            return (
              <button
                key={symbol}
                onClick={() => onSelect(symbol)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-foreground/5 hover:bg-foreground/[0.02] transition-colors text-left ${
                  isSelected ? "bg-foreground/[0.04]" : ""
                }`}
              >
                <TokenLogo symbol={symbol} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-medium">{symbol}</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-foreground" />}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate">{name}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-mono text-sm font-medium transition-colors duration-200 ${flash}`}>
                    ${price.toFixed(2)}
                  </div>
                  <div
                    className={`flex items-center justify-end gap-0.5 font-mono text-[10px] mt-0.5 ${
                      isPositive ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {isPositive ? "+" : ""}{change24h.toFixed(2)}%
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-foreground/10">
        <p className="font-mono text-[10px] text-muted-foreground">Yahoo Finance · NYSE</p>
      </div>
    </div>
  )
}

export { ASSET_META }
