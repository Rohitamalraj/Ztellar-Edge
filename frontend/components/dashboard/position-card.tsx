"use client"

import { useState } from "react"
import { Loader2, TrendingUp, TrendingDown } from "lucide-react"
import { type Position, calcPnl, calcHealthFactor } from "@/hooks/use-positions"
import { Button } from "@/components/ui/button"

interface PositionCardProps {
  position: Position
  currentPrice: number
  onClose: (id: string) => void
}

export function PositionCard({ position, currentPrice, onClose }: PositionCardProps) {
  const [closing, setClosing] = useState(false)

  const pnl        = calcPnl(position, currentPrice)
  const health     = calcHealthFactor(position, currentPrice)
  const pnlPercent = (pnl / position.collateralUSDC) * 100
  const isProfit   = pnl >= 0
  const isLong     = position.direction === "LONG"

  const healthColor = health > 0.15 ? "text-green-700" : health > 0.08 ? "text-yellow-600" : "text-red-600"
  const healthBg    = health > 0.15 ? "bg-green-600"  : health > 0.08 ? "bg-yellow-500"   : "bg-red-500"

  const elapsed = Math.floor((Date.now() - position.openedAt.getTime()) / 1000)
  const timeStr = elapsed < 60 ? `${elapsed}s` : elapsed < 3600 ? `${Math.floor(elapsed / 60)}m` : `${Math.floor(elapsed / 3600)}h`

  const handleClose = async () => {
    setClosing(true)
    try {
      await onClose(position.id)
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="border-b border-foreground/10 last:border-b-0">
      {/* Header */}
      <div className="px-5 py-3 border-b border-foreground/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-medium">{position.asset}</span>
          <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 border ${
            isLong
              ? "border-green-700/30 text-green-700 bg-green-700/5"
              : "border-red-600/30 text-red-600 bg-red-600/5"
          }`}>
            {isLong ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {position.direction}
          </span>
          <span className="text-xs font-mono text-muted-foreground">{position.leverage}x</span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">{timeStr} ago</span>
      </div>

      {/* Stats grid */}
      <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Entry",      value: `$${position.entryPrice.toFixed(2)}` },
          { label: "Current",    value: `$${currentPrice.toFixed(2)}` },
          { label: "Collateral", value: `$${position.collateralUSDC.toLocaleString()}` },
          {
            label: "P&L",
            value: `${isProfit ? "+" : ""}$${Math.abs(pnl).toFixed(2)}`,
            sub:   `(${isProfit ? "+" : ""}${pnlPercent.toFixed(1)}%)`,
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

      {/* Health bar + Close button */}
      <div className="px-5 pb-4 flex items-end gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
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

        <Button
          size="sm"
          variant="outline"
          onClick={handleClose}
          disabled={closing}
          className="font-mono text-xs h-7 px-4 shrink-0 border-red-600/30 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
        >
          {closing ? (
            <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Closing…</>
          ) : (
            "Close Position"
          )}
        </Button>
      </div>
    </div>
  )
}
