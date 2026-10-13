import { useState } from 'react'
import { matchRules, splitByToday } from '../lib/month'
import { dayType, hm, md, minOf, sod, WD } from '../lib/time'
import type { Ev } from '../lib/types'

interface Props {
  /** その月の1日の始まり */
  start: number
  /** その月の予定。まだ読み込んでいなければ undefined */
  events: Ev[] | undefined
  rules: string[]
  onToast: (text: string) => void
}

/** 月表示の1ページ：ルールに合う予定だけを日付順に並べる */
export function Month({ start, events, rules, onToast }: Props) {
  const m = new Date(start)
  const now = Date.now()
  const hits = (events ?? [])
    .filter((e) => e.kind !== 'holiday' && matchRules(e.title, rules))
    .sort((a, b) => a.start - b.start)

  // 日ごとにまとめる
  const byDay = new Map<number, Ev[]>()
  for (const e of hits) {
    const ds = sod(e.start)
    byDay.set(ds, [...(byDay.get(ds) ?? []), e])
  }

  const [pastOpen, setPastOpen] = useState(false)
  const today = sod(now)
  const { past, upcoming } = splitByToday([...byDay.keys()], today)
  const pastCount = past.reduce((n, ds) => n + (byDay.get(ds)?.length ?? 0), 0)
  // 今日の赤線は、今日を含む月のページにだけ出す
  const next = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime()
  const showToday = start <= today && today < next

  const row = (ds: number) => {
    const evs = byDay.get(ds) ?? []
    const type = dayType(ds, events ?? [])
    return (
      <li key={ds} className={evs.every((e) => e.end <= now) ? 'past' : undefined}>
        <span className={`month-date px ${type}`}>
          {md(ds)} <small>{WD[new Date(ds).getDay()]}</small>
        </span>
        <span className="month-evs">
          {evs.map((e) => {
            const time = e.allDay ? '終日' : `${hm(minOf(e.start, ds))}–${hm(minOf(e.end, ds))}`
            return (
              <button
                key={e.id}
                type="button"
                className={`month-ev interactive ${e.kind}`}
                onClick={() => onToast(`${md(ds)} ${time} ${e.title}`)}
              >
                <span className="time">{time}</span>
                {e.title}
              </button>
            )
          })}
        </span>
      </li>
    )
  }

  return (
    <div className="week-page month-page">
      <h2 className="month-title px">
        {`${m.getFullYear()}年${m.getMonth() + 1}月`}
        {events && <small>{`${hits.length}件`}</small>}
      </h2>
      {!events ? (
        <p className="month-empty">読み込み中…</p>
      ) : rules.length === 0 ? (
        <p className="month-empty">ルールを追加してください</p>
      ) : hits.length === 0 ? (
        <p className="month-empty">ルールに合う予定はありません</p>
      ) : (
        <ul className="month-list">
          {past.length > 0 && (
            <li className="past-toggle">
              <button
                type="button"
                className="interactive"
                aria-expanded={pastOpen}
                onClick={() => setPastOpen((v) => !v)}
              >
                {`過去 ${pastCount}件 ${pastOpen ? '▾' : '▸'}`}
              </button>
            </li>
          )}
          {pastOpen && past.map(row)}
          {showToday && (
            <li className="today-line" aria-label="今日">
              <span className="px">{`今日 ${md(today)}`}</span>
            </li>
          )}
          {upcoming.map(row)}
        </ul>
      )}
    </div>
  )
}
