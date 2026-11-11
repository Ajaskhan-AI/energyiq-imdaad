import { STATE_VERSION, type AppState } from './state'

/** localStorage key. localStorage = small key/value storage in the browser that survives refreshes. */
export const STORAGE_KEY = 'kuroshio-energyiq-imdaad'

/** Returns the saved state, or null if there is none / it is from an older version / it is broken. */
export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AppState>
    if (parsed.version !== STATE_VERSION) return null
    return parsed as AppState
  } catch {
    return null
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    // Private mode or storage full: the demo still works, it just won't survive a refresh.
    console.warn('Could not save demo data to localStorage', error)
  }
}

/** Size of the saved data in KB (shown on the debug panel). */
export function savedSizeKb(): number {
  try {
    return Math.round(((localStorage.getItem(STORAGE_KEY)?.length ?? 0) * 2) / 1024)
  } catch {
    return 0
  }
}
