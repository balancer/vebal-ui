import { spawn, type ChildProcess } from 'node:child_process'
import { test, expect } from '@playwright/test'
import { installMockWallet } from './mock-wallet'

const ANVIL_PORT = 8546
const ANVIL_RPC = `http://127.0.0.1:${ANVIL_PORT}`
const FORK_RPC = process.env.FORK_RPC ?? 'https://ethereum-rpc.publicnode.com'

/** Expired veBAL lock: 91,896.97 BPT, end 2023-11-23. */
const HOLDER = '0x55031F623152CfB63c60A152238B9b3B28c568B0'

const VE_BAL = '0xC128a9954e6c874eA3d62ce62B468bA073093F25'
const BPT = '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56'

let anvil: ChildProcess

async function rpc(method: string, params: unknown[] = []) {
  const res = await fetch(ANVIL_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const json = await res.json()
  if (json.error) throw new Error(`${method}: ${json.error.message}`)
  return json.result
}

async function erc20Balance(token: string, owner: string): Promise<bigint> {
  // balanceOf(address) selector 0x70a08231
  const data = `0x70a08231000000000000000000000000${owner.slice(2).toLowerCase()}`
  const hex = await rpc('eth_call', [{ to: token, data }, 'latest'])
  return BigInt(hex)
}

test.beforeAll(async () => {
  anvil = spawn(
    'anvil',
    ['--fork-url', FORK_RPC, '--port', String(ANVIL_PORT), '--silent'],
    { stdio: 'ignore' }
  )
  // Wait for the fork to answer.
  const deadline = Date.now() + 60_000
  for (;;) {
    try {
      await rpc('eth_chainId')
      break
    } catch {
      if (Date.now() > deadline) throw new Error('anvil did not start')
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  await rpc('anvil_impersonateAccount', [HOLDER])
  await rpc('anvil_setBalance', [HOLDER, '0x21e19e0c9bab2400000']) // 10k ETH for gas
})

test.afterAll(() => {
  anvil?.kill()
})

test('unlock veBAL then exit the returned BPT', async ({ page }) => {
  await installMockWallet(page, { rpcUrl: ANVIL_RPC, address: HOLDER, name: 'Mock Wallet' })
  // Point the app's read client at the fork.
  await page.addInitScript((url) => {
    localStorage.setItem('rpc:mainnet', url)
  }, ANVIL_RPC)

  await page.goto('/')

  // Precondition: the lock is escrowed, the wallet holds no BPT.
  expect(await erc20Balance(BPT, HOLDER)).toBe(0n)

  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByText('0x5503…68B0')).toBeVisible()

  // --- Unlock ---
  await expect(page.getByText('expired — ready to unlock')).toBeVisible()
  const unlock = page.getByRole('button', { name: 'Unlock veBAL' })
  await expect(unlock).toBeEnabled()
  await unlock.click()
  await expect(page.getByText('Unlock veBAL confirmed')).toBeVisible({ timeout: 60_000 })

  // withdraw() burned the position and returned the BPT to the wallet.
  expect(await erc20Balance(BPT, HOLDER)).toBeGreaterThan(0n)

  // --- Exit BPT ---
  const exit = page.getByRole('button', { name: 'Exit BPT' })
  await expect(exit).toBeEnabled({ timeout: 30_000 })
  await exit.click()
  await expect(page.getByText('Exit BPT confirmed')).toBeVisible({ timeout: 60_000 })

  // The BPT is gone; BAL and WETH arrived.
  expect(await erc20Balance(BPT, HOLDER)).toBe(0n)
  const bal = await erc20Balance('0xba100000625a3754423978a60c9317c58a424e3d', HOLDER)
  const weth = await erc20Balance('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', HOLDER)
  expect(bal).toBeGreaterThan(0n)
  expect(weth).toBeGreaterThan(0n)
})
