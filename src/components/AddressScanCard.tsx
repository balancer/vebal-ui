import { useEffect, useId, useState } from 'react'
import { isAddress, type Address, getAddress } from 'viem'
import { useApp } from '../contexts/AppContext'

const STORAGE_KEY = 'vebal:scan-addresses'

function readSessionAddresses(): Address[] {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(stored)) return []
    const addresses: Address[] = []
    for (const value of stored) {
      if (typeof value === 'string' && isAddress(value, { strict: false }) &&
        !addresses.some((address) => address.toLowerCase() === value.toLowerCase())) {
        addresses.push(value)
      }
    }
    return addresses
  } catch {
    return []
  }
}

export function AddressScanCard({ loading, onScan }: { loading: boolean; onScan: (target: Address) => void }) {
  const { account, setWatchAddress } = useApp()
  const [addresses, setAddresses] = useState(readSessionAddresses)
  const [selected, setSelected] = useState('wallet')
  const [input, setInput] = useState('')
  const headingId = useId()
  const inputId = useId()
  const adding = selected === 'add'
  const target = selected === 'wallet' ? account : addresses.find((address) => address === selected) ?? null

  useEffect(() => {
    if (!account) return
    setSelected((value) => value.toLowerCase() === account.toLowerCase() ? 'wallet' : value)
    setAddresses((saved) => saved.some((address) => address.toLowerCase() === account.toLowerCase())
      ? saved
      : [...saved, account])
  }, [account])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(addresses))
    } catch {
      // Keep the selector usable when browser storage is unavailable.
    }
  }, [addresses])

  function addAddress() {
    const value = input.trim()
    if (!isAddress(value, { strict: false })) return
    if (account?.toLowerCase() === value.toLowerCase()) {
      setSelected('wallet')
      setWatchAddress(null)
      setInput('')
      return
    }
    const existingAddress = addresses.find((saved) => saved.toLowerCase() === value.toLowerCase())
    const address = existingAddress ?? getAddress(value.toLowerCase())
    if (!existingAddress) setAddresses((saved) => [...saved, address])
    setSelected(address)
    setWatchAddress(address)
    setInput('')
  }

  return (
    <div className="card">
      <strong id={headingId}>Select address to scan for positions:</strong>
      <div className="row" style={{ flexWrap: 'wrap', marginTop: 16, gap: 20 }}>
<select
            className="mono address-selector"
          aria-labelledby={headingId}
          style={{ flex: '1 1 280px', minWidth: 0, maxWidth: '100%', height: 40 }}
          value={selected}
          onChange={(event) => {
            const value = event.target.value
            setSelected(value)
            if (value === 'wallet') setWatchAddress(null)
            else if (value !== 'add') setWatchAddress(value as Address)
          }}
        >
          <option value="wallet" disabled={!account}>
            {account ?? 'Connect a wallet'}
          </option>
          {addresses.filter((address) => address.toLowerCase() !== account?.toLowerCase()).map((address) => (
            <option key={address} value={address}>{address}</option>
          ))}
          <option value="add">Add a read-only address...</option>
        </select>
        <button
          type="button"
          className="btn-primary" style={{ width: 160, height: 40, flexShrink: 0 }}
          disabled={!target || loading}
          onClick={() => {
            if (!target) return
            setWatchAddress(selected === 'wallet' ? null : target)
            onScan(target)
          }}
        >
          {loading ? 'Scanning...' : 'Scan positions'}
        </button>
      </div>
      {adding && (
        <form
            className="row"
            style={{ flexWrap: 'wrap', marginTop: 20, gap: 20 }}
            onSubmit={(event) => {
            event.preventDefault()
            addAddress()
          }}
        >
          <input
            id={inputId}
            aria-label="Read-only address to add"
            className="mono"
            style={{ flex: '1 1 220px', minWidth: 0, height: 40 }}
            placeholder="0x... (read-only)"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="submit" className="btn-secondary"
              style={{ width: 160, height: 40, flexShrink: 0 }}
              disabled={!isAddress(input.trim(), { strict: false })}>
            Add
          </button>
        </form>
      )}
    </div>
  )
}
