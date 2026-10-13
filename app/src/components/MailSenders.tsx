import { groupBySender, type Mail } from '../lib/mail'
import { md } from '../lib/time'

interface Props {
  /** まだ読み込んでいなければ undefined */
  mails: Mail[] | undefined
  error: string
}

/** プロモーションを差出人ごとにまとめ、件数の多い順に並べる。配信停止のリンクは開くだけ */
export function MailSenders({ mails, error }: Props) {
  const senders = groupBySender(mails ?? [])
  return (
    <div className="mail-page">
      <h2 className="month-title px">
        プロモーション <small>直近30日</small>
        {mails && <small>{`${mails.length}通・${senders.length}件の差出人`}</small>}
      </h2>
      {error ? (
        <p className="month-empty">{error}</p>
      ) : !mails ? (
        <p className="month-empty">読み込み中…</p>
      ) : senders.length === 0 ? (
        <p className="month-empty">プロモーションのメールはありません</p>
      ) : (
        <ul className="sender-list">
          {senders.map((s) => (
            <li key={s.address}>
              <div className="sender-head">
                <span className="sender-name">{s.name}</span>
                <span className="sender-count px">{`${s.count}通`}</span>
              </div>
              <div className="sender-latest">
                <span className="date px">{md(s.latestDate)}</span>
                {s.latest}
              </div>
              <div className="sender-foot">
                <span className="sender-address">{s.address}</span>
                {s.unsubscribe.url ? (
                  <a className="unsub" href={s.unsubscribe.url} target="_blank" rel="noopener noreferrer">
                    配信停止
                  </a>
                ) : s.unsubscribe.mailto ? (
                  <a className="unsub" href={s.unsubscribe.mailto} target="_blank" rel="noopener noreferrer">
                    配信停止（メール）
                  </a>
                ) : (
                  <span className="unsub none">配信停止の案内なし</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
