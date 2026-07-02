"use client"

import { useState } from "react"
import { AppNav } from "@/components/app/app-nav"
import { TokenLogo } from "@/components/ui/token-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFreighter } from "@/hooks/use-freighter"
import { useSip, type SipRecord } from "@/hooks/use-sip"
import { useTier } from "@/hooks/use-tier"
import { ASSET_ID, ASSET_SYMBOL } from "@/lib/stellar"
import { Loader2, TrendingUp, PlusCircle, XCircle, RefreshCw, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

// Assets available for SIP
const ASSETS = Object.entries(ASSET_ID).map(([symbol, id]) => ({ symbol, id }))

// Frequency options — period in seconds
const PERIODS = [
  { label: "Every minute",  sublabel: "(testnet demo)",  secs: 60 },
  { label: "Daily",         sublabel: "86,400 s",        secs: 86_400 },
  { label: "Weekly",        sublabel: "604,800 s",       secs: 604_800 },
  { label: "Monthly",       sublabel: "2,592,000 s",     secs: 2_592_000 },
]

function formatPeriod(secs: number): string {
  if (secs < 120)     return `${secs}s`
  if (secs < 7200)    return `${Math.round(secs / 60)}m`
  if (secs < 172800)  return `${Math.round(secs / 3600)}h`
  if (secs < 1209600) return `${Math.round(secs / 86400)}d`
  return `${Math.round(secs / 604800)}w`
}

function formatTimeUntil(date: Date): { text: string; overdue: boolean } {
  const diff = date.getTime() - Date.now()
  if (diff <= 0) return { text: "NOW", overdue: true }
  const m = Math.floor(diff / 60_000)
  if (m < 60)   return { text: `in ${m}m`, overdue: false }
  const h = Math.floor(diff / 3_600_000)
  if (h < 24)   return { text: `in ${h}h`, overdue: false }
  const d = Math.floor(diff / 86_400_000)
  return { text: `in ${d}d`, overdue: false }
}

const explorerUrl = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`

// ── SIP Card ──────────────────────────────────────────────────────────────────

function SipCard({
  sip,
  investingId,
  cancellingId,
  onInvest,
  onCancel,
}: {
  sip: SipRecord
  investingId: number | null
  cancellingId: number | null
  onInvest: (id: number) => Promise<void>
  onCancel: (id: number) => Promise<void>
}) {
  const due        = formatTimeUntil(sip.nextDue)
  const isInvesting = investingId === sip.id
  const isCancelling = cancellingId === sip.id

  return (
    <div className={`border border-foreground/10 p-5 flex flex-col gap-4 transition-opacity ${!sip.active ? "opacity-40" : ""}`}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TokenLogo symbol={sip.asset} size={32} />
          <div>
            <div className="font-mono text-sm font-semibold">{sip.asset}</div>
            <div className="font-mono text-[10px] text-muted-foreground">
              ${sip.amountUsdc.toFixed(2)} / {formatPeriod(sip.periodSecs)}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`font-mono text-sm font-medium ${due.overdue ? "text-green-700" : "text-muted-foreground"}`}>
            {due.text}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">next invest</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 border-t border-foreground/8 pt-3">
        <div>
          <div className="font-mono text-[10px] text-muted-foreground mb-0.5">Total invested</div>
          <div className="font-mono text-xs">${sip.totalInvestedUsdc.toFixed(2)}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] text-muted-foreground mb-0.5">Installments</div>
          <div className="font-mono text-xs">{sip.count}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] text-muted-foreground mb-0.5">Status</div>
          <div className={`font-mono text-xs ${sip.active ? "text-green-700" : "text-muted-foreground"}`}>
            {sip.active ? "Active" : "Cancelled"}
          </div>
        </div>
      </div>

      {/* Actions */}
      {sip.active && (
        <div className="flex gap-2 border-t border-foreground/8 pt-3">
          <Button
            size="sm"
            className={`flex-1 font-mono text-xs h-8 ${
              due.overdue
                ? "bg-green-700 hover:bg-green-800 text-white"
                : "bg-foreground/10 text-foreground/40 cursor-not-allowed"
            }`}
            onClick={() => due.overdue && onInvest(sip.id)}
            disabled={!due.overdue || isInvesting}
          >
            {isInvesting ? (
              <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Investing…</>
            ) : (
              <><TrendingUp className="w-3 h-3 mr-1.5" />Invest Now</>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="font-mono text-xs h-8 px-3 text-muted-foreground hover:text-red-600 border border-foreground/10"
            onClick={() => onCancel(sip.id)}
            disabled={isCancelling}
          >
            {isCancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SipPage() {
  const { isConnected, publicKey } = useFreighter()
  const { tier, isVerified } = useTier(publicKey ?? null)
  const { sips, isLoading, isCreating, investingId, cancellingId, create, invest, cancel, refresh } = useSip()

  const [selectedAsset, setSelectedAsset] = useState(0)
  const [amount, setAmount] = useState("")
  const [period, setPeriod] = useState(60)

  const amountNum = parseFloat(amount) || 0

  const handleCreate = async () => {
    if (!amountNum || amountNum <= 0) return
    try {
      const { sipId, txHash } = await create(selectedAsset, amountNum, period)
      toast.success(`SIP #${sipId} created — ${ASSET_SYMBOL[selectedAsset]}`, {
        description: (
          <a href={explorerUrl(txHash)} target="_blank" rel="noopener noreferrer" className="underline font-mono text-xs">
            {txHash.slice(0, 8)}…{txHash.slice(-8)}
          </a>
        ),
      })
      setAmount("")
    } catch (e: unknown) {
      toast.error("Failed to create SIP", { description: (e as Error).message })
    }
  }

  const handleInvest = async (sipId: number) => {
    const sip = sips.find((s) => s.id === sipId)
    try {
      const { txHash } = await invest(sipId)
      toast.success(`Invested $${sip?.amountUsdc.toFixed(2)} in ${sip?.asset}`, {
        description: (
          <a href={explorerUrl(txHash)} target="_blank" rel="noopener noreferrer" className="underline font-mono text-xs">
            {txHash.slice(0, 8)}…{txHash.slice(-8)}
          </a>
        ),
      })
    } catch (e: unknown) {
      toast.error("Investment failed", { description: (e as Error).message })
    }
  }

  const handleCancel = async (sipId: number) => {
    try {
      const { txHash } = await cancel(sipId)
      toast.success(`SIP #${sipId} cancelled`, {
        description: (
          <a href={explorerUrl(txHash)} target="_blank" rel="noopener noreferrer" className="underline font-mono text-xs">
            {txHash.slice(0, 8)}…{txHash.slice(-8)}
          </a>
        ),
      })
    } catch (e: unknown) {
      toast.error("Cancel failed", { description: (e as Error).message })
    }
  }

  const activeSips   = sips.filter((s) => s.active)
  const inactiveSips = sips.filter((s) => !s.active)

  return (
    <div className="min-h-screen bg-background">
      <AppNav tier={tier} isVerified={isVerified} />

      <main className="max-w-5xl mx-auto px-4 lg:px-8 pt-24 pb-16">
        {/* Header */}
        <div className="mb-10">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">
            On-chain · Soroban contract
          </div>
          <h1 className="text-4xl lg:text-5xl font-sans font-semibold tracking-tight mb-3">
            Systematic Investment Plan
          </h1>
          <p className="text-muted-foreground max-w-xl">
            Schedule recurring investments into synthetic stocks. Each installment opens a 1× LONG position in the vault — enforced by the{" "}
            <code className="font-mono text-xs bg-foreground/5 px-1 py-0.5">synth_sip</code> Soroban contract. Your tier controls what assets you can hold.
          </p>
        </div>

        {!isConnected ? (
          <div className="border border-foreground/10 p-12 text-center">
            <p className="text-muted-foreground font-mono text-sm mb-4">Connect Freighter to manage your SIPs</p>
            <p className="text-xs text-muted-foreground">Use the Connect Wallet button in the navigation bar</p>
          </div>
        ) : !isVerified ? (
          <div className="border border-yellow-600/20 bg-yellow-600/5 p-8 text-center">
            <p className="font-mono text-sm text-yellow-700 mb-3">ZK proof required</p>
            <p className="text-sm text-muted-foreground mb-4">
              SIPs open vault positions — you need a verified tier to use the vault.
            </p>
            <Link href="/prove">
              <Button size="sm" variant="outline" className="font-mono text-xs border-yellow-600/30 text-yellow-700">
                Prove identity <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[380px_1fr] gap-8">

            {/* ── Left: create SIP form ── */}
            <div className="border border-foreground/10 p-5 space-y-5 h-fit">
              <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                New SIP
              </h2>

              {/* Asset picker */}
              <div>
                <Label className="font-mono text-xs text-muted-foreground mb-2 block">Asset</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {ASSETS.map(({ symbol, id }) => (
                    <button
                      key={id}
                      onClick={() => setSelectedAsset(id)}
                      className={`flex flex-col items-center gap-1 py-2 px-1 border text-center transition-all ${
                        selectedAsset === id
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/10 hover:border-foreground/30"
                      }`}
                    >
                      <TokenLogo symbol={symbol} size={20} />
                      <span className="font-mono text-[9px]">{symbol.replace("s", "")}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <Label className="font-mono text-xs text-muted-foreground mb-1.5 block">
                  Amount per installment (USDC)
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="font-mono text-sm border-foreground/10 pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground pointer-events-none">
                    USDC
                  </span>
                </div>
              </div>

              {/* Frequency */}
              <div>
                <Label className="font-mono text-xs text-muted-foreground mb-1.5 block">Frequency</Label>
                <div className="space-y-1.5">
                  {PERIODS.map((p) => (
                    <button
                      key={p.secs}
                      onClick={() => setPeriod(p.secs)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 border text-left transition-all ${
                        period === p.secs
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/10 hover:border-foreground/30"
                      }`}
                    >
                      <span className="font-mono text-xs">{p.label}</span>
                      <span className={`font-mono text-[10px] ${period === p.secs ? "text-background/60" : "text-muted-foreground"}`}>
                        {p.sublabel}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              {amountNum > 0 && (
                <div className="border border-foreground/8 bg-foreground/[0.02] p-3 space-y-1.5">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-muted-foreground">Per installment</span>
                    <span>${amountNum.toFixed(2)} USDC → {ASSET_SYMBOL[selectedAsset]}</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-muted-foreground">First investment</span>
                    <span className="text-green-700">immediately</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-muted-foreground">Direction</span>
                    <span>1× LONG (SIP always DCA)</span>
                  </div>
                </div>
              )}

              <Button
                className="w-full font-mono text-sm bg-foreground hover:bg-foreground/90 text-background"
                onClick={handleCreate}
                disabled={!amountNum || amountNum <= 0 || isCreating}
              >
                {isCreating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>
                ) : (
                  <><PlusCircle className="w-4 h-4 mr-2" />Start SIP</>
                )}
              </Button>
            </div>

            {/* ── Right: SIP list ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                  Your SIPs {activeSips.length > 0 && <span className="ml-1">({activeSips.length} active)</span>}
                </h2>
                <button
                  onClick={refresh}
                  disabled={isLoading}
                  className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              {isLoading ? (
                <div className="border border-foreground/10 p-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : sips.length === 0 ? (
                <div className="border border-foreground/10 p-12 text-center">
                  <p className="font-mono text-sm text-muted-foreground mb-1">No SIPs yet</p>
                  <p className="text-xs text-muted-foreground">Create one to start dollar-cost averaging into synthetic stocks.</p>
                </div>
              ) : (
                <>
                  {activeSips.map((sip) => (
                    <SipCard
                      key={sip.id}
                      sip={sip}
                      investingId={investingId}
                      cancellingId={cancellingId}
                      onInvest={handleInvest}
                      onCancel={handleCancel}
                    />
                  ))}
                  {inactiveSips.length > 0 && (
                    <div className="pt-2">
                      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
                        Cancelled
                      </p>
                      {inactiveSips.map((sip) => (
                        <SipCard
                          key={sip.id}
                          sip={sip}
                          investingId={investingId}
                          cancellingId={cancellingId}
                          onInvest={handleInvest}
                          onCancel={handleCancel}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
