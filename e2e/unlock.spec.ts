import { spawn, type ChildProcess } from 'node:child_process'
import { test, expect } from '@playwright/test'
import { installMockWallet } from './mock-wallet'

const ANVIL_PORT = 8546
const ANVIL_RPC = `http://127.0.0.1:${ANVIL_PORT}`
const FORK_RPC = process.env.FORK_RPC ?? 'https://ethereum-rpc.publicnode.com'
/** Pinned fork block — keeps the test deterministic as mainnet advances. */
const FORK_BLOCK = Number(process.env.FORK_BLOCK ?? 25_995_579)

/** Expired veBAL lock: 91,896.97 BPT, end 2023-11-23. */
const HOLDER = '0x55031F623152CfB63c60A152238B9b3B28c568B0'
const BPT = '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56'

let anvil: ChildProcess

async function rpc(method: string, params: unknown[] = []) {
  const res = await fetch(ANVIL_RPC, {
    method: 'POST',
    signal: AbortSignal.timeout(5000),
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

test.beforeAll(startAnvil)

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
  await page.getByRole('button', { name: 'Scan positions', exact: true }).click()

  // --- Unlock ---
  await expect(page.getByText('expired — ready to unlock')).toBeVisible()
  const unlock = page.getByRole('button', { name: 'Unlock veBAL' })
  await expect(unlock).toBeEnabled()
  await unlock.click()
  // Post-transaction refresh remounts the cards, so assert the on-chain outcome.
  await expect.poll(() => erc20Balance(BPT, HOLDER), { timeout: 60_000 }).toBeGreaterThan(0n)

  // --- Exit BPT ---
  const exit = page.getByRole('button', { name: 'Exit BPT' })
  await expect(exit).toBeEnabled({ timeout: 30_000 })
  await exit.click()
  // The BPT is gone; BAL and WETH arrived.
  await expect.poll(() => erc20Balance(BPT, HOLDER), { timeout: 60_000 }).toBe(0n)
  const bal = await erc20Balance('0xba100000625a3754423978a60c9317c58a424e3d', HOLDER)
  const weth = await erc20Balance('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', HOLDER)
  expect(bal).toBeGreaterThan(0n)
  expect(weth).toBeGreaterThan(0n)
})
async function startAnvil() {
  let output = ''
  let failure = ''
  anvil = spawn('anvil', [
    '--fork-url', FORK_RPC,
    '--fork-block-number', String(FORK_BLOCK),
    '--host', '127.0.0.1',
    '--port', String(ANVIL_PORT),
    '--silent',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  const capture = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-8192) }
  anvil.stdout?.on('data', capture)
  anvil.stderr?.on('data', capture)
  anvil.once('error', (error) => { failure = `Failed to launch Anvil: ${error.message}` })
  anvil.once('exit', (code, signal) => {
    failure = `Anvil exited before becoming ready (code ${code}, signal ${signal})`
  })

  const deadline = Date.now() + 60_000
  for (;;) {
    if (failure) throw new Error(`${failure}\n${output}`)
    try {
      await rpc('eth_chainId')
      break
    } catch (error) {
      if (failure) throw new Error(`${failure}\n${output}`)
      if (Date.now() > deadline) {
        throw new Error(`Anvil did not become ready at ${ANVIL_RPC}: ${String(error)}\n${output}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  await rpc('anvil_impersonateAccount', [HOLDER])
  await rpc('anvil_setBalance', [HOLDER, '0x21e19e0c9bab2400000'])
}
