import { useState } from 'react'
import { groupByService, type Mail } from '../lib/mail'
import { SenderList } from './MailSenders'

const TOP = 10

interface Props {
  /** まだ読み込んでいなければ undefined */
  mails: Mail[] | undefined
  error: string
}

/** 受け取ったメールをサービス（ドメイン）ごとに数え、横棒グラフにする。棒を押すと差出人の一覧 */
export function MailServices({ mails, error }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const services = groupByService(mails ?? [], TOP)
  // 「その他」にまとめる前の、本当のサービスの数
  const total = groupByService(mails ?? [], Number.POSITIVE_INFINITY).length
  const max = Math.max(1, ...services.map((s) => s.count))
  const selected = services.find((s) => s.service === open)

  return (
    <div className="mail-page">
      <h2 className="month-title px">
        受信 <small>直近30日</small>
        {mails && <small>{`${mails.length}通・${total}サービス`}</small>}
      </h2>
      {error ? (
        <p className="month-empty">{error}</p>
      ) : !mails ? (
        <p className="month-empty">読み込み中…（数十秒かかることがあります）</p>
      ) : services.length === 0 ? (
        <p className="month-empty">メールはありません</p>
      ) : selected ? (
        <>
          <button type="button" className="back interactive" onClick={() => setOpen(null)}>
            ← サービス一覧
          </button>
          <h3 className="service-title">
            {selected.service} <small>{`${selected.count}通`}</small>
          </h3>
          <SenderList senders={selected.senders} />
        </>
      ) : (
        <ul className="service-chart" aria-label="サービスごとのメールの数">
          {services.map((s) => (
            <li key={s.service}>
              <button
                type="button"
                className={`service-row interactive${s.service === 'その他' ? ' other' : ''}`}
                aria-label={`${s.service} ${s.count}通。押すと差出人の一覧`}
                title={`${s.service}：${s.count}通（${s.senders.length}件の差出人）`}
                onClick={() => setOpen(s.service)}
              >
                <span className="service-name">{s.service}</span>
                <span className="service-count px">{s.count}</span>
                <span className="service-bar" style={{ width: `${(s.count / max) * 100}%` }} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
