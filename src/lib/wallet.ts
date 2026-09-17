import type { Address } from 'viem'
import { CHAIN, getRpcUrl } from '../config/chain'

function ethereum() {
  const eth = (window as any).ethereum
  if (!eth) throw new Error('No injected wallet found. Install MetaMask, Rabby or similar.')
  return eth
}

export function hasInjectedWallet(): boolean {
  return Boolean((window as any).ethereum)
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
      if (hasInjectedWallet()) finish(true)
    }, 100)
    const timer = setTimeout(() => finish(hasInjectedWallet()), timeoutMs)
    window.addEventListener('ethereum#initialized', onInit)
  })
}

export async function requestAccounts(): Promise<Address[]> {
  return ethereum().request({ method: 'eth_requestAccounts' })
}

export async function getWalletChainId(): Promise<number> {
  const hex: string = await ethereum().request({ method: 'eth_chainId' })
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
  const eth = (window as any).ethereum
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
