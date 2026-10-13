import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Day } from './components/Day'
import { loadCache, saveCache } from './lib/cache'
import { call } from './lib/gas'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './lib/settings'
import { addDays, md, sod, WD } from './lib/time'
import type { Duties, Ev, InitRes, Settings } from './lib/types'

const FIRST_DAYS = 21
const CHUNK = 14
const EMPTY_DUTIES: Duties = { current: [], next: [] }

export function App() {
  const worldRef = useRef<HTMLElement>(null)
  const [today, setToday] = useState(() => sod(Date.now()))
  const [days, setDays] = useState(0)
  const [events, setEvents] = useState<Ev[]>([])
  const [duties, setDuties] = useState<Duties>(EMPTY_DUTIES)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState('読み込み中…')
  const [toast, setToast] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const loadingMore = useRef(false)

  useEffect(() => setSettings(loadSettings()), [])

  const dayW = useCallback(() => {
    const w = worldRef.current?.clientWidth ?? 1
    return Math.max(1, w * settings.zoom)
  }, [settings.zoom])

  const showToast = useCallback((text: string) => setToast(text), [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(id)
  }, [toast])

  const copy = useCallback(
    (text: string) => {
      const done = () => showToast(`コピー：${text}`)
      if (navigator.clipboard?.writeText)
        navigator.clipboard.writeText(text).then(done, () => showToast(text))
      else showToast(text)
    },
    [showToast],
  )

  // ---------- 読み込み ----------
  const init = useCallback(() => {
    const t = sod(Date.now())
    setToday(t)
    const cached = loadCache(t)
    if (cached) {
      setEvents(cached.events.filter((e) => e.end > t))
      setDays(Math.round((cached.start + cached.days * 86400000 - t) / 86400000))
      setDuties(cached.duties ?? EMPTY_DUTIES)
      setLoading('')
    }
    call<InitRes>('getInit', [t, FIRST_DAYS, Date.now()]).then(
      (res) => {
        setEvents(res.events)
        setDuties(res.duties)
        setDays(FIRST_DAYS)
        setLoading('')
        saveCache({ start: t, days: FIRST_DAYS, events: res.events, duties: res.duties })
      },
      (err) => {
        setLoading(cached ? '' : '読み込めませんでした')
        if (cached) showToast('オフライン表示中')
        console.error(err)
      },
    )
  }, [showToast])

  useEffect(init, [init])

  const loadMore = useCallback(() => {
    if (loadingMore.current) return
    loadingMore.current = true
    const from = addDays(today, days)
    call<Ev[]>('getDays', [from, CHUNK]).then(
      (more) => {
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id))
          const merged = prev.concat(more.filter((e) => !seen.has(e.id)))
          saveCache({ start: today, days: days + CHUNK, events: merged, duties })
          return merged
        })
        setDays((d) => d + CHUNK)
        loadingMore.current = false
      },
      (err) => {
        loadingMore.current = false
        showToast('読み込めませんでした')
        console.error(err)
      },
    )
  }, [today, days, duties, showToast])

  // ---------- 横スクロール ----------
  const onScroll = useCallback(() => {
    const w = worldRef.current
    if (!w) return
    setIndex(Math.round(w.scrollLeft / dayW()))
    if (w.scrollLeft + w.clientWidth * 4 > w.scrollWidth) loadMore()
  }, [dayW, loadMore])

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--zoom', String(settings.zoom))
  }, [settings.zoom])

  // 日付が変わったら読み直す
  useEffect(() => {
    const id = setInterval(() => {
      if (sod(Date.now()) !== today) init()
    }, 60000)
    return () => clearInterval(id)
  }, [today, init])

  const change = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      if (next.to - next.from < 4) {
        showToast('4時間以上にしてください')
        return prev
      }
      saveSettings(next)
      return next
    })
  }

  const d = new Date(addDays(today, index))
  const t = new Date(today)
  const monthsAhead = (d.getFullYear() - t.getFullYear()) * 12 + d.getMonth() - t.getMonth()
  const lastDate = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
  const hourOptions = Array.from({ length: 25 }, (_, i) => i)

  return (
    <>
      <header id="hud">
        <button
          type="button"
          id="hud-date"
          className={`px interactive${index === 0 ? ' today' : ''}`}
          aria-label="今日に戻る"
          onClick={() => worldRef.current?.scrollTo({ left: 0, behavior: 'smooth' })}
        >
          {md(addDays(today, index))} <small>{WD[d.getDay()]}</small>
        </button>

        <div id="band" role="list">
          {monthsAhead === 0 ? (
            <>
              <span className="head px">{`${t.getMonth() + 1}月 ▶`}</span>
              {duties.current.length === 0 && <span className="none">なし</span>}
              {duties.current.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  className="chip interactive"
                  onClick={() => {
                    setDuties((p) => ({ ...p, current: p.current.filter((y) => y.key !== x.key) }))
                    call('markDone', [x.key]).then(
                      () => showToast('済にしました'),
                      () => showToast('保存できませんでした'),
                    )
                  }}
                >
                  {x.title}
                  {x.months > 1 && <b>{`(${x.months}か月目)`}</b>}
                </button>
              ))}
              {lastDate - t.getDate() < 7 && duties.next.length > 0 && (
                <>
                  <span className="sep">｜</span>
                  <span className="head px">{`${((t.getMonth() + 1) % 12) + 1}月 ▶`}</span>
                  {duties.next.map((x) => (
                    <span key={x.key} className="chip next">
                      {x.title}
                    </span>
                  ))}
                </>
              )}
            </>
          ) : monthsAhead === 1 ? (
            <>
              <span className="head px">{`${d.getMonth() + 1}月 ▶`}</span>
              {duties.next.length === 0 && <span className="none">なし</span>}
              {duties.next.map((x) => (
                <span key={x.key} className="chip next">
                  {x.title}
                </span>
              ))}
            </>
          ) : (
            <>
              <span className="head px">{`${d.getMonth() + 1}月`}</span>
              <span className="none">まだ先</span>
            </>
          )}
        </div>

        <div id="gate" className="px">
          {index === 0 ? (
            <>
              {`${((t.getMonth() + 1) % 12) + 1}月の門まで`}
              <span>{`${lastDate - t.getDate()}日`}</span>
            </>
          ) : (
            <>
              今日から<span>{`+${index}日`}</span>
            </>
          )}
        </div>

        <button
          type="button"
          id="hud-set"
          className="px interactive"
          aria-label="設定"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((v) => !v)}
        >
          ⚙
        </button>
      </header>

      {panelOpen && (
        <div id="settings" className="px">
          <div className="row">
            <span>目盛り</span>
            <div className="seg">
              {([1, 2, 3] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={settings.step === v}
                  onClick={() => change({ step: v })}
                >
                  {`${v}h`}
                </button>
              ))}
            </div>
          </div>
          <div className="row">
            <span>時間帯</span>
            <select value={settings.from} onChange={(e) => change({ from: Number(e.target.value) })}>
              {hourOptions.map((v) => (
                <option key={v} value={v}>{`${v}:00`}</option>
              ))}
            </select>
            <span style={{ minWidth: 0 }}>〜</span>
            <select value={settings.to} onChange={(e) => change({ to: Number(e.target.value) })}>
              {hourOptions.map((v) => (
                <option key={v} value={v}>{`${v}:00`}</option>
              ))}
            </select>
          </div>
          <div className="row">
            <span>ズーム</span>
            <div className="seg">
              {[1, 1.5, 2, 3].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={settings.zoom === v}
                  onClick={() => change({ zoom: v })}
                >
                  {`${v}x`}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="close" onClick={() => setPanelOpen(false)}>
            閉じる
          </button>
        </div>
      )}

      <main
        id="world"
        className={settings.zoom > 1 ? 'zoomed' : undefined}
        aria-label="予定"
        ref={worldRef}
        onScroll={onScroll}
      >
        {Array.from({ length: days }, (_, i) => (
          <Day
            key={addDays(today, i)}
            index={i}
            today={today}
            events={events}
            duties={duties}
            settings={settings}
            onToast={showToast}
            onCopy={copy}
          />
        ))}
      </main>

      {loading && (
        <div id="loading" className="px">
          {loading}
        </div>
      )}
      <div id="toast" className={toast ? 'show' : undefined} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  )
}
