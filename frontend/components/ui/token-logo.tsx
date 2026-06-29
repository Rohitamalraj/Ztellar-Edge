"use client"

const BG: Record<string, string> = {
  sAAPL: "#1d1d1f",
  sTSLA: "#cc0000",
  sNVDA: "#76b900",
}

const LABEL: Record<string, string> = {
  sAAPL: "AAPL",
  sTSLA: "TSLA",
  sNVDA: "NVDA",
}

interface TokenLogoProps {
  symbol: string
  size?: number
  className?: string
}

export function TokenLogo({ symbol, size = 28, className = "" }: TokenLogoProps) {
  const bg = BG[symbol] ?? "#71717a"
  const label = LABEL[symbol] ?? symbol.replace(/^s/, "").slice(0, 4)
  const fontSize = size <= 20 ? size * 0.38 : size * 0.32

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size, background: bg }}
    >
      <span
        style={{ fontSize, lineHeight: 1, color: "#fff", fontFamily: "monospace", fontWeight: 700 }}
      >
        {label.slice(0, 1)}
      </span>
    </div>
  )
}
