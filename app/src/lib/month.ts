// 月表示：ルールに合う予定だけを、暦の月（1日〜末日）の範囲で拾う

/** タイトルがルールの言葉のどれか1つを含むか（OR）。英字の大文字・小文字は区別しない */
export function matchRules(title: string, rules: string[]): boolean {
  const t = title.toLowerCase()
  return rules.some((r) => r.trim() !== '' && t.includes(r.trim().toLowerCase()))
}

/** today の月から offset か月後の、1日の始まりと日数 */
export function monthRange(today: number, offset: number): { start: number; days: number } {
  const d = new Date(today)
  const start = new Date(d.getFullYear(), d.getMonth() + offset, 1)
  const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  return { start: start.getTime(), days }
}

/** ルールに言葉を足す。前後の空白は取り、空やすでにある言葉は足さない */
export function addRule(rules: string[], word: string): string[] {
  const w = word.trim()
  if (!w || rules.includes(w)) {
    return rules
  }
  return [...rules, w]
}

/** 日の始まりの一覧を、今日より前（過去）と今日以降（これから）に分ける。並び順はそのまま */
export function splitByToday(days: number[], today: number): { past: number[]; upcoming: number[] } {
  return { past: days.filter((d) => d < today), upcoming: days.filter((d) => d >= today) }
}
