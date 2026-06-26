"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { AnimatedSphere } from "./animated-sphere"
import Link from "next/link"

const words = ["prove", "trade", "protect", "verify"]

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false)
  const [wordIndex, setWordIndex] = useState(0)

  useEffect(() => { setIsVisible(true) }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative min-h-[145vh] flex flex-col overflow-hidden">
      {/* Animated background sphere */}
      <div className="absolute right-0 top-1/3 -translate-y-1/2 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] opacity-40 pointer-events-none">
        <AnimatedSphere />
      </div>

      {/* Grid background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        {[...Array(8)].map((_, i) => (
          <div key={`h-${i}`} className="absolute h-px bg-foreground/10" style={{ top: `${12.5 * (i + 1)}%`, left: 0, right: 0 }} />
        ))}
        {[...Array(12)].map((_, i) => (
          <div key={`v-${i}`} className="absolute w-px bg-foreground/10" style={{ left: `${8.33 * (i + 1)}%`, top: 0, bottom: 0 }} />
        ))}
      </div>

      {/* Title + description */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 pt-36 lg:pt-44">
        <div className={`mb-8 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground">
            <span className="w-8 h-px bg-foreground/30" />
            ZK-proven access to leveraged synthetic trading on Stellar
          </span>
        </div>

        <div className="mb-14">
          <h1
            className={`text-[clamp(2.5rem,7vw,7rem)] font-sans font-semibold leading-[0.9] tracking-tight transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="block">Trade synthetics</span>
            <span className="block">
              with ZK{" "}
              <span className="relative inline-block overflow-hidden pb-3">
                <span key={wordIndex} className="inline-flex whitespace-nowrap">
                  {words[wordIndex].split("").map((char, i) => (
                    <span
                      key={`${wordIndex}-${i}`}
                      className="inline-block animate-char-in"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      {char}
                    </span>
                  ))}
                </span>
                <span className="absolute -bottom-2 left-0 right-0 h-3 bg-foreground/10" />
              </span>
            </span>
          </h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24">
          <p
            className={`text-xl lg:text-2xl text-muted-foreground leading-relaxed transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Prove your KYC tier with a zero-knowledge proof. Unlock tier-based leverage on synthetic stocks — sAAPL, sTSLA, sNVDA — enforced on Soroban smart contracts. Nobody sees your identity data.
          </p>
        </div>
      </div>

      {/* CTA buttons */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 mt-28 lg:mt-36">
        <div
          className={`flex flex-col sm:flex-row items-start gap-4 transition-all duration-700 delay-300 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <Link href="/prove">
            <Button size="lg" className="bg-foreground hover:bg-foreground/90 text-background px-8 h-14 text-base rounded-full group">
              Prove Your Tier
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link href="/trade">
            <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-full border-foreground/20 hover:bg-foreground/5">
              Launch Trading App
            </Button>
          </Link>
        </div>
      </div>

      {/* Marquee stats */}
      <div className={`absolute bottom-8 left-0 right-0 transition-all duration-700 delay-500 ${isVisible ? "opacity-100" : "opacity-0"}`}>
        <div className="flex gap-16 marquee whitespace-nowrap">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-16">
              {[
                { value: "$5.5B+", label: "Stellar payment volume Q1 2026", tag: "STELLAR" },
                { value: "$12.8B", label: "Web3 identity market by 2034", tag: "MARKET" },
                { value: "4 tiers", label: "ZK-governed leverage caps", tag: "ZK" },
                { value: "$2B+", label: "Tokenized RWAs on Stellar", tag: "RWA" },
              ].map((stat) => (
                <div key={`${stat.tag}-${i}`} className="flex items-baseline gap-4">
                  <span className="text-4xl lg:text-5xl font-sans font-semibold">{stat.value}</span>
                  <span className="text-sm text-muted-foreground">
                    {stat.label}
                    <span className="block font-mono text-xs mt-1">{stat.tag}</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
