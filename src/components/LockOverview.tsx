import { useState } from 'react'
import { isAddress, type Address } from 'viem'
import { useApp } from '../contexts/AppContext'
import { fmtAmount, fmtDate, fmtDuration, fmtPct, shortAddr } from '../lib/format'
import type { LockData } from '../hooks/useLock'

export function LockOverview({ data }: { data: LockData }) {
  const { account, scanTarget, watchAddress, setWatchAddress } = useApp()
  const [watchInput, setWatchInput] = useState('')
  const { lock, bptBalance, bptTotalSupply, loading, error, refresh } = data

  // Elapsed fraction of the lock term, for the timeline bar.
  const totalTerm = lock && lock.hasLock ? Number(lock.end) * 1000 - (lock.lockedEndDate - lock.secondsRemaining * 1000) : 0
  const elapsed = lock && lock.hasLock ? totalTerm - lock.secondsRemaining * 1000 : 0
  const progress = totalTerm > 0 ? Math.min(1, Math.max(0, elapsed / totalTerm)) : 0

  return (
    <div className="card">
      <div className="row-between" style={{ flexWrap: 'wrap' }}>
        <div>
          <strong>Your veBAL lock</strong>
          {lock?.hasLock && (
            <>
              {' '}
              {lock.isExpired ? (
                <span className="badge badge-green">expired — ready to unlock</span>
              ) : (
                <span className="badge badge-blue">
                  active — {fmtDuration(lock.secondsRemaining)} remaining
                </span>
              )}
            </>
          )}
          {lock && !lock.hasLock && <span className="badge">no lock</span>}
        </div>
        <div className="row">
          <button className="btn-secondary" disabled={!scanTarget || loading} onClick={refresh}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <input
          style={{ flex: 1, minWidth: 220 }}
          className="mono"
          placeholder="...or watch any address (read-only)"
          value={watchInput}
          onChange={(e) => setWatchInput(e.target.value)}
        />
        <button
          className="btn-secondary"
          disabled={!isAddress(watchInput)}
          onClick={() => setWatchAddress(watchInput as Address)}
        >
          Watch
        </button>
        {watchAddress && (
          <button
            className="btn-secondary"
            onClick={() => {
              setWatchAddress(null)
              setWatchInput('')
            }}
          >
            Clear watch ({shortAddr(watchAddress)})
          </button>
        )}
      </div>

      {!account && !watchAddress && (
        <div className="muted" style={{ marginTop: 8 }}>
          Connect a wallet or enter an address to inspect a lock.
        </div>
      )}

      {error && (
        <div className="error-box" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {lock?.hasLock && (
        <>
          <div className="timeline">
            <div
              className={`timeline-fill${lock.isExpired ? ' expired' : ''}`}
              style={{ width: `${(lock.isExpired ? 1 : progress) * 100}%` }}
            />
          </div>
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-label">Locked BPT</div>
              <div className="stat-value">{fmtAmount(lock.amount, 18)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Unlock date</div>
              <div className="stat-value" style={{ fontSize: 14 }}>
                {fmtDate(lock.lockedEndDate)}
              </div>
            </div>
          </div>

          {!lock.isExpired && (
            <div className="warning-box" style={{ marginTop: 12 }}>
              This lock is still active. <span className="mono">withdraw()</span> reverts until{' '}
              {fmtDate(lock.lockedEndDate)} — there is no early exit. Come back after that date.
            </div>
          )}
        </>
      )}

      {lock && !lock.hasLock && scanTarget && (
        <div className="muted" style={{ marginTop: 12 }}>
          No veBAL lock found for {shortAddr(scanTarget)}.
        </div>
      )}

      {bptBalance > 0n && (
        <div className="muted" style={{ marginTop: 12 }}>
          Wallet holds {fmtAmount(bptBalance, 18)} BPT
          {bptTotalSupply > 0n ? ` (${fmtPct(Number(bptBalance) / Number(bptTotalSupply))} of the pool)` : ''}.
        </div>
      )}
    </div>
  )
}
