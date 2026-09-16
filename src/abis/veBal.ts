/**
 * VotingEscrow (veBAL) on Ethereum mainnet — 0xC128a9954e6c874eA3d62ce62B468bA073093F25.
 * Transcribed from frontend-monorepo packages/lib/modules/web3/contracts/abi/generated.ts
 * (veBalAbi), trimmed to the functions this UI calls.
 *
 * `locked` returns a tuple (int128 amount, uint256 end); `withdraw` takes no arguments
 * and reverts unless block.timestamp >= locked.end.
 */
export const veBalAbi = [
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'provider', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
      { name: 'locktime', type: 'uint256', indexed: true },
      { name: 'type', type: 'int128', indexed: false },
      { name: 'ts', type: 'uint256', indexed: false },
    ],
    name: 'Deposit',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'provider', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
      { name: 'ts', type: 'uint256', indexed: false },
    ],
    name: 'Withdraw',
  },
  {
    type: 'function',
    inputs: [],
    name: 'token',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '_addr', type: 'address' }],
    name: 'locked__end',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'addr', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'arg0', type: 'address' }],
    name: 'locked',
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
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'epoch',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const
