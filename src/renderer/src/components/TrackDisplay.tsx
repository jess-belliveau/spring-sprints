import { useEffect, useReducer, useRef } from 'react'
import type { LiveLaneState } from '@shared/types'

const LEFT_COLOR = '#22d3ee'  // cyan-400
const RIGHT_COLOR = '#f97316' // orange-500
const TRACK_BG = '#1f2937'    // gray-800

const SIZE = 600
const CX = SIZE / 2
const CY = SIZE / 2
const OUTER_R = 224
const INNER_R = 162
const STROKE = 36

// Per-frame blend factor: higher = snappier, lower = smoother
// At 60fps, 0.18 gives ~95% of target in ~1.5s; telemetry arrives at 4Hz
const ALPHA = 0.18

interface Props {
  left: LiveLaneState | null
  right: LiveLaneState | null
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
  // Target distances from props (written each render, read in RAF loop)
  const leftTargetRef = useRef(0)
  const rightTargetRef = useRef(0)

  // Smoothed display positions
  const leftPosRef = useRef(0)
  const rightPosRef = useRef(0)

  const rafRef = useRef<number>(0)
  const [, redraw] = useReducer((n: number) => n + 1, 0)

  // Update targets from props each render
  const newLeftTarget = left?.distanceCovered ?? 0
  const newRightTarget = right?.distanceCovered ?? 0

  // Snap to 0 when a new race starts (target dropped significantly below current pos)
  if (newLeftTarget < leftPosRef.current - 1) leftPosRef.current = 0
  if (newRightTarget < rightPosRef.current - 1) rightPosRef.current = 0

  leftTargetRef.current = newLeftTarget
  rightTargetRef.current = newRightTarget

  useEffect(() => {
    function frame() {
      const lt = leftTargetRef.current
      const rt = rightTargetRef.current

      leftPosRef.current += (lt - leftPosRef.current) * ALPHA
      rightPosRef.current += (rt - rightPosRef.current) * ALPHA

      // Snap to target when close enough to avoid endless tiny updates
      if (Math.abs(lt - leftPosRef.current) < 0.01) leftPosRef.current = lt
      if (Math.abs(rt - rightPosRef.current) < 0.01) rightPosRef.current = rt

      redraw()
      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const hasBoth = left !== null && right !== null
  const soloR = 194

  const leftR = hasBoth ? INNER_R : soloR
  const rightR = OUTER_R

  const leftPct = leftPosRef.current / targetDistance
  const rightPct = rightPosRef.current / targetDistance

  const leftDot = dotXY(leftPct, leftR)
  const rightDot = dotXY(rightPct, rightR)

  const leftDist = left?.distanceCovered ?? 0
  const rightDist = right?.distanceCovered ?? 0
  const gap = Math.round(Math.abs(leftDist - rightDist))
  const leftLeads = hasBoth && leftDist > rightDist + 0.5
  const rightLeads = hasBoth && rightDist > leftDist + 0.5
  const leftDim = hasBoth && rightLeads
  const rightDim = hasBoth && leftLeads

  return (
    <div className="flex items-center w-full h-full gap-4 px-8">

      {/* ── Left rider stats ── */}
      {left && (
        <div className="flex-1 flex flex-col items-end gap-3 min-w-0">
          <span
            className="text-3xl font-black tracking-widest uppercase truncate"
            style={{ color: LEFT_COLOR }}
          >
            {left.riderName}
          </span>

          {leftLeads && (
            <span className="text-sm font-bold tracking-widest" style={{ color: LEFT_COLOR }}>
              ▲ LEADS +{gap}m
            </span>
          )}

          <span className="text-8xl font-black tabular-nums text-white leading-none text-right">
            {Math.round(leftDist)}
            <span className="text-3xl text-gray-500"> m</span>
          </span>

          <span className="text-5xl font-bold tabular-nums text-yellow-400 leading-none">
            {left.instantWatts}
            <span className="text-2xl text-gray-400"> W</span>
          </span>

          <span className="text-3xl font-bold tabular-nums text-gray-300 leading-none">
            {left.cadenceRpm}
            <span className="text-lg text-gray-500"> rpm</span>
          </span>

          <span className="text-2xl font-mono text-gray-500">{fmt(left.elapsedMs)}</span>

          {left.finished && (
            <span className="text-lg font-bold text-green-400 tracking-widest uppercase">
              ✓ Finished
            </span>
          )}
        </div>
      )}

      {/* ── Circular track ── */}
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="flex-shrink-0"
      >
        {/* Track backgrounds */}
        {hasBoth && (
          <circle cx={CX} cy={CY} r={OUTER_R} fill="none" stroke={TRACK_BG} strokeWidth={STROKE} />
        )}
        <circle cx={CX} cy={CY} r={leftR} fill="none" stroke={TRACK_BG} strokeWidth={STROKE} />

        {/* Right progress arc (outer) */}
        {right && (
          <circle
            cx={CX} cy={CY} r={OUTER_R}
            fill="none"
            stroke={RIGHT_COLOR}
            strokeWidth={STROKE}
            strokeDasharray={2 * Math.PI * OUTER_R}
            strokeDashoffset={arcOffset(OUTER_R, rightPct)}
            strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CY})`}
            opacity={rightDim ? 0.4 : 1}
          />
        )}

        {/* Left progress arc (inner or solo) */}
        {left && (
          <circle
            cx={CX} cy={CY} r={leftR}
            fill="none"
            stroke={LEFT_COLOR}
            strokeWidth={STROKE}
            strokeDasharray={2 * Math.PI * leftR}
            strokeDashoffset={arcOffset(leftR, leftPct)}
            strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CY})`}
            opacity={leftDim ? 0.4 : 1}
          />
        )}

        {/* Right dot */}
        {right && rightPct > 0.001 && (
          <>
            {rightLeads && (
              <circle cx={rightDot[0]} cy={rightDot[1]} r={28} fill={RIGHT_COLOR} opacity={0.25} />
            )}
            <circle cx={rightDot[0]} cy={rightDot[1]} r={rightLeads ? 17 : 12} fill={RIGHT_COLOR} />
          </>
        )}

        {/* Left dot */}
        {left && leftPct > 0.001 && (
          <>
            {leftLeads && (
              <circle cx={leftDot[0]} cy={leftDot[1]} r={28} fill={LEFT_COLOR} opacity={0.25} />
            )}
            <circle cx={leftDot[0]} cy={leftDot[1]} r={leftLeads ? 17 : 12} fill={LEFT_COLOR} />
          </>
        )}

        {/* Solo: distance in centre */}
        {!hasBoth && left && (
          <>
            <text
              x={CX} y={CY - 16}
              textAnchor="middle"
              fill="white"
              fontSize="64"
              fontWeight="900"
              fontFamily="ui-monospace, monospace"
            >
              {Math.round(leftDist)}m
            </text>
            <text
              x={CX} y={CY + 28}
              textAnchor="middle"
              fill="#4b5563"
              fontSize="22"
            >
              of {targetDistance}m
            </text>
          </>
        )}

        {/* H2H: subtle target distance in centre */}
        {hasBoth && (
          <text
            x={CX} y={CY + 14}
            textAnchor="middle"
            fill="#374151"
            fontSize="30"
            fontWeight="bold"
          >
            {targetDistance}m
          </text>
        )}
      </svg>

      {/* ── Right rider stats ── */}
      {right && (
        <div className="flex-1 flex flex-col items-start gap-3 min-w-0">
          <span
            className="text-3xl font-black tracking-widest uppercase truncate"
            style={{ color: RIGHT_COLOR }}
          >
            {right.riderName}
          </span>

          {rightLeads && (
            <span className="text-sm font-bold tracking-widest" style={{ color: RIGHT_COLOR }}>
              ▲ LEADS +{gap}m
            </span>
          )}

          <span className="text-8xl font-black tabular-nums text-white leading-none">
            {Math.round(rightDist)}
            <span className="text-3xl text-gray-500"> m</span>
          </span>

          <span className="text-5xl font-bold tabular-nums text-yellow-400 leading-none">
            {right.instantWatts}
            <span className="text-2xl text-gray-400"> W</span>
          </span>

          <span className="text-3xl font-bold tabular-nums text-gray-300 leading-none">
            {right.cadenceRpm}
            <span className="text-lg text-gray-500"> rpm</span>
          </span>

          <span className="text-2xl font-mono text-gray-500">{fmt(right.elapsedMs)}</span>

          {right.finished && (
            <span className="text-lg font-bold text-green-400 tracking-widest uppercase">
              ✓ Finished
            </span>
          )}
        </div>
      )}
    </div>
  )
}
