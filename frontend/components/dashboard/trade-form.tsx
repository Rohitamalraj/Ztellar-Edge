"use client"

import { useState } from "react"
import { Loader2, TrendingUp, TrendingDown, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LeverageSlider } from "@/components/ui/leverage-slider"
import { TierBadge } from "@/components/zk/tier-badge"
import { type AssetSymbol, type Direction } from "@/hooks/use-positions"
import { type TierNumber, tierLeverageCap } from "@/hooks/use-tier"
import Link from "next/link"

interface TradeFormProps {
  asset: AssetSymbol
  price: number
  tier: TierNumber
  isConnected: boolean
  isVerified: boolean
  isTradable?: boolean
  onSubmit: (direction: Direction, leverage: number, collateral: number) => Promise<void>
  isSubmitting: boolean
}

export function TradeForm({ asset, price, tier, isConnected, isVerified, isTradable = true, onSubmit, isSubmitting }: TradeFormProps) {
  const [direction, setDirection] = useState<Direction>("LONG")
  const [leverage, setLeverage] = useState(1)
  const [collateral, setCollateral] = useState("")

  const maxLeverage = tierLeverageCap(tier)
  const collateralNum = parseFloat(collateral) || 0
  const positionSize = collateralNum * leverage
  const isLong = direction === "LONG"

  const handleSubmit = async () => {
    if (!collateralNum || collateralNum <= 0) return
    await onSubmit(direction, leverage, collateralNum)
    setCollateral("")
  }

  return (
    <div className="h-full border border-foreground/10 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-foreground/10 flex items-center justify-between">
        <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{asset}</h2>
        <span className="font-mono text-xs text-muted-foreground">${price.toFixed(2)}</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-5">
        {/* Direction tabs */}
        <div>
          <div className="grid grid-cols-2 border border-foreground/10">
            <button
              onClick={() => setDirection("LONG")}
              className={`py-2.5 text-xs font-mono font-medium transition-all ${
                isLong
                  ? "bg-green-700 text-white border-r border-green-700"
                  : "text-muted-foreground hover:bg-foreground/[0.02] border-r border-foreground/10"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 inline mr-1.5" />
              Long
            </button>
            <button
              onClick={() => setDirection("SHORT")}
              className={`py-2.5 text-xs font-mono font-medium transition-all ${
                !isLong
                  ? "bg-red-600 text-white"
                  : "text-muted-foreground hover:bg-foreground/[0.02]"
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5 inline mr-1.5" />
              Short
            </button>
          </div>
        </div>

        {/* Collateral input */}
        <div className="space-y-2">
          <Label className="text-xs font-mono text-muted-foreground">Collateral (USDC)</Label>
          <Input
            type="number"
            placeholder="0.00"
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
            className="font-mono text-sm border-foreground/10"
          />
        </div>

        {/* Leverage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-mono text-muted-foreground">Leverage</Label>
            <span className="font-mono text-sm font-medium">{leverage}x</span>
          </div>
          <LeverageSlider
            value={leverage}
            onChange={setLeverage}
            max={maxLeverage || 1}
            tierCap={maxLeverage}
          />
        </div>

        {/* Tier badge */}
        {isVerified && (
          <div className="flex items-center justify-between py-2 border-t border-foreground/5">
            <span className="text-xs font-mono text-muted-foreground">Your tier</span>
            <TierBadge tier={tier} size="sm" showCap />
          </div>
        )}

        {/* Stats */}
        <div className="space-y-2 pt-2 border-t border-foreground/10">
          {[
            { label: "Entry price", value: `$${price.toFixed(2)}` },
            { label: "Position size", value: positionSize > 0 ? `$${positionSize.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—" },
            { label: "Leverage cap", value: maxLeverage > 0 ? `${maxLeverage}x` : "Unverified" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">{label}</span>
              <span className="text-xs font-mono">{value}</span>
            </div>
          ))}
        </div>

        {/* Unverified warning */}
        {isConnected && !isVerified && (
          <div className="flex items-start gap-2 p-3 border border-yellow-600/20 bg-yellow-600/5">
            <ShieldAlert className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-mono text-yellow-700 mb-1">Identity not verified</p>
              <p className="text-xs text-muted-foreground">You need a ZK-verified tier to open positions.</p>
              <Link href="/prove" className="text-xs font-mono text-yellow-700 underline mt-1 block">
                Verify now →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Action button */}
      <div className="p-4 border-t border-foreground/10">
        {!isTradable ? (
          <Button className="w-full font-mono text-xs" disabled variant="outline">
            Coming Soon — Not Yet On-Chain
          </Button>
        ) : !isConnected ? (
          <Button className="w-full" disabled>Connect Wallet</Button>
        ) : !isVerified ? (
          <Button className="w-full" variant="outline" asChild>
            <Link href="/prove">Verify Identity to Trade</Link>
          </Button>
        ) : (
          <Button
            className={`w-full font-mono text-sm ${
              isLong
                ? "bg-green-700 hover:bg-green-800 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            }`}
            onClick={handleSubmit}
            disabled={isSubmitting || !collateralNum || collateralNum <= 0}
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Opening...</>
            ) : (
              `${isLong ? "Long" : "Short"} ${asset} ${leverage}x`
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
