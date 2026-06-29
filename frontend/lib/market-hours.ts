export function isUsEquityMarketOpen(): boolean {
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now)

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  const weekday = get("weekday")
  const hour = parseInt(get("hour"), 10)
  const minute = parseInt(get("minute"), 10)
  const totalMinutes = hour * 60 + minute

  if (weekday === "Sat" || weekday === "Sun") return false
  // NYSE: 9:30 AM – 4:00 PM ET
  return totalMinutes >= 9 * 60 + 30 && totalMinutes < 16 * 60
}

export function marketStatusLabel(): "Open" | "Closed" | "Pre-Market" | "After-Hours" {
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now)

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  const weekday = get("weekday")
  const hour = parseInt(get("hour"), 10)
  const minute = parseInt(get("minute"), 10)
  const total = hour * 60 + minute

  if (weekday === "Sat" || weekday === "Sun") return "Closed"
  if (total >= 4 * 60 && total < 9 * 60 + 30) return "Pre-Market"
  if (total >= 9 * 60 + 30 && total < 16 * 60) return "Open"
  if (total >= 16 * 60 && total < 20 * 60) return "After-Hours"
  return "Closed"
}
