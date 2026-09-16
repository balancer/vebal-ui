import { fmtAmount } from '../lib/format'
import type { LockData } from '../hooks/useLock'

export function UnlockCard({ data }: { data: LockData }) {
  const { lock } = data

  if (!lock?.hasLock) return null

  return (
    <div className="card">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <strong>Unlock</strong>
          {lock.isExpired && <span className="badge badge-green">available</span>}
          <span className="muted">
          Unlocking burns your veBAL position and returns {fmtAmount(lock.amount, 18)} BPT
            (80BAL-20WETH) to your wallet.
          </span>
        </div>

        <div className="row-between" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <div className="amount">{fmtAmount(lock.amount, 18)} BPT</div>
        <button className="btn-primary" style={{ minWidth: 160 }} disabled>
            Unlock veBAL
        </button>
        </div>
    </div>
  )
}
