import type { Address, Hash, PublicClient, WalletClient } from 'viem'
import { veBalAbi } from '../abis/veBal'
import { erc20Abi } from '../abis/erc20'
import { CONTRACTS } from '../config/chain'

export interface LockInfo {
  /** BPT locked, in wei. */
  amount: bigint
  /** Lock end, unix seconds. */
  end: bigint
  hasLock: boolean
  isExpired: boolean
  /** Seconds until unlock; 0 once expired. */
  secondsRemaining: number
  /** Lock end as unix ms (0 when there is no lock). */
  lockedEndDate: number
  /** veBAL balance = current voting power, decays linearly to 0 at `end`. */
  votingPower: bigint
  /** Total veBAL supply, in wei. */
  totalSupply: bigint
  /** Current global epoch. */
  epoch: bigint
}


const ZERO: LockInfo = {
  amount: 0n,
  end: 0n,
  hasLock: false,
  isExpired: false,
  secondsRemaining: 0,
  lockedEndDate: 0,
  votingPower: 0n,
  totalSupply: 0n,
  epoch: 0n,
}

/**
 * Expiry rule, matching frontend-monorepo apps/frontend-v3/lib/vebal/useVebalLockInfo.ts:
 * hasLock = amount > 0, isExpired = hasLock && now > end.
 */
export function getLockState({
  nowMs,
  amount,
  end,
}: {
  nowMs: number
  amount: bigint
  end: bigint
}): Pick<LockInfo, 'hasLock' | 'isExpired' | 'secondsRemaining' | 'lockedEndDate'> {
  const hasLock = amount > 0n
  const lockedEndDate = Number(end) * 1000
  const isExpired = hasLock && nowMs > lockedEndDate
  const secondsRemaining = hasLock && !isExpired ? Math.floor((lockedEndDate - nowMs) / 1000) : 0
  return { hasLock, isExpired, secondsRemaining, lockedEndDate }
}

/**
 * One multicall for everything the overview needs. allowFailure keeps a fresh
 * address (no lock, no veBAL) from throwing.
 */
export async function readLockInfo(
  client: PublicClient,
  user: Address,
  nowMs = Date.now()
): Promise<LockInfo> {
  const results = await client.multicall({
    allowFailure: true,
    contracts: [
      { address: CONTRACTS.veBAL, abi: veBalAbi, functionName: 'locked', args: [user] },
      { address: CONTRACTS.veBAL, abi: veBalAbi, functionName: 'balanceOf', args: [user] },
      { address: CONTRACTS.veBAL, abi: veBalAbi, functionName: 'totalSupply' },
      { address: CONTRACTS.veBAL, abi: veBalAbi, functionName: 'epoch' },
    ],
  })

  const [lockedRes, balanceRes, supplyRes, epochRes] = results
  const locked = lockedRes.status === 'success' ? lockedRes.result : undefined
  const amount = locked ? BigInt(locked.amount) : 0n
  const end = locked ? locked.end : 0n

  return {
    ...ZERO,
    amount,
    end,
    votingPower: balanceRes.status === 'success' ? balanceRes.result : 0n,
    totalSupply: supplyRes.status === 'success' ? supplyRes.result : 0n,
    epoch: epochRes.status === 'success' ? epochRes.result : 0n,
    ...getLockState({ nowMs, amount, end }),
  }
}

/** BPT (80BAL-20WETH) held in the wallet — the token withdraw() returns. */
export async function readBptBalance(client: PublicClient, user: Address): Promise<bigint> {
  return client.readContract({
    address: CONTRACTS.veBalBpt,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [user],
  })
}

/**
 * Unlock. `withdraw()` takes no arguments and reverts unless the lock has expired;
 * it burns the veBAL position and returns the BPT to the caller.
 */
export async function withdrawLock(walletClient: WalletClient, user: Address): Promise<Hash> {
  return walletClient.writeContract({
    chain: walletClient.chain,
    account: user,
    address: CONTRACTS.veBAL,
    abi: veBalAbi,
    functionName: 'withdraw',
  })
}
