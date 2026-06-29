"use client"

import { useState, useEffect, useCallback } from "react"
import { getUserUsdcBalance } from "@/lib/stellar"

export function useUsdcBalance(walletAddress: string | null) {
  const [balance, setBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) { setBalance(null); return }
    setIsLoading(true)
    try {
      const bal = await getUserUsdcBalance(walletAddress)
      setBalance(bal)
    } catch {
      setBalance(null)
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return { balance, isLoading, refetch: fetchBalance }
}
