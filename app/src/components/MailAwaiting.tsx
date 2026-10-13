import { parseFrom } from '../lib/mail'
import { awaitingReply, type ThreadInfo } from '../lib/reply'
import { md } from '../lib/time'

export interface ThreadsRes {
  me: string
  threads: ThreadInfo[]
}

interface Props {
  /** まだ読み込んでいなければ undefined */
  data: ThreadsRes | undefined
  error: string
}

/** 返信漏れっぽいスレッドを、待たせている日数の長い順に並べる。押すと Gmail で開く */
export function MailAwaiting({ data, error }: Props) {
  const list = data ? awaitingReply(data.threads, data.me, Date.now()) : []
  return (
    <div className="mail-page">
      <h2 className="month-title px">
        未返信候補 {data && <small>{`${list.length}通`}</small>}
        <small>直近30日</small>
      </h2>
      {error ? (
        <p className="month-empty">{error}</p>
      ) : !data ? (
        <p className="month-empty">読み込み中…（数十秒かかることがあります）</p>
      ) : list.length === 0 ? (
        <p className="month-empty">未返信候補はありません</p>
      ) : (
        <ul className="sender-list">
          {list.map((t) => (
            <li key={t.id}>
              <a
                className="awaiting"
                href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(data.me)}#all/${t.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="sender-head">
                  <span className="sender-name">{parseFrom(t.from).name}</span>
                  <span className="sender-count px">{t.days === 0 ? '今日' : `${t.days}日`}</span>
                </div>
                <div className="sender-latest">
                  <span className="date px">{md(t.date)}</span>
                  {t.subject || '（件名なし）'}
                  {t.count > 1 && <small className="thread-count">{` (${t.count})`}</small>}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
