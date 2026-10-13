import { describe, expect, it } from 'vitest'
import { addRule, matchRules, monthRange } from './month'

describe('matchRules', () => {
  it('ルールの言葉を含む予定は表示する', () => {
    expect(matchRules('部署の飲み会', ['飲み'])).toBe(true)
  })

  it('どのルールも含まない予定は表示しない', () => {
    expect(matchRules('定例MTG', ['飲み'])).toBe(false)
  })

  it('ルールが複数あれば、どれか1つを含めば表示する（OR）', () => {
    expect(matchRules('取引先と会食', ['飲み', '会食'])).toBe(true)
  })

  it('ルールが空なら何も表示しない', () => {
    expect(matchRules('部署の飲み会', [])).toBe(false)
  })

  it('空のルールはすべてに一致したりしない', () => {
    expect(matchRules('定例MTG', [''])).toBe(false)
  })

  it('英字は大文字・小文字を区別しない', () => {
    expect(matchRules('Team Lunch', ['lunch'])).toBe(true)
  })
})

describe('monthRange', () => {
  const today = new Date(2026, 9, 13).getTime()
  const show = (r: { start: number; days: number }) => {
    const d = new Date(r.start)
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${r.days}日`
  }

  it('今月は1日から末日まで', () => {
    expect(show(monthRange(today, 0))).toBe('2026/10/1 31日')
  })

  it('次の月、年をまたいだ月も1日から末日まで', () => {
    expect(show(monthRange(today, 1))).toBe('2026/11/1 30日')
    expect(show(monthRange(today, 3))).toBe('2027/1/1 31日')
    expect(show(monthRange(today, 4))).toBe('2027/2/1 28日')
  })
})

describe('addRule', () => {
  it('前後の空白を取り除いて足す', () => {
    expect(addRule(['飲み'], '  会食 ')).toEqual(['飲み', '会食'])
  })

  it('空や、すでにある言葉は足さない', () => {
    expect(addRule(['飲み'], '   ')).toEqual(['飲み'])
    expect(addRule(['飲み'], '飲み')).toEqual(['飲み'])
  })
})
