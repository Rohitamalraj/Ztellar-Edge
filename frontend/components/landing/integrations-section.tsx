"use client"

import { useEffect, useRef, useState } from "react"

const INTEGRATIONS = [
  { name: "Stellar", desc: "Layer-1 blockchain" },
  { name: "Soroban", desc: "Smart contracts" },
  { name: "BLS12-381", desc: "Native ZK curves" },
  { name: "Groth16", desc: "Proof system" },
  { name: "Circom", desc: "Circuit compiler" },
  { name: "snarkjs", desc: "Browser prover" },
  { name: "Freighter", desc: "Stellar wallet" },
  { name: "SEP-0041", desc: "Token standard" },
  { name: "Horizon", desc: "On-chain oracle" },
]

export function IntegrationsSection() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.15 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={ref} className="py-24 border-t border-foreground/10">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className={`mb-14 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <span className="inline-flex items-center gap-3 font-mono text-xs text-muted-foreground mb-4">
            <span className="w-8 h-px bg-foreground/30" />
            Built on
          </span>
          <h2 className="text-3xl lg:text-5xl font-sans font-semibold tracking-tight">
            Stellar-native stack
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px border border-foreground/10">
          {INTEGRATIONS.map((item, i) => (
            <div
              key={item.name}
              className={`p-6 border-r border-b border-foreground/10 transition-all duration-500 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="font-mono text-xs font-semibold mb-1">{item.name}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
