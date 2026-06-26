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
import { MOCK_ASSETS } from "@/components/dashboard/markets-panel"

export default function TradePage() {
  const { isConnected, publicKey } = useFreighter()
  const { tier, isVerified, leverageCap } = useTier(publicKey)
  const { positions, isOpening, openPosition, closePosition } = usePositions()
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>("sAAPL")

  const assetData = MOCK_ASSETS.find((a) => a.symbol === selectedAsset)
  const price = assetData?.price ?? 0

  const handleOpenPosition = async (direction: Direction, leverage: number, collateral: number) => {
    try {
      await openPosition(selectedAsset, direction, leverage, collateral, price)
      toast.success(`${direction} ${selectedAsset} ${leverage}x opened`)
    } catch {
      toast.error("Failed to open position")
    }
  }

  const handleClosePosition = async (id: string) => {
    try {
      await closePosition(id)
      toast.success("Position closed")
    } catch {
      toast.error("Failed to close position")
    }
  }

  return (
    <>
      <DashboardNav tier={tier} isVerified={isVerified} />
      <div className="pt-[72px]">
        <StatsBar positions={positions} />
        <TradingLayout
          leftPanel={
            <MarketsPanel selected={selectedAsset} onSelect={setSelectedAsset} />
          }
          centerPanel={<PriceChart asset={selectedAsset} />}
          rightPanel={
            <TradeForm
              asset={selectedAsset}
              price={price}
              tier={tier}
              isConnected={isConnected}
              isVerified={isVerified}
              onSubmit={handleOpenPosition}
              isSubmitting={isOpening}
            />
          }
          bottomPanel={
            <PositionsPanel positions={positions} onClose={handleClosePosition} />
          }
        />
      </div>
    </>
  )
}
