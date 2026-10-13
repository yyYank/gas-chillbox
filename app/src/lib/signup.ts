// 登録サービス候補：件名に「登録完了」などを含むメールから、登録したサービスを洗い出す

import { type Mail, parseFrom, serviceOf } from './mail'

/** ルールが未保存のときの最初の言葉 */
export const DEFAULT_SIGNUP_RULES = [
  '登録完了',
  '登録が完了',
  'ご登録ありがとう',
  '会員登録',
  'アカウント作成',
  'アカウントの作成',
  'Welcome to',
  'Verify your email',
  'Confirm your email',
]

/** 件名にどれかの言葉を含むメールを探す Gmail の検索式。言葉がなければ空 */
export function signupQuery(rules: string[]): string {
  const words = rules.map((r) => r.replace(/"/g, '').trim()).filter(Boolean)
  if (words.length === 0) return ''
  return `subject:(${words.map((w) => `"${w}"`).join(' OR ')})`
}

export interface Signup {
  service: string
  /** 最初に届いたメールの差出人名 */
  name: string
  /** 最初に届いた日（≒登録日） */
  first: number
  count: number
  /** 最初に届いたメールの件名 */
  subject: string
}

/** サービス（ドメイン）ごとにまとめ、登録日の新しい順に並べる */
export function groupSignups(mails: Mail[]): Signup[] {
  const map = new Map<string, Signup>()
  for (const m of [...mails].sort((a, b) => a.date - b.date)) {
    const service = serviceOf(parseFrom(m.from).address)
    const s = map.get(service)
    if (s) s.count++
    else
      map.set(service, { service, name: parseFrom(m.from).name, first: m.date, count: 1, subject: m.subject })
  }
  return [...map.values()].sort((a, b) => b.first - a.first)
}
