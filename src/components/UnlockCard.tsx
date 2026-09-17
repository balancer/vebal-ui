import { useApp } from '../contexts/AppContext'
import { useTransaction } from '../hooks/useTransaction'
import { makeWalletClient } from '../lib/clients'
import { fmtAmount } from '../lib/format'
import { withdrawLock } from '../lib/vebal'
import type { LockData } from '../hooks/useLock'
import { TxStatusView } from './TxStatusView'

export function UnlockCard({ data }: { data: LockData }) {
  const { account, readOnly } = useApp()
  const { status, send } = useTransaction()
  const { lock, refresh } = data

  const busy = status.state === 'pending' || status.state === 'confirming'
  const canUnlock = Boolean(lock?.isExpired && account && !readOnly && !busy)

  async function onUnlock() {
    if (!account || !lock) return
    const walletClient = makeWalletClient(account)
    const ok = await send('Unlock veBAL', () => withdrawLock(walletClient, account))
    if (ok) refresh()
  }

  if (!lock?.hasLock) return null

  return (
    <div className="card">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <strong>Unlock</strong>
        <span className="muted">
          Unlocking burns your veBAL position and returns {fmtAmount(lock.amount, 18)} BPT
          (80BAL-20WETH) to your wallet.
        </span>
      </div>

      <div className="row-between" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <div className="amount">{fmtAmount(lock.amount, 18)} BPT</div>
        <button className="btn-primary" style={{ minWidth: 160 }} disabled={!canUnlock} onClick={onUnlock}>
          Unlock veBAL
        </button>
      </div>

      {readOnly && <div className="muted" style={{ marginTop: 8 }}>watch mode — actions disabled</div>}
      {!account && <div className="muted" style={{ marginTop: 8 }}>connect a wallet to unlock</div>}

      <TxStatusView status={status} />
    </div>
  )
}
