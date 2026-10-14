// メール：プロモーションを差出人ごとにまとめ、配信停止の候補を見つける

/** サーバーが返すメール1通（本文は読まず、ヘッダーだけ） */
export interface Mail {
  id: string
  from: string
  subject: string
  date: number
  /** List-Unsubscribe ヘッダーの中身。なければ空 */
  unsubscribe: string
}

/** 「名前 <アドレス>」を分ける。アドレスは小文字にそろえる */
export function parseFrom(from: string): { name: string; address: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  if (!m) {
    const address = from.trim().toLowerCase()
    return { name: address, address }
  }
  const address = m[2].trim().toLowerCase()
  const name = m[1].replace(/^"(.*)"$/, '$1').trim()
  return { name: name || address, address }
}

/** List-Unsubscribe から https のリンクと mailto を取り出す（http は使わない） */
export function parseUnsubscribe(header: string): { url?: string; mailto?: string } {
  const out: { url?: string; mailto?: string } = {}
  for (const m of header.matchAll(/<([^>]+)>/g)) {
    const v = m[1].trim()
    if (!out.url && /^https:\/\//i.test(v)) {
      out.url = v
    }
    if (!out.mailto && /^mailto:/i.test(v)) {
      out.mailto = v
    }
  }
  return out
}

export interface Sender {
  address: string
  name: string
  count: number
  latest: string
  latestDate: number
  unsubscribe: { url?: string; mailto?: string }
}

/** 差出人のアドレスごとにまとめる。件数の多い順、同じなら新しいメールがある順 */
export function groupBySender(mails: Mail[]): Sender[] {
  const map = new Map<string, Sender>()
  // 新しい順に見ると、最初に見たものが最新になる
  for (const m of [...mails].sort((a, b) => b.date - a.date)) {
    const { name, address } = parseFrom(m.from)
    const u = parseUnsubscribe(m.unsubscribe)
    const s = map.get(address)
    if (!s) {
      map.set(address, { address, name, count: 1, latest: m.subject, latestDate: m.date, unsubscribe: u })
      continue
    }
    s.count++
    if (!s.unsubscribe.url && u.url) {
      s.unsubscribe = { ...s.unsubscribe, url: u.url }
    }
    if (!s.unsubscribe.mailto && u.mailto) {
      s.unsubscribe = { ...s.unsubscribe, mailto: u.mailto }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.latestDate - a.latestDate)
}

// co.jp・ne.jp・co.uk のように、2段で1つの末尾として扱うもの（よく見るものだけ）
const SECOND_LEVEL = new Set([
  'co',
  'ne',
  'or',
  'ac',
  'go',
  'ad',
  'ed',
  'gr',
  'lg',
  'com',
  'net',
  'org',
  'gov',
  'edu',
])

/** アドレスのドメインからサービスを決める。サブドメインは取り除く */
export function serviceOf(address: string): string {
  const at = address.lastIndexOf('@')
  if (at < 0) {
    return address
  }
  const labels = address
    .slice(at + 1)
    .toLowerCase()
    .split('.')
    .filter(Boolean)
  const n = labels.length >= 3 && SECOND_LEVEL.has(labels[labels.length - 2]) ? 3 : 2
  return labels.slice(-n).join('.')
}

export interface Service {
  service: string
  count: number
  senders: Sender[]
}

/** サービスごとにまとめて件数の多い順に並べる。上位 top 件より後ろは「その他」にまとめる */
export function groupByService(mails: Mail[], top: number): Service[] {
  const map = new Map<string, Mail[]>()
  for (const m of mails) {
    const key = serviceOf(parseFrom(m.from).address)
    map.set(key, [...(map.get(key) ?? []), m])
  }
  const all = [...map].map(([service, ms]) => ({ service, count: ms.length, senders: groupBySender(ms) }))
  all.sort((a, b) => b.count - a.count || a.service.localeCompare(b.service))
  if (all.length <= top) {
    return all
  }
  const rest = all.slice(top)
  const restMails = mails.filter((m) => rest.some((r) => r.service === serviceOf(parseFrom(m.from).address)))
  return [
    ...all.slice(0, top),
    { service: 'その他', count: restMails.length, senders: groupBySender(restMails) },
  ]
}
