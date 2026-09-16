import { fmtAmount } from '../lib/format'
import type { LockData } from '../hooks/useLock'

export function UnlockCard({ data }: { data: LockData }) {
  const { lock } = data

  if (!lock?.hasLock) return null

  return (
    <div className="card">
      <div className="row-between" style={{ flexWrap: 'wrap' }}>
        <div>
          <strong>Unlock</strong>{' '}
          {lock.isExpired ? (
            <span className="badge badge-green">available</span>
          ) : (
            <span className="badge badge-orange">locked</span>
          )}
        </div>
        <div className="mono">{fmtAmount(lock.amount, 18)} BPT</div>
      </div>

      <div className="muted" style={{ marginTop: 12 }}>
        Unlocking burns your veBAL position and returns {fmtAmount(lock.amount, 18)} BPT
        (80BAL-20WETH) to your wallet. Voting power drops to zero immediately. This cannot be
        undone — re-locking means a new lock term.
      </div>

      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn-primary" disabled>
          Unlock veBAL
        </button>
      </div>
    </div>
  )
}
