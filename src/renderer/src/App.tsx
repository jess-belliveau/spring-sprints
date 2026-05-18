import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { useIPCListeners } from './hooks/useIPCListeners'
import { useTheme, type Theme } from './hooks/useTheme'
import { useEventStore, selectPhase } from './store/event.store'
import { useBluetoothStore } from './store/bluetooth.store'
import { Setup } from './screens/Setup'
import { Registration } from './screens/Registration'
import { DevicePairing } from './screens/DevicePairing'
import { Qualifying } from './screens/Qualifying'
import { QualifyingResults } from './screens/QualifyingResults'
import { Bracket } from './screens/Bracket'
import { HeadToHead } from './screens/HeadToHead'
import { FinalResults } from './screens/FinalResults'
import { ErrorBoundary } from './components/ErrorBoundary'
import { DeviceManagerModal } from './components/DeviceManagerModal'

const PHASE_ROUTES: Record<string, string> = {
  setup: '/',
  registration: '/registration',
  'device-pairing': '/pairing',
  qualifying: '/qualifying',
  'qualifying-results': '/qualifying-results',
  bracket: '/bracket',
  'head-to-head': '/headtohead',
  complete: '/final'
}

const LANE_DOT_COLOR: Record<string, string> = {
  connected: 'bg-green-400',
  connecting: 'bg-amber-400 animate-pulse',
  error: 'bg-red-500',
  empty: 'bg-stone-700'
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'poster', label: 'Poster' },
  { value: 'stadium', label: 'Stadium' }
]

function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <div className="fixed bottom-3 right-3 z-30 flex items-center gap-0.5 bg-stone-900 border border-stone-700 rounded-full px-1 py-1">
      {THEMES.map((t) => (
        <button
          key={t.value}
          onClick={() => setTheme(t.value)}
          className={`px-2.5 py-0.5 rounded-full text-xs uppercase tracking-widest transition-colors ${
            theme === t.value
              ? 'bg-stone-700 text-white'
              : 'text-stone-500 hover:text-stone-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function DeviceStatusButton() {
  const connectedDevices = useBluetoothStore((s) => s.connectedDevices)
  const [open, setOpen] = useState(false)

  const leftStatus = connectedDevices['left']?.status ?? 'empty'
  const rightStatus = connectedDevices['right']?.status ?? 'empty'

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-3 left-3 z-30 flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 border border-stone-700 hover:border-stone-500 rounded-full px-3 py-1.5 transition-colors"
        title="Manage BLE devices"
      >
        <span className="text-xs text-stone-400 uppercase tracking-widest mr-0.5">BLE</span>
        <span className={`w-2 h-2 rounded-full ${LANE_DOT_COLOR[leftStatus]}`} title={`Left: ${leftStatus}`} />
        <span className={`w-2 h-2 rounded-full ${LANE_DOT_COLOR[rightStatus]}`} title={`Right: ${rightStatus}`} />
      </button>
      {open && <DeviceManagerModal onClose={() => setOpen(false)} />}
    </>
  )
}

function PhaseRouter() {
  const navigate = useNavigate()
  const phase = useEventStore(selectPhase)
  const setEvent = useEventStore((s) => s.setEvent)

  useEffect(() => {
    window.electronAPI.loadEvent().then((event) => {
      if (event) setEvent(event)
    })
  }, [setEvent])

  useEffect(() => {
    const route = PHASE_ROUTES[phase]
    if (route) navigate(route)
  }, [phase, navigate])

  return null
}

export default function App() {
  useIPCListeners()
  const { theme, setTheme } = useTheme()

  return (
    <div
      className="w-screen h-screen bg-[var(--root-bg)] text-white overflow-hidden"
      data-theme={theme}
    >
      <ErrorBoundary>
        <PhaseRouter />
        <DeviceStatusButton />
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <Routes>
          <Route path="/" element={<Setup />} />
          <Route path="/registration" element={<Registration />} />
          <Route path="/pairing" element={<DevicePairing />} />
          <Route path="/qualifying" element={<Qualifying />} />
          <Route path="/qualifying-results" element={<QualifyingResults />} />
          <Route path="/bracket" element={<Bracket />} />
          <Route path="/headtohead" element={<HeadToHead />} />
          <Route path="/final" element={<FinalResults />} />
        </Routes>
      </ErrorBoundary>
    </div>
  )
}
