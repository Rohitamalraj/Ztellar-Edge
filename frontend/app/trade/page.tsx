"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { TradingLayout } from "@/components/dashboard/trading-layout"
import { MarketsPanel } from "@/components/dashboard/markets-panel"
import { CandlestickChart } from "@/components/dashboard/candlestick-chart"
import { TradeForm } from "@/components/dashboard/trade-form"
import { PositionsPanel } from "@/components/dashboard/positions-panel"
import { StatsBar } from "@/components/dashboard/stats-bar"
import { useFreighter } from "@/hooks/use-freighter"
import { useTier } from "@/hooks/use-tier"
import { usePositions, type AssetSymbol, type Direction } from "@/hooks/use-positions"
import { usePrices } from "@/hooks/use-prices"
import { useUsdcBalance } from "@/hooks/use-usdc-balance"

export default function TradePage() {
  const { isConnected, publicKey } = useFreighter()
  const { tier, isVerified } = useTier(publicKey)
  const { positions, isOpening, openPosition, closePosition } = usePositions(publicKey)
  const prices = usePrices(publicKey)
  const { balance: usdcBalance, isLoading: isBalanceLoading, refetch: refetchBalance } = useUsdcBalance(publicKey)
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>("sAAPL")
  const [favorites, setFavorites] = useState<Set<AssetSymbol>>(new Set())
  const [isFaucetLoading, setIsFaucetLoading] = useState(false)
  const oracleRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Push live prices to vault on mount and every 60s
  useEffect(() => {
    const pushPrices = () =>
      fetch("/api/oracle", { method: "POST" })
        .then((r) => r.json())
        .then((d: { prices?: Record<string, number>; error?: string }) => {
          if (d.error) console.warn("[oracle]", d.error)
          else console.log("[oracle] prices updated:", d.prices)
        })
        .catch((e) => console.warn("[oracle] fetch error:", e))

    pushPrices()
    oracleRef.current = setInterval(pushPrices, 60_000)
    return () => { if (oracleRef.current) clearInterval(oracleRef.current) }
  }, [])

  const currentPrice = prices[selectedAsset].price

  const handleToggleFavorite = (sym: AssetSymbol) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(sym)) next.delete(sym); else next.add(sym)
      return next
    })
  }

  const handleClaimFaucet = async () => {
    if (!publicKey) {
      toast.error("Connect your wallet first")
      return
    }
    setIsFaucetLoading(true)
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey }),
      })
      const data = await res.json() as { success?: boolean; amount?: number; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? "Faucet failed")
      toast.success(`+${data.amount ?? 1000} USDC added to your wallet`)
      await refetchBalance()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Faucet error")
    } finally {
      setIsFaucetLoading(false)
    }
  }

  const handleOpenPosition = async (direction: Direction, leverage: number, collateral: number) => {
    try {
      await openPosition(selectedAsset, direction, leverage, collateral, currentPrice)
      toast.success(`${direction} ${selectedAsset} ${leverage}x opened`)
      await refetchBalance()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open position")
    }
  }

  const handleClosePosition = async (id: string) => {
    try {
      // Push latest prices on-chain before settling so PnL reflects live market
      await fetch("/api/oracle", { method: "POST" }).catch(() => {})
      const pnl = await closePosition(id)
      const sign = pnl >= 0 ? "+" : ""
      toast.success(`Position closed  ${sign}$${pnl.toFixed(2)} PnL`)
      await refetchBalance()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close position")
    }
  }

  return (
    <>
      <DashboardNav tier={tier} isVerified={isVerified} />
      <div className="pt-[72px]">
        <StatsBar positions={positions} prices={prices} selectedAsset={selectedAsset} />
        <TradingLayout
          leftPanel={
            <MarketsPanel
              selected={selectedAsset}
              onSelect={setSelectedAsset}
              prices={prices}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
          }
          centerPanel={
            <CandlestickChart
              asset={selectedAsset}
              priceData={prices[selectedAsset]}
            />
          }
          rightPanel={
            <TradeForm
              asset={selectedAsset}
              price={currentPrice}
              tier={tier}
              isConnected={isConnected}
              isVerified={isVerified}
              walletAddress={publicKey}
              usdcBalance={usdcBalance}
              isFaucetLoading={isFaucetLoading || isBalanceLoading}
              onClaimFaucet={handleClaimFaucet}
              onSubmit={handleOpenPosition}
              isSubmitting={isOpening}
            />
          }
          bottomPanel={
            <PositionsPanel
              positions={positions}
              prices={prices}
              onClose={handleClosePosition}
            />
          }
        />
      </div>
    </>
  )
}
