"use client"

import { useState, useCallback } from "react"

export type AssetSymbol = "sAAPL" | "sTSLA" | "sNVDA"
export type Direction = "LONG" | "SHORT"

export interface Position {
  id: string
  asset: AssetSymbol
  direction: Direction
  leverage: number
  entryPrice: number
  collateralUSDC: number
  openedAt: Date
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
  return equity / notional
}

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([])
  const [isOpening, setIsOpening] = useState(false)

  const openPosition = useCallback(
    async (
      asset: AssetSymbol,
      direction: Direction,
      leverage: number,
      collateralUSDC: number,
      entryPrice: number,
    ) => {
      setIsOpening(true)
      try {
        // TODO: call synth_vault Soroban contract open_position()
        await new Promise((r) => setTimeout(r, 1200))
        const newPosition: Position = {
          id: crypto.randomUUID(),
          asset,
          direction,
          leverage,
          entryPrice,
          collateralUSDC,
          openedAt: new Date(),
        }
        setPositions((prev) => [newPosition, ...prev])
        return newPosition
      } finally {
        setIsOpening(false)
      }
    },
    [],
  )

  const closePosition = useCallback(async (id: string) => {
    // TODO: call synth_vault Soroban contract close_position()
    await new Promise((r) => setTimeout(r, 800))
    setPositions((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return { positions, isOpening, openPosition, closePosition }
}
