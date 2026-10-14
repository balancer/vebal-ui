import { useCallback, useEffect, useState } from 'react'
import type { Address, PublicClient } from 'viem'
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
  refresh: (target?: Address) => void
}

export function useLock(): LockData {
  const { publicClient, scanTarget } = useApp()
  const [lock, setLock] = useState<LockInfo | null>(null)
  const [bptBalance, setBptBalance] = useState(0n)
  const [bptTotalSupply, setBptTotalSupply] = useState(0n)
  const [poolTokens, setPoolTokens] = useState<PoolToken[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scanRequest, setScanRequest] = useState<{ target: Address; client: PublicClient } | null>(null)

  const scan = useCallback((target: Address) => {
    setScanRequest({ target, client: publicClient })
  }, [publicClient])

  const refresh = useCallback((target: Address | null = scanTarget) => {
    if (target) scan(target)
  }, [scanTarget, scan])

  useEffect(() => {
    setLock(null)
    setBptBalance(0n)
    setBptTotalSupply(0n)
    setPoolTokens([])
    setLoading(false)
    setError('')

    if (!scanTarget || !scanRequest || scanRequest.client !== publicClient ||
      scanRequest.target.toLowerCase() !== scanTarget.toLowerCase()) {
      if (scanRequest) setScanRequest(null)
      return
    }

    let cancelled = false
    setLoading(true)

      ; (async () => {
        try {
          const [info, bpt, supply, tokens] = await Promise.all([
            readLockInfo(publicClient, scanRequest.target),
            readBptBalance(publicClient, scanRequest.target),
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
  }, [publicClient, scanTarget, scanRequest])

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
