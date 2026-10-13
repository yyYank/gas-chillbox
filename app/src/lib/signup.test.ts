import { describe, expect, it } from 'vitest'
import type { Mail } from './mail'
import { DEFAULT_SIGNUP_RULES, groupSignups, signupQuery } from './signup'

describe('signupQuery', () => {
  it('件名にどれかの言葉を含むメールを探す検索式にする', () => {
    expect(signupQuery(['登録完了', 'Welcome to'])).toBe('subject:("登録完了" OR "Welcome to")')
  })

  it('言葉の中の " は取り除く', () => {
    expect(signupQuery(['a"b'])).toBe('subject:("ab")')
  })

  it('言葉がなければ空（検索しない）', () => {
    expect(signupQuery([])).toBe('')
    expect(signupQuery(['  '])).toBe('')
  })

  it('最初の言葉には「登録完了」と「Welcome to」が入っている', () => {
    expect(DEFAULT_SIGNUP_RULES).toContain('登録完了')
    expect(DEFAULT_SIGNUP_RULES).toContain('Welcome to')
  })
})

describe('groupSignups', () => {
  const mail = (from: string, subject: string, date: number): Mail => ({
    id: `${from}${date}`,
    from,
    subject,
    date,
    unsubscribe: '',
  })

  it('サービスごとにまとめ、最初に届いた日を登録日とする', () => {
    const g = groupSignups([
      mail('Note <info@note.com>', 'ご登録ありがとう', 5),
      mail('Note <no-reply@mail.note.com>', '登録完了', 3),
    ])
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ service: 'note.com', name: 'Note', first: 3, count: 2, subject: '登録完了' })
  })

  it('登録日の新しい順に並べる', () => {
    const g = groupSignups([
      mail('A <a@a.com>', 's', 1),
      mail('B <b@b.com>', 's', 9),
      mail('C <c@c.com>', 's', 5),
    ])
    expect(g.map((x) => x.service)).toEqual(['b.com', 'c.com', 'a.com'])
  })
})
