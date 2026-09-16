import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { applySlippage, fmtAmount } from '../lib/format'
import { queryBptExit, type BptExitQuote } from '../lib/bptExit'
import type { LockData } from '../hooks/useLock'

const SLIPPAGE_PCT = 1

export function BptExitCard({ data }: { data: LockData }) {
  const { scanTarget } = useApp()
  const { bptBalance, poolTokens } = data

  const [quote, setQuote] = useState<BptExitQuote | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [quoting, setQuoting] = useState(false)

  const refreshQuote = useCallback(async () => {
    if (bptBalance === 0n || !scanTarget || poolTokens.length === 0) return
    setQuoting(true)
    setQuoteError('')
    try {
      setQuote(await queryBptExit(data.publicClient, scanTarget, poolTokens, bptBalance))
    } catch (e: any) {
      setQuote(null)
      setQuoteError(String(e.shortMessage ?? e.message ?? e))
    } finally {
      setQuoting(false)
    }
  }, [data.publicClient, scanTarget, poolTokens, bptBalance])

  useEffect(() => {
    refreshQuote()
  }, [refreshQuote])

  return (
    <div className="card">
      <div className="row-between" style={{ flexWrap: 'wrap' }}>
        <div>
          <strong>Exit 80BAL-20WETH BPT</strong> <span className="badge">Balancer v2</span>
        </div>
        <div className="mono">{fmtAmount(bptBalance, 18)} BPT</div>
      </div>

      <div className="muted" style={{ marginTop: 12 }}>
        Proportional exit — you receive BAL and WETH in the pool's ratio. No auto-unwrap.
      </div>

      {quoting && (
        <div className="muted row" style={{ marginTop: 12 }}>
          <span className="spinner" /> simulating exit...
        </div>
      )}

      {quoteError && (
        <div className="warning-box" style={{ marginTop: 12 }}>
          Exit simulation failed: {quoteError}
        </div>
      )}

      {quote && !quoting && (
        <table className="amounts" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Token</th>
              <th>Expected</th>
              <th>Minimum ({SLIPPAGE_PCT}% slippage)</th>
            </tr>
          </thead>
          <tbody>
            {poolTokens.map((t, i) => (
              <tr key={t.address}>
                <td>{t.symbol}</td>
                <td className="mono">{fmtAmount(quote.amountsOut[i] ?? 0n, t.decimals)}</td>
                <td className="mono">
                  {fmtAmount(applySlippage(quote.amountsOut[i] ?? 0n, SLIPPAGE_PCT), t.decimals)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button className="btn-primary" style={{ minWidth: 160 }} disabled>
          Exit BPT
        </button>
      </div>
    </div>
  )
}
