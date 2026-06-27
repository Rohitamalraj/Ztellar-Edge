"use client"

import { type AssetSymbol } from "@/hooks/use-positions"

interface PriceChartProps {
  asset: AssetSymbol
  price: number
  change24h: number
}

export function PriceChart({ asset, price, change24h }: PriceChartProps) {
  const isPositive = change24h >= 0

  // Sparkline based on current price with a sine-wave shape for visual demo
  const points = Array.from({ length: 60 }, (_, i) => {
    const noise = Math.sin(i * 0.4) * price * 0.02 + Math.sin(i * 0.15) * price * 0.03
    return price + noise
  })
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const svgPoints = points
    .map((p, i) => `${(i / (points.length - 1)) * 100},${100 - ((p - min) / range) * 80}`)
    .join(" ")

  return (
    <div className="h-full border border-foreground/10 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-foreground/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-medium">{asset}</span>
          <span className={`font-mono text-xs ${isPositive ? "text-green-700" : "text-red-600"}`}>
            {isPositive ? "+" : ""}{change24h.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-semibold">${price.toFixed(2)}</span>
          <span className="font-mono text-[10px] text-muted-foreground border border-foreground/10 px-2 py-0.5">1D</span>
        </div>
      </div>

      {/* SVG chart */}
      <div className="flex-1 p-4 relative">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id={`grad-${asset}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? "#15803d" : "#dc2626"} stopOpacity="0.15" />
              <stop offset="100%" stopColor={isPositive ? "#15803d" : "#dc2626"} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,100 ${svgPoints} 100,100`}
            fill={`url(#grad-${asset})`}
          />
          <polyline
            points={svgPoints}
            fill="none"
            stroke={isPositive ? "#15803d" : "#dc2626"}
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Y axis labels */}
        <div className="absolute right-6 top-4 bottom-4 flex flex-col justify-between pointer-events-none">
          <span className="font-mono text-xs text-muted-foreground">${max.toFixed(0)}</span>
          <span className="font-mono text-xs text-muted-foreground">${min.toFixed(0)}</span>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-foreground/10">
        <p className="font-mono text-[10px] text-muted-foreground">Synth Vault price · Testnet</p>
      </div>
    </div>
  )
}
