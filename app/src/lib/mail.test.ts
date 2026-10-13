import { describe, expect, it } from 'vitest'
import { groupBySender, groupByService, type Mail, parseFrom, parseUnsubscribe, serviceOf } from './mail'

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

describe('serviceOf', () => {
  it('アドレスのドメインをサービスとして返す', () => {
    expect(serviceOf('a@x.com')).toBe('x.com')
  })

  it('サブドメインは取り除いてまとめる', () => {
    expect(serviceOf('store-news@amazon.co.jp')).toBe('amazon.co.jp')
    expect(serviceOf('info@mail.rakuten.co.jp')).toBe('rakuten.co.jp')
    expect(serviceOf('no-reply@accounts.google.com')).toBe('google.com')
  })

  it('co.jp や ne.jp、co.uk のような2段の末尾を1つと数える', () => {
    expect(serviceOf('a@news.example.ne.jp')).toBe('example.ne.jp')
    expect(serviceOf('a@foo.bar.co.uk')).toBe('bar.co.uk')
  })

  it('@ がなければそのまま返す', () => {
    expect(serviceOf('unknown')).toBe('unknown')
  })
})

describe('groupByService', () => {
  const mail = (from: string, date = 1): Mail => ({
    id: `${from}${date}`,
    from,
    subject: 's',
    date,
    unsubscribe: '',
  })

  it('サービスごとに数え、件数の多い順に並べる', () => {
    const g = groupByService(
      [mail('a@x.com'), mail('b@mail.y.com'), mail('c@y.com'), mail('d@news.y.com')],
      10,
    )
    expect(g.map((x) => [x.service, x.count])).toEqual([
      ['y.com', 3],
      ['x.com', 1],
    ])
  })

  it('各サービスは差出人ごとのまとめも持つ', () => {
    const g = groupByService([mail('A <a@y.com>'), mail('A <a@y.com>', 2), mail('B <b@mail.y.com>')], 10)
    expect(g[0].senders.map((s) => [s.address, s.count])).toEqual([
      ['a@y.com', 2],
      ['b@mail.y.com', 1],
    ])
  })

  it('上位 N 件を超えた分は「その他」にまとめて最後に置く', () => {
    const g = groupByService([mail('a@a.com'), mail('a@a.com', 2), mail('b@b.com'), mail('c@c.com')], 1)
    expect(g.map((x) => [x.service, x.count])).toEqual([
      ['a.com', 2],
      ['その他', 2],
    ])
  })
})
