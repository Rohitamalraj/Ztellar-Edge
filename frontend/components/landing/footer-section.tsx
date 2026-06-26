"use client"

import Link from "next/link"

const links = {
  Protocol: [
    { name: "Trade", href: "/trade" },
    { name: "Prove Identity", href: "/prove" },
    { name: "Positions", href: "/positions" },
  ],
  Developers: [
    { name: "GitHub", href: "https://github.com" },
    { name: "ZK Circuit", href: "#" },
    { name: "Soroban Contracts", href: "#" },
  ],
  Stellar: [
    { name: "Stellar Docs", href: "https://developers.stellar.org" },
    { name: "Soroban", href: "https://soroban.stellar.org" },
    { name: "Freighter Wallet", href: "https://freighter.app" },
  ],
  Resources: [
    { name: "Circom Docs", href: "https://docs.circom.io" },
    { name: "Stellar Hacks", href: "https://dorahacks.io" },
    { name: "Reflector Oracle", href: "https://reflector.network" },
  ],
}

export function FooterSection() {
  return (
    <footer className="border-t border-foreground/10 py-16 lg:py-20">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-8 mb-16">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-sans font-semibold text-xl tracking-tight">Ztellar Edge</span>
              <span className="font-mono text-[10px] text-muted-foreground">ZK</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
              Privacy-preserving synthetic trading on Stellar. ZK-proven tiers. Soroban enforcement.
            </p>
            <div className="flex items-center gap-2 mt-6">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-mono text-xs text-muted-foreground">Stellar Testnet live</span>
            </div>
          </div>

          {Object.entries(links).map(([section, items]) => (
            <div key={section}>
              <h4 className="font-mono text-xs text-muted-foreground mb-4 uppercase tracking-wider">{section}</h4>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-sm text-foreground/70 hover:text-foreground transition-colors"
                      {...(item.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-foreground/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="font-mono text-xs text-muted-foreground">
            © 2026 Ztellar Edge · Built for Stellar Hacks: Real-World ZK
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            Powered by Soroban · BN254 · snarkjs
          </span>
        </div>
      </div>
    </footer>
  )
}
