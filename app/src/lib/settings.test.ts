import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSettings } from './settings'

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

  it('知らない値が保存されていたら day に戻す', () => {
    stubSaved(JSON.stringify({ view: 'month' }))
    expect(loadSettings().view).toBe('day')
  })
})
