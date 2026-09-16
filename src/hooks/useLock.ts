import { useCallback, useEffect, useState } from 'react'
import type { PublicClient } from 'viem'
import { useApp } from '../contexts/AppContext'
import { readBptBalance, readLockInfo, type LockInfo } from '../lib/vebal'
import { readBptTotalSupply, readPoolTokens, type PoolToken } from '../lib/bptExit'

export interface LockData {
  lock: LockInfo | null
  bptBalance: bigint
  bptTotalSupply: bigint
  poolTokens: PoolToken[]
  loading: boolean
  error: string
  publicClient: PublicClient
  refresh: () => void
}

/**
 * Reads everything the page needs for `scanTarget`. No polling — public RPCs are
 * the only data source and the user drives every refresh (button + post-tx).
 */
export function useLock(): LockData {
  const { publicClient, scanTarget } = useApp()
  const [lock, setLock] = useState<LockInfo | null>(null)
  const [bptBalance, setBptBalance] = useState(0n)
  const [bptTotalSupply, setBptTotalSupply] = useState(0n)
  const [poolTokens, setPoolTokens] = useState<PoolToken[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nonce, setNonce] = useState(0)

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!scanTarget) {
      setLock(null)
      setBptBalance(0n)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')

    ;(async () => {
      try {
        const [info, bpt, supply, tokens] = await Promise.all([
          readLockInfo(publicClient, scanTarget),
          readBptBalance(publicClient, scanTarget),
          readBptTotalSupply(publicClient),
          readPoolTokens(publicClient),
        ])
        if (cancelled) return
        setLock(info)
        setBptBalance(bpt)
        setBptTotalSupply(supply)
        setPoolTokens(tokens)
      } catch (e: any) {
        if (!cancelled) setError(String(e.shortMessage ?? e.message ?? e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [publicClient, scanTarget, nonce])

  return {
    lock,
    bptBalance,
    bptTotalSupply,
    poolTokens,
    loading,
    error,
    publicClient,
    refresh,
  }
}
