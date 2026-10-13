import type { Duties, Ev } from './types'

const CACHE_KEY = 'gas-chillbox-cache-v1'

export interface Cache {
  start: number
  days: number
  events: Ev[]
  duties: Duties
}

export function saveCache(c: Cache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    /* 使えない環境では無視 */
  }
}

export function loadCache(today: number): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Cache
    if (!c?.events) return null
    const end = c.start + c.days * 86400000
    if (end <= today) return null
    return c
  } catch {
    return null
  }
}
