"use client"

import { useState, useCallback, useEffect } from "react"
import { readTier } from "@/lib/stellar"

export type TierNumber = 0 | 1 | 2 | 3 | 4

export interface TierInfo {
  tier: TierNumber
  expiry: number | null
  isVerified: boolean
  label: string
  leverageCap: number
  color: string
}

export function tierLabel(tier: TierNumber): string {
  switch (tier) {
    case 1: return "Basic"
    case 2: return "Verified"
    case 3: return "Trusted"
    case 4: return "Premium"
    default: return "Unverified"
  }
}

export function tierLeverageCap(tier: TierNumber): number {
  switch (tier) {
    case 1: return 1
    case 2: return 2
    case 3: return 5
    case 4: return 10
    default: return 0
  }
}

export function tierColor(tier: TierNumber): string {
  switch (tier) {
    case 1: return "#15803d"
    case 2: return "#1e40af"
    case 3: return "#7e22ce"
    case 4: return "#ca8a04"
    default: return "#71717a"
  }
}

export function useTier(publicKey: string | null) {
  const [tier, setTier] = useState<TierNumber>(0)
  const [expiry, setExpiry] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!publicKey) return
    setIsLoading(true)
    try {
      // Try on-chain first (tier_manager contract)
      const onChainTier = await readTier(publicKey)
      if (onChainTier > 0) {
        setTier(onChainTier as TierNumber)
        // Expiry comes from localStorage (written after ZK proof submission)
        const stored = localStorage.getItem(`ztellar_tier_${publicKey}`)
        if (stored) {
          const parsed = JSON.parse(stored)
          setExpiry(parsed.expiry ?? null)
        }
        return
      }
      // Fall back to localStorage if contract returns 0 (unverified)
      const stored = localStorage.getItem(`ztellar_tier_${publicKey}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.expiry > Date.now() / 1000) {
          setTier(parsed.tier as TierNumber)
          setExpiry(parsed.expiry)
        }
      }
    } catch {
      // Network error — fall back to localStorage
      const stored = localStorage.getItem(`ztellar_tier_${publicKey}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.expiry > Date.now() / 1000) {
          setTier(parsed.tier as TierNumber)
          setExpiry(parsed.expiry)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [publicKey])

  // Auto-refresh when wallet connects
  useEffect(() => {
    refresh()
  }, [refresh])

  const setVerifiedTier = useCallback(
    (t: TierNumber, exp: number) => {
      setTier(t)
      setExpiry(exp)
      if (publicKey) {
        localStorage.setItem(`ztellar_tier_${publicKey}`, JSON.stringify({ tier: t, expiry: exp }))
      }
    },
    [publicKey],
  )

  return {
    tier,
    expiry,
    isLoading,
    isVerified: tier > 0,
    label: tierLabel(tier),
    leverageCap: tierLeverageCap(tier),
    color: tierColor(tier),
    refresh,
    setVerifiedTier,
  }
}
