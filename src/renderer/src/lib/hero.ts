import { HERO_THRESHOLDS_M, HERO_THRESHOLDS_F } from '@shared/constants'

export type HeroThresholds = readonly [number, number]

// Per-lane thresholds passed into the race displays; null = hero mode off
export interface HeroLaneThresholds {
  left: HeroThresholds
  right: HeroThresholds
  // Event-wide highest recorded max watts — beating it triggers the record
  // effect (tier 3). 0 = nothing recorded yet, so the tier can't trigger.
  recordWatts: number
}

export function heroThresholdsFor(gender?: 'M' | 'F'): HeroThresholds {
  return gender === 'F' ? HERO_THRESHOLDS_F : HERO_THRESHOLDS_M
}

export function heroTier(
  watts: number,
  thresholds: HeroThresholds,
  recordWatts = 0
): 0 | 1 | 2 | 3 {
  if (recordWatts > 0 && watts > recordWatts) return 3
  if (watts >= thresholds[1]) return 2
  if (watts >= thresholds[0]) return 1
  return 0
}

// Imperatively toggle fire classes on a live watts element — the race displays
// update these spans outside React, so classes must be managed the same way.
export function applyHeroFire(
  el: HTMLElement | null,
  watts: number,
  thresholds: HeroThresholds | null,
  recordWatts = 0
): void {
  if (!el) return
  const tier = thresholds ? heroTier(watts, thresholds, recordWatts) : 0
  el.classList.toggle('hero-fire-1', tier === 1)
  el.classList.toggle('hero-fire-2', tier === 2)
  el.classList.toggle('hero-fire-3', tier === 3)
}
