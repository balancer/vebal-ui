import { useState } from 'react'
import { isAddress, type Address } from 'viem'
import { useApp } from '../contexts/AppContext'

/** Watch-any-address entry, shown before a scan target exists. */
export function WatchAddressForm() {
  const { setWatchAddress } = useApp()
  const [input, setInput] = useState('')

  return (
    <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
      <input
        style={{ flex: 1, minWidth: 220 }}
        className="mono"
        placeholder="0x... (read-only)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <button
        className="btn-secondary"
        disabled={!isAddress(input)}
        onClick={() => setWatchAddress(input as Address)}
      >
        Watch
      </button>
    </div>
  )
}
