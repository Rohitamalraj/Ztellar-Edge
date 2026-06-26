"use client"

import { toast } from "sonner"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { PositionCard } from "@/components/dashboard/position-card"
import { StatsBar } from "@/components/dashboard/stats-bar"
import { useFreighter } from "@/hooks/use-freighter"
import { useTier } from "@/hooks/use-tier"
import { usePositions } from "@/hooks/use-positions"
import { MOCK_ASSETS } from "@/components/dashboard/markets-panel"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function PositionsPage() {
  const { publicKey, isConnected } = useFreighter()
  const { tier, isVerified } = useTier(publicKey)
  const { positions, closePosition } = usePositions()

  const PRICE_MAP: Record<string, number> = Object.fromEntries(
    MOCK_ASSETS.map((a) => [a.symbol, a.price]),
  )

  const handleClose = async (id: string) => {
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
      <div className="pt-[72px] min-h-screen">
        <StatsBar positions={positions} />
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-sans font-semibold tracking-tight mb-1">Open Positions</h1>
              <p className="text-muted-foreground text-sm font-mono">{positions.length} active positions</p>
            </div>
            <Button asChild>
              <Link href="/trade">Open Trade</Link>
            </Button>
          </div>

          {positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-2xl font-sans font-semibold mb-3">No open positions</p>
              <p className="text-muted-foreground mb-8 max-w-sm">
                {!isConnected
                  ? "Connect your Freighter wallet to start trading."
                  : !isVerified
                  ? "Verify your identity first to unlock leverage and open positions."
                  : "Select an asset in the trading terminal and open your first position."}
              </p>
              <Button asChild>
                <Link href={!isVerified ? "/prove" : "/trade"}>
                  {!isVerified ? "Verify Identity" : "Go to Trade"}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {positions.map((position) => (
                <PositionCard
                  key={position.id}
                  position={position}
                  currentPrice={PRICE_MAP[position.asset] ?? position.entryPrice}
                  onClose={handleClose}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
