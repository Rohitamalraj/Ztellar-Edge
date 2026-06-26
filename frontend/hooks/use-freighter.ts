"use client"

import { useState, useEffect, useCallback } from "react"

export interface FreighterState {
  isConnected: boolean
  publicKey: string | null
  isInstalled: boolean
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

export function useFreighter(): FreighterState {
  const [isInstalled, setIsInstalled] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        const freighter = await import("@stellar/freighter-api")
        const installed = await freighter.isConnected()
        setIsInstalled(installed.isConnected)

        if (installed.isConnected) {
          const allowed = await freighter.isAllowed()
          if (allowed.isAllowed) {
            const addr = await freighter.getAddress()
            if (addr.address) {
              setPublicKey(addr.address)
              setIsConnected(true)
            }
          }
        }
      } catch {
        setIsInstalled(false)
      }
    }
    check()
  }, [])

  const connect = useCallback(async () => {
    setIsConnecting(true)
    try {
      const freighter = await import("@stellar/freighter-api")
      await freighter.requestAccess()
      const addr = await freighter.getAddress()
      if (addr.address) {
        setPublicKey(addr.address)
        setIsConnected(true)
      }
    } catch (err) {
      console.error("Freighter connect error:", err)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setPublicKey(null)
    setIsConnected(false)
  }, [])

  return { isConnected, publicKey, isInstalled, isConnecting, connect, disconnect }
}
