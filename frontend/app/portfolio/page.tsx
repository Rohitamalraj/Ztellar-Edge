"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AppNav } from "@/components/app/app-nav"
import { TokenLogo } from "@/components/ui/token-logo"
import { Button } from "@/components/ui/button"
import { useFreighter } from "@/hooks/use-freighter"
import { useTier } from "@/hooks/use-tier"
import { usePositions, calcPnl, type Position } from "@/hooks/use-positions"
import { usePrices } from "@/hooks/use-prices"
import { useSip } from "@/hooks/use-sip"
import { getUserUsdcBalance } from "@/lib/stellar"
import { getClosedTrades, clearHistory, type ClosedTrade } from "@/lib/trade-history"
import { shortenAddress } from "@/lib/utils"
import { toast } from "sonner"
import {
  Loader2, TrendingUp, TrendingDown, ExternalLink, RefreshCw,
  Wallet, BarChart2, CheckCircle2, Clock, Trash2,
} from "lucide-react"

const explorerUrl = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`

function formatAge(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60)  return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatPeriod(secs: number): string {
  if (secs < 120)    return "1 min"
  if (secs < 7200)   return `${Math.round(secs / 60)}m`
  if (secs < 172800) return `${Math.round(secs / 3600)}h`
  if (secs < 604800) return `${Math.round(secs / 86400)}d`
  return `${Math.round(secs / 604800)}w`
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  positive,
  negative,
}: {
  label: string
  value: string
  sub?: string
  positive?: boolean
  negative?: boolean
}) {
  return (
    <div className="border border-foreground/10 p-5">
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{label}</div>
      <div className={`font-sans text-2xl font-semibold tracking-tight ${positive ? "text-green-700" : negative ? "text-red-600" : ""}`}>
        {value}
      </div>
      {sub && <div className="font-mono text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  )
}

// ── Open position row ──────────────────────────────────────────────────────────

function PositionRow({
  position,
  currentPrice,
  onClose,
  isClosing,
}: {
  position: Position
  currentPrice: number
  onClose: (id: string) => Promise<void>
  isClosing: boolean
}) {
  const pnl       = calcPnl(position, currentPrice)
  const pnlPct    = (pnl / position.collateralUSDC) * 100
  const isLong    = position.direction === "LONG"
  const ageMs     = Date.now() - position.openedAt.getTime()
  const posVal    = position.collateralUSDC + pnl

  return (
    <tr className="border-b border-foreground/5 hover:bg-foreground/[0.015] transition-colors">
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-2.5">
          <TokenLogo symbol={position.asset} size={24} />
          <span className="font-mono text-sm font-medium">{position.asset}</span>
        </div>
      </td>
      <td className="py-3 px-3">
        <span className={`inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 ${isLong ? "text-green-700 bg-green-700/10" : "text-red-600 bg-red-600/10"}`}>
          {isLong ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {position.direction}
        </span>
      </td>
      <td className="py-3 px-3 font-mono text-xs text-center">{position.leverage}×</td>
      <td className="py-3 px-3 font-mono text-xs text-right">${position.collateralUSDC.toFixed(2)}</td>
      <td className="py-3 px-3 font-mono text-xs text-right">${position.entryPrice.toFixed(2)}</td>
      <td className="py-3 px-3 font-mono text-xs text-right">${currentPrice.toFixed(2)}</td>
      <td className="py-3 px-3 text-right">
        <div className={`font-mono text-xs font-medium ${pnl >= 0 ? "text-green-700" : "text-red-600"}`}>
          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
        </div>
        <div className={`font-mono text-[10px] ${pnl >= 0 ? "text-green-700/70" : "text-red-600/70"}`}>
          {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
        </div>
      </td>
      <td className="py-3 px-3 font-mono text-xs text-right">${posVal.toFixed(2)}</td>
      <td className="py-3 px-3 font-mono text-[10px] text-muted-foreground text-right">{formatAge(ageMs)}</td>
      <td className="py-3 pl-3 pr-4 text-right">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2.5 font-mono text-[11px] border border-foreground/10 hover:border-red-600/30 hover:text-red-600"
          onClick={() => onClose(position.id)}
          disabled={isClosing}
        >
          {isClosing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Close"}
        </Button>
      </td>
    </tr>
  )
}

// ── Closed trade row ──────────────────────────────────────────────────────────

function TradeRow({ trade }: { trade: ClosedTrade }) {
  const isLong = trade.direction === "LONG"
  const pnlPct = (trade.pnl / trade.collateralUSDC) * 100

  return (
    <tr className="border-b border-foreground/5 hover:bg-foreground/[0.015] transition-colors">
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-2.5">
          <TokenLogo symbol={trade.asset} size={20} />
          <span className="font-mono text-sm">{trade.asset}</span>
        </div>
      </td>
      <td className="py-3 px-3">
        <span className={`font-mono text-xs ${isLong ? "text-green-700" : "text-red-600"}`}>
          {trade.direction}
        </span>
      </td>
      <td className="py-3 px-3 font-mono text-xs text-center">{trade.leverage}×</td>
      <td className="py-3 px-3 font-mono text-xs text-right">${trade.collateralUSDC.toFixed(2)}</td>
      <td className="py-3 px-3 font-mono text-xs text-right">${trade.entryPrice.toFixed(2)}</td>
      <td className="py-3 px-3 text-right">
        <div className={`font-mono text-xs font-medium ${trade.pnl >= 0 ? "text-green-700" : "text-red-600"}`}>
          {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
        </div>
        <div className={`font-mono text-[10px] ${trade.pnl >= 0 ? "text-green-700/70" : "text-red-600/70"}`}>
          {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
        </div>
      </td>
      <td className="py-3 px-3 font-mono text-[10px] text-muted-foreground text-right">
        {formatAge(Date.now() - trade.closedAt)}
      </td>
      <td className="py-3 pl-3 pr-4 text-right">
        <a
          href={explorerUrl(trade.txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {trade.txHash.slice(0, 6)}…{trade.txHash.slice(-6)}
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { isConnected, publicKey } = useFreighter()
  const { tier, isVerified }       = useTier(publicKey ?? null)
  const { positions, closePosition, isLoading: posLoading } = usePositions(publicKey ?? null)
  const prices                     = usePrices(publicKey)
  const { sips, isLoading: sipLoading } = useSip()
  const [usdcBalance, setUsdcBalance]   = useState<number | null>(null)
  const [closingId, setClosingId]       = useState<string | null>(null)
  const [history, setHistory]           = useState<ClosedTrade[]>([])
  const [histKey, setHistKey]           = useState(0)

  // Load USDC balance
  useEffect(() => {
    if (!publicKey) { setUsdcBalance(null); return }
    getUserUsdcBalance(publicKey).then(setUsdcBalance)
  }, [publicKey])

  // Load trade history from localStorage
  useEffect(() => {
    if (!publicKey) { setHistory([]); return }
    setHistory(getClosedTrades(publicKey))
  }, [publicKey, histKey])

  // Derived portfolio stats
  const unrealizedPnl = positions.reduce((sum, pos) => {
    const cp = prices[pos.asset]?.price ?? pos.entryPrice
    return sum + calcPnl(pos, cp)
  }, 0)

  const totalCollateral = positions.reduce((sum, pos) => sum + pos.collateralUSDC, 0)
  const realizedPnl     = history.reduce((sum, t) => sum + t.pnl, 0)
  const portfolioValue  = (usdcBalance ?? 0) + totalCollateral + unrealizedPnl

  const activeSips      = sips.filter((s) => s.active)
  const totalSipInvested = activeSips.reduce((sum, s) => sum + s.totalInvestedUsdc, 0)

  const handleClose = async (id: string) => {
    setClosingId(id)
    try {
      const { pnl, txHash } = await closePosition(id)
      const sign = pnl >= 0 ? "+" : ""
      toast.success(`Position closed  ${sign}$${pnl.toFixed(2)} PnL`, {
        description: (
          <a href={explorerUrl(txHash)} target="_blank" rel="noopener noreferrer"
            className="font-mono text-xs underline opacity-70 hover:opacity-100">
            {txHash.slice(0, 8)}…{txHash.slice(-8)}
          </a>
        ),
      })
      // Refresh history after close
      setHistKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close position")
    } finally {
      setClosingId(null)
    }
  }

  const handleClearHistory = () => {
    if (!publicKey) return
    clearHistory(publicKey)
    setHistKey((k) => k + 1)
    toast.success("Trade history cleared")
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav tier={tier} isVerified={isVerified} />
        <main className="max-w-5xl mx-auto px-4 lg:px-8 pt-24">
          <div className="border border-foreground/10 p-16 text-center">
            <Wallet className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
            <p className="font-mono text-sm text-muted-foreground mb-1">Connect Freighter to view your portfolio</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav tier={tier} isVerified={isVerified} />

      <main className="max-w-[1400px] mx-auto px-4 lg:px-8 pt-20 pb-16">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 pt-4">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Portfolio</div>
            <h1 className="text-3xl font-sans font-semibold tracking-tight">
              {publicKey ? shortenAddress(publicKey) : "—"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/trade">
              <Button size="sm" className="font-mono text-xs bg-foreground text-background hover:bg-foreground/90">
                New Trade
              </Button>
            </Link>
            <Link href="/sip">
              <Button size="sm" variant="outline" className="font-mono text-xs border-foreground/20">
                New SIP
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard
            label="Portfolio Value"
            value={`$${portfolioValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sub="Balance + positions + PnL"
          />
          <StatCard
            label="USDC Balance"
            value={usdcBalance !== null
              ? `$${usdcBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "—"}
            sub="Available to trade"
          />
          <StatCard
            label="Unrealized PnL"
            value={`${unrealizedPnl >= 0 ? "+" : ""}$${unrealizedPnl.toFixed(2)}`}
            sub={`${positions.length} open position${positions.length !== 1 ? "s" : ""}`}
            positive={unrealizedPnl > 0}
            negative={unrealizedPnl < 0}
          />
          <StatCard
            label="Realized PnL"
            value={`${realizedPnl >= 0 ? "+" : ""}$${realizedPnl.toFixed(2)}`}
            sub={`${history.length} closed trade${history.length !== 1 ? "s" : ""}`}
            positive={realizedPnl > 0}
            negative={realizedPnl < 0}
          />
        </div>

        {/* ── Open Positions ── */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <BarChart2 className="w-3.5 h-3.5" />
              Open Positions
              <span className="text-foreground/30">({positions.length})</span>
            </h2>
            <Link href="/trade" className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              + Open trade →
            </Link>
          </div>

          {posLoading ? (
            <div className="border border-foreground/10 p-10 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : positions.length === 0 ? (
            <div className="border border-foreground/10 p-10 text-center">
              <p className="font-mono text-sm text-muted-foreground">No open positions</p>
            </div>
          ) : (
            <div className="border border-foreground/10 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-foreground/10 bg-foreground/[0.02]">
                    {["Asset", "Direction", "Lev", "Collateral", "Entry", "Current", "Unreal. PnL", "Value", "Age", ""].map((h) => (
                      <th key={h} className={`font-mono text-[10px] text-muted-foreground uppercase tracking-widest py-2.5 px-3 ${h === "" || h === "Lev" ? "text-center" : ["Collateral","Entry","Current","Unreal. PnL","Value","Age"].includes(h) ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <PositionRow
                      key={pos.id}
                      position={pos}
                      currentPrice={prices[pos.asset]?.price ?? pos.entryPrice}
                      onClose={handleClose}
                      isClosing={closingId === pos.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Active SIPs ── */}
        {(activeSips.length > 0 || sipLoading) && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5" />
                Active SIPs
                <span className="text-foreground/30">({activeSips.length})</span>
              </h2>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-muted-foreground">
                  ${totalSipInvested.toFixed(2)} total invested
                </span>
                <Link href="/sip" className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  Manage SIPs →
                </Link>
              </div>
            </div>

            {sipLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {activeSips.map((sip) => {
                  const due = sip.nextDue.getTime() - Date.now()
                  const isDue = due <= 0
                  return (
                    <div key={sip.id} className="border border-foreground/10 p-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <TokenLogo symbol={sip.asset} size={24} />
                        <div>
                          <div className="font-mono text-sm font-medium">{sip.asset}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            ${sip.amountUsdc.toFixed(2)} / {formatPeriod(sip.periodSecs)}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-xs">
                          <span className="text-muted-foreground">Invested</span>
                          <span>${sip.totalInvestedUsdc.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-mono text-xs">
                          <span className="text-muted-foreground">Installments</span>
                          <span>{sip.count}</span>
                        </div>
                        <div className="flex justify-between font-mono text-xs">
                          <span className="text-muted-foreground">Next due</span>
                          <span className={isDue ? "text-green-700 font-medium" : "text-muted-foreground"}>
                            {isDue ? "NOW" : formatAge(-due)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Trade History ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Trade History
              <span className="text-foreground/30">({history.length})</span>
            </h2>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="border border-foreground/10 p-10 text-center">
              <Clock className="w-5 h-5 mx-auto mb-3 text-muted-foreground" />
              <p className="font-mono text-sm text-muted-foreground">No closed trades yet</p>
              <p className="font-mono text-[11px] text-muted-foreground mt-1">
                Closed trades appear here automatically
              </p>
            </div>
          ) : (
            <div className="border border-foreground/10 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-foreground/10 bg-foreground/[0.02]">
                    {["Asset", "Direction", "Lev", "Collateral", "Entry", "PnL", "Closed", "Tx"].map((h) => (
                      <th key={h} className={`font-mono text-[10px] text-muted-foreground uppercase tracking-widest py-2.5 px-3 ${h === "Lev" ? "text-center" : ["Collateral","Entry","PnL","Closed","Tx"].includes(h) ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((trade) => (
                    <TradeRow key={`${trade.positionId}-${trade.closedAt}`} trade={trade} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
