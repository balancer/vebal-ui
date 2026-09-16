import type { Address } from 'viem'

export interface ChainConfig {
  key: string
  chainId: number
  name: string
  defaultRpcUrl: string
  explorerUrl: string
  nativeSymbol: string
  multicall3: Address
}

/**
 * Ethereum mainnet only. veBAL exists on mainnet; the L2 "veBAL" tokens are
 * delegation proxies, not locks, so there is nothing to unlock there.
 */
export const CHAIN: ChainConfig = {
  key: 'mainnet',
  chainId: 1,
  name: 'Ethereum',
  defaultRpcUrl: 'https://ethereum-rpc.publicnode.com',
  explorerUrl: 'https://etherscan.io',
  nativeSymbol: 'ETH',
  multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
}

export const CONTRACTS = {
  /** VotingEscrow (veBAL). */
  veBAL: '0xC128a9954e6c874eA3d62ce62B468bA073093F25',
  /** Balancer 80BAL-20WETH BPT — the token veBAL locks. */
  veBalBpt: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56',
  bal: '0xba100000625a3754423978a60c9317c58a424e3d',
  weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  vaultV2: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  balancerQueries: '0xe39b5e3b6d74016b2f6a9673d7d7493b6df549d5',
  /** poolId of the 80BAL-20WETH weighted pool. */
  poolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
} as const satisfies Record<string, Address>

const RPC_STORAGE_KEY = 'rpc:mainnet'

export function getRpcUrl(): string {
  return localStorage.getItem(RPC_STORAGE_KEY) || CHAIN.defaultRpcUrl
}

export function setRpcOverride(url: string | null) {
  if (url) localStorage.setItem(RPC_STORAGE_KEY, url)
  else localStorage.removeItem(RPC_STORAGE_KEY)
}
