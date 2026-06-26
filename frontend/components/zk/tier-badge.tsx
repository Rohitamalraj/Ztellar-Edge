import { ShieldCheck } from "lucide-react"
import { tierLabel, tierLeverageCap, tierColor, type TierNumber } from "@/hooks/use-tier"
import { cn } from "@/lib/utils"

interface TierBadgeProps {
  tier: TierNumber
  className?: string
  size?: "sm" | "md" | "lg"
  showCap?: boolean
}

export function TierBadge({ tier, className, size = "md", showCap = true }: TierBadgeProps) {
  const color = tierColor(tier)
  const label = tierLabel(tier)
  const cap = tierLeverageCap(tier)

  if (tier === 0) {
    return (
      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 border border-foreground/10 font-mono text-xs text-muted-foreground", className)}>
        <span>UNVERIFIED</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 border font-mono whitespace-nowrap",
        size === "sm" && "px-2 py-0.5 text-[10px]",
        size === "md" && "px-3 py-1 text-xs",
        size === "lg" && "px-4 py-2 text-sm",
        className,
      )}
      style={{ borderColor: `${color}40`, color }}
    >
      <ShieldCheck className={cn(size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4")} />
      <span>TIER {tier}</span>
      <span className="opacity-60">·</span>
      <span className="opacity-80">{label}</span>
      {showCap && (
        <>
          <span className="opacity-60">·</span>
          <span className="opacity-60">≤{cap}x</span>
        </>
      )}
    </div>
  )
}
