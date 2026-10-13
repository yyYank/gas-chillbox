import type { Mail } from '../lib/mail'
import { groupSignups } from '../lib/signup'

interface Props {
  /** まだ読み込んでいなければ undefined */
  mails: Mail[] | undefined
  error: string
  /** ルールが空 */
  empty: boolean
}

const ymd = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

/** 件名に「登録完了」などを含むメールから、登録したサービスを登録日の新しい順に並べる */
export function MailSignups({ mails, error, empty }: Props) {
  const list = groupSignups(mails ?? [])
  return (
    <div className="mail-page">
      <h2 className="month-title px">
        登録サービス候補 {mails && <small>{`${list.length}件`}</small>}
        <small>全期間</small>
      </h2>
      {error ? (
        <p className="month-empty">{error}</p>
      ) : empty ? (
        <p className="month-empty">ルールを追加してください</p>
      ) : !mails ? (
        <p className="month-empty">読み込み中…（数十秒かかることがあります）</p>
      ) : list.length === 0 ? (
        <p className="month-empty">ルールに合うメールはありません</p>
      ) : (
        <ul className="sender-list">
          {list.map((s) => (
            <li key={s.service}>
              <div className="sender-head">
                <span className="sender-name">{s.name}</span>
                <span className="sender-count px">{ymd(s.first)}</span>
              </div>
              <div className="sender-latest">{s.subject}</div>
              <div className="sender-foot">
                <span className="sender-address">
                  {s.count > 1 ? `${s.service}・${s.count}通` : s.service}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
