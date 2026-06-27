"use client"

import { useState } from "react"
import { toast } from "sonner"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { TradingLayout } from "@/components/dashboard/trading-layout"
import { MarketsPanel } from "@/components/dashboard/markets-panel"
import { PriceChart } from "@/components/dashboard/price-chart"
import { TradeForm } from "@/components/dashboard/trade-form"
import { PositionsPanel } from "@/components/dashboard/positions-panel"
import { StatsBar } from "@/components/dashboard/stats-bar"
import { useFreighter } from "@/hooks/use-freighter"
import { useTier } from "@/hooks/use-tier"
import { usePositions, type AssetSymbol, type Direction } from "@/hooks/use-positions"
import { usePrices } from "@/hooks/use-prices"

export default function TradePage() {
  const { isConnected, publicKey } = useFreighter()
  const { tier, isVerified } = useTier(publicKey)
  const { positions, isOpening, openPosition, closePosition } = usePositions(publicKey)
  const prices = usePrices(publicKey)
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>("sAAPL")

  const currentPrice = prices[selectedAsset].price

  const handleOpenPosition = async (direction: Direction, leverage: number, collateral: number) => {
    try {
      await openPosition(selectedAsset, direction, leverage, collateral, currentPrice)
      toast.success(`${direction} ${selectedAsset} ${leverage}x opened`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to open position"
      toast.error(msg)
    }
  }

  const handleClosePosition = async (id: string) => {
    try {
      const pnl = await closePosition(id)
      const sign = pnl >= 0 ? "+" : ""
      toast.success(`Position closed  ${sign}$${pnl.toFixed(2)} PnL`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to close position"
      toast.error(msg)
    }
  }

  return (
    <>
      <DashboardNav tier={tier} isVerified={isVerified} />
      <div className="pt-[72px]">
        <StatsBar positions={positions} prices={prices} />
        <TradingLayout
          leftPanel={
            <MarketsPanel
              selected={selectedAsset}
              onSelect={setSelectedAsset}
              prices={prices}
            />
          }
          centerPanel={
            <PriceChart
              asset={selectedAsset}
              price={prices[selectedAsset].price}
              change24h={prices[selectedAsset].change24h}
            />
          }
          rightPanel={
            <TradeForm
              asset={selectedAsset}
              price={currentPrice}
              tier={tier}
              isConnected={isConnected}
              isVerified={isVerified}
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
