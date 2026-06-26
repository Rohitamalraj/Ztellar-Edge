"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShieldCheck, ShieldAlert, Menu, X } from "lucide-react"
import { useFreighter } from "@/hooks/use-freighter"
import { type TierNumber } from "@/hooks/use-tier"
import { TierBadge } from "@/components/zk/tier-badge"
import { shortenAddress } from "@/lib/utils"

interface DashboardNavProps {
  tier: TierNumber
  isVerified: boolean
  onVerifyClick?: () => void
}

export function DashboardNav({ tier, isVerified, onVerifyClick }: DashboardNavProps) {
  const pathname = usePathname()
  const { isConnected, publicKey, connect, disconnect } = useFreighter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-b border-foreground/10 h-[72px]">
        <div className="max-w-[1920px] mx-auto px-6 h-full flex items-center justify-between gap-4">
          {/* Left: Logo + mobile hamburger */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-sans font-semibold text-xl tracking-tight">Ztellar Edge</span>
              <span className="text-muted-foreground font-mono text-[10px] mt-0.5">ZK</span>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-muted/50 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Center: Nav pills */}
          <div className="hidden md:flex items-center gap-2 border border-foreground/10 px-2 py-1.5">
            {[
              { label: "Trade", href: "/trade" },
              { label: "Positions", href: "/positions" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-6 py-2 font-mono text-xs transition-all ${
                  pathname === item.href
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-foreground/[0.04]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Verified tier badge */}
            {isConnected && isVerified && (
              <div className="hidden md:block">
                <TierBadge tier={tier} size="sm" />
              </div>
            )}

            {/* Verify identity button */}
            {isConnected && !isVerified && (
              <Link
                href="/prove"
                className="hidden md:flex items-center gap-2 px-4 py-2 border border-yellow-600/30 bg-yellow-600/5 hover:border-yellow-600/50 transition-all"
              >
                <ShieldAlert className="w-4 h-4 text-yellow-600" />
                <span className="text-yellow-600 font-mono text-xs">Verify Identity</span>
              </Link>
            )}

            {/* Wallet connect */}
            <button
              onClick={isConnected ? disconnect : connect}
              className="font-mono text-xs border border-foreground/20 hover:border-foreground/60 hover:bg-foreground/5 transition-all px-4 py-2"
            >
              {isConnected && publicKey ? shortenAddress(publicKey) : "Connect Wallet"}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-[72px] left-0 right-0 bg-background/90 backdrop-blur-xl border-b border-foreground/10 p-4 animate-slide-in">
            <div className="flex flex-col gap-3">
              {[
                { label: "Trade", href: "/trade" },
                { label: "Positions", href: "/positions" },
                { label: "Prove Identity", href: "/prove" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full px-6 py-3 font-mono text-xs text-left border border-foreground/5 hover:bg-foreground/[0.04] transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              {isVerified && (
                <div className="px-4 py-3 mt-1">
                  <TierBadge tier={tier} size="sm" />
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  )
}
