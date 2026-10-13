import { useLayoutEffect, useRef } from 'react'
import { addDays, dayType, hm, hours, md, minOf, nowMin, WD } from '../lib/time'
import type { Duties, Ev, Settings } from '../lib/types'

const MIN_GAP = 60 // これ未満の空きは表示しない（分）
const FLAG_BASE = 44
const FLAG_GAP = 6
const FLAG_BASE_COMPACT = 2
const FLAG_GAP_COMPACT = 2

interface Props {
  index: number
  today: number
  events: Ev[]
  duties: Duties
  settings: Settings
  onToast: (text: string) => void
  onCopy: (text: string) => void
  /** 1週間表示の1行として描く（旗を積まず、行の頭に日付を出す） */
  compact?: boolean
}

interface Slot {
  e: Ev
  a: number
  b: number
}

export function Day({ index, today, events, duties, settings, onToast, onCopy, compact }: Props) {
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
    // 1週間表示は行が低いので積まずに横へずらす。右端からはみ出す分は左へ押し戻す
    if (compact) {
      const ls: number[] = []
      let edge = 0
      // 行の頭（日付と終日予定）にかぶるほど背が高い札は、横に広げて行数を減らす
      const head = track.querySelector<HTMLElement>('.allday')
      const top = head ? head.offsetTop + head.offsetHeight + FLAG_GAP_COMPACT : 0
      flags.forEach((f) => {
        // 左端に置いて測る（右端に近いと幅が広がらないため）。広がらなくなったら打ち切る
        f.style.left = '0px'
        f.style.bottom = `calc(var(--ground) + ${FLAG_BASE_COMPACT}px)`
        f.style.maxWidth = ''
        f.style.width = ''
        for (let w = f.offsetWidth; f.offsetTop < top && w < track.clientWidth; ) {
          f.style.maxWidth = `${Math.min(track.clientWidth, w + 40)}px`
          if (f.offsetWidth <= w) break
          w = f.offsetWidth
        }
        // 右端寄りに置くと使える幅が減って札が縮むので、測った幅で固定してから戻す
        f.style.width = `${f.offsetWidth}px`
        f.style.left = `${f.dataset.l}%`
        ls.push(Math.max(f.offsetLeft, edge))
        edge = ls[ls.length - 1] + f.offsetWidth + FLAG_GAP_COMPACT
      })
      let limit = track.clientWidth
      for (let i = flags.length - 1; i >= 0; i--) {
        ls[i] = Math.max(0, Math.min(ls[i], limit - flags[i].offsetWidth))
        limit = ls[i] - FLAG_GAP_COMPACT
      }
      flags.forEach((f, i) => {
        f.style.left = `${ls[i]}px`
      })
      return
    }
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

  const type = dayType(ds, events)
  const nextType = dayType(de, events)
  const holiday = nextType === 'holiday'
  const todayMonth = new Date(today).getMonth()
  const ticks: number[] = []
  for (let t = h0; t < h1; t += settings.step) ticks.push(t)

  return (
    <section className={`day ${type}${isGate ? ' gate-day' : ''}${compact ? ' compact' : ''}`} data-i={index}>
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

        {(compact || allDay.length > 0) && (
          <div className="allday">
            {compact && (
              <span className={`rowdate px ${type}${isToday ? ' today' : ''}`}>
                {md(ds)} <small>{WD[new Date(ds).getDay()]}</small>
              </span>
            )}
            {allDay.map((e) => (
              <span key={e.id} className={e.kind === 'holiday' ? 'holiday' : undefined}>
                {e.title}
              </span>
            ))}
          </div>
        )}

        {!compact &&
          gaps.map((g) => {
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
                data-l={pct(x.a)}
                style={
                  compact
                    ? { left: `${pct(x.a)}%` }
                    : { left: `${pct(x.a)}%`, width: `${pct(x.b) - pct(x.a)}%` }
                }
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
          <div className={`wl px ${nextType}`}>
            {`${md(de)} ${WD[nextDay.getDay()]}${holiday ? '・祝' : ''}`}
          </div>
        )}
      </div>
    </section>
  )
}
