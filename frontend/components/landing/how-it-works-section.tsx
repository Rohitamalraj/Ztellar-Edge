"use client"

import { useEffect, useRef, useState } from "react"

const steps = [
  {
    step: "01",
    title: "Connect Freighter",
    description: "Connect your Stellar wallet using the Freighter browser extension. No MetaMask, no bridges — pure Stellar-native.",
  },
  {
    step: "02",
    title: "Generate ZK Proof",
    description: "Our oracle scores your wallet activity. snarkjs generates a Groth16 proof in your browser — your raw data never leaves your device.",
  },
  {
    step: "03",
    title: "Verify On Stellar",
    description: "The proof is submitted to a Soroban verifier contract that calls Stellar's native BN254 pairing_check host function. Your tier is stored on-chain.",
  },
  {
    step: "04",
    title: "Trade With Edge",
    description: "Open synthetic positions in sAAPL, sTSLA, or sNVDA. Your tier determines your leverage cap — enforced atomically by the SynthVault contract.",
  },
]

export function HowItWorksSection() {
  const [visibleSteps, setVisibleSteps] = useState<Set<number>>(new Set())
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const observers = stepRefs.current.map((ref, i) => {
      if (!ref) return null
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setVisibleSteps((prev) => new Set([...prev, i]))
        },
        { threshold: 0.3 },
      )
      observer.observe(ref)
      return observer
    })
    return () => observers.forEach((o) => o?.disconnect())
  }, [])

  return (
    <section id="how-it-works" className="py-24 lg:py-32 border-t border-foreground/10">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-16 lg:mb-24">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            How it works
          </span>
          <h2 className="text-4xl lg:text-6xl font-sans font-semibold tracking-tight">
            Four steps.
            <br />
            <span className="text-muted-foreground">Zero exposure.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {steps.map((step, i) => (
            <div
              key={step.step}
              ref={(el) => { stepRefs.current[i] = el }}
              className={`transition-all duration-700 ${
                visibleSteps.has(i) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <div className="mb-6">
                <span className="font-mono text-xs text-muted-foreground">{step.step}</span>
                <div className="mt-3 h-px bg-foreground/10 relative">
                  <div
                    className="absolute left-0 top-0 h-full bg-foreground transition-all duration-1000"
                    style={{ width: visibleSteps.has(i) ? "100%" : "0%" }}
                  />
                </div>
              </div>
              <h3 className="text-xl font-sans font-semibold mb-3">{step.title}</h3>
              <p className="text-muted-foreground text-base leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>

        {/* Flow diagram */}
        <div className="mt-20 lg:mt-28 hidden lg:flex items-center justify-center gap-0">
          {["Freighter Wallet", "ZK Proof (snarkjs)", "Soroban Verifier", "SynthVault Trade"].map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="px-5 py-3 border border-foreground/10 text-sm font-mono text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-all">
                {label}
              </div>
              {i < 3 && (
                <div className="flex items-center">
                  <div className="w-8 h-px bg-foreground/20" />
                  <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[6px] border-l-foreground/20" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
