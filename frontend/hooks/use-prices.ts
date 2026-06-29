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
  sAAPL: { price: 192.35, change24h: 1.24, prev: 191.11, volume: 0 },
  sTSLA: { price: 248.12, change24h: -2.87, prev: 255.43, volume: 0 },
  sNVDA: { price: 875.44, change24h: 3.15, prev: 848.21, volume: 0 },
}

const ASSETS: AssetSymbol[] = ["sAAPL", "sTSLA", "sNVDA"]
const POLL_MS = 10_000   // re-fetch real prices every 10s
const TICK_MS = 2_000    // micro random-walk every 2s for live feel

function microWalk(price: number): number {
  return Math.max(0.01, price * (1 + (Math.random() * 0.0006 - 0.0003)))
}

export function usePrices(_publicKey?: string | null): Prices {
  const [prices, setPrices] = useState<Prices>(SEED)
  const baseRef = useRef<Prices>(SEED)

  // Fetch real prices from Yahoo Finance via API route
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
          ASSETS.forEach((sym) => {
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
        // network error — keep current prices
      }
    }

    fetchPrices()
    const id = setInterval(fetchPrices, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Micro-walk between API polls so numbers visibly move
  useEffect(() => {
    const id = setInterval(() => {
      setPrices((prev) => {
        const next = { ...prev }
        ASSETS.forEach((sym) => {
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
