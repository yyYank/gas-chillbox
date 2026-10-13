import { describe, expect, it } from 'vitest'
import { groupBySender, type Mail, parseFrom, parseUnsubscribe } from './mail'

describe('parseFrom', () => {
  it('「名前 <アドレス>」を名前とアドレスに分ける', () => {
    expect(parseFrom('Amazon.co.jp <store-news@amazon.co.jp>')).toEqual({
      name: 'Amazon.co.jp',
      address: 'store-news@amazon.co.jp',
    })
  })

  it('名前の引用符を外す', () => {
    expect(parseFrom('"楽天市場" <info@rakuten.co.jp>').name).toBe('楽天市場')
  })

  it('アドレスだけなら名前もアドレスにする', () => {
    expect(parseFrom('news@example.com')).toEqual({ name: 'news@example.com', address: 'news@example.com' })
  })

  it('アドレスは小文字にそろえる', () => {
    expect(parseFrom('X <News@Example.COM>').address).toBe('news@example.com')
  })
})

describe('parseUnsubscribe', () => {
  it('https のリンクと mailto を取り出す', () => {
    expect(parseUnsubscribe('<mailto:u@example.com?subject=unsub>, <https://example.com/u?id=1>')).toEqual({
      url: 'https://example.com/u?id=1',
      mailto: 'mailto:u@example.com?subject=unsub',
    })
  })

  it('ヘッダーがなければどちらもない', () => {
    expect(parseUnsubscribe('')).toEqual({})
  })

  it('http（暗号化なし）のリンクは使わない', () => {
    expect(parseUnsubscribe('<http://example.com/u>')).toEqual({})
  })
})

describe('groupBySender', () => {
  const mail = (from: string, subject: string, date: number, unsubscribe = ''): Mail => ({
    id: `${from}${date}`,
    from,
    subject,
    date,
    unsubscribe,
  })

  it('同じアドレスのメールを1つにまとめて数える', () => {
    const g = groupBySender([
      mail('A <a@x.com>', 's1', 1),
      mail('A <a@x.com>', 's2', 2),
      mail('B <b@x.com>', 's3', 3),
    ])
    expect(g.map((x) => [x.address, x.count])).toEqual([
      ['a@x.com', 2],
      ['b@x.com', 1],
    ])
  })

  it('件数の多い順。同じ件数なら新しいメールがある方が先', () => {
    const g = groupBySender([mail('A <a@x.com>', 's', 1), mail('B <b@x.com>', 's', 5)])
    expect(g.map((x) => x.address)).toEqual(['b@x.com', 'a@x.com'])
  })

  it('最新の件名と、配信停止のリンクを持つ', () => {
    const g = groupBySender([
      mail('A <a@x.com>', '古い', 1, '<https://x.com/old>'),
      mail('A <a@x.com>', '新しい', 9, '<https://x.com/new>'),
    ])
    expect(g[0].latest).toBe('新しい')
    expect(g[0].unsubscribe.url).toBe('https://x.com/new')
  })

  it('最新のメールに配信停止がなくても、古いメールにあればそれを使う', () => {
    const g = groupBySender([
      mail('A <a@x.com>', '古い', 1, '<https://x.com/old>'),
      mail('A <a@x.com>', '新しい', 9),
    ])
    expect(g[0].unsubscribe.url).toBe('https://x.com/old')
  })
})
