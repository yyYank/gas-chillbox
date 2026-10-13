import { addDays } from './time'
import type { Duties, Ev, InitRes } from './types'

// google.script.run は GAS の iframe の中にしか無い。無い時はダミーで動かす。
interface GasRunner {
  withSuccessHandler(fn: (v: unknown) => void): GasRunner
  withFailureHandler(fn: (e: unknown) => void): GasRunner
  [name: string]: unknown
}

declare global {
  interface Window {
    google?: { script?: { run?: GasRunner } }
  }
}

export function call<T>(fn: string, args: unknown[] = []): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = window.google?.script?.run
    if (run) {
      const handler = run.withSuccessHandler(resolve as (v: unknown) => void).withFailureHandler(reject)
      ;(handler[fn] as (...a: unknown[]) => void).apply(null, args)
    } else {
      setTimeout(() => resolve(mock(fn, args) as T), 150)
    }
  })
}

// ---------- GAS の外で開いたとき用のダミーデータ ----------
function mockDays(start: number, days: number): Ev[] {
  const out: Ev[] = []
  const at = (d: number, h: number, m: number, dur: number, title: string, kind: Ev['kind']) => {
    const s = new Date(addDays(start, d))
    s.setHours(h, m, 0, 0)
    out.push({
      id: `m${d}${title}${h}`,
      title,
      start: s.getTime(),
      end: s.getTime() + dur * 60000,
      allDay: false,
      kind,
      tentative: /^\[Slack\]/.test(title),
    })
  }
  for (let d = 0; d < days; d++) {
    const wd = new Date(addDays(start, d)).getDay()
    if (wd >= 1 && wd <= 5) {
      at(d, 9, 30, 30, '朝会', 'work')
      if (d % 2) at(d, 10, 30, 90, '定例MTG', 'work')
      if (d % 3 === 0) at(d, 14, 0, 60, '[Slack] 1on1', 'work')
      if (d % 4 === 1) at(d, 15, 0, 120, '設計レビュー', 'work')
      if (d % 5 === 2) at(d, 19, 0, 150, '飲み会', 'private')
    } else if (d % 7 === 0) {
      at(d, 13, 0, 60, '歯医者', 'private')
    }
  }
  return out
}

function mockDuties(): Duties {
  return {
    current: [
      { title: '健診', key: 'done:健診:x', months: 3 },
      { title: '住民税', key: 'done:住民税:x', months: 1 },
      { title: '次男 予防接種', key: 'done:予防接種:x', months: 1 },
    ],
    next: [
      { title: '年末調整', key: 'n1', months: 1 },
      { title: 'インフル予防接種', key: 'n2', months: 1 },
    ],
  }
}

function mock(fn: string, args: unknown[]): InitRes | Ev[] | boolean {
  if (fn === 'getInit') {
    return { events: mockDays(args[0] as number, args[1] as number), duties: mockDuties() }
  }
  if (fn === 'getDays') return mockDays(args[0] as number, args[1] as number)
  return true
}
