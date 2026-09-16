import { formatUnits, parseUnits } from 'viem'

/** Human-readable token amount: trims to a sensible precision. */
export function fmtAmount(raw: bigint, decimals: number): string {
  const s = formatUnits(raw, decimals)
  const n = Number(s)
  if (n === 0) return '0'
  if (n < 0.0001) return s // show full precision for dust
  if (n < 1) return n.toFixed(6).replace(/\.?0+$/, '')
  if (n < 1000) return n.toFixed(4).replace(/\.?0+$/, '')
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function parseAmount(input: string, decimals: number): bigint | null {
  try {
    const v = parseUnits(input.trim() as `${number}`, decimals)
    return v >= 0n ? v : null
  } catch {
    return null
  }
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** minAmountOut = expected * (1 - slippagePct/100) */
export function applySlippage(expected: bigint, slippagePct: number): bigint {
  const bps = BigInt(Math.round(slippagePct * 100))
  return (expected * (10_000n - bps)) / 10_000n
}

/** Seconds -> "12d 4h" / "4h 30m" / "12m". */
export function fmtDuration(seconds: number): string {
  if (seconds <= 0) return '0m'
  const d = Math.floor(seconds / 86_400)
  const h = Math.floor((seconds % 86_400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Unix ms -> locale date string. */
export function fmtDate(ms: number): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 0..1 -> "12.34%" */
export function fmtPct(fraction: number): string {
  if (!Number.isFinite(fraction) || fraction <= 0) return '0%'
  if (fraction < 0.0001) return '<0.01%'
  return `${(fraction * 100).toFixed(2)}%`
}
