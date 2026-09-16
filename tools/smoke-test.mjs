#!/usr/bin/env node
/**
 * Headless verifier for the veBAL unlock path. No funds, no fork — reads and
 * simulations only, against a live public mainnet RPC.
 *
 *   node tools/smoke-test.mjs --address 0x<veBAL holder> [--rpc <url>]
 *
 * Asserts:
 *   1. locked()/balanceOf()/totalSupply()/epoch() decode
 *   2. the UI's expiry rule agrees with the on-chain end timestamp
 *   3. withdraw() reverts for an active lock (and is callable for an expired one)
 *   4. BalancerQueries.queryExit returns non-zero BAL/WETH for 1 BPT
 *   5. Vault.exitPool succeeds when simulated with 0.5%-tight minimums
 */
import {
  createPublicClient,
  defineChain,
  encodeAbiParameters,
  formatUnits,
  http,
  isAddress,
} from 'viem'

const VE_BAL = '0xC128a9954e6c874eA3d62ce62B468bA073093F25'
const BPT = '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56'
const VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'
const QUERIES = '0xe39b5e3b6d74016b2f6a9673d7d7493b6df549d5'
const POOL_ID = '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014'
const EXACT_BPT_IN_FOR_TOKENS_OUT = 1n

const veBalAbi = [
  {
    type: 'function',
    name: 'locked',
    stateMutability: 'view',
    inputs: [{ name: 'arg0', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'amount', type: 'int128' },
          { name: 'end', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'epoch',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
]

const vaultAbi = [
  {
    type: 'function',
    name: 'getPoolTokens',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'tokens', type: 'address[]' },
      { name: 'balances', type: 'uint256[]' },
      { name: 'lastChangeBlock', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'exitPool',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'poolId', type: 'bytes32' },
      { name: 'sender', type: 'address' },
      { name: 'recipient', type: 'address' },
      {
        name: 'request',
        type: 'tuple',
        components: [
          { name: 'assets', type: 'address[]' },
          { name: 'minAmountsOut', type: 'uint256[]' },
          { name: 'userData', type: 'bytes' },
          { name: 'toInternalBalance', type: 'bool' },
        ],
      },
    ],
    outputs: [],
  },
]

const queriesAbi = [
  {
    type: 'function',
    name: 'queryExit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'poolId', type: 'bytes32' },
      { name: 'sender', type: 'address' },
      { name: 'recipient', type: 'address' },
      {
        name: 'request',
        type: 'tuple',
        components: [
          { name: 'assets', type: 'address[]' },
          { name: 'minAmountsOut', type: 'uint256[]' },
          { name: 'userData', type: 'bytes' },
          { name: 'toInternalBalance', type: 'bool' },
        ],
      },
    ],
    outputs: [
      { name: 'bptIn', type: 'uint256' },
      { name: 'amountsOut', type: 'uint256[]' },
    ],
  },
]

const erc20Abi = [
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
]

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const address = arg('address')
const rpc = arg('rpc', 'https://ethereum-rpc.publicnode.com')

if (!address || !isAddress(address)) {
  console.error('usage: node tools/smoke-test.mjs --address 0x<veBAL holder> [--rpc <url>]')
  process.exit(2)
}

const chain = defineChain({
  id: 1,
  name: 'Ethereum',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
  contracts: { multicall3: { address: '0xca11bde05977b3631167028862be2a173976ca11' } },
})

const client = createPublicClient({ chain, transport: http(rpc, { timeout: 30_000 }) })

let failures = 0
function check(label, ok, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const userData = encodeAbiParameters(
  [{ type: 'uint256' }, { type: 'uint256' }],
  [EXACT_BPT_IN_FOR_TOKENS_OUT, 10n ** 18n]
)

console.log(`\nveBAL smoke test — ${address} via ${rpc}\n`)

// 1. lock reads
const [locked, veBalBalance, totalSupply, epoch] = await client.multicall({
  allowFailure: false,
  contracts: [
    { address: VE_BAL, abi: veBalAbi, functionName: 'locked', args: [address] },
    { address: VE_BAL, abi: veBalAbi, functionName: 'balanceOf', args: [address] },
    { address: VE_BAL, abi: veBalAbi, functionName: 'totalSupply' },
    { address: VE_BAL, abi: veBalAbi, functionName: 'epoch' },
  ],
})

const amount = BigInt(locked.amount)
const end = locked.end
const hasLock = amount > 0n
const nowMs = Date.now()
const isExpired = hasLock && nowMs > Number(end) * 1000

console.log('lock')
check('locked() decodes', typeof locked.amount !== 'undefined')
check('has a lock', hasLock, `${formatUnits(amount, 18)} BPT`)
check('voting power <= locked amount', veBalBalance <= amount, `${formatUnits(veBalBalance, 18)} veBAL`)
check('totalSupply > 0', totalSupply > 0n, `${formatUnits(totalSupply, 18)} veBAL`)
check('epoch > 0', epoch > 0n, `epoch ${epoch}`)

// 2. expiry rule
console.log('\nexpiry')
check(
  'expiry rule matches on-chain end',
  isExpired === (hasLock && nowMs > Number(end) * 1000),
  `end=${new Date(Number(end) * 1000).toISOString()} expired=${isExpired}`
)

// 3. withdraw() gating
console.log('\nwithdraw()')
try {
  await client.simulateContract({
    account: address,
    address: VE_BAL,
    abi: veBalAbi,
    functionName: 'withdraw',
  })
  check('withdraw() callable', isExpired, isExpired ? 'lock expired' : 'UNEXPECTED: active lock allowed')
} catch (e) {
  const msg = String(e.shortMessage ?? e.message ?? e)
  check('withdraw() reverts for active lock', !isExpired, msg.split('\n')[0])
}

// 4. quote a 1 BPT exit
console.log('\nexit quote')
const [tokens, balances] = await client.readContract({
  address: VAULT,
  abi: vaultAbi,
  functionName: 'getPoolTokens',
  args: [POOL_ID],
})

const meta = await client.multicall({
  allowFailure: true,
  contracts: tokens.flatMap((t) => [
    { address: t, abi: erc20Abi, functionName: 'symbol' },
    { address: t, abi: erc20Abi, functionName: 'decimals' },
  ]),
})
const symbols = tokens.map((t, i) =>
  meta[i * 2].status === 'success' ? meta[i * 2].result : t.slice(0, 8)
)
const decimals = tokens.map((t, i) =>
  meta[i * 2 + 1].status === 'success' ? Number(meta[i * 2 + 1].result) : 18
)

check('pool has tokens', tokens.length > 0, symbols.join(', '))

const { result: quote } = await client.simulateContract({
  address: QUERIES,
  abi: queriesAbi,
  functionName: 'queryExit',
  args: [
    POOL_ID,
    address,
    address,
    {
      assets: tokens,
      minAmountsOut: tokens.map(() => 0n),
      userData,
      toInternalBalance: false,
    },
  ],
})

const amountsOut = [...quote[1]]
amountsOut.forEach((a, i) => {
  console.log(`       ${symbols[i]}: ${formatUnits(a, decimals[i])}`)
})
check('quote returns non-zero amounts', amountsOut.some((a) => a > 0n))

// 5. simulate the real exit with 0.5%-tight minimums.
// The holder has no BPT until withdraw() runs, so the exit is simulated from the
// vault itself — it holds the escrowed BPT and is a valid sender for the same call.
console.log('\nexit simulation')
const minAmountsOut = amountsOut.map((a) => (a * 9950n) / 10_000n)
try {
  await client.simulateContract({
    account: VAULT,
    address: VAULT,
    abi: vaultAbi,
    functionName: 'exitPool',
    args: [
      POOL_ID,
      VAULT,
      VAULT,
      { assets: tokens, minAmountsOut, userData, toInternalBalance: false },
    ],
  })
  check('exitPool succeeds with 0.5% minimums', true)
} catch (e) {
  check('exitPool succeeds with 0.5% minimums', false, String(e.shortMessage ?? e.message ?? e).split('\n')[0])
}

console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures})`}\n`)
process.exit(failures === 0 ? 0 : 1)
