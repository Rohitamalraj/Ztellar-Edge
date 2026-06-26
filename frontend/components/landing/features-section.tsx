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
    title: "Synthetic Stock Tokens",
    description:
      "Deposit collateral, mint synthetic exposure to sAAPL, sTSLA, and sNVDA. Synthetic tokens follow Stellar's SEP-0041 standard. Prices are fed by the Reflector oracle network — Stellar's native decentralized price oracle.",
    visual: "synth",
  },
  {
    number: "04",
    title: "Native Stellar Stack",
    description:
      "Built on Soroban — Stellar's Rust-based smart contract platform. Uses Protocol 25 BN254 and Poseidon host functions for cheap ZK verification. Freighter wallet for user signing. No bridges, no EVM.",
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
  const assets = ["sAAPL", "sTSLA", "sNVDA"]
  const widths = [110, 85, 95]
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {assets.map((a, i) => (
        <g key={a}>
          <rect x="30" y={30 + i * 38} width="140" height="26" rx="3" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
          <rect x="30" y={30 + i * 38} width="0" height="26" rx="3" fill="currentColor" opacity="0.12">
            <animate attributeName="width" values={`0;${widths[i]}`} dur="1.5s" begin={`${i * 0.3}s`} fill="freeze" />
          </rect>
          <text x="40" y={47 + i * 38} fontSize="9" fontFamily="monospace" fill="currentColor">{a}</text>
          <circle cx="158" cy={43 + i * 38} r="3" fill="currentColor" opacity="0.6">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
    </svg>
  )
}

function ChainVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={20 + i * 60} y="55" width="50" height="50" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" begin={`${i}s`} repeatCount="indefinite" />
          </rect>
          <text x={45 + i * 60} y="80" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="currentColor" opacity="0.7">
            {["ZK VERIFY", "TIER MGR", "VAULT"][i].split(" ").map((w, wi) => (
              <tspan key={wi} x={45 + i * 60} dy={wi === 0 ? 0 : 10}>{w}</tspan>
            ))}
          </text>
          {i < 2 && (
            <line x1={70 + i * 60} y1="80" x2={80 + i * 60} y2="80" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2">
              <animate attributeName="stroke-dashoffset" values="0;-5" dur="0.5s" repeatCount="indefinite" />
            </line>
          )}
        </g>
      ))}
      <text x="100" y="130" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="currentColor" opacity="0.5">Stellar Soroban</text>
      <line x1="40" y1="122" x2="160" y2="122" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
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
