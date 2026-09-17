import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { useTransaction } from '../hooks/useTransaction'
import { makeWalletClient } from '../lib/clients'
import { applySlippage, fmtAmount } from '../lib/format'
import { executeBptExit, queryBptExit, type BptExitQuote } from '../lib/bptExit'
import type { LockData } from '../hooks/useLock'
import { TxStatusView } from './TxStatusView'

const SLIPPAGE_PCT = 1

export function BptExitCard({ data }: { data: LockData }) {
  const { account, readOnly, scanTarget } = useApp()
  const { status, send } = useTransaction()
  const { bptBalance, poolTokens, refresh } = data

  const [quote, setQuote] = useState<BptExitQuote | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [quoting, setQuoting] = useState(false)

  const busy = status.state === 'pending' || status.state === 'confirming'
  const canExit = Boolean(bptBalance > 0n && quote && account && !readOnly && !busy)

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

  async function onExit() {
    if (!account || !quote) return
    const walletClient = makeWalletClient(account)
    const ok = await send('Exit BPT', () =>
      executeBptExit(walletClient, account, poolTokens, quote, SLIPPAGE_PCT, false)
    )
    if (ok) {
      setQuote(null)
      refresh()
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <strong>Exit 80BAL-20WETH BPT</strong>
        <span className="muted">
          Proportional exit — you receive BAL and WETH in the pool's ratio. No auto-unwrap.
        </span>
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

      <div className="row-between" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <div className="amount">{fmtAmount(bptBalance, 18)} BPT</div>
        <button className="btn-primary" style={{ minWidth: 160 }} disabled={!canExit} onClick={onExit}>
          Exit BPT
        </button>
      </div>

      {readOnly && <div className="muted" style={{ marginTop: 8 }}>watch mode — actions disabled</div>}
      {!account && <div className="muted" style={{ marginTop: 8 }}>connect a wallet to exit</div>}

      <TxStatusView status={status} />
    </div>
  )
}
