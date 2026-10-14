import { BptExitCard } from './components/BptExitCard'
import { Header } from './components/Header'
import { LockOverview } from './components/LockOverview'
import { UnlockCard } from './components/UnlockCard'
import { useApp } from './contexts/AppContext'
import { useLock } from './hooks/useLock'
import { AddressScanCard } from "./components/AddressScanCard";

export default function App() {
  const { scanTarget } = useApp()
  const data = useLock()

  return (
    <>
      <Header />

      <AddressScanCard loading={data.loading} onScan={data.refresh} />

      {data.error && !data.lock && (
        <div className="error-box" style={{ marginBottom: 16 }}>{data.error}</div>
      )}

      {scanTarget && data.lock && (
        <>
          <LockOverview data={data} />
          <UnlockCard data={data} />
          <BptExitCard data={data} />
        </>
      )}

      <footer className="muted" style={{ marginTop: 32, fontSize: 12 }}>
        veBAL withdrawals require an expired lock. BPT exits are proportional and return BAL and
        WETH. USD pricing is unavailable — amounts are shown as token
        quantities.
        <br />
        This site is fully static; it only talks to the RPC you configure.
      </footer>
    </>
  )
}
