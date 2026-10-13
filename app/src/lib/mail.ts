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
    if (!out.url && /^https:\/\//i.test(v)) out.url = v
    if (!out.mailto && /^mailto:/i.test(v)) out.mailto = v
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
    if (!s.unsubscribe.url && u.url) s.unsubscribe = { ...s.unsubscribe, url: u.url }
    if (!s.unsubscribe.mailto && u.mailto) s.unsubscribe = { ...s.unsubscribe, mailto: u.mailto }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.latestDate - a.latestDate)
}
