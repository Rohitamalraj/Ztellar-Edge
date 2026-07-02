"use client"

import { useCallback, useEffect, useState } from "react"
import { useFreighter } from "./use-freighter"
import {
  createSip,
  executeSipInvestment,
  cancelSip,
  getUserSips,
  type SipRecord,
} from "@/lib/stellar"

export type { SipRecord }

export function useSip() {
  const { publicKey, isConnected } = useFreighter()
  const [sips, setSips]             = useState<SipRecord[]>([])
  const [isLoading, setIsLoading]   = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [investingId, setInvestingId] = useState<number | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    if (!publicKey || !isConnected) { setSips([]); return }
    setIsLoading(true)
    try {
      const data = await getUserSips(publicKey)
      setSips(data)
    } catch (e) {
      console.warn("[useSip] refresh error:", e)
    } finally {
      setIsLoading(false)
    }
  }, [publicKey, isConnected])

  useEffect(() => { refresh() }, [refresh])

  async function create(assetId: number, amountUsdc: number, periodSecs: number) {
    if (!publicKey) throw new Error("Not connected")
    setIsCreating(true)
    try {
      const result = await createSip(publicKey, assetId, amountUsdc, periodSecs)
      await refresh()
      return result
    } finally {
      setIsCreating(false)
    }
  }

  async function invest(sipId: number) {
    if (!publicKey) throw new Error("Not connected")
    setInvestingId(sipId)
    try {
      const result = await executeSipInvestment(publicKey, sipId)
      await refresh()
      return result
    } finally {
      setInvestingId(null)
    }
  }

  async function cancel(sipId: number) {
    if (!publicKey) throw new Error("Not connected")
    setCancellingId(sipId)
    try {
      const result = await cancelSip(publicKey, sipId)
      await refresh()
      return result
    } finally {
      setCancellingId(null)
    }
  }

  return {
    sips,
    isLoading,
    isCreating,
    investingId,
    cancellingId,
    create,
    invest,
    cancel,
    refresh,
  }
}
