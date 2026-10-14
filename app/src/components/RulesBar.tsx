import { useState } from 'react'
import { addRule } from '../lib/month'

interface Props {
  rules: string[]
  onChange: (next: string[]) => void
}

/** 「含む［言葉 ×］…［追加］」の行。月表示や登録サービスのルールを足し引きする */
export function RulesBar({ rules, onChange }: Props) {
  const [input, setInput] = useState('')
  return (
    <form
      id="rules"
      onSubmit={(e) => {
        e.preventDefault()
        const next = addRule(rules, input)
        if (next !== rules) {
          onChange(next)
        }
        setInput('')
      }}
    >
      <span className="label">含む</span>
      {rules.map((r) => (
        <button
          key={r}
          type="button"
          className="rule interactive"
          aria-label={`ルール「${r}」を消す`}
          onClick={() => onChange(rules.filter((x) => x !== r))}
        >
          {r} <span aria-hidden="true">×</span>
        </button>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="言葉を追加"
        aria-label="ルールに足す言葉"
      />
      <button type="submit" className="add interactive" disabled={!input.trim()}>
        追加
      </button>
    </form>
  )
}
