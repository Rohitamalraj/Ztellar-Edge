"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function CtaSection() {
  return (
    <section className="py-24 lg:py-40 border-t border-foreground/10">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            Get started
          </span>
          <h2 className="text-4xl lg:text-6xl font-sans font-semibold tracking-tight mb-8">
            Prove your tier.
            <br />
            <span className="text-muted-foreground">Trade with edge.</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed mb-12">
            Ztellar Edge is live on Stellar Testnet. Connect your Freighter wallet, generate a ZK proof in your browser, and start trading synthetic stocks with tier-appropriate leverage.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
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
      </div>
    </section>
  )
}
