import { useState, type ReactNode } from 'react'
import { isAddress, type Address } from 'viem'
import { useApp } from '../contexts/AppContext'
import { shortAddr } from '../lib/format'

export function WatchAddressForm({ children }: { children?: ReactNode }) {
  const { watchAddress, setWatchAddress } = useApp()
  const [input, setInput] = useState('')

  return (
    <div className="row" style={{ flexWrap: 'wrap' }}>
      {children}
      <input
        style={{ flex: 1, minWidth: 220 }}
        className="mono"
        placeholder="...or watch any address (read-only)"
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
      {watchAddress && (
        <button
          className="btn-secondary"
          onClick={() => {
            setWatchAddress(null)
            setInput('')
          }}
        >
          Clear watch ({shortAddr(watchAddress)})
        </button>
      )}
    </div>
  )
}
