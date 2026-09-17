import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { CHAIN, getRpcUrl } from '../config/chain'
import { getProvider } from "./wallet";

export function toViemChain() {
  return defineChain({
    id: CHAIN.chainId,
    name: CHAIN.name,
    nativeCurrency: { name: CHAIN.nativeSymbol, symbol: CHAIN.nativeSymbol, decimals: 18 },
    rpcUrls: { default: { http: [getRpcUrl()] } },
    blockExplorers: { default: { name: 'Etherscan', url: CHAIN.explorerUrl } },
    contracts: { multicall3: { address: CHAIN.multicall3 } },
  })
}

/** Read client — always uses the configured RPC (default or user override), never the wallet's. */
export function makePublicClient(): PublicClient {
  return createPublicClient({
    chain: toViemChain(),
    transport: http(getRpcUrl(), { timeout: 30_000 }),
    batch: { multicall: { batchSize: 1024, wait: 50 } },
  })
}

export function makeWalletClient(account: Address): WalletClient {
  return createWalletClient({
    account,
    chain: toViemChain(),
    transport: custom(getProvider() as any),
  })
}
