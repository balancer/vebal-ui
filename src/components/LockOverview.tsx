import { useApp } from '../contexts/AppContext'
import { fmtAmount, fmtDate, fmtDuration, fmtPct, shortAddr } from '../lib/format'
import type { LockData } from '../hooks/useLock'

export function LockOverview({ data }: { data: LockData }) {
  const { scanTarget } = useApp()
  const { lock, bptBalance, bptTotalSupply, error } = data

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
      </div>

      {error && (
        <div className="error-box" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {lock?.hasLock && (
        <>
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
