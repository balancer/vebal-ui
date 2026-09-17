import type { Page } from '@playwright/test'

export interface MockWalletOptions {
  /** JSON-RPC endpoint the provider forwards to (an Anvil fork). */
  rpcUrl: string
  /** Account the wallet reports and signs as. Must be impersonated on the node. */
  address: string
  /** Wallet name shown in the picker. */
  name?: string
}

/**
 * Installs a minimal EIP-1193 + EIP-6963 provider into the page before any app
 * code runs. Every request is forwarded verbatim to the Anvil fork, so the app
 * exercises its real viem calls against real contracts — only the wallet is fake.
 */
export async function installMockWallet(page: Page, opts: MockWalletOptions): Promise<void> {
  const { rpcUrl, address, name = 'Mock Wallet' } = opts
  await page.addInitScript(
    ({ rpcUrl, address, name }) => {
      let id = 0
      const listeners: Record<string, ((...args: any[]) => void)[]> = {}

      async function rpc(method: string, params: unknown[] = []) {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
        })
        const json = await res.json()
        if (json.error) {
          const err: any = new Error(json.error.message)
          err.code = json.error.code
          throw err
        }
        return json.result
      }

      const provider = {
        isMock: true,
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [address]
          if (method === 'wallet_switchEthereumChain') return null
          if (method === 'wallet_addEthereumChain') return null
          return rpc(method, params ?? [])
        },
        on(event: string, handler: (...args: any[]) => void) {
          ;(listeners[event] ??= []).push(handler)
        },
        removeListener(event: string, handler: (...args: any[]) => void) {
          listeners[event] = (listeners[event] ?? []).filter((h) => h !== handler)
        },
      }

      ;(window as any).ethereum = provider

      const announce = () =>
        window.dispatchEvent(
          new CustomEvent('eip6963:announceProvider', {
            detail: {
              info: { uuid: 'mock-wallet-uuid', name, icon: '', rdns: 'test.mock' },
              provider,
            },
          })
        )
      window.addEventListener('eip6963:requestProvider', announce)
      announce()
    },
    { rpcUrl, address, name }
  )
}
