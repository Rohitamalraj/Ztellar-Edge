"use client"

import { useState } from "react"
import { X, TrendingUp, TrendingDown } from "lucide-react"
import { type Position, calcPnl, calcHealthFactor } from "@/hooks/use-positions"

interface PositionCardProps {
  position: Position
  currentPrice: number
  onClose: (id: string) => void
}

export function PositionCard({ position, currentPrice, onClose }: PositionCardProps) {
  const [confirming, setConfirming] = useState(false)

  const pnl = calcPnl(position, currentPrice)
  const health = calcHealthFactor(position, currentPrice)
  const pnlPercent = (pnl / position.collateralUSDC) * 100
  const isProfit = pnl >= 0
  const isLong = position.direction === "LONG"
  const healthColor = health > 0.15 ? "text-green-700" : health > 0.08 ? "text-yellow-600" : "text-red-600"
  const healthBg = health > 0.15 ? "bg-green-600" : health > 0.08 ? "bg-yellow-500" : "bg-red-500"

  const elapsed = Math.floor((Date.now() - position.openedAt.getTime()) / 1000)
  const timeStr = elapsed < 60 ? `${elapsed}s` : elapsed < 3600 ? `${Math.floor(elapsed / 60)}m` : `${Math.floor(elapsed / 3600)}h`

  return (
    <div className="border border-foreground/10 hover:border-foreground/20 transition-colors group">
      {/* Header */}
      <div className="px-5 py-3 border-b border-foreground/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-medium">{position.asset}</span>
          <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 border ${
            isLong ? "border-green-700/30 text-green-700 bg-green-700/5" : "border-red-600/30 text-red-600 bg-red-600/5"
          }`}>
            {isLong ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {position.direction}
          </span>
          <span className="text-xs font-mono text-muted-foreground">{position.leverage}x</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground">{timeStr} ago</span>
          {confirming ? (
            <div className="flex items-center gap-2">
              <button onClick={() => onClose(position.id)} className="text-xs font-mono text-red-600 hover:text-red-700 transition-colors">
                Confirm close
              </button>
              <button onClick={() => setConfirming(false)} className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground"
              aria-label="Close position"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body grid */}
      <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Entry", value: `$${position.entryPrice.toFixed(2)}` },
          { label: "Current", value: `$${currentPrice.toFixed(2)}` },
          { label: "Collateral", value: `$${position.collateralUSDC.toLocaleString()}` },
          {
            label: "P&L",
            value: `${isProfit ? "+" : ""}$${Math.abs(pnl).toFixed(2)}`,
            sub: `(${isProfit ? "+" : ""}${pnlPercent.toFixed(1)}%)`,
            color: isProfit ? "text-green-700" : "text-red-600",
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label}>
            <div className="font-mono text-xs text-muted-foreground mb-1">{label}</div>
            <div className={`font-mono text-sm font-medium ${color ?? ""}`}>
              {value}
              {sub && <span className="text-xs ml-1 opacity-70">{sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Health bar */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-xs text-muted-foreground">Health factor</span>
          <span className={`font-mono text-xs ${healthColor}`}>{(health * 100).toFixed(1)}%</span>
        </div>
        <div className="h-px bg-foreground/10">
          <div
            className={`h-full transition-all duration-500 ${healthBg}`}
            style={{ width: `${Math.min(Math.max(health * 100, 0), 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
