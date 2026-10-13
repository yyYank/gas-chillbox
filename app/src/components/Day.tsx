import { useLayoutEffect, useRef } from 'react'
import { addDays, hm, hours, md, minOf, nowMin, WD } from '../lib/time'
import type { Duties, Ev, Settings } from '../lib/types'

const MIN_GAP = 60 // これ未満の空きは表示しない（分）
const FLAG_BASE = 44
const FLAG_GAP = 6

interface Props {
  index: number
  today: number
  events: Ev[]
  duties: Duties
  settings: Settings
  onToast: (text: string) => void
  onCopy: (text: string) => void
}

interface Slot {
  e: Ev
  a: number
  b: number
}

export function Day({ index, today, events, duties, settings, onToast, onCopy }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const h0 = settings.from
  const h1 = settings.to
  const span = (h1 - h0) * 60
  const pct = (min: number) => Math.max(0, Math.min(100, ((min - h0 * 60) / span) * 100))

  const ds = addDays(today, index)
  const de = addDays(ds, 1)
  const nextDay = new Date(de)
  const isGate = nextDay.getDate() === 1
  const isToday = index === 0

  const evs = events.filter((e) => e.start < de && e.end > ds)
  const allDay = evs.filter((e) => e.allDay)
  const timed: Slot[] = evs
    .filter((e) => !e.allDay && e.kind !== 'holiday')
    .map((e) => ({ e, a: Math.max(h0 * 60, minOf(e.start, ds)), b: Math.min(h1 * 60, minOf(e.end, ds)) }))
    .filter((x) => x.b > x.a)
    .sort((x, y) => x.a - y.a || y.b - x.b)

  // 旗は描画してからでないと高さが分からない。測って、重ならない位置まで積み上げる
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const bars = track.querySelectorAll<HTMLElement>('.blk')
    const flags = track.querySelectorAll<HTMLElement>('.flag')
    const placed: { l: number; r: number; top: number }[] = []
    flags.forEach((f, i) => {
      const l = f.offsetLeft
      const r = l + f.offsetWidth
      let y = FLAG_BASE
      for (const q of placed) if (l < q.r && r > q.l) y = Math.max(y, q.top + FLAG_GAP)
      f.style.bottom = `calc(var(--ground) + ${y}px)`
      const b = bars[i]
      if (b) b.style.height = `${y + 8}px`
      placed.push({ l, r, top: y + f.offsetHeight })
    })
  })

  // 空き（地面そのもの）
  const gaps: [number, number][] = []
  let cursor = h0 * 60
  if (isToday) cursor = Math.max(cursor, Math.ceil(nowMin() / 15) * 15)
  for (const r of [
    ...timed.map((x): [number, number] => [x.a, x.b]),
    [h1 * 60, h1 * 60] as [number, number],
  ]) {
    if (r[0] - cursor >= MIN_GAP) gaps.push([cursor, r[0]])
    cursor = Math.max(cursor, r[1])
  }
  const dayLabel = `${md(ds)}(${WD[new Date(ds).getDay()]})`

  const holiday = events.some((e) => e.kind === 'holiday' && e.start < addDays(de, 1) && e.end > de)
  const todayMonth = new Date(today).getMonth()
  const ticks: number[] = []
  for (let t = h0; t < h1; t += settings.step) ticks.push(t)

  return (
    <section className={`day${isGate ? ' gate-day' : ''}`} data-i={index}>
      <div className="track" ref={trackRef}>
        <div className="sky" style={{ left: 0, width: '33.34%', background: 'rgb(var(--bg))' }} />
        <div className="sky" style={{ left: '33.33%', width: '33.34%', background: 'rgb(var(--surface))' }} />
        <div
          className="sky"
          style={{ left: '66.66%', width: '33.34%', background: 'rgb(var(--surface-2))' }}
        />
        <div className="strip" />
        <div className="soil" />
        {ticks.map((t) => (
          <div key={t}>
            <div className={`tick${t % 3 === 0 ? ' major' : ''}`} style={{ left: `${pct(t * 60)}%` }} />
            <div className={`tl${t === h0 ? ' first' : ''}`} style={{ left: `${pct(t * 60)}%` }}>
              {t}
            </div>
          </div>
        ))}

        {allDay.length > 0 && (
          <div className="allday">
            {allDay.map((e) => (
              <span key={e.id} className={e.kind === 'holiday' ? 'holiday' : undefined}>
                {e.title}
              </span>
            ))}
          </div>
        )}

        {gaps.map((g) => {
          const left = pct(g[0])
          const width = pct(g[1]) - left
          const text =
            g[1] >= h1 * 60
              ? `${dayLabel} ${hm(g[0])}以降 空いてます`
              : `${dayLabel} ${hm(g[0])}〜${hm(g[1])} 空いてます`
          return (
            <button
              key={`${g[0]}-${g[1]}`}
              type="button"
              className="free interactive"
              style={{ left: `${left + 0.6}%`, width: `${Math.max(0, width - 1.2)}%` }}
              aria-label={text}
              onClick={() => onCopy(text)}
            >
              {width < 8 ? '空' : `空き ${hours(g[1] - g[0])}`}
            </button>
          )
        })}

        {/* L1 柱＝予定の時間 */}
        {timed.map((x) => (
          <button
            key={x.e.id}
            type="button"
            className={`blk px interactive ${x.e.kind}${x.e.tentative ? ' tent' : ''}`}
            style={{ left: `${pct(x.a)}%`, width: `${pct(x.b) - pct(x.a)}%` }}
            aria-label={`${hm(x.a)}–${hm(x.b)} ${x.e.title}`}
            onClick={() => onToast(`${hm(x.a)}–${hm(x.b)} ${x.e.title}`)}
          />
        ))}

        {/* L3 旗＝予定名 */}
        {timed.length > 0 && (
          <div className="flags">
            {timed.map((x) => (
              <span
                key={x.e.id}
                className="flag px"
                style={{ left: `${pct(x.a)}%`, width: `${pct(x.b) - pct(x.a)}%` }}
              >
                <span className="t">{x.e.title.replace(/^\[Slack\]\s*/, '')}</span>
                <small>{`${hm(x.a)}–${hm(x.b)}${x.e.tentative ? ' 仮' : ''}`}</small>
              </span>
            ))}
          </div>
        )}

        {isGate && new Date(ds).getMonth() === todayMonth && duties.current.length > 0 && (
          <div className="signs">
            {duties.current.slice(0, 3).map((d) => (
              <div key={d.key} className="sign">
                <div className="board">
                  {d.title}
                  {d.months > 1 && <b>{` (${d.months}か月目)`}</b>}
                  <small>{`門を越えると (${d.months + 1}か月目)`}</small>
                </div>
                <div className="post" />
              </div>
            ))}
          </div>
        )}

        {isToday && (
          <div className="now" style={{ left: `${pct(nowMin())}%` }}>
            <span className="px">{`いま ${hm(nowMin())}`}</span>
          </div>
        )}
      </div>

      <div className="wall">
        {isGate ? (
          <>
            <div className="month px">{`${nextDay.getMonth() + 1}月`}</div>
            {nextDay.getMonth() === (todayMonth + 1) % 12 && duties.next.length > 0 && (
              <div className="nextband">{`来月　${duties.next.map((d) => d.title).join('・')}`}</div>
            )}
          </>
        ) : (
          <div className={`wl px${holiday || nextDay.getDay() === 0 ? ' hol' : ''}`}>
            {`${md(de)} ${WD[nextDay.getDay()]}${holiday ? '・祝' : ''}`}
          </div>
        )}
      </div>
    </section>
  )
}
