import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSettings, stepFontScale } from './settings'

function stubSaved(value: string | null) {
  vi.stubGlobal('localStorage', { getItem: () => value })
}

afterEach(() => vi.unstubAllGlobals())

describe('loadSettings の表示モード', () => {
  it('保存されていなければ 1日表示（day）になる', () => {
    stubSaved(null)
    expect(loadSettings().view).toBe('day')
  })

  it('保存された 1週間表示（week）を読み戻せる', () => {
    stubSaved(JSON.stringify({ view: 'week' }))
    expect(loadSettings().view).toBe('week')
  })

  it('保存された 5日表示（five）と平日表示（weekdays）を読み戻せる', () => {
    stubSaved(JSON.stringify({ view: 'five' }))
    expect(loadSettings().view).toBe('five')
    stubSaved(JSON.stringify({ view: 'weekdays' }))
    expect(loadSettings().view).toBe('weekdays')
  })

  it('知らない値が保存されていたら day に戻す', () => {
    stubSaved(JSON.stringify({ view: 'month' }))
    expect(loadSettings().view).toBe('day')
  })
})

describe('loadSettings の文字の倍率', () => {
  it('保存されていなければ 1（100%）', () => {
    stubSaved(null)
    expect(loadSettings().fontScale).toBe(1)
  })

  it('保存された倍率を読み戻せる', () => {
    stubSaved(JSON.stringify({ fontScale: 1.3 }))
    expect(loadSettings().fontScale).toBe(1.3)
  })

  it('範囲外（0.8〜1.6 の外）の値は 1 に戻す', () => {
    stubSaved(JSON.stringify({ fontScale: 3 }))
    expect(loadSettings().fontScale).toBe(1)
  })
})

describe('stepFontScale', () => {
  it('＋で 0.1 増え、−で 0.1 減る', () => {
    expect(stepFontScale(1, 1)).toBe(1.1)
    expect(stepFontScale(1, -1)).toBe(0.9)
  })

  it('何度押しても小数の誤差が積もらない', () => {
    let x = 1
    for (let i = 0; i < 5; i++) x = stepFontScale(x, 1)
    expect(x).toBe(1.5)
  })

  it('上限 1.6 と下限 0.8 で止まる', () => {
    expect(stepFontScale(1.6, 1)).toBe(1.6)
    expect(stepFontScale(0.8, -1)).toBe(0.8)
  })
})
