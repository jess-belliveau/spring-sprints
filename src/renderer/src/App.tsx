import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { useIPCListeners } from './hooks/useIPCListeners'
import { useEventStore, selectPhase } from './store/event.store'
import { Setup } from './screens/Setup'
import { Registration } from './screens/Registration'
import { DevicePairing } from './screens/DevicePairing'
import { Qualifying } from './screens/Qualifying'
import { QualifyingResults } from './screens/QualifyingResults'
import { Bracket } from './screens/Bracket'
import { HeadToHead } from './screens/HeadToHead'
import { FinalResults } from './screens/FinalResults'
import { ErrorBoundary } from './components/ErrorBoundary'

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

function PhaseRouter() {
  const navigate = useNavigate()
  const phase = useEventStore(selectPhase)
  const setEvent = useEventStore((s) => s.setEvent)

  // Load persisted event on startup
  useEffect(() => {
    window.electronAPI.loadEvent().then((event) => {
      if (event) {
        setEvent(event)
      }
    })
  }, [setEvent])

  // Navigate when phase changes
  useEffect(() => {
    const route = PHASE_ROUTES[phase]
    if (route) navigate(route)
  }, [phase, navigate])

  return null
}

export default function App() {
  useIPCListeners()

  return (
    <div className="w-screen h-screen bg-gray-950 text-white overflow-hidden">
      <ErrorBoundary>
        <PhaseRouter />
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
