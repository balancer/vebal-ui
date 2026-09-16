import { BptExitCard } from './components/BptExitCard'
import { Header } from './components/Header'
import { LockOverview } from './components/LockOverview'
import { UnlockCard } from './components/UnlockCard'
import { WatchAddressForm } from './components/WatchAddressForm'
import { useApp } from './contexts/AppContext'
import { useLock } from './hooks/useLock'

export default function App() {
  const { scanTarget } = useApp()
  const data = useLock()

  return (
    <>
      <Header />

      {!scanTarget && (
        <div className="card">
          <div className="muted">
            Connect an injected wallet, or paste any address below to inspect its veBAL lock
            read-only.
          </div>
          <WatchAddressForm />
        </div>
      )}

      {scanTarget && (
        <>
          <LockOverview data={data} />
          <UnlockCard data={data} />
          <BptExitCard data={data} />
        </>
      )}

      <footer className="muted" style={{ marginTop: 32, fontSize: 12 }}>
        Fully static — no backend, no subgraph, no Balancer API. Reads go to the RPC you configure.
        No USD pricing: amounts are token quantities. Unlocking requires an expired lock; the BPT
        exit pays out BAL and WETH as-is, with no auto-unwrap.
      </footer>
    </>
  )
}
