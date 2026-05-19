import { useCallback, useEffect, useRef } from 'react'

export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext()
    }
    return ctxRef.current
  }, [])

  const beep = useCallback(
    (freq: number, durationMs: number, gainValue = 0.4) => {
      const ctx = getCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(gainValue, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + durationMs / 1000)
    },
    [getCtx]
  )

  const playCountdownBeep = useCallback(
    (value: number) => {
      if (value > 0) {
        beep(880, 180)
      } else {
        // GO — two quick high beeps
        beep(1320, 120)
        setTimeout(() => beep(1320, 120), 140)
      }
    },
    [beep]
  )

  const playFinishFanfare = useCallback(() => {
    getCtx()
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      setTimeout(() => beep(freq, 250), i * 120)
    })
    // Final sustained chord
    setTimeout(() => {
      ;[523, 659, 784].forEach((freq) => beep(freq, 600))
    }, notes.length * 120)
  }, [beep, getCtx])

  useEffect(() => {
    return () => { ctxRef.current?.close() }
  }, [])

  return { beep, playCountdownBeep, playFinishFanfare }
}
