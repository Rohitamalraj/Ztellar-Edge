"use client"

import { useState } from "react"
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
      toast.error(err instanceof Error ? err.message : "Failed to open position")
    }
  }

  const handleClosePosition = async (id: string) => {
    try {
      const pnl = await closePosition(id)
      const sign = pnl >= 0 ? "+" : ""
      toast.success(`Position closed  ${sign}$${pnl.toFixed(2)} PnL`)
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
