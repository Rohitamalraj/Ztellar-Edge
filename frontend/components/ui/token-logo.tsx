"use client"

import { useState } from "react"

const LOGOKIT_TOKEN = "pk_frfbe2dd55bc04b3d4d1bc"

function getStockLogoUrl(ticker: string): string {
  const clean = ticker.startsWith("s") ? ticker.slice(1) : ticker
  return `https://img.logokit.com/ticker/${clean.toUpperCase()}?token=${LOGOKIT_TOKEN}`
}

const FALLBACK_GRADIENTS: Record<string, string> = {
  AAPL: "#1d1d1f",
  TSLA: "#cc0000",
  NVDA: "#76b900",
  MSFT: "#0078d4",
  AMZN: "#ff9900",
  GOOG: "#4285f4",
  META: "#0866ff",
  NFLX: "#e50914",
  AMD:  "#ed1c24",
  JPM:  "#003087",
  SPY:  "#1a56db",
  PFE:  "#0093c8",
  INTC: "#0071c5",
  SOFI: "#00b67a",
}

interface TokenLogoProps {
  symbol: string
  size?: number
  className?: string
}

export function TokenLogo({ symbol, size = 28, className = "" }: TokenLogoProps) {
  const [hasError, setHasError] = useState(false)
  const clean = symbol.startsWith("s") ? symbol.slice(1) : symbol
  const fallbackBg = FALLBACK_GRADIENTS[clean] ?? "#71717a"

  if (hasError) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-full shrink-0 font-mono font-bold text-white ${className}`}
        style={{
          width: size,
          height: size,
          background: fallbackBg,
          fontSize: size * 0.33,
        }}
      >
        {clean.slice(0, 2)}
      </div>
    )
  }

  return (
    <img
      src={getStockLogoUrl(symbol)}
      alt={`${clean} logo`}
      className={`rounded-full object-cover shrink-0 ${className}`}
      style={{ width: size, height: size }}
      onError={() => setHasError(true)}
    />
  )
}
