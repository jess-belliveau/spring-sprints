import { useEffect, useRef } from 'react'
import { useRaceStore } from '../store/race.store'

const SIZE = 600
const CX = SIZE / 2
const CY = SIZE / 2
const OUTER_R = 224
const INNER_R = 162
const STROKE = 36
const SOLO_R = 194

// Cap dead-reckoning extrapolation. Must be > longest device tick interval:
// demo = 250ms, real FTMS = 1000ms. 2.0s gives margin without runaway.
const MAX_EXTRAP_S = 2.0

interface Props {
  left: { riderName: string } | null
  right: { riderName: string } | null
  targetDistance: number
  compact?: boolean
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

export function TrackDisplay({ left, right, targetDistance, compact = false }: Props) {
  const hasBoth = left !== null && right !== null
  const leftR = hasBoth ? INNER_R : SOLO_R

  // Keep prop values in refs so closures always read current values
  const hasBothRef = useRef(hasBoth)
  hasBothRef.current = hasBoth
  const leftRRef = useRef(leftR)
  leftRRef.current = leftR
  const targetDistanceRef = useRef(targetDistance)
  targetDistanceRef.current = targetDistance

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

  // Physics state for dead reckoning — updated by subscription at ~10 Hz
  const leftPhysRef  = useRef({ pos: 0, vel: 0, ts: 0 })
  const rightPhysRef = useRef({ pos: 0, vel: 0, ts: 0 })

  // Signed gap in metres written by subscription, read by RAF.
  // Positive = left leads, negative = right leads, 0 = equal / solo.
  const leadGapRef = useRef(0)

  const rafRef = useRef(0)

  useEffect(() => {
    // Subscription updates physics refs and all stats text at telemetry rate (~10 Hz)
    const unsubscribe = useRaceStore.subscribe((state) => {
      const l = state.race?.left
      const r = state.race?.right
      const now = Date.now()

      // Only reset the dead-reckoning clock when THIS lane's data actually changed.
      // Without this guard, a right-lane telemetry tick would silently reset the
      // left-lane timestamp (same store update, stale left values), causing the
      // left arc to snap back to the last telemetry position on the next RAF frame.
      if (l) {
        const newPos = l.distanceCovered
        const newVel = l.finished ? 0 : l.velocityMs
        const lp = leftPhysRef.current
        if (newPos !== lp.pos || newVel !== lp.vel) {
          leftPhysRef.current = { pos: newPos, vel: newVel, ts: now }
        }
      }
      if (r) {
        const newPos = r.distanceCovered
        const newVel = r.finished ? 0 : r.velocityMs
        const rp = rightPhysRef.current
        if (newPos !== rp.pos || newVel !== rp.vel) {
          rightPhysRef.current = { pos: newPos, vel: newVel, ts: now }
        }
      }

      const hb = hasBothRef.current
      const leftDist  = l?.distanceCovered ?? 0
      const rightDist = r?.distanceCovered ?? 0

      leadGapRef.current = hb ? leftDist - rightDist : 0

      // Stats text
      if (l) {
        if (leftDistRef.current)     leftDistRef.current.textContent     = String(Math.round(leftDist))
        if (leftWattsRef.current)    leftWattsRef.current.textContent    = String(l.instantWatts)
        if (leftCadenceRef.current)  leftCadenceRef.current.textContent  = String(l.cadenceRpm)
        if (leftTimeRef.current)     leftTimeRef.current.textContent     = fmt(l.elapsedMs)
        if (leftFinishedRef.current) leftFinishedRef.current.style.visibility = l.finished ? 'visible' : 'hidden'
      }
      if (r) {
        if (rightDistRef.current)     rightDistRef.current.textContent     = String(Math.round(rightDist))
        if (rightWattsRef.current)    rightWattsRef.current.textContent    = String(r.instantWatts)
        if (rightCadenceRef.current)  rightCadenceRef.current.textContent  = String(r.cadenceRpm)
        if (rightTimeRef.current)     rightTimeRef.current.textContent     = fmt(r.elapsedMs)
        if (rightFinishedRef.current) rightFinishedRef.current.style.visibility = r.finished ? 'visible' : 'hidden'
      }

      // Keep leads text content fresh; visibility is controlled by the RAF loop.
      const absGap = Math.round(Math.abs(leftDist - rightDist))
      if (leftLeadsRef.current)  leftLeadsRef.current.textContent  = `▲ LEADS +${absGap}m`
      if (rightLeadsRef.current) rightLeadsRef.current.textContent = `▲ LEADS +${absGap}m`
    })

    // RAF loop drives arc and dot positions at 60fps via dead reckoning
    function tick() {
      const now  = Date.now()
      const dist = targetDistanceRef.current
      const hb   = hasBothRef.current
      const lR   = leftRRef.current

      const lPhys = leftPhysRef.current
      const rPhys = rightPhysRef.current

      const lDt = lPhys.ts > 0 ? Math.min((now - lPhys.ts) / 1000, MAX_EXTRAP_S) : 0
      const rDt = rPhys.ts > 0 ? Math.min((now - rPhys.ts) / 1000, MAX_EXTRAP_S) : 0

      const leftEstDist  = Math.min(dist, lPhys.pos + lPhys.vel * lDt)
      const rightEstDist = Math.min(dist, rPhys.pos + rPhys.vel * rDt)

      const leftPct  = leftEstDist  / dist
      const rightPct = rightEstDist / dist

      // Smooth advantage: ramps from 0 at a 0.5 m gap to 1 at a 5 m gap.
      // Both values are 0 in solo mode (hb = false).
      const rawGap   = leadGapRef.current           // + = left leads
      const leftAdv  = hb ? Math.min(1, Math.max(0, ( rawGap - 0.5) / 4.5)) : 0
      const rightAdv = hb ? Math.min(1, Math.max(0, (-rawGap - 0.5) / 4.5)) : 0

      // Arcs — trailing dims gradually as the gap opens
      if (leftArcRef.current) {
        leftArcRef.current.style.strokeDashoffset = String(arcOffset(lR, leftPct))
        leftArcRef.current.style.opacity = String(1 - rightAdv * 0.6)
      }
      if (rightArcRef.current) {
        rightArcRef.current.style.strokeDashoffset = String(arcOffset(OUTER_R, rightPct))
        rightArcRef.current.style.opacity = String(1 - leftAdv * 0.6)
      }

      // Left dot — radius and glow scale with advantage
      if (leftPct > 0.001) {
        const [lx, ly] = dotXY(leftPct, lR)
        if (leftDotRef.current) {
          leftDotRef.current.setAttribute('cx', String(lx))
          leftDotRef.current.setAttribute('cy', String(ly))
          leftDotRef.current.setAttribute('r', String(12 + leftAdv * 5))
          leftDotRef.current.style.display = ''
        }
        if (leftGlowRef.current) {
          leftGlowRef.current.setAttribute('cx', String(lx))
          leftGlowRef.current.setAttribute('cy', String(ly))
          leftGlowRef.current.style.opacity = String(leftAdv * 0.3)
          leftGlowRef.current.style.display = leftAdv > 0 ? '' : 'none'
        }
      } else {
        if (leftDotRef.current)  leftDotRef.current.style.display  = 'none'
        if (leftGlowRef.current) leftGlowRef.current.style.display = 'none'
      }

      // Right dot
      if (rightPct > 0.001) {
        const [rx, ry] = dotXY(rightPct, OUTER_R)
        if (rightDotRef.current) {
          rightDotRef.current.setAttribute('cx', String(rx))
          rightDotRef.current.setAttribute('cy', String(ry))
          rightDotRef.current.setAttribute('r', String(12 + rightAdv * 5))
          rightDotRef.current.style.display = ''
        }
        if (rightGlowRef.current) {
          rightGlowRef.current.setAttribute('cx', String(rx))
          rightGlowRef.current.setAttribute('cy', String(ry))
          rightGlowRef.current.style.opacity = String(rightAdv * 0.3)
          rightGlowRef.current.style.display = rightAdv > 0 ? '' : 'none'
        }
      } else {
        if (rightDotRef.current)  rightDotRef.current.style.display  = 'none'
        if (rightGlowRef.current) rightGlowRef.current.style.display = 'none'
      }

      // Leads label fades in as advantage grows
      if (leftLeadsRef.current)  leftLeadsRef.current.style.opacity  = String(leftAdv)
      if (rightLeadsRef.current) rightLeadsRef.current.style.opacity = String(rightAdv)

      // Solo centre distance
      if (centreDistRef.current) {
        centreDistRef.current.textContent = `${Math.round(leftEstDist)}m`
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      unsubscribe()
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const svgPx = compact ? 400 : SIZE

  // React renders the DOM structure once — all live updates happen imperatively above
  return (
    <div className={`flex items-center w-full h-full gap-4 ${compact ? 'px-4' : 'px-8'}`}>

      {/* ── Left rider stats ── */}
      {left && (
        <div className="flex-1 flex flex-col items-end gap-2 min-w-0">
          <span ref={leftLeadsRef} className={`${compact ? 'text-2xl' : 'text-5xl'} font-black tracking-widest uppercase`} style={{ color: 'var(--lane-left)', opacity: 0 }}>
            ▲ LEADS +0m
          </span>

          <span className={`${compact ? 'text-2xl' : 'text-5xl'} font-black tracking-widest uppercase truncate`} style={{ color: 'var(--lane-left)' }}>
            {left.riderName}
          </span>

          <span className={`${compact ? 'text-4xl' : 'text-8xl'} font-black tabular-nums text-white leading-none text-right`}>
            <span ref={leftDistRef}>0</span>
            <span className={`${compact ? 'text-xl' : 'text-4xl'} text-stone-500`}> m</span>
          </span>

          <span className={`${compact ? 'text-3xl' : 'text-7xl'} font-bold tabular-nums text-amber-400 leading-none`}>
            <span ref={leftWattsRef}>0</span>
            <span className={`${compact ? 'text-base' : 'text-3xl'} text-stone-400`}> W</span>
          </span>

          <span className={`${compact ? 'text-2xl' : 'text-5xl'} font-bold tabular-nums text-stone-300 leading-none`}>
            <span ref={leftCadenceRef}>0</span>
            <span className={`${compact ? 'text-sm' : 'text-2xl'} text-stone-500`}> rpm</span>
          </span>

          <span ref={leftTimeRef} className={`${compact ? 'text-xl' : 'text-3xl'} font-mono text-stone-500`}>0:00.00</span>

          <span ref={leftFinishedRef} className={`${compact ? 'text-sm' : 'text-xl'} font-bold text-green-400 tracking-widest uppercase`} style={{ visibility: 'hidden' }}>
            ✓ Finished
          </span>
        </div>
      )}

      {/* ── Circular track ── */}
      <svg width={svgPx} height={svgPx} viewBox={`0 0 ${SIZE} ${SIZE}`} className="flex-shrink-0">
        {/* Track backgrounds — static */}
        {hasBoth && (
          <circle cx={CX} cy={CY} r={OUTER_R} fill="none" style={{ stroke: 'var(--track-bg)' }} strokeWidth={STROKE} />
        )}
        <circle cx={CX} cy={CY} r={leftR} fill="none" style={{ stroke: 'var(--track-bg)' }} strokeWidth={STROKE} />

        {/* Right arc — strokeDashoffset driven by RAF at 60fps */}
        {right && (
          <circle
            ref={rightArcRef}
            cx={CX} cy={CY} r={OUTER_R}
            fill="none"
            strokeWidth={STROKE}
            strokeDasharray={2 * Math.PI * OUTER_R}
            strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{
              stroke: 'var(--lane-right)',
              strokeDashoffset: 2 * Math.PI * OUTER_R,
            }}
          />
        )}

        {/* Left arc */}
        {left && (
          <circle
            ref={leftArcRef}
            cx={CX} cy={CY} r={leftR}
            fill="none"
            strokeWidth={STROKE}
            strokeDasharray={2 * Math.PI * leftR}
            strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{
              stroke: 'var(--lane-left)',
              strokeDashoffset: 2 * Math.PI * leftR,
            }}
          />
        )}

        {/* Dots — hidden initially, positioned by RAF */}
        {right && (
          <>
            <circle ref={rightGlowRef} cx={CX} cy={CY} r={28} style={{ fill: 'var(--lane-right)', display: 'none', opacity: 0 }} />
            <circle ref={rightDotRef}  cx={CX} cy={CY} r={12} style={{ fill: 'var(--lane-right)', display: 'none' }} />
          </>
        )}
        {left && (
          <>
            <circle ref={leftGlowRef} cx={CX} cy={CY} r={28} style={{ fill: 'var(--lane-left)', display: 'none', opacity: 0 }} />
            <circle ref={leftDotRef}  cx={CX} cy={CY} r={12} style={{ fill: 'var(--lane-left)', display: 'none' }} />
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
        <div className="flex-1 flex flex-col items-start gap-2 min-w-0">
          <span ref={rightLeadsRef} className={`${compact ? 'text-2xl' : 'text-5xl'} font-black tracking-widest uppercase`} style={{ color: 'var(--lane-right)', opacity: 0 }}>
            ▲ LEADS +0m
          </span>

          <span className={`${compact ? 'text-2xl' : 'text-5xl'} font-black tracking-widest uppercase truncate`} style={{ color: 'var(--lane-right)' }}>
            {right.riderName}
          </span>

          <span className={`${compact ? 'text-4xl' : 'text-8xl'} font-black tabular-nums text-white leading-none`}>
            <span ref={rightDistRef}>0</span>
            <span className={`${compact ? 'text-xl' : 'text-4xl'} text-stone-500`}> m</span>
          </span>

          <span className={`${compact ? 'text-3xl' : 'text-7xl'} font-bold tabular-nums text-amber-400 leading-none`}>
            <span ref={rightWattsRef}>0</span>
            <span className={`${compact ? 'text-base' : 'text-3xl'} text-stone-400`}> W</span>
          </span>

          <span className={`${compact ? 'text-2xl' : 'text-5xl'} font-bold tabular-nums text-stone-300 leading-none`}>
            <span ref={rightCadenceRef}>0</span>
            <span className={`${compact ? 'text-sm' : 'text-2xl'} text-stone-500`}> rpm</span>
          </span>

          <span ref={rightTimeRef} className={`${compact ? 'text-xl' : 'text-3xl'} font-mono text-stone-500`}>0:00.00</span>

          <span ref={rightFinishedRef} className={`${compact ? 'text-sm' : 'text-xl'} font-bold text-green-400 tracking-widest uppercase`} style={{ visibility: 'hidden' }}>
            ✓ Finished
          </span>
        </div>
      )}
    </div>
  )
}
