import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getStockLogoUrl(ticker: string): string {
  const clean = ticker.startsWith("s") ? ticker.slice(1) : ticker
  return `https://api.logokit.com/logo?token=${clean}&format=png&size=64`
}

export function formatPrice(price: number): string {
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : ""
  return `${sign}$${Math.abs(pnl).toFixed(2)}`
}

export function shortenAddress(address: string): string {
  if (!address) return ""
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}
