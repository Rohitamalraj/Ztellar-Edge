"use client"

import { useEffect, useRef, useState } from "react"

const metrics = [
  { value: "$5.5B+", label: "Stellar payment volume", sub: "Q1 2026" },
  { value: "$2B+", label: "Tokenized RWAs on Stellar", sub: "2026" },
  { value: "28.9%", label: "Web3 identity market CAGR", sub: "2025–2034" },
  { value: "4 tiers", label: "ZK-governed leverage caps", sub: "Tier 1 → 10x" },
]

export function MetricsSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.2 },
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} className="py-16 border-y border-foreground/10 bg-foreground/[0.02]">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 lg:divide-x divide-foreground/10">
          {metrics.map((metric, i) => (
            <div
              key={metric.label}
              className={`lg:px-8 first:pl-0 last:pr-0 transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="text-4xl lg:text-5xl font-sans font-semibold tracking-tight mb-2">{metric.value}</div>
              <div className="text-muted-foreground text-sm">{metric.label}</div>
              <div className="font-mono text-xs text-muted-foreground/60 mt-1">{metric.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
