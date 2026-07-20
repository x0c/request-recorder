export function generateId(): string {
  return crypto.randomUUID()
}

export function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "-"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}
