import { describe, expect, it } from 'vitest'
import { addDays, dayType, pageCount, pageDays, sod, weekCount, weekDays } from './time'
import type { Ev } from './types'

describe('weekDays', () => {
  it('今日から7日分の日の始まりを、1日ずつ順に返す', () => {
    const today = sod(new Date(2026, 9, 13, 15, 30).getTime())
    expect(weekDays(today)).toEqual([0, 1, 2, 3, 4, 5, 6].map((i) => addDays(today, i)))
  })

  it('月をまたいでも日付が1日ずつ進む', () => {
    const today = sod(new Date(2026, 9, 28).getTime())
    const dates = weekDays(today).map((ms) => new Date(ms).getDate())
    expect(dates).toEqual([28, 29, 30, 31, 1, 2, 3])
  })

  it('週番号を渡すと、その週の7日分を返す（1なら来週）', () => {
    const today = sod(new Date(2026, 9, 13).getTime())
    expect(weekDays(today, 1)).toEqual([7, 8, 9, 10, 11, 12, 13].map((i) => addDays(today, i)))
  })
})

describe('weekCount', () => {
  it('読み込んだ日数に収まる週の数を返す', () => {
    expect(weekCount(21)).toBe(3)
    expect(weekCount(20)).toBe(2)
  })

  it('まだ読み込んでいなくても1週は表示する', () => {
    expect(weekCount(0)).toBe(1)
  })
})

describe('dayType', () => {
  const day = (m: number, d: number) => new Date(2026, m - 1, d).getTime()
  const allDay = (ds: number, kind: Ev['kind']): Ev => ({
    id: `${kind}${ds}`,
    title: 'x',
    start: ds,
    end: addDays(ds, 1),
    allDay: true,
    kind,
  })

  it('平日は weekday', () => {
    expect(dayType(day(10, 13), [])).toBe('weekday')
  })

  it('土曜は sat、日曜は sun', () => {
    expect(dayType(day(10, 17), [])).toBe('sat')
    expect(dayType(day(10, 18), [])).toBe('sun')
  })

  it('祝日カレンダーの予定がある日は holiday', () => {
    expect(dayType(day(11, 3), [allDay(day(11, 3), 'holiday')])).toBe('holiday')
  })

  it('祝日が土曜に重なったら holiday を優先する', () => {
    expect(dayType(day(10, 17), [allDay(day(10, 17), 'holiday')])).toBe('holiday')
  })

  it('前後の日の祝日や、祝日以外の終日予定では holiday にならない', () => {
    const events = [
      allDay(day(10, 12), 'holiday'),
      allDay(day(10, 14), 'holiday'),
      allDay(day(10, 13), 'private'),
    ]
    expect(dayType(day(10, 13), events)).toBe('weekday')
  })
})

describe('pageDays', () => {
  // 2026-10-13 は火曜
  const tue = sod(new Date(2026, 9, 13).getTime())
  const dates = (ms: number[]) => ms.map((x) => new Date(x).getDate())

  it('5日表示は今日から5日ずつ並べる', () => {
    expect(dates(pageDays('five', tue, 0))).toEqual([13, 14, 15, 16, 17])
    expect(dates(pageDays('five', tue, 1))).toEqual([18, 19, 20, 21, 22])
  })

  it('平日表示は今週の月〜金を並べ、次のページは翌週の月〜金', () => {
    expect(dates(pageDays('weekdays', tue, 0))).toEqual([12, 13, 14, 15, 16])
    expect(dates(pageDays('weekdays', tue, 1))).toEqual([19, 20, 21, 22, 23])
  })

  it('平日表示を土日に開いたら、来週の月〜金から始める', () => {
    const sat = sod(new Date(2026, 9, 17).getTime())
    const sun = sod(new Date(2026, 9, 18).getTime())
    expect(dates(pageDays('weekdays', sat, 0))).toEqual([19, 20, 21, 22, 23])
    expect(dates(pageDays('weekdays', sun, 0))).toEqual([19, 20, 21, 22, 23])
  })

  it('1週間表示は今日から7日ずつ並べる', () => {
    expect(pageDays('week', tue, 1)).toEqual(weekDays(tue, 1))
  })
})

describe('pageCount', () => {
  const tue = sod(new Date(2026, 9, 13).getTime())

  it('読み込んだ日数の中に最後の日が収まるページの数を返す', () => {
    expect(pageCount('five', tue, 21)).toBe(4)
    expect(pageCount('week', tue, 21)).toBe(3)
    // 21日分（〜11/2）の中に金曜が収まるのは 10/16, 10/23, 10/30 の3週
    expect(pageCount('weekdays', tue, 21)).toBe(3)
  })

  it('まだ読み込んでいなくても1ページは表示する', () => {
    expect(pageCount('weekdays', tue, 0)).toBe(1)
  })
})
