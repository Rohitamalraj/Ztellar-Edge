"use client"

import { useState, useMemo } from "react"
import { TrendingUp, TrendingDown, Search, Star } from "lucide-react"
import type { AssetSymbol } from "@/hooks/use-positions"
import type { Prices } from "@/hooks/use-prices"
import { TokenLogo } from "@/components/ui/token-logo"
import { marketStatusLabel } from "@/lib/market-hours"

export interface AssetMeta {
  symbol: AssetSymbol
  name: string
  category: string
  tradable: boolean // false = display only (contract not yet deployed)
}

export const ASSET_META: AssetMeta[] = [
  { symbol: "sAAPL", name: "Apple Inc.",              category: "Technology", tradable: true },
  { symbol: "sTSLA", name: "Tesla Inc.",              category: "Technology", tradable: true },
  { symbol: "sNVDA", name: "NVIDIA Corp.",            category: "Technology", tradable: true },
  { symbol: "sMSFT", name: "Microsoft Corp.",         category: "Technology", tradable: true },
  { symbol: "sAMZN", name: "Amazon.com Inc.",         category: "Consumer",   tradable: true },
  { symbol: "sGOOG", name: "Alphabet Inc.",           category: "Technology", tradable: true },
  { symbol: "sMETA", name: "Meta Platforms",          category: "Technology", tradable: true },
  { symbol: "sNFLX", name: "Netflix Inc.",            category: "Consumer",   tradable: true },
  { symbol: "sAMD",  name: "Advanced Micro Devices", category: "Technology", tradable: true },
  { symbol: "sJPM",  name: "JPMorgan Chase & Co.",   category: "Financials", tradable: true },
  { symbol: "sSPY",  name: "S&P 500 ETF",            category: "ETF",        tradable: true },
  { symbol: "sPFE",  name: "Pfizer Inc.",             category: "Healthcare", tradable: true },
]

interface MarketsPanelProps {
  selected: AssetSymbol
  onSelect: (asset: AssetSymbol) => void
  prices: Prices
  favorites: Set<AssetSymbol>
  onToggleFavorite: (sym: AssetSymbol) => void
}

export function MarketsPanel({ selected, onSelect, prices, favorites, onToggleFavorite }: MarketsPanelProps) {
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"all" | "favorites">("all")
  const status = marketStatusLabel()
  const isOpen = status === "Open"

  const filtered = useMemo(() => {
    let list = ASSET_META
    if (tab === "favorites") list = list.filter((a) => favorites.has(a.symbol))
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((a) =>
        a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
      )
    }
    return list
  }, [tab, search, favorites])

  return (
    <div className="h-full border border-foreground/10 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-foreground/10 flex items-center justify-between shrink-0">
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
      <div className="px-3 py-2 border-b border-foreground/5 shrink-0">
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

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-px bg-foreground/10 shrink-0">
        {(["all", "favorites"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 font-mono text-xs transition-colors ${
              tab === t
                ? "bg-foreground text-background"
                : "bg-background text-muted-foreground hover:bg-foreground/[0.02]"
            }`}
          >
            {t === "all" ? "All Markets" : "Favorites"}
          </button>
        ))}
      </div>

      {/* Column labels */}
      <div className="grid grid-cols-[20px_1fr_auto_auto] gap-2 px-4 py-1.5 border-b border-foreground/10 shrink-0">
        <div />
        <div className="font-mono text-[10px] text-muted-foreground">MARKET</div>
        <div className="font-mono text-[10px] text-muted-foreground text-right">PRICE</div>
        <div className="font-mono text-[10px] text-muted-foreground text-right w-14">24H %</div>
      </div>

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="font-mono text-xs text-muted-foreground">
              {tab === "favorites" ? "No favorites yet" : "No results"}
            </span>
          </div>
        ) : (
          filtered.map(({ symbol, name, tradable }) => {
            const { price, change24h } = prices[symbol]
            const isPositive = change24h >= 0
            const isSelected = symbol === selected

            return (
              <button
                key={symbol}
                onClick={() => onSelect(symbol)}
                className={`w-full grid grid-cols-[20px_1fr_auto_auto] gap-2 items-center px-4 py-3 border-b border-foreground/5 hover:bg-foreground/[0.02] transition-colors text-left ${
                  isSelected ? "bg-foreground/[0.04]" : ""
                }`}
              >
                {/* Star — div not button to avoid nested-button HTML violation */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(symbol) }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      e.stopPropagation()
                      onToggleFavorite(symbol)
                    }
                  }}
                  className="flex items-center justify-center"
                >
                  <Star
                    className={`w-3.5 h-3.5 transition-colors ${
                      favorites.has(symbol) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/40 hover:text-muted-foreground"
                    }`}
                  />
                </div>

                {/* Name + logo */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <TokenLogo symbol={symbol} size={26} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-medium">{symbol}</span>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />}
                      </div>
                    <div className="font-mono text-[10px] text-muted-foreground truncate">{name}</div>
                  </div>
                </div>

                {/* Price */}
                <div className="font-mono text-xs font-medium text-right">
                  ${price >= 1000
                    ? price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : price.toFixed(2)}
                </div>

                {/* Change */}
                <div
                  className={`flex items-center justify-end gap-0.5 font-mono text-[10px] w-14 ${
                    isPositive ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {isPositive ? <TrendingUp className="w-2.5 h-2.5 shrink-0" /> : <TrendingDown className="w-2.5 h-2.5 shrink-0" />}
                  {isPositive ? "+" : ""}{change24h.toFixed(2)}%
                </div>
              </button>
            )
          })
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-foreground/10 shrink-0">
        <p className="font-mono text-[10px] text-muted-foreground">Yahoo Finance · NYSE/NASDAQ</p>
      </div>
    </div>
  )
}
