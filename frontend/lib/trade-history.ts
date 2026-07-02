// localStorage-backed closed trade history.
// Saved when usePositions.closePosition() completes successfully.

export interface ClosedTrade {
  positionId: string
  asset: string
  direction: "LONG" | "SHORT"
  leverage: number
  collateralUSDC: number
  entryPrice: number
  pnl: number           // signed USDC
  closedAt: number      // Date.now()
  txHash: string
}

const key = (wallet: string) => `zte_trade_history_${wallet}`

export function saveClosedTrade(wallet: string, trade: ClosedTrade): void {
  if (typeof window === "undefined") return
  try {
    const existing = getClosedTrades(wallet)
    // Prevent duplicates if somehow called twice for same position
    if (existing.some((t) => t.positionId === trade.positionId)) return
    localStorage.setItem(key(wallet), JSON.stringify([trade, ...existing]))
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

export function getClosedTrades(wallet: string): ClosedTrade[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(key(wallet))
    if (!raw) return []
    return JSON.parse(raw) as ClosedTrade[]
  } catch {
    return []
  }
}

export function clearHistory(wallet: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(key(wallet))
}
