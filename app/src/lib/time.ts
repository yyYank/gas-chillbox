import type { Ev, View } from './types'

export const WD = ['日', '月', '火', '水', '木', '金', '土']

export function sod(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function addDays(ms: number, n: number): number {
  const d = new Date(ms)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

/** today から数えて week 週目（0 が今週）の7日分の日の始まり */
export function weekDays(today: number, week = 0): number[] {
  return Array.from({ length: 7 }, (_, i) => addDays(today, week * 7 + i))
}

/** 読み込んだ日数で描ける週の数（読み込み前でも1週は描く） */
export function weekCount(days: number): number {
  return Math.max(1, Math.floor(days / 7))
}

export function minOf(ms: number, dayStart: number): number {
  return (ms - dayStart) / 60000
}

export function hm(min: number): string {
  const m = Math.round(min)
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

export function md(ms: number): string {
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function nowMin(): number {
  return minOf(Date.now(), sod(Date.now()))
}

export function hours(min: number): string {
  return `${Math.round(min / 30) / 2}h`
}

export type DayType = 'weekday' | 'sat' | 'sun' | 'holiday'

/** 曜日と祝日カレンダーから、その日の種類を決める（祝日が土曜に重なれば祝日） */
export function dayType(ds: number, events: Ev[]): DayType {
  const de = addDays(ds, 1)
  if (events.some((e) => e.kind === 'holiday' && e.start < de && e.end > ds)) {
    return 'holiday'
  }
  const wd = new Date(ds).getDay()
  return wd === 6 ? 'sat' : wd === 0 ? 'sun' : 'weekday'
}

/** 複数日を縦に並べる表示で、page ページ目に並べる日の始まり */
export function pageDays(view: Exclude<View, 'day' | 'month'>, today: number, page: number): number[] {
  if (view === 'week') {
    return weekDays(today, page)
  }
  if (view === 'five') {
    return Array.from({ length: 5 }, (_, i) => addDays(today, page * 5 + i))
  }
  // 平日：今週の月曜から。土日なら来週の月曜から
  const wd = new Date(today).getDay()
  const monday = addDays(today, wd === 6 ? 2 : wd === 0 ? 1 : 1 - wd)
  return Array.from({ length: 5 }, (_, i) => addDays(monday, page * 7 + i))
}

/** 読み込んだ日数の中に最後の日が収まるページの数（読み込み前でも1ページは描く） */
export function pageCount(view: Exclude<View, 'day' | 'month'>, today: number, days: number): number {
  const end = addDays(today, days)
  let n = 0
  while (pageDays(view, today, n)[view === 'week' ? 6 : 4] < end) {
    n++
  }
  return Math.max(1, n)
}
