import { useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { shortAddr } from '../lib/format'

export function Header() {
  const { account, connect, hasWallet, rpcUrl, setRpcUrl } = useApp()
  const [showRpc, setShowRpc] = useState(false)
  const [rpcInput, setRpcInput] = useState('')
  const [connectError, setConnectError] = useState('')

  return (
    <header style={{ padding: '24px 0 8px' }}>
      <div className="row-between" style={{ flexWrap: 'wrap' }}>
        <div>
          <h1 className="gradient-text" style={{ margin: 0, fontSize: 28 }}>
            veBAL Unlock
          </h1>
          <div className="muted">Withdraw an expired veBAL lock and exit the returned BPT</div>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="badge">Ethereum</span>
          <button className="btn-secondary" onClick={() => setShowRpc((s) => !s)}>
            RPC
          </button>
            {account ? (
              <span className="badge badge-blue mono">{shortAddr(account)}</span>
            ) : (
              <button
                className="btn-primary"
                title={hasWallet ? '' : 'No injected wallet detected'}
                onClick={() =>
                  connect().catch((e) => setConnectError(String(e.shortMessage ?? e.message)))
                }
              >
                Connect wallet
              </button>
            )}
        </div>
      </div>

      {showRpc && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="muted" style={{ marginBottom: 8 }}>
            RPC endpoint (stored locally; used for all reads and added to your wallet when
            switching chains)
          </div>
          <div className="row">
            <input
              style={{ flex: 1 }}
              placeholder={rpcUrl}
              value={rpcInput}
              onChange={(e) => setRpcInput(e.target.value)}
            />
            <button
              className="btn-primary"
              disabled={!rpcInput.trim().startsWith('http')}
              onClick={() => {
                setRpcUrl(rpcInput.trim())
                setRpcInput('')
                setShowRpc(false)
              }}
            >
              Save
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setRpcUrl(null)
                setRpcInput('')
              }}
            >
              Reset to default
            </button>
          </div>
          <div className="muted mono" style={{ marginTop: 6 }}>
            current: {rpcUrl}
          </div>
        </div>
      )}
        {!hasWallet && (
          <div className="muted" style={{ marginTop: 8 }}>
            No injected wallet detected. Install MetaMask, Rabby, Rivet or similar, then reload.
          </div>
        )}
        {connectError && (
          <div className="error-box" style={{ marginTop: 8 }}>
            {connectError}
          </div>
        )}
    </header>
  )
}
