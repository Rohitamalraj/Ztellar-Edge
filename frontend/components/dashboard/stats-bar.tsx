"use client"

import { type Position, calcPnl } from "@/hooks/use-positions"
import { type Prices } from "@/hooks/use-prices"
import { marketStatusLabel } from "@/lib/market-hours"
import { TokenLogo } from "@/components/ui/token-logo"

interface StatsBarProps {
  positions: Position[]
  prices: Prices
  selectedAsset?: string
}

export function StatsBar({ positions, prices, selectedAsset = "sAAPL" }: StatsBarProps) {
  const totalCollateral = positions.reduce((s, p) => s + p.collateralUSDC, 0)
  const totalPnl = positions.reduce(
    (s, p) => s + calcPnl(p, prices[p.asset as keyof typeof prices]?.price ?? p.entryPrice),
    0
  )
  const isProfitable = totalPnl >= 0
  const status = marketStatusLabel()
  const isOpen = status === "Open"
  const assetPrice = prices[selectedAsset as keyof typeof prices]

  return (
    <div className="flex items-center gap-0 px-0 border-b border-foreground/10 bg-background overflow-x-auto scrollbar-hide">
      {/* Selected asset ticker */}
      {assetPrice && (
        <div className="flex items-center gap-3 px-5 py-3 border-r border-foreground/10 shrink-0">
          <TokenLogo symbol={selectedAsset} size={22} />
          <div>
            <div className="font-mono text-xs font-semibold">${assetPrice.price.toFixed(2)}</div>
            <div
              className={`font-mono text-[10px] ${
                assetPrice.change24h >= 0 ? "text-green-700" : "text-red-600"
              }`}
            >
              {assetPrice.change24h >= 0 ? "+" : ""}{assetPrice.change24h.toFixed(2)}% 24h
            </div>
          </div>
        </div>
      )}

      {/* Stat cells */}
      <div className="flex items-center divide-x divide-foreground/10">
        {[
          {
            label: "Market",
            value: status,
            color: isOpen ? "text-green-700" : "text-muted-foreground",
          },
          { label: "Positions", value: String(positions.length) },
          {
            label: "Collateral",
            value: `$${totalCollateral.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
          },
          {
            label: "Unrealized P&L",
            value: `${isProfitable ? "+" : ""}$${Math.abs(totalPnl).toFixed(2)}`,
            color: isProfitable ? "text-green-700" : "text-red-600",
          },
          {
            label: "Volume",
            value: assetPrice?.volume
              ? `${(assetPrice.volume / 1_000_000).toFixed(1)}M`
              : "—",
          },
          { label: "Network", value: "Stellar Testnet" },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-4 py-3 shrink-0">
            <div className="font-mono text-[10px] text-muted-foreground mb-0.5">{label}</div>
            <div className={`font-mono text-xs font-medium ${color ?? ""}`}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
