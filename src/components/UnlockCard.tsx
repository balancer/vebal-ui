import { useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { useTransaction } from '../hooks/useTransaction'
import { makeWalletClient } from '../lib/clients'
import { fmtAmount, fmtDate } from '../lib/format'
import { withdrawLock } from '../lib/vebal'
import type { LockData } from '../hooks/useLock'
import { TxStatusView } from './TxStatusView'

export function UnlockCard({ data }: { data: LockData }) {
  const { account, readOnly } = useApp()
  const { status, send } = useTransaction()
  const [confirmed, setConfirmed] = useState(false)
  const { lock, refresh } = data

  const busy = status.state === 'pending' || status.state === 'confirming'
  const canUnlock = Boolean(lock?.hasLock && lock.isExpired && account && !readOnly && confirmed && !busy)

  async function onUnlock() {
    if (!account || !lock) return
    const walletClient = makeWalletClient(account)
    const ok = await send('Unlock veBAL', () => withdrawLock(walletClient, account))
    if (ok) {
      setConfirmed(false)
      refresh()
    }
  }

  if (!lock?.hasLock) return null

  return (
    <div className="card">
      <div className="row-between" style={{ flexWrap: 'wrap' }}>
        <div>
          <strong>Unlock</strong>{' '}
          {lock.isExpired ? (
            <span className="badge badge-green">available</span>
          ) : (
            <span className="badge badge-orange">locked until {fmtDate(lock.lockedEndDate)}</span>
          )}
        </div>
        <div className="mono">{fmtAmount(lock.amount, 18)} BPT returned</div>
      </div>

      {!lock.isExpired ? (
        <div className="warning-box" style={{ marginTop: 12 }}>
          The lock has not expired. <span className="mono">withdraw()</span> reverts before{' '}
          {fmtDate(lock.lockedEndDate)} — veBAL has no early exit.
        </div>
      ) : (
        <>
          <div className="muted" style={{ marginTop: 12 }}>
            Unlocking burns your veBAL position and returns {fmtAmount(lock.amount, 18)} BPT
            (80BAL-20WETH) to your wallet. Voting power drops to zero immediately. This cannot be
            undone — re-locking means a new lock term.
          </div>

          <label className="row muted" style={{ marginTop: 12 }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I understand this burns my veBAL and returns the BPT to my wallet
          </label>

          <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn-primary" disabled={!canUnlock} onClick={onUnlock}>
              Unlock veBAL
            </button>
            {readOnly && <span className="muted">watch mode — actions disabled</span>}
            {!account && <span className="muted">connect a wallet to unlock</span>}
          </div>
        </>
      )}

      <TxStatusView status={status} />
    </div>
  )
}
