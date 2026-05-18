import { useEffect, useRef } from 'react'
import { useRaceStore } from '../store/race.store'

const SIZE = 600
const CX = SIZE / 2
const CY = SIZE / 2
const OUTER_R = 224
const INNER_R = 162
const STROKE = 36
const SOLO_R = 194
const ALPHA = 0.18

interface Props {
  left: { riderName: string } | null
  right: { riderName: string } | null
  targetDistance: number
}

function arcOffset(r: number, pct: number): number {
  return 2 * Math.PI * r * (1 - Math.min(1, pct))
}

function dotXY(pct: number, r: number): [number, number] {
  const a = 2 * Math.PI * Math.min(1, pct) - Math.PI / 2
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export function TrackDisplay({ left, right, targetDistance }: Props) {
  const hasBoth = left !== null && right !== null
  const leftR = hasBoth ? INNER_R : SOLO_R
  const rightR = OUTER_R

  // SVG refs
  const leftArcRef = useRef<SVGCircleElement>(null)
  const rightArcRef = useRef<SVGCircleElement>(null)
  const leftDotRef = useRef<SVGCircleElement>(null)
  const rightDotRef = useRef<SVGCircleElement>(null)
  const leftGlowRef = useRef<SVGCircleElement>(null)
  const rightGlowRef = useRef<SVGCircleElement>(null)
  const centreDistRef = useRef<SVGTextElement>(null)

  // Stats panel refs
  const leftDistRef = useRef<HTMLSpanElement>(null)
  const leftLeadsRef = useRef<HTMLSpanElement>(null)
  const leftWattsRef = useRef<HTMLSpanElement>(null)
  const leftCadenceRef = useRef<HTMLSpanElement>(null)
  const leftTimeRef = useRef<HTMLSpanElement>(null)
  const leftFinishedRef = useRef<HTMLSpanElement>(null)
  const rightDistRef = useRef<HTMLSpanElement>(null)
  const rightLeadsRef = useRef<HTMLSpanElement>(null)
  const rightWattsRef = useRef<HTMLSpanElement>(null)
  const rightCadenceRef = useRef<HTMLSpanElement>(null)
  const rightTimeRef = useRef<HTMLSpanElement>(null)
  const rightFinishedRef = useRef<HTMLSpanElement>(null)

  // Animation state — plain refs, never React state
  const leftPosRef = useRef(0)
  const rightPosRef = useRef(0)
  const leftTargetRef = useRef(0)
  const rightTargetRef = useRef(0)
  const rafRef = useRef<number>(0)

  // Non-reactive store subscription — updates text/status nodes at telemetry rate (~10 Hz)
  useEffect(() => {
    return useRaceStore.subscribe((state) => {
      const l = state.race?.left
      const r = state.race?.right

      if (l) {
        leftTargetRef.current = l.distanceCovered
        if (leftWattsRef.current) leftWattsRef.current.textContent = String(l.instantWatts)
        if (leftCadenceRef.current) leftCadenceRef.current.textContent = String(l.cadenceRpm)
        if (leftTimeRef.current) leftTimeRef.current.textContent = fmt(l.elapsedMs)
        if (leftFinishedRef.current) leftFinishedRef.current.style.display = l.finished ? '' : 'none'
      } else {
        leftTargetRef.current = 0
      }

      if (r) {
        rightTargetRef.current = r.distanceCovered
        if (rightWattsRef.current) rightWattsRef.current.textContent = String(r.instantWatts)
        if (rightCadenceRef.current) rightCadenceRef.current.textContent = String(r.cadenceRpm)
        if (rightTimeRef.current) rightTimeRef.current.textContent = fmt(r.elapsedMs)
        if (rightFinishedRef.current) rightFinishedRef.current.style.display = r.finished ? '' : 'none'
      } else {
        rightTargetRef.current = 0
      }
    })
  }, [])

  // RAF loop — direct SVG/DOM attribute writes, zero React involvement
  useEffect(() => {
    function frame() {
      const lt = leftTargetRef.current
      const rt = rightTargetRef.current

      // Snap to 0 when race resets (target drops well below smoothed pos)
      if (lt < leftPosRef.current - 1) leftPosRef.current = 0
      if (rt < rightPosRef.current - 1) rightPosRef.current = 0

      leftPosRef.current += (lt - leftPosRef.current) * ALPHA
      rightPosRef.current += (rt - rightPosRef.current) * ALPHA
      if (Math.abs(lt - leftPosRef.current) < 0.01) leftPosRef.current = lt
      if (Math.abs(rt - rightPosRef.current) < 0.01) rightPosRef.current = rt

      const leftPct = leftPosRef.current / targetDistance
      const rightPct = rightPosRef.current / targetDistance
      const leftLeads = hasBoth && leftPosRef.current > rightPosRef.current + 0.5
      const rightLeads = hasBoth && rightPosRef.current > leftPosRef.current + 0.5
      const gap = Math.round(Math.abs(leftPosRef.current - rightPosRef.current))

      // Arcs
      leftArcRef.current?.setAttribute('stroke-dashoffset', String(arcOffset(leftR, leftPct)))
      leftArcRef.current?.setAttribute('opacity', hasBoth && rightLeads ? '0.4' : '1')
      rightArcRef.current?.setAttribute('stroke-dashoffset', String(arcOffset(rightR, rightPct)))
      rightArcRef.current?.setAttribute('opacity', hasBoth && leftLeads ? '0.4' : '1')

      // Left dot
      if (leftPct > 0.001) {
        const [lx, ly] = dotXY(leftPct, leftR)
        if (leftDotRef.current) {
          leftDotRef.current.setAttribute('cx', String(lx))
          leftDotRef.current.setAttribute('cy', String(ly))
          leftDotRef.current.setAttribute('r', leftLeads ? '17' : '12')
          leftDotRef.current.style.display = ''
        }
        if (leftGlowRef.current) {
          leftGlowRef.current.setAttribute('cx', String(lx))
          leftGlowRef.current.setAttribute('cy', String(ly))
          leftGlowRef.current.style.display = leftLeads ? '' : 'none'
        }
      } else {
        if (leftDotRef.current) leftDotRef.current.style.display = 'none'
        if (leftGlowRef.current) leftGlowRef.current.style.display = 'none'
      }

      // Right dot
      if (rightPct > 0.001) {
        const [rx, ry] = dotXY(rightPct, rightR)
        if (rightDotRef.current) {
          rightDotRef.current.setAttribute('cx', String(rx))
          rightDotRef.current.setAttribute('cy', String(ry))
          rightDotRef.current.setAttribute('r', rightLeads ? '17' : '12')
          rightDotRef.current.style.display = ''
        }
        if (rightGlowRef.current) {
          rightGlowRef.current.setAttribute('cx', String(rx))
          rightGlowRef.current.setAttribute('cy', String(ry))
          rightGlowRef.current.style.display = rightLeads ? '' : 'none'
        }
      } else {
        if (rightDotRef.current) rightDotRef.current.style.display = 'none'
        if (rightGlowRef.current) rightGlowRef.current.style.display = 'none'
      }

      // Smoothed distance counters (60fps — looks much better than 10Hz jumps)
      if (leftDistRef.current) leftDistRef.current.textContent = String(Math.round(leftPosRef.current))
      if (rightDistRef.current) rightDistRef.current.textContent = String(Math.round(rightPosRef.current))
      if (centreDistRef.current) centreDistRef.current.textContent = `${Math.round(leftPosRef.current)}m`

      // Leads indicator — visibility keeps layout stable (no reflow = no stat flicker)
      if (leftLeadsRef.current) {
        leftLeadsRef.current.style.visibility = leftLeads ? 'visible' : 'hidden'
        if (leftLeads) leftLeadsRef.current.textContent = `▲ LEADS +${gap}m`
      }
      if (rightLeadsRef.current) {
        rightLeadsRef.current.style.visibility = rightLeads ? 'visible' : 'hidden'
        if (rightLeads) rightLeadsRef.current.textContent = `▲ LEADS +${gap}m`
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [targetDistance, hasBoth, leftR])

  // React renders the DOM structure once — all live updates happen imperatively above
  return (
    <div className="flex items-center w-full h-full gap-4 px-8">

      {/* ── Left rider stats ── */}
      {left && (
        <div className="flex-1 flex flex-col items-end gap-3 min-w-0">
          <span ref={leftLeadsRef} className="text-5xl font-black tracking-widest uppercase" style={{ color: 'var(--lane-left)', visibility: 'hidden' }}>
            ▲ LEADS +0m
          </span>

          <span className="text-3xl font-black tracking-widest uppercase truncate" style={{ color: 'var(--lane-left)' }}>
            {left.riderName}
          </span>

          <span className="text-8xl font-black tabular-nums text-white leading-none text-right">
            <span ref={leftDistRef}>0</span>
            <span className="text-3xl text-stone-500"> m</span>
          </span>

          <span className="text-5xl font-bold tabular-nums text-amber-400 leading-none">
            <span ref={leftWattsRef}>0</span>
            <span className="text-2xl text-stone-400"> W</span>
          </span>

          <span className="text-3xl font-bold tabular-nums text-stone-300 leading-none">
            <span ref={leftCadenceRef}>0</span>
            <span className="text-lg text-stone-500"> rpm</span>
          </span>

          <span ref={leftTimeRef} className="text-2xl font-mono text-stone-500">0:00.00</span>

          <span ref={leftFinishedRef} className="text-lg font-bold text-green-400 tracking-widest uppercase" style={{ display: 'none' }}>
            ✓ Finished
          </span>
        </div>
      )}

      {/* ── Circular track ── */}
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="flex-shrink-0">
        {/* Track backgrounds — static */}
        {hasBoth && (
          <circle cx={CX} cy={CY} r={OUTER_R} fill="none" style={{ stroke: 'var(--track-bg)' }} strokeWidth={STROKE} />
        )}
        <circle cx={CX} cy={CY} r={leftR} fill="none" style={{ stroke: 'var(--track-bg)' }} strokeWidth={STROKE} />

        {/* Right arc — starts fully hidden (dashoffset = full circumference) */}
        {right && (
          <circle
            ref={rightArcRef}
            cx={CX} cy={CY} r={OUTER_R}
            fill="none"
            style={{ stroke: 'var(--lane-right)' }}
            strokeWidth={STROKE}
            strokeDasharray={2 * Math.PI * OUTER_R}
            strokeDashoffset={2 * Math.PI * OUTER_R}
            strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        )}

        {/* Left arc */}
        {left && (
          <circle
            ref={leftArcRef}
            cx={CX} cy={CY} r={leftR}
            fill="none"
            style={{ stroke: 'var(--lane-left)' }}
            strokeWidth={STROKE}
            strokeDasharray={2 * Math.PI * leftR}
            strokeDashoffset={2 * Math.PI * leftR}
            strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        )}

        {/* Dots — hidden initially, positioned by RAF loop */}
        {right && (
          <>
            <circle ref={rightGlowRef} cx={CX} cy={CY} r={28} style={{ fill: 'var(--lane-right)', display: 'none' }} opacity={0.25} />
            <circle ref={rightDotRef} cx={CX} cy={CY} r={12} style={{ fill: 'var(--lane-right)', display: 'none' }} />
          </>
        )}
        {left && (
          <>
            <circle ref={leftGlowRef} cx={CX} cy={CY} r={28} style={{ fill: 'var(--lane-left)', display: 'none' }} opacity={0.25} />
            <circle ref={leftDotRef} cx={CX} cy={CY} r={12} style={{ fill: 'var(--lane-left)', display: 'none' }} />
          </>
        )}

        {/* Solo: distance counter in centre */}
        {!hasBoth && left && (
          <>
            <text ref={centreDistRef} x={CX} y={CY - 16} textAnchor="middle" fill="white" fontSize="64" fontWeight="900" fontFamily="ui-monospace, monospace">
              0m
            </text>
            <text x={CX} y={CY + 28} textAnchor="middle" fill="#78716c" fontSize="22">
              of {targetDistance}m
            </text>
          </>
        )}

        {/* H2H: target distance — static */}
        {hasBoth && (
          <text x={CX} y={CY + 14} textAnchor="middle" fill="#44403c" fontSize="30" fontWeight="bold">
            {targetDistance}m
          </text>
        )}
      </svg>

      {/* ── Right rider stats ── */}
      {right && (
        <div className="flex-1 flex flex-col items-start gap-3 min-w-0">
          <span ref={rightLeadsRef} className="text-5xl font-black tracking-widest uppercase" style={{ color: 'var(--lane-right)', visibility: 'hidden' }}>
            ▲ LEADS +0m
          </span>

          <span className="text-3xl font-black tracking-widest uppercase truncate" style={{ color: 'var(--lane-right)' }}>
            {right.riderName}
          </span>

          <span className="text-8xl font-black tabular-nums text-white leading-none">
            <span ref={rightDistRef}>0</span>
            <span className="text-3xl text-stone-500"> m</span>
          </span>

          <span className="text-5xl font-bold tabular-nums text-amber-400 leading-none">
            <span ref={rightWattsRef}>0</span>
            <span className="text-2xl text-stone-400"> W</span>
          </span>

          <span className="text-3xl font-bold tabular-nums text-stone-300 leading-none">
            <span ref={rightCadenceRef}>0</span>
            <span className="text-lg text-stone-500"> rpm</span>
          </span>

          <span ref={rightTimeRef} className="text-2xl font-mono text-stone-500">0:00.00</span>

          <span ref={rightFinishedRef} className="text-lg font-bold text-green-400 tracking-widest uppercase" style={{ display: 'none' }}>
            ✓ Finished
          </span>
        </div>
      )}
    </div>
  )
}
