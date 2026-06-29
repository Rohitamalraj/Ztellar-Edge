"use client"

import { useState, useCallback, useEffect } from "react"
import {
  openVaultPosition,
  closeVaultPosition,
  getWalletPositionIds,
  getVaultPosition,
  ASSET_ID,
  DIR_ID,
  type VaultPosition,
} from "@/lib/stellar"

export type AssetSymbol = "sAAPL" | "sTSLA" | "sNVDA"
export type Direction = "LONG" | "SHORT"

export interface Position extends VaultPosition {
  asset: AssetSymbol
  direction: Direction
}

export function calcPnl(position: Position, currentPrice: number): number {
  const priceChange = (currentPrice - position.entryPrice) / position.entryPrice
  const leveragedReturn = priceChange * position.leverage * (position.direction === "SHORT" ? -1 : 1)
  return position.collateralUSDC * leveragedReturn
}

export function calcHealthFactor(position: Position, currentPrice: number): number {
  const pnl = calcPnl(position, currentPrice)
  const equity = position.collateralUSDC + pnl
  const notional = position.collateralUSDC * position.leverage
  if (notional === 0) return 1
  return equity / notional
}

export function usePositions(publicKey: string | null) {
  const [positions, setPositions] = useState<Position[]>([])
  const [isOpening, setIsOpening] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Load positions from chain whenever wallet connects
  const loadPositions = useCallback(async () => {
    if (!publicKey) {
      setPositions([])
      return
    }
    console.log("📊 [ZE] loadPositions — wallet:", publicKey)
    setIsLoading(true)
    try {
      const ids = await getWalletPositionIds(publicKey)
      if (ids.length === 0) {
        console.log("📊 [ZE] loadPositions — no open positions")
        setPositions([])
        return
      }
      console.log("📊 [ZE] loadPositions — fetching", ids.length, "positions:", ids)
      const settled = await Promise.all(ids.map((id) => getVaultPosition(id, publicKey)))
      const live = settled.filter(Boolean) as VaultPosition[]
      console.log("✅ [ZE] loadPositions — loaded:", live)
      setPositions(live as Position[])
    } catch (e) {
      console.warn("📊 [ZE] loadPositions error:", e)
    } finally {
      setIsLoading(false)
    }
  }, [publicKey])

  useEffect(() => {
    loadPositions()
  }, [loadPositions])

  const openPosition = useCallback(
    async (
      asset: AssetSymbol,
      direction: Direction,
      leverage: number,
      collateralUSDC: number,
      _entryPrice: number  // unused — vault reads on-chain price
    ) => {
      if (!publicKey) throw new Error("Wallet not connected")
      setIsOpening(true)
      try {
        console.log("📊 [ZE] openPosition:", { asset, direction, leverage, collateralUSDC })
        const positionId = await openVaultPosition(
          publicKey,
          ASSET_ID[asset],
          DIR_ID[direction],
          leverage,
          collateralUSDC
        )
        console.log("✅ [ZE] openPosition — positionId:", positionId)
        // Refresh from chain so the new position appears with correct entry price
        await loadPositions()
        return positionId
      } finally {
        setIsOpening(false)
      }
    },
    [publicKey, loadPositions]
  )

  const closePosition = useCallback(
    async (id: string) => {
      if (!publicKey) throw new Error("Wallet not connected")
      console.log("📊 [ZE] closePosition — id:", id)
      const pnl = await closeVaultPosition(publicKey, id)
      console.log(`✅ [ZE] closePosition — PnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`)
      // Remove locally immediately, then sync from chain
      setPositions((prev) => prev.filter((p) => p.id !== id))
      return pnl
    },
    [publicKey]
  )

  return { positions, isOpening, isLoading, openPosition, closePosition, loadPositions }
}
