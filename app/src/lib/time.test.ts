import { describe, expect, it } from 'vitest'
import { addDays, sod, weekDays } from './time'

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
})
