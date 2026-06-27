"use client"

import { type Position } from "@/hooks/use-positions"
import { type Prices } from "@/hooks/use-prices"
import { PositionCard } from "./position-card"

interface PositionsPanelProps {
  positions: Position[]
  prices: Prices
  onClose: (id: string) => void
}

export function PositionsPanel({ positions, prices, onClose }: PositionsPanelProps) {
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
              currentPrice={prices[position.asset]?.price ?? position.entryPrice}
              onClose={onClose}
            />
          ))
        )}
      </div>
    </div>
  )
}
