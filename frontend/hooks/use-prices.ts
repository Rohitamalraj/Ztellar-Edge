"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { getVaultPrice } from "@/lib/stellar"
import type { AssetSymbol } from "./use-positions"

export interface AssetPrice {
  price: number
  change24h: number  // percentage
  prev: number       // price from last tick (for colour flash)
}

export type Prices = Record<AssetSymbol, AssetPrice>

const SEED: Prices = {
  sAAPL: { price: 192.35, change24h: 1.24, prev: 192.35 },
  sTSLA: { price: 248.12, change24h: -2.87, prev: 248.12 },
  sNVDA: { price: 875.44, change24h: 3.15, prev: 875.44 },
}

const ASSETS: AssetSymbol[] = ["sAAPL", "sTSLA", "sNVDA"]
const ASSET_IDS: Record<AssetSymbol, number> = { sAAPL: 0, sTSLA: 1, sNVDA: 2 }
const POLL_MS = 30_000  // re-fetch from chain every 30s
const TICK_MS = 3_000   // random-walk tick every 3s (UI liveness)

function randomWalk(price: number): number {
  // ±0.12% per tick
  const delta = price * (Math.random() * 0.0024 - 0.0012)
  return Math.max(0.01, price + delta)
}

export function usePrices(publicKey: string | null): Prices {
  const [prices, setPrices] = useState<Prices>(SEED)
  // store the "real" on-chain base prices separately from the ticked display prices
  const baseRef = useRef<Record<AssetSymbol, number>>({
    sAAPL: SEED.sAAPL.price,
    sTSLA: SEED.sTSLA.price,
    sNVDA: SEED.sNVDA.price,
  })
  const openRef = useRef<Record<AssetSymbol, number>>({
    sAAPL: SEED.sAAPL.price,
    sTSLA: SEED.sTSLA.price,
    sNVDA: SEED.sNVDA.price,
  })

  const fetchFromChain = useCallback(async () => {
    if (!publicKey) return
    try {
      const results = await Promise.all(
        ASSETS.map((sym) => getVaultPrice(ASSET_IDS[sym], publicKey))
      )
      ASSETS.forEach((sym, i) => {
        if (results[i] > 0) {
          baseRef.current[sym] = results[i]
          // treat the previous open price as the 24h open if we don't have a better source
          openRef.current[sym] = openRef.current[sym] || results[i]
        }
      })
    } catch {
      // network error — keep current base
    }
  }, [publicKey])

  // Pull from chain on connect + every 30s
  useEffect(() => {
    fetchFromChain()
    const id = setInterval(fetchFromChain, POLL_MS)
    return () => clearInterval(id)
  }, [fetchFromChain])

  // Random-walk tick every 3s so the UI looks alive
  useEffect(() => {
    const id = setInterval(() => {
      setPrices((prev) => {
        const next = { ...prev }
        ASSETS.forEach((sym) => {
          const ticked = randomWalk(prev[sym].price)
          const open = openRef.current[sym]
          const change24h = open > 0 ? ((ticked - open) / open) * 100 : 0
          next[sym] = { price: ticked, change24h, prev: prev[sym].price }
        })
        return next
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  return prices
}
