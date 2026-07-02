"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Menu, X, ShieldCheck, Shield } from "lucide-react"
import { useFreighter } from "@/hooks/use-freighter"
import { tierLabel, tierColor, type TierNumber } from "@/hooks/use-tier"
import { shortenAddress } from "@/lib/utils"

interface AppNavProps {
  tier?: TierNumber
  isVerified?: boolean
  onVerifyClick?: () => void
}

export function AppNav({ tier = 0, isVerified = false, onVerifyClick }: AppNavProps) {
  const pathname = usePathname()
  const { isConnected, publicKey, isConnecting, connect, disconnect } = useFreighter()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const isLandingPage = pathname === "/"

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navItems = [
    { name: "Trade", href: "/trade" },
    { name: "Positions", href: "/positions" },
    { name: "SIP", href: "/sip" },
    { name: "Prove", href: "/prove" },
    { name: "How it works", href: isLandingPage ? "#how-it-works" : "/#how-it-works" },
  ]

  const tierLabelStr = tierLabel(tier as TierNumber)
  const tColor = tierColor(tier as TierNumber)

  return (
    <>
      <header
        className={`fixed z-50 transition-all duration-500 ${
          isLandingPage && isScrolled ? "top-4 left-4 right-4" : "top-0 left-0 right-0"
        }`}
      >
        <nav
          className={`mx-auto transition-all duration-500 ${
            isLandingPage && (isScrolled || isMobileMenuOpen)
              ? "bg-background/80 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-lg max-w-[1200px]"
              : isLandingPage
              ? "bg-transparent max-w-[1400px]"
              : "bg-background/90 backdrop-blur-xl border-b border-foreground/10"
          }`}
        >
          <div
            className={`flex items-center justify-between transition-all duration-500 px-6 lg:px-8 ${
              isLandingPage && isScrolled ? "h-14" : "h-16"
            }`}
          >
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <span className="font-sans tracking-tight text-xl font-semibold">Ztellar Edge</span>
              <span className="text-muted-foreground font-mono text-[10px] mt-0.5">ZK</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                if (item.href.startsWith("#") || item.href.startsWith("/#")) {
                  return (
                    <a
                      key={item.name}
                      href={item.href}
                      className="px-4 py-2 font-mono text-xs text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors"
                    >
                      {item.name}
                    </a>
                  )
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 font-mono text-xs transition-colors ${
                      isActive
                        ? "bg-foreground text-background"
                        : "text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              })}
            </div>

            {/* Right side */}
            <div className="hidden md:flex items-center gap-3">
              {/* Tier badge */}
              {!isLandingPage && isVerified && (
                <div className="px-3 py-1 border border-foreground/10 font-mono text-[10px]">
                  <span className="text-muted-foreground">TIER </span>
                  <span style={{ color: tColor }}>{tier}</span>
                  <span className="text-muted-foreground"> • {tierLabelStr}</span>
                </div>
              )}

              {/* Verify button */}
              {!isLandingPage && isConnected && onVerifyClick && (
                <button
                  onClick={onVerifyClick}
                  className={`flex items-center gap-1.5 font-mono text-[10px] px-3 py-1.5 border transition-all duration-200 ${
                    isVerified
                      ? "border-green-700/30 text-green-700 hover:bg-green-700/5"
                      : "border-primary/40 text-primary hover:bg-primary/5 animate-pulse"
                  }`}
                >
                  {isVerified ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                  {isVerified ? "Verified" : "Verify Identity"}
                </button>
              )}

              {/* Wallet connect */}
              <button
                onClick={isConnected ? disconnect : connect}
                disabled={isConnecting}
                className={`font-mono border border-foreground/20 hover:border-foreground/60 hover:bg-foreground/5 transition-all duration-300 ${
                  isLandingPage && isScrolled ? "px-3 h-8 text-xs rounded-full" : "px-4 py-2 text-xs"
                }`}
              >
                {isConnecting
                  ? "Connecting..."
                  : isConnected && publicKey
                  ? shortenAddress(publicKey)
                  : "Connect Wallet"}
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={`md:hidden fixed inset-0 bg-background z-40 transition-all duration-500 ${
          isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col h-full px-8 pt-28 pb-8">
          <div className="flex-1 flex flex-col justify-center gap-8">
            {navItems.map((item, i) => {
              const Comp = item.href.startsWith("#") || item.href.startsWith("/#") ? "a" : Link
              return (
                <Comp
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-4xl font-sans font-semibold text-foreground hover:text-muted-foreground transition-all duration-500 ${
                    isMobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: isMobileMenuOpen ? `${i * 75}ms` : "0ms" }}
                >
                  {item.name}
                </Comp>
              )
            })}
          </div>

          <div
            className={`flex flex-col gap-3 pt-8 border-t border-foreground/10 transition-all duration-500 ${
              isMobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: isMobileMenuOpen ? "300ms" : "0ms" }}
          >
            {isVerified && (
              <div className="px-4 py-3 border border-foreground/10 font-mono text-sm text-center">
                <span className="text-muted-foreground">TIER </span>
                <span style={{ color: tColor }}>{tier}</span>
                <span className="text-muted-foreground"> • {tierLabelStr}</span>
              </div>
            )}
            <button
              onClick={() => { (isConnected ? disconnect : connect)(); setIsMobileMenuOpen(false) }}
              className="w-full border border-foreground/20 h-14 text-base font-mono hover:bg-foreground/5 transition-colors"
            >
              {isConnected && publicKey ? shortenAddress(publicKey) : "Connect Wallet"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
