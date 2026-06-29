"use client"

import { useEffect, useRef, useState } from "react"
import { ShieldCheck, EyeOff, Lock, Cpu, GitBranch, Zap } from "lucide-react"

const ITEMS = [
  {
    icon: ShieldCheck,
    title: "On-chain Groth16",
    body: "Proofs verified by Soroban using Stellar's native BLS12-381 pairing host functions — no trusted third party.",
  },
  {
    icon: EyeOff,
    title: "Zero data exposure",
    body: "Your wallet activity score never leaves your browser. Only the cryptographic proof is transmitted.",
  },
  {
    icon: Lock,
    title: "Nullifier anti-replay",
    body: "Each proof includes a Poseidon-hashed nullifier. The contract rejects reused proofs at the protocol level.",
  },
  {
    icon: Cpu,
    title: "BLS12-381 native",
    body: "Stellar's VM exposes G1/G2 arithmetic and multi-pairing as host calls — cheaper and faster than EVM emulation.",
  },
  {
    icon: GitBranch,
    title: "Open circuit",
    body: "The Circom circuit (573 constraints) is open source. Anyone can audit the score-to-tier mapping.",
  },
  {
    icon: Zap,
    title: "30-day expiry",
    body: "Verified tiers expire after 30 days. Re-verification keeps leverage caps aligned with current wallet activity.",
  },
]

export function SecuritySection() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={ref} className="py-24 border-t border-foreground/10 bg-foreground/[0.015]">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className={`mb-14 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <span className="inline-flex items-center gap-3 font-mono text-xs text-muted-foreground mb-4">
            <span className="w-8 h-px bg-foreground/30" />
            Security
          </span>
          <h2 className="text-3xl lg:text-5xl font-sans font-semibold tracking-tight">
            Privacy by construction
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl">
            Every privacy guarantee in Ztellar Edge is enforced by cryptography — not policy.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px border border-foreground/10">
          {ITEMS.map((item, i) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                className={`p-8 border-r border-b border-foreground/10 bg-background transition-all duration-500 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Icon className="w-5 h-5 mb-4 text-foreground/60" />
                <h3 className="font-sans font-semibold mb-2">{item.title}</h3>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
