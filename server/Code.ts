/**
 * gas-chillbox ビューア — Googleカレンダーを DB にした横スクロール型ビューア
 *
 * 私用アカウントの GAS プロジェクトに置き、ウェブアプリとして「自分のみ」でデプロイする。
 * 仕事カレンダーは私用アカウントに共有済み（重ね表示できている）前提で、ID を指定して読む。
 *
 * GAS はファイルをまたいで関数をグローバルに共有するので、import/export は書かない。
 */

type Calendar = GoogleAppsScript.Calendar.Calendar;
type Kind = 'private' | 'work' | 'holiday';
type CalendarConfig = { id: string; kind: Kind; selfEmail?: string };

// 個人情報はリポジトリに入れない。GAS エディタの「プロジェクトの設定 > スクリプト プロパティ」に置く。
//   WORK_CALENDAR_ID   : 共有されている仕事カレンダーの ID（通常は仕事のメールアドレス）
//   EXTRA_CALENDAR_IDS : 追加で重ねるカレンダーの ID（カンマ区切り。私用扱いで描く）
const PROPS = PropertiesService.getScriptProperties();
const WORK_CALENDAR_ID = PROPS.getProperty('WORK_CALENDAR_ID');
const EXTRA_CALENDAR_IDS = (PROPS.getProperty('EXTRA_CALENDAR_IDS') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const CONFIG = {
  // 表示するカレンダー
  calendars: [
    { id: 'primary', kind: 'private' },
    // selfEmail があると、自分が「不参加」にした会議を描かない。
    WORK_CALENDAR_ID ? { id: WORK_CALENDAR_ID, kind: 'work', selfEmail: WORK_CALENDAR_ID } : null,
    ...EXTRA_CALENDAR_IDS.map((id) => ({ id, kind: 'private' })),
    { id: 'ja.japanese#holiday@group.v.calendar.google.com', kind: 'holiday' },
  ].filter((c): c is CalendarConfig => c !== null),
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('gas-chillbox')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** 初回ロード：予定を返す */
function getInit(startMs: number, days: number) {
  return { events: getDays(startMs, days) };
}

/** startMs から days 日分の予定 */
function getDays(startMs: number, days: number) {
  const start = new Date(startMs);
  const end = new Date(startMs + days * 86400000 + 3600000); // DST 等の端数を吸収
  const out: {
    id: string;
    title: string;
    start: number;
    end: number;
    allDay: boolean;
    kind: Kind;
    tentative: boolean;
  }[] = [];
  CONFIG.calendars.forEach((c) => {
    const cal = getCal_(c.id);
    if (!cal) return;
    cal.getEvents(start, end).forEach((e) => {
      if (c.selfEmail) {
        const g = e.getGuestByEmail(c.selfEmail);
        if (g && g.getGuestStatus() === CalendarApp.GuestStatus.NO) return;
      }
      const title = e.getTitle();
      out.push({
        id: `${e.getId()}:${e.getStartTime().getTime()}`,
        title,
        start: e.getStartTime().getTime(),
        end: e.getEndTime().getTime(),
        allDay: e.isAllDayEvent(),
        kind: c.kind,
        tentative: /^\[Slack\]/.test(title),
      });
    });
  });
  return out;
}

// メール：本文は読まずにヘッダーだけ取る（Gmail API・読み取り専用）

/** 直近30日のプロモーション */
function getPromotions() {
  return getMails_('category:promotions newer_than:30d', 200);
}

/** 直近30日に受け取ったメール全部（送信済みは除く）。サービス別の集計に使う */
function getReceived() {
  return getMails_('-in:sent -in:chats -in:drafts newer_than:30d', 500);
}

/**
 * 未返信候補の材料：受信トレイの直近30日のスレッドと、その最後のメールのヘッダー。
 * 判定（自分宛てか、メルマガか など）はクライアントで行う。下書きは最後のメールとみなさない。
 */
function getThreads() {
  const gmail = Gmail;
  if (!gmail?.Users?.Threads) throw new Error('Gmail の高度なサービスが有効になっていません');
  const threads = gmail.Users.Threads;
  const me = gmail.Users.getProfile('me').emailAddress || '';
  const res = threads.list('me', {
    q: 'in:inbox -category:promotions -category:social -category:updates -category:forums newer_than:30d',
    maxResults: 200,
  });
  const list = (res.threads || []).map((t) => {
    const th = threads.get('me', t.id || '', {
      format: 'metadata',
      metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'List-Unsubscribe', 'List-Id'],
    });
    const msgs = (th.messages || []).filter((m) => (m.labelIds || []).indexOf('DRAFT') === -1);
    const last = msgs[msgs.length - 1];
    const first = msgs[0];
    const header = (m: typeof last, name: string) =>
      ((m && m.payload && m.payload.headers) || []).find((h) => (h.name || '').toLowerCase() === name.toLowerCase())
        ?.value || '';
    return {
      id: t.id || '',
      subject: header(first, 'Subject'),
      from: header(last, 'From'),
      to: header(last, 'To'),
      cc: header(last, 'Cc'),
      date: Number((last && last.internalDate) || 0),
      unsubscribe: header(last, 'List-Unsubscribe'),
      listId: header(last, 'List-Id'),
      count: msgs.length,
    };
  });
  return { me, threads: list };
}

function getMails_(query: string, max: number) {
  const gmail = Gmail;
  if (!gmail?.Users?.Messages) throw new Error('Gmail の高度なサービスが有効になっていません');
  const messages = gmail.Users.Messages;
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = messages.list('me', {
      q: query,
      maxResults: Math.min(500, max - ids.length),
      pageToken,
    });
    (res.messages || []).forEach((m) => {
      if (m.id) ids.push(m.id);
    });
    pageToken = res.nextPageToken || undefined;
  } while (pageToken && ids.length < max);

  return ids.map((id) => {
    const m = messages.get('me', id, {
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'List-Unsubscribe'],
    });
    const header = (name: string) =>
      (m.payload?.headers || []).find((h) => (h.name || '').toLowerCase() === name.toLowerCase())?.value || '';
    return {
      id,
      from: header('From'),
      subject: header('Subject'),
      date: Number(m.internalDate || 0),
      unsubscribe: header('List-Unsubscribe'),
    };
  });
}

const RULES_KEY = 'rules:month';

/** 月表示のルール（タイトルに含む言葉の一覧）。スマホと PC で共有するので UserProperties に置く */
function getRules(): string[] {
  try {
    const v = JSON.parse(PropertiesService.getUserProperties().getProperty(RULES_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch (_) {
    return [];
  }
}

function saveRules(rules: unknown) {
  if (!Array.isArray(rules) || rules.some((x) => typeof x !== 'string') || rules.length > 50)
    throw new Error('invalid rules');
  PropertiesService.getUserProperties().setProperty(RULES_KEY, JSON.stringify(rules));
  return true;
}

function getCal_(id: string): Calendar | null {
  if (id === 'primary') return CalendarApp.getDefaultCalendar();
  return CalendarApp.getCalendarById(id);
}
