import type { Settings } from './types'

const SET_KEY = 'gas-chillbox-settings-v1'

export const DEFAULT_SETTINGS: Settings = { step: 1, from: 6, to: 24, zoom: 1 }

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SET_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const s = JSON.parse(raw) as Partial<Settings>
    const next = { ...DEFAULT_SETTINGS }
    if (s.step === 1 || s.step === 2 || s.step === 3) next.step = s.step
    if (s.zoom && [1, 1.5, 2, 3].includes(s.zoom)) next.zoom = s.zoom
    if (
      typeof s.from === 'number' &&
      typeof s.to === 'number' &&
      s.from >= 0 &&
      s.to <= 24 &&
      s.to - s.from >= 4
    ) {
      next.from = s.from
      next.to = s.to
    }
    return next
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SET_KEY, JSON.stringify(s))
  } catch {
    /* 使えない環境では無視 */
  }
}
