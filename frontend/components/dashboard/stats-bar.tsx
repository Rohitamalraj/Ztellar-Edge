"use client"

import { type Position, calcPnl } from "@/hooks/use-positions"
import { MOCK_ASSETS } from "./markets-panel"

interface StatsBarProps {
  positions: Position[]
}

export function StatsBar({ positions }: StatsBarProps) {
  const PRICE_MAP: Record<string, number> = Object.fromEntries(
    MOCK_ASSETS.map((a) => [a.symbol, a.price]),
  )

  const totalCollateral = positions.reduce((s, p) => s + p.collateralUSDC, 0)
  const totalPnl = positions.reduce((s, p) => s + calcPnl(p, PRICE_MAP[p.asset] ?? p.entryPrice), 0)
  const isProfitable = totalPnl >= 0

  return (
    <div className="flex items-center gap-6 px-6 py-3 border-b border-foreground/10 bg-background/60 backdrop-blur-sm overflow-x-auto scrollbar-hide">
      {[
        { label: "Positions", value: String(positions.length) },
        { label: "Collateral", value: `$${totalCollateral.toLocaleString("en-US", { maximumFractionDigits: 2 })}` },
        {
          label: "Unrealized P&L",
          value: `${isProfitable ? "+" : ""}$${Math.abs(totalPnl).toFixed(2)}`,
          color: isProfitable ? "text-green-700" : "text-red-600",
        },
        { label: "Network", value: "Stellar Testnet" },
        { label: "Oracle", value: "Reflector Network" },
      ].map(({ label, value, color }) => (
        <div key={label} className="shrink-0">
          <div className="font-mono text-[10px] text-muted-foreground mb-0.5">{label}</div>
          <div className={`font-mono text-xs font-medium ${color ?? ""}`}>{value}</div>
        </div>
      ))}
    </div>
  )
}
