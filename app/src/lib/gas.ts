import type { Mail } from './mail'
import type { ThreadInfo } from './reply'
import { addDays } from './time'
import type { Ev, InitRes } from './types'

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

let mockRules: string[] = ['飲み']

function mockThreads(): { me: string; threads: ThreadInfo[] } {
  const me = 'me@example.com'
  const day = 86400000
  const now = Date.now()
  const t = (
    id: string,
    from: string,
    subject: string,
    daysAgo: number,
    extra: Partial<ThreadInfo> = {},
  ) => ({
    id,
    subject,
    from,
    to: me,
    cc: '',
    date: now - daysAgo * day,
    unsubscribe: '',
    listId: '',
    count: 1,
    ...extra,
  })
  return {
    me,
    threads: [
      t('a', '山田 太郎 <yamada@corp.example>', '来週の打ち合わせの日程について', 6, { count: 3 }),
      t('b', '佐藤 <sato@school.example>', '保護者会の出欠のご確認', 3),
      t('c', '自分 <me@example.com>', '見積もりの件', 2, { count: 2 }),
      t('d', 'GitHub <notifications@github.com>', '[repo] New comment', 1),
      t('e', '鈴木 <suzuki@corp.example>', '資料の共有', 0),
      t('f', 'team@corp.example', '全体連絡', 4, { to: 'all@corp.example', cc: me }),
    ],
  }
}

function mockMails(): Mail[] {
  const now = Date.now()
  const senders = [
    ['Amazon.co.jp <store-news@amazon.co.jp>', 'タイムセール開催中', 18, '<https://example.com/u/amazon>'],
    ['"楽天市場" <info@rakuten.co.jp>', 'ポイント5倍キャンペーン', 11, '<mailto:unsub@rakuten.co.jp>'],
    ['ユニクロ <news@uniqlo.example>', '週末限定価格のお知らせ', 6, '<https://example.com/u/uniqlo>'],
    ['Some Store <hello@store.example>', '新商品のご案内', 2, ''],
    ['楽天カード <info@mail.rakuten.co.jp>', 'ご利用明細のお知らせ', 9, ''],
    ['GitHub <notifications@github.com>', '[repo] New issue', 24, ''],
    ['Google <no-reply@accounts.google.com>', 'セキュリティ通知', 4, ''],
    ['Slack <feedback@slack.com>', '未読のメッセージがあります', 7, ''],
    ['note <info@note.com>', 'あなたへのおすすめ', 5, '<https://example.com/u/note>'],
    ['Zoom <no-reply@zoom.us>', 'ミーティングの録画', 3, ''],
    ['PayPay <info@paypay.ne.jp>', 'キャンペーンのお知らせ', 3, '<https://example.com/u/paypay>'],
    ['Qiita <info@qiita.com>', 'トレンド記事', 2, ''],
    ['connpass <no-reply@connpass.com>', 'イベントのお知らせ', 2, ''],
    ['Yahoo <mail@news.yahoo.co.jp>', 'ニュース', 1, ''],
  ] as const
  return senders.flatMap(([from, subject, n, unsubscribe]) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${from}${i}`,
      from,
      subject: i === 0 ? subject : `${subject}（${i}）`,
      date: now - i * 86400000 * 1.3,
      unsubscribe,
    })),
  )
}

function mock(
  fn: string,
  args: unknown[],
): InitRes | Ev[] | Mail[] | { me: string; threads: ThreadInfo[] } | string[] | boolean {
  if (fn === 'getRules') return mockRules
  if (fn === 'getPromotions' || fn === 'getReceived') return mockMails()
  if (fn === 'getThreads') return mockThreads()
  if (fn === 'saveRules') {
    mockRules = args[0] as string[]
    return true
  }
  if (fn === 'getInit') {
    return { events: mockDays(args[0] as number, args[1] as number) }
  }
  if (fn === 'getDays') return mockDays(args[0] as number, args[1] as number)
  return true
}
