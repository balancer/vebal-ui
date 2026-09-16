import {
  encodeAbiParameters,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { vaultV2Abi } from '../abis/vaultV2'
import { balancerQueriesAbi } from '../abis/balancerQueries'
import { erc20Abi } from '../abis/erc20'
import { CONTRACTS } from '../config/chain'
import { applySlippage } from './format'

/**
 * ExitKind for the 80BAL-20WETH weighted pool: EXACT_BPT_IN_FOR_TOKENS_OUT.
 * Composable-stable (2) and recovery (255) are not reachable for this pool.
 */
const EXACT_BPT_IN_FOR_TOKENS_OUT = 1n

export interface PoolToken {
  address: Address
  symbol: string
  decimals: number
}

export interface BptExitQuote {
  /** Aligned with the pool's token registration order. */
  amountsOut: bigint[]
  userData: `0x${string}`
}

function encodeUserData(bptIn: bigint): `0x${string}` {
  return encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'uint256' }],
    [EXACT_BPT_IN_FOR_TOKENS_OUT, bptIn]
  )
}

/** Fallback quote when queryExit reverts: zero expectations, emergency exits only. */
export function emergencyBptQuote(tokenCount: number, bptIn: bigint): BptExitQuote {
  return { amountsOut: Array.from({ length: tokenCount }, () => 0n), userData: encodeUserData(bptIn) }
}

/** Pool tokens in registration order — the order exitPool expects. */
export async function readPoolTokens(client: PublicClient): Promise<PoolToken[]> {
  const [tokens] = await client.readContract({
    address: CONTRACTS.vaultV2,
    abi: vaultV2Abi,
    functionName: 'getPoolTokens',
    args: [CONTRACTS.poolId],
  })

  const meta = await client.multicall({
    allowFailure: true,
    contracts: tokens.flatMap((t) => [
      { address: t, abi: erc20Abi, functionName: 'symbol' as const },
      { address: t, abi: erc20Abi, functionName: 'decimals' as const },
    ]),
  })

  return tokens.map((address, i) => ({
    address,
    symbol: meta[i * 2].status === 'success' ? (meta[i * 2].result as string) : address.slice(0, 8),
    decimals: meta[i * 2 + 1].status === 'success' ? Number(meta[i * 2 + 1].result) : 18,
  }))
}

export async function readBptTotalSupply(client: PublicClient): Promise<bigint> {
  return client.readContract({
    address: CONTRACTS.veBalBpt,
    abi: erc20Abi,
    functionName: 'totalSupply',
  })
}

/** Simulate the exit to get expected amounts out. queryExit is nonpayable — simulate, not read. */
export async function queryBptExit(
  client: PublicClient,
  user: Address,
  tokens: PoolToken[],
  bptIn: bigint
): Promise<BptExitQuote> {
  const assets = tokens.map((t) => t.address)
  const userData = encodeUserData(bptIn)
  const { result } = await client.simulateContract({
    address: CONTRACTS.balancerQueries,
    abi: balancerQueriesAbi,
    functionName: 'queryExit',
    args: [
      CONTRACTS.poolId,
      user,
      user,
      {
        assets,
        minAmountsOut: assets.map(() => 0n),
        userData,
        toInternalBalance: false,
      },
    ],
  })
  return { amountsOut: [...result[1]], userData }
}

/** Execute the exit. minAmountsOut = expected − slippage; all zeros in emergency mode. */
export async function executeBptExit(
  walletClient: WalletClient,
  user: Address,
  tokens: PoolToken[],
  quote: BptExitQuote,
  slippagePct: number,
  emergency: boolean
): Promise<Hash> {
  const assets = tokens.map((t) => t.address)
  const minAmountsOut = tokens.map((_, i) =>
    emergency ? 0n : applySlippage(quote.amountsOut[i] ?? 0n, slippagePct)
  )
  return walletClient.writeContract({
    chain: walletClient.chain,
    account: user,
    address: CONTRACTS.vaultV2,
    abi: vaultV2Abi,
    functionName: 'exitPool',
    args: [
      CONTRACTS.poolId,
      user,
      user,
      {
        assets,
        minAmountsOut,
        userData: quote.userData,
        toInternalBalance: false,
      },
    ],
  })
}
