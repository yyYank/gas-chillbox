export type Kind = 'work' | 'private' | 'holiday'

export interface Ev {
  id: string
  title: string
  start: number
  end: number
  allDay: boolean
  kind: Kind
  tentative?: boolean
}

export interface Duty {
  title: string
  key: string
  months: number
}

export interface Duties {
  current: Duty[]
  next: Duty[]
}

export interface InitRes {
  events: Ev[]
  duties: Duties
}

export interface Settings {
  step: 1 | 2 | 3
  from: number
  to: number
  zoom: number
  view: View
  /** 上のタブ。どのソースを見ているか */
  source: Source
  /** 文字の倍率（1 = 100%） */
  fontScale: number
}

export type Source = 'calendar' | 'mail'

export type View = 'day' | 'five' | 'weekdays' | 'week' | 'month'
