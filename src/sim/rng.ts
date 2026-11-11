/**
 * Seeded random numbers. Math.random() gives different numbers every load;
 * a seeded generator gives the SAME sequence for the same seed, so generated
 * demo data (energy history, signal strength…) is stable and reproducible.
 * Algorithm: mulberry32 (tiny, fast, good enough for demo data).
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number
  /** Float in [min, max). */
  range(min: number, max: number): number
  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number
  /** True with probability p. */
  chance(p: number): boolean
  pick<T>(items: readonly T[]): T
}

/** Turns any string into a 32-bit seed (FNV-1a hash). */
export function hashString(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('rng.pick called with an empty array')
      return items[Math.floor(next() * items.length)]
    },
  }
}
