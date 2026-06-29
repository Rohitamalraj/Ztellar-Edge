"use client"

import { useState, useEffect, useRef } from "react"
import type { AssetSymbol } from "./use-positions"

export interface AssetPrice {
  price: number
  change24h: number
  prev: number
  volume: number
}

export type Prices = Record<AssetSymbol, AssetPrice>

const SEED: Prices = {
  sAAPL: { price: 211.45, change24h:  1.24, prev: 208.87, volume: 0 },
  sTSLA: { price: 248.12, change24h: -2.87, prev: 255.43, volume: 0 },
  sNVDA: { price: 135.80, change24h:  3.15, prev: 131.56, volume: 0 },
  sMSFT: { price: 452.86, change24h: -0.69, prev: 455.98, volume: 0 },
  sAMZN: { price: 215.45, change24h:  0.83, prev: 213.69, volume: 0 },
  sGOOG: { price: 185.37, change24h:  0.50, prev: 184.45, volume: 0 },
  sMETA: { price: 681.42, change24h:  1.40, prev: 672.00, volume: 0 },
  sNFLX: { price: 1291.5, change24h: -1.35, prev: 1309.1, volume: 0 },
  sAMD:  { price: 172.18, change24h: -2.33, prev: 176.30, volume: 0 },
  sJPM:  { price: 272.90, change24h:  1.58, prev: 268.60, volume: 0 },
  sSPY:  { price: 594.20, change24h:  0.42, prev: 591.72, volume: 0 },
  sPFE:  { price:  25.10, change24h: -0.80, prev:  25.30, volume: 0 },
}

export const ALL_ASSETS: AssetSymbol[] = [
  "sAAPL", "sTSLA", "sNVDA",
  "sMSFT", "sAMZN", "sGOOG",
  "sMETA", "sNFLX", "sAMD",
  "sJPM",  "sSPY",  "sPFE",
]

const POLL_MS = 15_000
const TICK_MS = 2_000

function microWalk(price: number): number {
  return Math.max(0.01, price * (1 + (Math.random() * 0.0006 - 0.0003)))
}

export function usePrices(_publicKey?: string | null): Prices {
  const [prices, setPrices] = useState<Prices>(SEED)
  const baseRef = useRef<Prices>(SEED)

  useEffect(() => {
    let cancelled = false

    const fetchPrices = async () => {
      try {
        const res = await fetch("/api/prices")
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return

        setPrices((prev) => {
          const next = { ...prev }
          ALL_ASSETS.forEach((sym) => {
            const d = data[sym]
            if (d && d.price > 0) {
              next[sym] = {
                price: d.price,
                change24h: d.change24h,
                prev: d.prev,
                volume: d.volume ?? 0,
              }
            }
          })
          baseRef.current = next
          return next
        })
      } catch {
        // keep current prices on network error
      }
    }

    fetchPrices()
    const id = setInterval(fetchPrices, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setPrices((prev) => {
        const next = { ...prev }
        ALL_ASSETS.forEach((sym) => {
          const ticked = microWalk(prev[sym].price)
          const base = baseRef.current[sym]
          const change24h = base.prev > 0
            ? ((ticked - base.prev) / base.prev) * 100
            : prev[sym].change24h
          next[sym] = { ...prev[sym], price: ticked, change24h }
        })
        return next
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  return prices
}
