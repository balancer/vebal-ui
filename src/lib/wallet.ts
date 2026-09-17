import type { Address } from 'viem'
import { CHAIN, getRpcUrl } from '../config/chain'
export interface WalletEntry {
  id: string
  name: string
  provider: Eip1193Provider
}

function legacyProvider(): Eip1193Provider | null {
  const eth = (window as any).ethereum
  if (!eth) return null
  if (Array.isArray(eth.providers) && eth.providers.length > 0) return eth.providers[0]
  return eth
}

let selectedId: string | null = null

/** Pin the wallet used for connect/sign. `null` clears the choice. */
export function selectWallet(id: string | null): void {
  selectedId = id
}

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
  on?: (event: string, handler: (...args: any[]) => void) => void
  removeListener?: (event: string, handler: (...args: any[]) => void) => void
}

interface Eip6963ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string }
  provider: Eip1193Provider
}

/** Wallets that announced themselves via EIP-6963, keyed by uuid. */
const announced = new Map<string, Eip6963ProviderDetail>()

if (typeof window !== 'undefined') {
  window.addEventListener('eip6963:announceProvider', (event) => {
    const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail
    if (detail?.info?.uuid) announced.set(detail.info.uuid, detail)
  })
  window.dispatchEvent(new Event('eip6963:requestProvider'))
}

/** Wallets the page can currently see — EIP-6963 announcements first, then legacy injection. */
export function listWallets(): WalletEntry[] {
  const out: WalletEntry[] = []
  const seen = new Set<Eip1193Provider>()
  for (const d of announced.values()) {
    if (seen.has(d.provider)) continue
    seen.add(d.provider)
    out.push({ id: d.info.uuid, name: d.info.name, provider: d.provider })
  }
  const legacy = legacyProvider()
  if (legacy && !seen.has(legacy)) {
    out.push({
      id: 'legacy',
      name: (legacy as any).isMetaMask ? 'MetaMask' : 'Injected wallet',
      provider: legacy,
    })
  }
  return out
}

function pickProvider(): Eip1193Provider | null {
  const wallets = listWallets()
  if (wallets.length === 0) return null
  if (selectedId) {
    const chosen = wallets.find((w) => w.id === selectedId)
    if (chosen) return chosen.provider
  }
  return wallets[0].provider
}


function ethereum(): Eip1193Provider {
  const provider = pickProvider()
  if (!provider) {
    throw new Error('No injected wallet found. Install MetaMask, Rabby, Rivet or similar.')
  }
  return provider
}

/** The provider connect/sign should use — the selected wallet, else the first available. */
export function getProvider(): Eip1193Provider {
  return ethereum()
}

export function hasInjectedWallet(): boolean {
  return pickProvider() !== null
}

/**
 * Resolves once an injected provider is available. Wallets inject `window.ethereum`
 * at unpredictable times (after page load, after unlock), so poll briefly and also
 * listen for EIP-6963 / legacy `ethereum#initialized` announcements.
 */
export function waitForInjectedWallet(timeoutMs = 3000): Promise<boolean> {
  if (hasInjectedWallet()) return Promise.resolve(true)
  return new Promise((resolve) => {
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      clearInterval(poll)
      clearTimeout(timer)
      window.removeEventListener('ethereum#initialized', onInit)
      resolve(ok)
    }
    const onInit = () => finish(true)
    const poll = setInterval(() => {
      window.dispatchEvent(new Event('eip6963:requestProvider'))
      if (hasInjectedWallet()) finish(true)
    }, 100)
    const timer = setTimeout(() => finish(hasInjectedWallet()), timeoutMs)
    window.addEventListener('ethereum#initialized', onInit)
  })
}

export async function requestAccounts(): Promise<Address[]> {
  const eth = ethereum()
  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as Address[]
  if (accounts && accounts.length > 0) return accounts
  // Some wallets (Rivet, locked extensions) resolve requestAccounts with [] and only
  // expose the account via eth_accounts once the user has approved the connection.
  const existing = (await eth.request({ method: 'eth_accounts' })) as Address[]
  return existing ?? []
}

export async function getWalletChainId(): Promise<number> {
  const hex = (await ethereum().request({ method: 'eth_chainId' })) as string
  return Number(hex)
}

/** Switch the wallet to mainnet, adding it (with the configured RPC) if unknown. */
export async function ensureWalletChain(): Promise<void> {
  const eth = ethereum()
  const chainIdHex = `0x${CHAIN.chainId.toString(16)}`
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    })
  } catch (e: any) {
    // 4902: unknown chain -> add it using the user's configured RPC
    if (e?.code === 4902 || /unrecognized|not added/i.test(String(e?.message))) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: CHAIN.name,
            nativeCurrency: {
              name: CHAIN.nativeSymbol,
              symbol: CHAIN.nativeSymbol,
              decimals: 18,
            },
            rpcUrls: [getRpcUrl()],
            blockExplorerUrls: [CHAIN.explorerUrl],
          },
        ],
      })
    } else {
      throw e
    }
  }
}

export function onWalletEvents(handlers: {
  accountsChanged?: (accounts: Address[]) => void
  chainChanged?: (chainIdHex: string) => void
}): () => void {
  const eth = pickProvider()
  if (!eth?.on) return () => {}
  const acc = handlers.accountsChanged ?? (() => {})
  const ch = handlers.chainChanged ?? (() => {})
  eth.on('accountsChanged', acc)
  eth.on('chainChanged', ch)
  return () => {
    eth.removeListener?.('accountsChanged', acc)
    eth.removeListener?.('chainChanged', ch)
  }
}
