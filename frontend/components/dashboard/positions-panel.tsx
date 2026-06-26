"use client"

import { type Position } from "@/hooks/use-positions"
import { PositionCard } from "./position-card"
import { MOCK_ASSETS } from "./markets-panel"

interface PositionsPanelProps {
  positions: Position[]
  onClose: (id: string) => void
}

const PRICE_MAP: Record<string, number> = Object.fromEntries(
  MOCK_ASSETS.map((a) => [a.symbol, a.price]),
)

export function PositionsPanel({ positions, onClose }: PositionsPanelProps) {
  return (
    <div className="h-full border border-foreground/10 flex flex-col">
      <div className="px-4 py-3 border-b border-foreground/10 flex items-center justify-between shrink-0">
        <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Open Positions</h2>
        <span className="font-mono text-xs text-muted-foreground">{positions.length} active</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <p className="text-muted-foreground text-sm mb-1">No open positions</p>
            <p className="text-muted-foreground text-xs font-mono">Select an asset and open your first trade</p>
          </div>
        ) : (
          positions.map((position) => (
            <PositionCard
              key={position.id}
              position={position}
              currentPrice={PRICE_MAP[position.asset] ?? position.entryPrice}
              onClose={onClose}
            />
          ))
        )}
      </div>
    </div>
  )
}
