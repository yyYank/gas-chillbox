import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Day } from './components/Day'
import { MailAwaiting, type ThreadsRes } from './components/MailAwaiting'
import { MailSenders } from './components/MailSenders'
import { MailServices } from './components/MailServices'
import { MailSignups } from './components/MailSignups'
import { Month } from './components/Month'
import { RulesBar } from './components/RulesBar'
import { loadCache, saveCache } from './lib/cache'
import { call } from './lib/gas'
import type { Mail } from './lib/mail'
import { monthRange } from './lib/month'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, stepFontScale } from './lib/settings'
import { DEFAULT_SIGNUP_RULES, signupQuery } from './lib/signup'
import { addDays, pageCount, pageDays, sod } from './lib/time'
import type { Ev, InitRes, MailView, Settings } from './lib/types'

const FIRST_DAYS = 21
const CHUNK = 14

export function App() {
  const worldRef = useRef<HTMLElement>(null)
  const [today, setToday] = useState(() => sod(Date.now()))
  const [days, setDays] = useState(0)
  const [events, setEvents] = useState<Ev[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState('読み込み中…')
  const [toast, setToast] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const loadingMore = useRef(false)
  // 月表示：ルールは GAS 側に保存。月ごとの予定は1日から末日まで別に読む
  const [rules, setRules] = useState<string[] | null>(null)
  const [monthEvents, setMonthEvents] = useState<Record<number, Ev[]>>({})
  const [monthPages, setMonthPages] = useState(3)
  const monthLoading = useRef(new Set<number>())
  // メール：タブを開いたときに一度だけ読む
  const [mails, setMails] = useState<Partial<Record<MailView, Mail[]>>>({})
  const [threads, setThreads] = useState<ThreadsRes | undefined>(undefined)
  const [signupRules, setSignupRules] = useState<string[] | null>(null)
  const [signupMails, setSignupMails] = useState<Mail[] | undefined>(undefined)
  const signupReq = useRef(0)
  const [mailError, setMailError] = useState<Partial<Record<MailView, string>>>({})
  const mailRequested = useRef(new Set<MailView>())

  useEffect(() => setSettings(loadSettings()), [])

  const showToast = useCallback((text: string) => setToast(text), [])
  useEffect(() => {
    if (!toast) {
      return
    }
    const id = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(id)
  }, [toast])

  const copy = useCallback(
    (text: string) => {
      const done = () => showToast(`コピー：${text}`)
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done, () => showToast(text))
      } else {
        showToast(text)
      }
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
      setLoading('')
    }
    call<InitRes>('getInit', [t, FIRST_DAYS]).then(
      (res) => {
        setEvents(res.events)
        setDays(FIRST_DAYS)
        setLoading('')
        saveCache({ start: t, days: FIRST_DAYS, events: res.events })
      },
      (err) => {
        setLoading(cached ? '' : '読み込めませんでした')
        if (cached) {
          showToast('オフライン表示中')
        }
        console.error(err)
      },
    )
  }, [showToast])

  useEffect(init, [init])

  const loadMore = useCallback(() => {
    if (loadingMore.current) {
      return
    }
    loadingMore.current = true
    const from = addDays(today, days)
    call<Ev[]>('getDays', [from, CHUNK]).then(
      (more) => {
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id))
          const merged = prev.concat(more.filter((e) => !seen.has(e.id)))
          saveCache({ start: today, days: days + CHUNK, events: merged })
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
  }, [today, days, showToast])

  // ---------- 横スクロール ----------
  const onScroll = useCallback(() => {
    const w = worldRef.current
    if (!w) {
      return
    }
    const view = settings.view
    if (view === 'month') {
      if (w.scrollLeft + w.clientWidth * 2 > w.scrollWidth) {
        setMonthPages((n) => n + 1)
      }
      return
    }
    if (w.scrollLeft + w.clientWidth * 4 > w.scrollWidth) {
      loadMore()
    }
  }, [loadMore, settings.view])

  // 月表示に入ったらルールと、見えている月とその先の予定を読む
  useEffect(() => {
    if (settings.view !== 'month') {
      return
    }
    if (rules === null) {
      call<string[] | null>('getRules', ['month']).then(
        (r) => setRules(r ?? []),
        (err) => {
          setRules([])
          showToast('ルールを読み込めませんでした')
          console.error(err)
        },
      )
    }
    for (let p = 0; p < monthPages; p++) {
      const { start, days: n } = monthRange(today, p)
      if (monthEvents[start] || monthLoading.current.has(start)) {
        continue
      }
      monthLoading.current.add(start)
      call<Ev[]>('getDays', [start, n]).then(
        (evs) => setMonthEvents((prev) => ({ ...prev, [start]: evs })),
        (err) => {
          monthLoading.current.delete(start)
          showToast('読み込めませんでした')
          console.error(err)
        },
      )
    }
  }, [settings.view, rules, monthPages, monthEvents, today, showToast])

  // メールは表示ごとに、開いたときに一度だけ読む
  useEffect(() => {
    const mv = settings.mailView
    if (settings.source !== 'mail' || mv === 'signups' || mailRequested.current.has(mv)) {
      return
    }
    mailRequested.current.add(mv)
    const fail = (err: unknown) => {
      setMailError((p) => ({ ...p, [mv]: 'メールを読み込めませんでした' }))
      console.error(err)
    }
    if (mv === 'awaiting') {
      call<ThreadsRes>('getThreads').then(setThreads, fail)
    } else {
      call<Mail[]>(mv === 'services' ? 'getReceived' : 'getPromotions').then(
        (ms) => setMails((p) => ({ ...p, [mv]: ms })),
        fail,
      )
    }
  }, [settings.source, settings.mailView])

  // 登録サービス：ルール（件名に含む言葉）を読み、変わるたびに検索し直す
  useEffect(() => {
    if (settings.source !== 'mail' || settings.mailView !== 'signups' || signupRules !== null) {
      return
    }
    call<string[] | null>('getRules', ['signups']).then(
      (r) => setSignupRules(r ?? DEFAULT_SIGNUP_RULES),
      (err) => {
        setSignupRules(DEFAULT_SIGNUP_RULES)
        showToast('ルールを読み込めませんでした')
        console.error(err)
      },
    )
  }, [settings.source, settings.mailView, signupRules, showToast])

  useEffect(() => {
    if (signupRules === null) {
      return
    }
    const q = signupQuery(signupRules)
    const id = ++signupReq.current
    setSignupMails(q ? undefined : [])
    if (!q) {
      return
    }
    call<Mail[]>('getSignups', [q]).then(
      (ms) => {
        if (id === signupReq.current) {
          setSignupMails(ms)
        }
      },
      (err) => {
        if (id === signupReq.current) {
          setMailError((p) => ({ ...p, signups: 'メールを読み込めませんでした' }))
        }
        console.error(err)
      },
    )
  }, [signupRules])

  const changeSignupRules = (next: string[]) => {
    const prev = signupRules ?? []
    setSignupRules(next)
    call('saveRules', [next, 'signups']).then(undefined, (err) => {
      setSignupRules(prev)
      showToast('ルールを保存できませんでした')
      console.error(err)
    })
  }

  const changeRules = (next: string[]) => {
    const prev = rules ?? []
    setRules(next)
    call('saveRules', [next, 'month']).then(undefined, (err) => {
      setRules(prev)
      showToast('ルールを保存できませんでした')
      console.error(err)
    })
  }

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--zoom', String(settings.zoom))
  }, [settings.zoom])

  // 日付が変わったら読み直す
  useEffect(() => {
    const id = setInterval(() => {
      if (sod(Date.now()) !== today) {
        init()
      }
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

  const view = settings.view
  const cal = settings.source === 'calendar'
  const week = view !== 'day'
  const dayOf = (ds: number, compact: boolean) => (
    <Day
      key={ds}
      index={Math.round((ds - today) / 86400000)}
      today={today}
      events={events}
      settings={settings}
      onToast={showToast}
      onCopy={copy}
      compact={compact}
    />
  )
  const hourOptions = Array.from({ length: 25 }, (_, i) => i)

  return (
    // 文字の倍率はここで流す。:root に後から入れると、各日の札が古い文字サイズで測られてしまう
    <div className="app" style={{ '--fs': settings.fontScale } as CSSProperties}>
      <header id="hud">
        <div id="tabs" role="tablist" aria-label="ソース">
          {(
            [
              ['calendar', 'カレンダー'],
              ['mail', 'メール'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={settings.source === v}
              className="interactive"
              onClick={() => change({ source: v })}
            >
              {label}
            </button>
          ))}
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
          {cal && (
            <>
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
                <span>表示</span>
                <div className="seg">
                  {(
                    [
                      ['day', '1日'],
                      ['five', '5日'],
                      ['weekdays', '平日'],
                      ['week', '1週間'],
                      ['month', '月'],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={settings.view === v}
                      onClick={() => {
                        worldRef.current?.scrollTo({ left: 0 })
                        change({ view: v })
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {!cal && (
            <div className="row">
              <span>表示</span>
              <div className="seg">
                {(
                  [
                    ['services', 'サービス別'],
                    ['awaiting', '未返信'],
                    ['signups', '登録サービス'],
                    ['promotions', 'プロモーション'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={settings.mailView === v}
                    onClick={() => change({ mailView: v })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="row">
            <span>文字</span>
            <div className="seg">
              <button
                type="button"
                aria-label="文字を小さく"
                disabled={settings.fontScale <= 0.8}
                onClick={() => change({ fontScale: stepFontScale(settings.fontScale, -1) })}
              >
                −
              </button>
              <span className="fs-value">{`${Math.round(settings.fontScale * 100)}%`}</span>
              <button
                type="button"
                aria-label="文字を大きく"
                disabled={settings.fontScale >= 1.6}
                onClick={() => change({ fontScale: stepFontScale(settings.fontScale, 1) })}
              >
                ＋
              </button>
            </div>
          </div>
          {cal && (
            <div className="row">
              <span>ズーム</span>
              <div className="seg">
                {[1, 1.5, 2, 3].map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={!week && settings.zoom === v}
                    disabled={week}
                    onClick={() => change({ zoom: v })}
                  >
                    {`${v}x`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="button" className="close" onClick={() => setPanelOpen(false)}>
            閉じる
          </button>
        </div>
      )}

      {cal && view === 'month' && <RulesBar rules={rules ?? []} onChange={changeRules} />}
      {!cal && settings.mailView === 'signups' && signupRules !== null && (
        <RulesBar rules={signupRules} onChange={changeSignupRules} />
      )}

      {cal ? (
        <main
          id="world"
          className={week ? 'week' : settings.zoom > 1 ? 'zoomed' : undefined}
          aria-label="予定"
          ref={worldRef}
          onScroll={onScroll}
        >
          {view === 'month'
            ? Array.from({ length: monthPages }, (_, p) => monthRange(today, p)).map(({ start }) => (
                <Month
                  key={start}
                  start={start}
                  events={rules === null ? undefined : monthEvents[start]}
                  rules={rules ?? []}
                  onToast={showToast}
                />
              ))
            : view !== 'day'
              ? Array.from({ length: pageCount(view, today, days) }, (_, p) => pageDays(view, today, p)).map(
                  (ds) => (
                    <div key={ds[0]} className="week-page">
                      {ds.map((d) => dayOf(d, true))}
                    </div>
                  ),
                )
              : Array.from({ length: days }, (_, i) => dayOf(addDays(today, i), false))}
        </main>
      ) : (
        <main id="mail" aria-label="メール">
          {settings.mailView === 'services' ? (
            <MailServices mails={mails.services} error={mailError.services ?? ''} />
          ) : settings.mailView === 'signups' ? (
            <MailSignups
              mails={signupMails}
              error={mailError.signups ?? ''}
              empty={signupRules?.length === 0}
            />
          ) : settings.mailView === 'awaiting' ? (
            <MailAwaiting data={threads} error={mailError.awaiting ?? ''} />
          ) : (
            <MailSenders mails={mails.promotions} error={mailError.promotions ?? ''} />
          )}
        </main>
      )}

      {cal && loading && (
        <div id="loading" className="px">
          {loading}
        </div>
      )}
      <div id="toast" className={toast ? 'show' : undefined} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  )
}
