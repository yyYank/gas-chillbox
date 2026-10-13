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

/** today から7日分の日の始まり */
export function weekDays(today: number): number[] {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i))
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
