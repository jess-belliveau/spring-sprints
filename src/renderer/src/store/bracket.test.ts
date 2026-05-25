import { describe, it, expect } from 'vitest'
import { buildBracket } from './event.store'
import type { Rider } from '@shared/types'

function makeRiders(n: number): Rider[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `rider-${i + 1}`,
    name: `Rider ${i + 1}`,
    seed: i + 1
  }))
}

// bracketPositions(8) = [1, 8, 4, 5, 2, 7, 3, 6]
// Match 0: seed1 vs seed8
// Match 1: seed4 vs seed5
// Match 2: seed2 vs seed7
// Match 3: seed3 vs seed6

describe('buildBracket', () => {
  it('seeds 8 riders into correct matchups (1v8, 4v5, 2v7, 3v6)', () => {
    const riders = makeRiders(8)
    const rounds = buildBracket(riders)
    const qf = rounds[0].matches

    expect(qf[0].topRiderId).toBe('rider-1')
    expect(qf[0].bottomRiderId).toBe('rider-8')
    expect(qf[1].topRiderId).toBe('rider-4')
    expect(qf[1].bottomRiderId).toBe('rider-5')
    expect(qf[2].topRiderId).toBe('rider-2')
    expect(qf[2].bottomRiderId).toBe('rider-7')
    expect(qf[3].topRiderId).toBe('rider-3')
    expect(qf[3].bottomRiderId).toBe('rider-6')
  })

  it('creates 3 rounds for 8 riders with a 3rd place match in the final round', () => {
    const rounds = buildBracket(makeRiders(8))
    expect(rounds).toHaveLength(3)
    expect(rounds[0].matches).toHaveLength(4)
    expect(rounds[1].matches).toHaveLength(2)
    expect(rounds[2].matches).toHaveLength(2)
    expect(rounds[2].matches[0].isThirdPlace).toBeFalsy()
    expect(rounds[2].matches[1].isThirdPlace).toBe(true)
  })

  it('handles 4 riders — byes at seeds 5-8, auto-advance real riders', () => {
    const riders = makeRiders(4)
    const rounds = buildBracket(riders)
    const qf = rounds[0].matches

    // QF[0]: seed1 vs seed8(bye) → rider-1 advances
    expect(qf[0].topRiderId).toBe('rider-1')
    expect(qf[0].bottomRiderId).toBeNull()
    expect(qf[0].winnerId).toBe('rider-1')

    // QF[1]: seed4 vs seed5(bye) → rider-4 advances
    expect(qf[1].topRiderId).toBe('rider-4')
    expect(qf[1].bottomRiderId).toBeNull()
    expect(qf[1].winnerId).toBe('rider-4')

    // QF[2]: seed2 vs seed7(bye) → rider-2 advances
    expect(qf[2].topRiderId).toBe('rider-2')
    expect(qf[2].bottomRiderId).toBeNull()
    expect(qf[2].winnerId).toBe('rider-2')

    // QF[3]: seed3 vs seed6(bye) → rider-3 advances
    expect(qf[3].topRiderId).toBe('rider-3')
    expect(qf[3].bottomRiderId).toBeNull()
    expect(qf[3].winnerId).toBe('rider-3')
  })

  it('auto-advances byes into round 1 correctly', () => {
    const riders = makeRiders(4)
    const rounds = buildBracket(riders)
    const sf = rounds[1].matches

    // SF[0]: winner QF[0](top) vs winner QF[1](bottom)
    expect(sf[0].topRiderId).toBe('rider-1')
    expect(sf[0].bottomRiderId).toBe('rider-4')

    // SF[1]: winner QF[2](top) vs winner QF[3](bottom)
    expect(sf[1].topRiderId).toBe('rider-2')
    expect(sf[1].bottomRiderId).toBe('rider-3')
  })

  it('handles 2 riders — rider-2 is in QF[2] (seed2 slot), not QF[3]', () => {
    const riders = makeRiders(2)
    const rounds = buildBracket(riders)
    const qf = rounds[0].matches

    // QF[0]: seed1(rider-1) vs seed8(bye)
    expect(qf[0].topRiderId).toBe('rider-1')
    expect(qf[0].bottomRiderId).toBeNull()
    expect(qf[0].winnerId).toBe('rider-1')

    // QF[1]: seed4(bye) vs seed5(bye) — no real riders
    expect(qf[1].topRiderId).toBeNull()
    expect(qf[1].bottomRiderId).toBeNull()
    expect(qf[1].winnerId).toBeNull()

    // QF[2]: seed2(rider-2) vs seed7(bye)
    expect(qf[2].topRiderId).toBe('rider-2')
    expect(qf[2].bottomRiderId).toBeNull()
    expect(qf[2].winnerId).toBe('rider-2')

    // QF[3]: seed3(bye) vs seed6(bye) — no real riders
    expect(qf[3].topRiderId).toBeNull()
    expect(qf[3].bottomRiderId).toBeNull()
  })
})
