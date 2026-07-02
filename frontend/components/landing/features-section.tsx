"use client"

import { useEffect, useRef, useState } from "react"

const features = [
  {
    number: "01",
    title: "ZK Identity Gate",
    description:
      "Your KYC tier is proven with a Groth16 zero-knowledge proof. No documents stored on-chain — just a verified tier number, a nullifier to prevent replay, and an expiry. The Soroban verifier calls Stellar's native BN254 pairing_check host function to validate the proof.",
    visual: "zk",
  },
  {
    number: "02",
    title: "Tier-Based Leverage",
    description:
      "Your verified tier governs your leverage cap. Tier 1 (Basic) unlocks 1x. Tier 2 (Verified) unlocks 2x. Tier 3 (Trusted) unlocks 5x. Tier 4 (Premium) unlocks 10x. The SynthVault contract enforces it atomically — not an admin.",
    visual: "tier",
  },
  {
    number: "03",
    title: "Synthetic Stock Positions",
    description:
      "Deposit USDC collateral and open long or short synthetic positions on 12 assets — sAAPL, sTSLA, sNVDA, sMSFT, sAMZN, sGOOG, sMETA, sNFLX, sAMD, sJPM, sSPY, and sPFE. Prices are pushed on-chain every 60 seconds by an admin oracle via the vault's set_prices instruction and settle atomically at close.",
    visual: "synth",
  },
  {
    number: "04",
    title: "Native Stellar Stack",
    description:
      "Built on Soroban — Stellar's Rust-based smart contract platform. Uses Protocol 25 BLS12-381 pairing_check host functions for cheap ZK verification on-chain. Freighter wallet for user signing. Systematic Investment Plans (SIP) are enforced by a dedicated Soroban contract. No bridges, no EVM.",
    visual: "chain",
  },
]

function ZKVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <circle cx="100" cy="80" r="50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4">
        <animateTransform attributeName="transform" type="rotate" from="0 100 80" to="360 100 80" dur="20s" repeatCount="indefinite" />
      </circle>
      <circle cx="100" cy="80" r="30" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4">
        <animateTransform attributeName="transform" type="rotate" from="360 100 80" to="0 100 80" dur="12s" repeatCount="indefinite" />
      </circle>
      <circle cx="100" cy="80" r="8" fill="currentColor">
        <animate attributeName="r" values="8;10;8" dur="2s" repeatCount="indefinite" />
      </circle>
      {[0, 1, 2, 3].map((i) => {
        const angle = (i * 90 * Math.PI) / 180
        return (
          <circle key={i} cx={100 + Math.cos(angle) * 50} cy={80 + Math.sin(angle) * 50} r="5" fill="none" stroke="currentColor" strokeWidth="2">
            <animate attributeName="opacity" values="1;0.3;1" dur="2s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
          </circle>
        )
      })}
      <text x="100" y="84" textAnchor="middle" fontSize="10" fontFamily="monospace" fill="currentColor" opacity="0.6">ZK</text>
    </svg>
  )
}

function TierVisual() {
  const tiers = [
    { label: "T1", bars: 2, max: 10 },
    { label: "T2", bars: 4, max: 10 },
    { label: "T3", bars: 7, max: 10 },
    { label: "T4", bars: 10, max: 10 },
  ]
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {tiers.map((tier, i) => (
        <g key={tier.label}>
          <rect x={20 + i * 45} y={140 - tier.bars * 12} width="30" height={tier.bars * 12} rx="2" fill="currentColor" opacity={0.15 + i * 0.2}>
            <animate attributeName="height" values={`0;${tier.bars * 12}`} dur="1s" begin={`${i * 0.2}s`} fill="freeze" />
            <animate attributeName="y" values={`140;${140 - tier.bars * 12}`} dur="1s" begin={`${i * 0.2}s`} fill="freeze" />
          </rect>
          <text x={35 + i * 45} y="155" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="currentColor" opacity="0.6">{tier.label}</text>
          <text x={35 + i * 45} y={132 - tier.bars * 12} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="currentColor">
            {[1, 2, 5, 10][i]}x
          </text>
        </g>
      ))}
      <line x1="15" y1="140" x2="185" y2="140" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    </svg>
  )
}

function SynthVisual() {
  const rows = [
    { label: "sAAPL", w: 110 },
    { label: "sTSLA", w:  85 },
    { label: "sNVDA", w:  95 },
    { label: "sMSFT", w: 120 },
    { label: "sAMZN", w:  75 },
  ]
  return (
    <svg viewBox="0 0 200 185" className="w-full h-full">
      {rows.map((r, i) => (
        <g key={r.label}>
          <rect x="18" y={8 + i * 34} width="164" height="22" rx="2" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
          <rect x="18" y={8 + i * 34} width="0" height="22" rx="2" fill="currentColor" opacity="0.10">
            <animate attributeName="width" values={`0;${r.w}`} dur="1.2s" begin={`${i * 0.2}s`} fill="freeze" />
          </rect>
          <text x="26" y={23 + i * 34} fontSize="8" fontFamily="monospace" fill="currentColor" opacity="0.85">{r.label}</text>
          <circle cx="172" cy={19 + i * 34} r="2.5" fill="currentColor" opacity="0.5">
            <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" begin={`${i * 0.35}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
      <text x="100" y="182" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="currentColor" opacity="0.35">+7 more assets</text>
    </svg>
  )
}

function ChainVisual() {
  const contracts = ["ZK\nVERIFY", "TIER\nMGR", "VAULT", "SIP"]
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {contracts.map((label, i) => {
        const x = 8 + i * 47
        return (
          <g key={label}>
            <rect x={x} y="45" width="40" height="44" rx="3" fill="none" stroke="currentColor" strokeWidth="1.2">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" begin={`${i * 0.75}s`} repeatCount="indefinite" />
            </rect>
            {label.split("\n").map((word, wi) => (
              <text key={wi} x={x + 20} y={63 + wi * 11} textAnchor="middle" fontSize="6.5" fontFamily="monospace" fill="currentColor" opacity="0.75">
                {word}
              </text>
            ))}
            {i < contracts.length - 1 && (
              <line x1={x + 40} y1="67" x2={x + 47} y2="67" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2">
                <animate attributeName="stroke-dashoffset" values="0;-4" dur="0.4s" repeatCount="indefinite" />
              </line>
            )}
          </g>
        )
      })}
      <text x="100" y="118" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="currentColor" opacity="0.4">Stellar Soroban · BLS12-381</text>
    </svg>
  )
}

function AnimatedVisual({ type }: { type: string }) {
  switch (type) {
    case "zk":    return <ZKVisual />
    case "tier":  return <TierVisual />
    case "synth": return <SynthVisual />
    case "chain": return <ChainVisual />
    default:      return <ZKVisual />
  }
}

function FeatureCard({ feature, index }: { feature: (typeof features)[0]; index: number }) {
  const [isVisible, setIsVisible] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.2 },
    )
    if (cardRef.current) observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={cardRef}
      className={`group relative transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 py-12 lg:py-20 border-b border-foreground/10">
        <div className="shrink-0">
          <span className="font-mono text-sm text-muted-foreground">{feature.number}</span>
        </div>
        <div className="flex-1 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-3xl lg:text-4xl font-sans font-semibold mb-4 group-hover:translate-x-2 transition-transform duration-500">
              {feature.title}
            </h3>
            <p className="text-lg text-muted-foreground leading-relaxed">{feature.description}</p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <div className="w-48 h-40 text-foreground">
              <AnimatedVisual type={feature.visual} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.1 },
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="features" ref={sectionRef} className="relative py-24 lg:py-32">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-16 lg:mb-24">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            Protocol capabilities
          </span>
          <h2
            className={`text-4xl lg:text-6xl font-sans font-semibold tracking-tight transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Identity governs access.
            <br />
            <span className="text-muted-foreground">Proof governs terms.</span>
          </h2>
        </div>
        <div>
          {features.map((feature, index) => (
            <FeatureCard key={feature.number} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
