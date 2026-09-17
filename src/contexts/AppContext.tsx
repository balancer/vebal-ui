import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Address, PublicClient } from 'viem'
import { CHAIN, getRpcUrl, setRpcOverride } from '../config/chain'
import { makePublicClient } from '../lib/clients'
import { hasInjectedWallet, onWalletEvents, requestAccounts, waitForInjectedWallet, listWallets, selectWallet, type WalletEntry } from '../lib/wallet'

interface AppContextValue {
  chain: typeof CHAIN
  publicClient: PublicClient
  rpcUrl: string
  setRpcUrl: (url: string | null) => void

  account: Address | null
  connect: () => Promise<void>
  hasWallet: boolean
  /** Injected wallets the page can see (EIP-6963 + legacy). */
  wallets: WalletEntry[]
  /** Currently selected wallet id, or null for the default (first). */
  selectedWalletId: string | null
  /** Pin which wallet connect/sign uses. */
  chooseWallet: (id: string) => void

  /** Address being inspected: connected account or watch address. */
  watchAddress: Address | null
  setWatchAddress: (addr: Address | null) => void
  scanTarget: Address | null
  readOnly: boolean
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [rpcVersion, setRpcVersion] = useState(0)
  const [account, setAccount] = useState<Address | null>(null)
  const [watchAddress, setWatchAddress] = useState<Address | null>(null)
  const [hasWallet, setHasWallet] = useState(hasInjectedWallet())
  const [wallets, setWallets] = useState<WalletEntry[]>(() => listWallets())
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const publicClient = useMemo(() => makePublicClient(), [rpcVersion])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rpcUrl = useMemo(() => getRpcUrl(), [rpcVersion])

  const setRpcUrl = useCallback((url: string | null) => {
    setRpcOverride(url)
    setRpcVersion((v) => v + 1)
  }, [])

  const connect = useCallback(async () => {
    const accounts = await requestAccounts()
    setAccount(accounts[0] ?? null)
  }, [])

  const chooseWallet = useCallback((id: string) => {
    selectWallet(id)
    setSelectedWalletId(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    waitForInjectedWallet().then((ok) => {
      if (!cancelled) setHasWallet(ok)
    })
    // A wallet can announce itself at any time (EIP-6963) — reflect that immediately.
    const onAnnounce = () => {
      setHasWallet(true)
      setWallets(listWallets())
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    return () => {
      cancelled = true
      window.removeEventListener('eip6963:announceProvider', onAnnounce)
    }
  }, [])

  useEffect(() => {
    return onWalletEvents({
      accountsChanged: (accounts) => setAccount(accounts[0] ?? null),
    })
  }, [selectedWalletId])

  const scanTarget = watchAddress ?? account

  const value: AppContextValue = {
    chain: CHAIN,
    publicClient,
    rpcUrl,
    setRpcUrl,
    account,
    connect,
    hasWallet,
    wallets,
    selectedWalletId,
    chooseWallet,
    watchAddress,
    setWatchAddress,
    scanTarget,
    readOnly: watchAddress !== null && watchAddress.toLowerCase() !== account?.toLowerCase(),
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp outside AppProvider')
  return ctx
}
