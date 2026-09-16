import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { useTransaction } from '../hooks/useTransaction'
import { makeWalletClient } from '../lib/clients'
import { applySlippage, fmtAmount, parseAmount } from '../lib/format'
import {
  emergencyBptQuote,
  executeBptExit,
  queryBptExit,
  type BptExitQuote,
} from '../lib/bptExit'
import type { LockData } from '../hooks/useLock'
import { TxStatusView } from './TxStatusView'

export function BptExitCard({ data }: { data: LockData }) {
  const { account, readOnly, scanTarget } = useApp()
  const { status, send } = useTransaction()
  const { bptBalance, poolTokens, refresh } = data

  const [amountInput, setAmountInput] = useState('')
  const [slippage, setSlippage] = useState('1')
  const [emergency, setEmergency] = useState(false)
  const [quote, setQuote] = useState<BptExitQuote | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [quoting, setQuoting] = useState(false)
  const debounceRef = useRef<number>()

  const bptIn = amountInput ? parseAmount(amountInput, 18) : bptBalance
  const validAmount = bptIn !== null && bptIn > 0n && bptIn <= bptBalance
  const slippagePct = Number(slippage) >= 0 ? Number(slippage) : 1
  const busy = status.state === 'pending' || status.state === 'confirming'

  const refreshQuote = useCallback(async () => {
    if (!validAmount || !scanTarget || poolTokens.length === 0) return
    setQuoting(true)
    setQuoteError('')
    try {
      setQuote(await queryBptExit(data.publicClient, scanTarget, poolTokens, bptIn!))
    } catch (e: any) {
      setQuote(null)
      setQuoteError(String(e.shortMessage ?? e.message ?? e))
    } finally {
      setQuoting(false)
    }
  }, [data.publicClient, scanTarget, poolTokens, bptIn, validAmount])

  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(refreshQuote, 400)
    return () => window.clearTimeout(debounceRef.current)
  }, [refreshQuote])

  async function onExit() {
    if (!account || !validAmount) return
    if (!quote && !emergency) return
    const effectiveQuote = quote ?? emergencyBptQuote(poolTokens.length, bptIn!)
    const walletClient = makeWalletClient(account)
    const ok = await send('Exit BPT', () =>
      executeBptExit(walletClient, account, poolTokens, effectiveQuote, slippagePct, emergency)
    )
    if (ok) {
      setAmountInput('')
      setQuote(null)
      refresh()
    }
  }

  if (bptBalance === 0n) return null

  return (
    <div className="card">
      <div className="row-between" style={{ flexWrap: 'wrap' }}>
        <div>
          <strong>Exit 80BAL-20WETH BPT</strong> <span className="badge">Balancer v2</span>
        </div>
        <div className="mono">{fmtAmount(bptBalance, 18)} BPT</div>
      </div>

      <div className="muted" style={{ marginTop: 8 }}>
        Proportional exit — you receive BAL and WETH in the pool's ratio. No auto-unwrap.
      </div>

      <div className="card-inner" style={{ marginTop: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input
            style={{ flex: 1, minWidth: 160 }}
            placeholder={`amount (max ${fmtAmount(bptBalance, 18)})`}
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
          />
          <button className="btn-secondary" onClick={() => setAmountInput('')}>
            Max
          </button>
          <label className="row muted">
            slippage&nbsp;
            <input
              style={{ width: 60 }}
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
            />
            %
          </label>
        </div>

        {amountInput && !validAmount && (
          <div className="error-box" style={{ marginTop: 8 }}>
            Invalid amount (max {fmtAmount(bptBalance, 18)})
          </div>
        )}

        {quoting && (
          <div className="muted row" style={{ marginTop: 8 }}>
            <span className="spinner" /> simulating exit...
          </div>
        )}

        {quoteError && (
          <div className="warning-box" style={{ marginTop: 8 }}>
            Exit simulation failed: {quoteError}
            <br />
            You can still try an emergency exit (no minimum amounts).
          </div>
        )}

        {quote && !quoting && (
          <table className="amounts" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Token</th>
                <th>Expected</th>
                <th>Minimum ({emergency ? 'none' : `${slippagePct}% slippage`})</th>
              </tr>
            </thead>
            <tbody>
              {poolTokens.map((t, i) => (
                <tr key={t.address}>
                  <td>{t.symbol}</td>
                  <td className="mono">{fmtAmount(quote.amountsOut[i] ?? 0n, t.decimals)}</td>
                  <td className="mono">
                    {emergency
                      ? '0'
                      : fmtAmount(applySlippage(quote.amountsOut[i] ?? 0n, slippagePct), t.decimals)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <label
            className="row muted"
            title="Submit with zero minimum amounts — no slippage protection"
          >
            <input
              type="checkbox"
              checked={emergency}
              onChange={(e) => setEmergency(e.target.checked)}
            />
            emergency mode
          </label>
          <button
            className={emergency ? 'btn-danger' : 'btn-primary'}
            disabled={
              readOnly ||
              !account ||
              !validAmount ||
              (!quote && !emergency) ||
              busy ||
              poolTokens.length === 0
            }
            onClick={onExit}
          >
            {emergency ? 'Emergency exit' : 'Exit BPT'}
          </button>
          {readOnly && <span className="muted">watch mode — actions disabled</span>}
        </div>

        {emergency && (
          <div className="warning-box" style={{ marginTop: 8 }}>
            Emergency mode submits with minAmountsOut = 0. You accept whatever the pool returns —
            no sandwich/slippage protection.
          </div>
        )}

        <TxStatusView status={status} />
      </div>
    </div>
  )
}
