// 未返信候補：最後のメールが他の人から来ていて、自分が宛先に入っているスレッド

import { parseFrom } from './mail'

/** サーバーが返すスレッド1つ。from〜listId は最後のメールのヘッダー */
export interface ThreadInfo {
  id: string
  subject: string
  from: string
  to: string
  cc: string
  date: number
  unsubscribe: string
  listId: string
  count: number
}

// 返信を求めていないアドレス（no-reply、通知、配送エラーなど）
const NO_REPLY = /^(no-?reply|do-?not-?reply|notifications?|mailer-daemon|postmaster)([-+.@])/i

/** 宛先ヘッダー（カンマ区切り）のアドレスを小文字でそろえて取り出す */
function addresses(header: string): string[] {
  return header
    .split(',')
    .map((x) => parseFrom(x).address)
    .filter(Boolean)
}

export function isAwaitingReply(t: ThreadInfo, me: string): boolean {
  const self = me.toLowerCase()
  const from = parseFrom(t.from).address
  if (from === self) {
    return false
  }
  if (!addresses(t.to).includes(self)) {
    return false
  }
  if (t.unsubscribe || t.listId) {
    return false
  }
  if (NO_REPLY.test(from)) {
    return false
  }
  return true
}

/** 候補だけを、待たせている日数の長い順に並べる */
export function awaitingReply(ts: ThreadInfo[], me: string, now: number): (ThreadInfo & { days: number })[] {
  return ts
    .filter((t) => isAwaitingReply(t, me))
    .map((t) => ({ ...t, days: Math.floor((now - t.date) / 86400000) }))
    .sort((a, b) => a.date - b.date)
}
