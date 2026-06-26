import { AppNav } from "@/components/app/app-nav"
import { ProveAccessFlow } from "@/components/zk/prove-access-flow"

export default function ProvePage() {
  return (
    <>
      <AppNav />
      <main className="pt-24 pb-16 min-h-screen">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="mb-12">
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
              <span className="w-8 h-px bg-foreground/30" />
              Zero-knowledge identity verification
            </span>
            <h1 className="text-3xl lg:text-4xl font-sans font-semibold tracking-tight mb-3">
              Prove Your Tier
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl">
              Generate a Groth16 ZK proof of your wallet activity tier. Your raw data stays private — only the verified tier is stored on Stellar.
            </p>
          </div>
          <ProveAccessFlow />
        </div>
      </main>
    </>
  )
}
