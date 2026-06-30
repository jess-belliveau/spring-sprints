import { useEffect, useRef, type RefObject } from 'react'
import { useRaceStore } from '../store/race.store'

const MAX_EXTRAP_S = 2.0

interface Props {
  left: { riderName: string } | null
  right: { riderName: string } | null
  targetDistance: number
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function Panel({
  riderName,
  side,
  barRef,
  wattsRef,
  timeRef,
  finishedRef,
}: {
  riderName: string
  side: 'left' | 'right'
  barRef: RefObject<HTMLDivElement>
  wattsRef: RefObject<HTMLSpanElement>
  timeRef: RefObject<HTMLSpanElement>
  finishedRef: RefObject<HTMLDivElement>
}) {
  const color = side === 'left' ? 'var(--lane-left)' : 'var(--lane-right)'
  const isLeft = side === 'left'

  const bar = (
    <div className="w-[72px] self-stretch bg-stone-800 relative overflow-hidden shrink-0">
      <div
        ref={barRef}
        className="absolute bottom-0 inset-x-0"
        style={{ height: '0%', backgroundColor: color, transition: 'none' }}
      />
    </div>
  )

  return (
    <div className="flex-1 flex overflow-hidden">
      {!isLeft && bar}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-10 py-8">
        <div className="text-3xl font-black uppercase tracking-widest truncate max-w-full" style={{ color }}>
          {riderName}
        </div>
        <span ref={timeRef} className="text-8xl font-black tabular-nums text-white leading-none">
          0:00.00
        </span>
        <div className="leading-none">
          <span ref={wattsRef} className="text-4xl font-bold tabular-nums text-amber-400">0</span>
          <span className="text-xl text-stone-400"> W</span>
        </div>
        <div
          ref={finishedRef}
          className="text-2xl font-bold text-green-400 tracking-widest uppercase"
          style={{ display: 'none' }}
        >
          ✓ Finished
        </div>
      </div>
      {isLeft && bar}
    </div>
  )
}

export function LineSplitDisplay({ left, right, targetDistance }: Props) {
  const leftBarRef = useRef<HTMLDivElement>(null)
  const leftWattsRef = useRef<HTMLSpanElement>(null)
  const leftTimeRef = useRef<HTMLSpanElement>(null)
  const leftFinishedRef = useRef<HTMLDivElement>(null)
  const rightBarRef = useRef<HTMLDivElement>(null)
  const rightWattsRef = useRef<HTMLSpanElement>(null)
  const rightTimeRef = useRef<HTMLSpanElement>(null)
  const rightFinishedRef = useRef<HTMLDivElement>(null)

  const leftPhysRef = useRef({ pos: 0, vel: 0, ts: 0 })
  const rightPhysRef = useRef({ pos: 0, vel: 0, ts: 0 })
  const targetDistanceRef = useRef(targetDistance)
  targetDistanceRef.current = targetDistance
  const rafRef = useRef(0)

  useEffect(() => {
    const unsubscribe = useRaceStore.subscribe((state) => {
      const l = state.race?.left
      const r = state.race?.right
      const now = Date.now()

      if (l) {
        const newPos = l.distanceCovered
        const newVel = l.finished ? 0 : l.velocityMs
        const lp = leftPhysRef.current
        if (newPos !== lp.pos || newVel !== lp.vel) {
          leftPhysRef.current = { pos: newPos, vel: newVel, ts: now }
        }
        if (leftWattsRef.current)    leftWattsRef.current.textContent    = String(l.instantWatts)
        if (leftTimeRef.current)     leftTimeRef.current.textContent     = fmt(l.elapsedMs)
        if (leftFinishedRef.current) leftFinishedRef.current.style.display = l.finished ? '' : 'none'
      }

      if (r) {
        const newPos = r.distanceCovered
        const newVel = r.finished ? 0 : r.velocityMs
        const rp = rightPhysRef.current
        if (newPos !== rp.pos || newVel !== rp.vel) {
          rightPhysRef.current = { pos: newPos, vel: newVel, ts: now }
        }
        if (rightWattsRef.current)    rightWattsRef.current.textContent    = String(r.instantWatts)
        if (rightTimeRef.current)     rightTimeRef.current.textContent     = fmt(r.elapsedMs)
        if (rightFinishedRef.current) rightFinishedRef.current.style.display = r.finished ? '' : 'none'
      }
    })

    function tick() {
      const now = Date.now()
      const dist = targetDistanceRef.current
      const lPhys = leftPhysRef.current
      const rPhys = rightPhysRef.current
      const lDt = lPhys.ts > 0 ? Math.min((now - lPhys.ts) / 1000, MAX_EXTRAP_S) : 0
      const rDt = rPhys.ts > 0 ? Math.min((now - rPhys.ts) / 1000, MAX_EXTRAP_S) : 0
      const leftPct  = Math.min(1, (lPhys.pos + lPhys.vel * lDt) / dist)
      const rightPct = Math.min(1, (rPhys.pos + rPhys.vel * rDt) / dist)
      if (leftBarRef.current)  leftBarRef.current.style.height = `${leftPct  * 100}%`
      if (rightBarRef.current) rightBarRef.current.style.height = `${rightPct * 100}%`
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      unsubscribe()
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div className="flex w-full h-full overflow-hidden">
      {left && (
        <Panel
          riderName={left.riderName}
          side="left"
          barRef={leftBarRef}
          wattsRef={leftWattsRef}
          timeRef={leftTimeRef}
          finishedRef={leftFinishedRef}
        />
      )}
      {right && (
        <Panel
          riderName={right.riderName}
          side="right"
          barRef={rightBarRef}
          wattsRef={rightWattsRef}
          timeRef={rightTimeRef}
          finishedRef={rightFinishedRef}
        />
      )}
    </div>
  )
}
