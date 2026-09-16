# veBAL Unlock

Standalone static site for inspecting and exiting a **veBAL** lock on Ethereum mainnet.

No backend, no subgraph, no Balancer API — it only talks to the RPC you configure.

## What it does

1. **Inspect** — reads `locked(address)`, `balanceOf(address)`, `totalSupply()` and `epoch()`
   from the veBAL VotingEscrow (`0xC128a9954e6c874eA3d62ce62B468bA073093F25`) in a single
   multicall, and shows the locked BPT, current voting power, share of total veBAL, and the
   unlock date.
2. **Unlock** — calls `withdraw()` once the lock has expired. `withdraw()` takes no arguments
   and reverts before `locked.end`; there is no early exit. It burns the veBAL position and
   returns the locked BPT to your wallet.
3. **Exit the BPT** — the lock holds the Balancer 80BAL-20WETH BPT
   (`0x5c6ee304399dbdb9c8ef030ab642b10820db8f56`). The site quotes a proportional exit via
   `BalancerQueries.queryExit` and submits `Vault.exitPool` with `minAmountsOut` derived from
   the quote minus your slippage tolerance. An opt-in **emergency mode** submits with zero
   minimums.

The unlock and the BPT exit are two separate transactions — the second is only possible after
the first, because the BPT is held by the escrow until you withdraw.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3002
npm run build    # static output in dist/
```

Dependencies: `react`, `react-dom`, `viem`. That's all.

## RPC

Reads always go to the configured RPC, never the wallet's. The default is a public endpoint;
override it with the **RPC** button in the header (persisted in `localStorage` under
`rpc:mainnet`). When the wallet is on another chain, the configured RPC is also what gets
offered to `wallet_addEthereumChain`.

## Verification

```bash
node tools/smoke-test.mjs --address 0x<veBAL holder>
```

Headless check against a live public RPC, no funds needed: decodes the lock, asserts the
expiry rule against the on-chain end timestamp, confirms `withdraw()` reverts for an active
lock, quotes a 1 BPT exit, and simulates the real `exitPool` with 0.5%-tight minimums.

For end-to-end testing with real transactions, fork mainnet with
`anvil --fork-url <rpc>`, point the UI's RPC at `http://localhost:8545`, and impersonate a
holder.

## Limitations

- **Mainnet only.** veBAL exists on Ethereum; the L2 "veBAL" tokens are delegation proxies,
  not locks.
- **Injected wallet only** (MetaMask, Rabby, ...). No WalletConnect. Any address can be
  watched read-only.
- **No USD pricing** — there is no price source without an API, so amounts are token
  quantities.
- **No early exit.** `withdraw()` reverts until the lock expires; the UI blocks the action
  and says so.
- **No auto-unwrap.** The BPT exit pays out BAL and WETH as-is.
- **No lock/extend.** This site only unlocks; creating or extending a lock is out of scope.
