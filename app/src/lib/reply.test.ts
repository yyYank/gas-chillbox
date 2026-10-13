import { describe, expect, it } from 'vitest'
import { awaitingReply, isAwaitingReply, type ThreadInfo } from './reply'

const ME = 'me@example.com'
const thread = (p: Partial<ThreadInfo> = {}): ThreadInfo => ({
  id: 't1',
  subject: '打ち合わせの件',
  from: '山田 <yamada@corp.example>',
  to: `自分 <${ME}>`,
  cc: '',
  date: 0,
  unsubscribe: '',
  listId: '',
  count: 1,
  ...p,
})

describe('isAwaitingReply', () => {
  it('最後のメールが他の人からで、宛先に自分がいれば候補', () => {
    expect(isAwaitingReply(thread(), ME)).toBe(true)
  })

  it('宛先は大文字・小文字や、複数の宛先が混ざっていても見つける', () => {
    expect(isAwaitingReply(thread({ to: `a@x.com, "Me" <ME@Example.com>` }), ME)).toBe(true)
  })

  it('最後のメールが自分からなら、返信済みなので候補ではない', () => {
    expect(isAwaitingReply(thread({ from: `自分 <${ME}>` }), ME)).toBe(false)
  })

  it('自分が CC にしか入っていなければ候補ではない', () => {
    expect(isAwaitingReply(thread({ to: 'team@corp.example', cc: ME }), ME)).toBe(false)
  })

  it('メルマガ（List-Unsubscribe や List-Id がある）は候補ではない', () => {
    expect(isAwaitingReply(thread({ unsubscribe: '<https://x.com/u>' }), ME)).toBe(false)
    expect(isAwaitingReply(thread({ listId: '<news.x.com>' }), ME)).toBe(false)
  })

  it('no-reply や通知用のアドレスからは候補ではない', () => {
    for (const from of [
      'no-reply@x.com',
      'X <noreply@x.com>',
      'notifications@github.com',
      'MAILER-DAEMON@x.com',
      'do-not-reply@x.com',
    ]) {
      expect(isAwaitingReply(thread({ from }), ME)).toBe(false)
    }
  })
})

describe('awaitingReply', () => {
  const DAY = 86400000
  const now = 10 * DAY

  it('候補だけを、待たせている日数の長い順に並べる', () => {
    const r = awaitingReply(
      [
        thread({ id: 'new', date: now - 1 * DAY }),
        thread({ id: 'mine', from: ME, date: now - 9 * DAY }),
        thread({ id: 'old', date: now - 5 * DAY }),
      ],
      ME,
      now,
    )
    expect(r.map((x) => [x.id, x.days])).toEqual([
      ['old', 5],
      ['new', 1],
    ])
  })

  it('1日たっていなければ 0日', () => {
    expect(awaitingReply([thread({ date: now - DAY / 2 })], ME, now)[0].days).toBe(0)
  })
})
