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
type Duty = { title: string; key: string; months?: number };

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
  // 健診・予防接種・税金などを入れておく非表示カレンダーの名前
  dutyCalendarName: '義務',
  // 未完了の義務を何か月さかのぼって拾うか
  lookbackMonths: 12,
  // 予約済み判定で先を見る日数（「健診」の予約が入っていれば帯から外す）
  bookingLookaheadDays: 180,
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('gas-chillbox')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** 初回ロード：予定と帯をまとめて返す */
function getInit(startMs: number, days: number, nowMs: number) {
  return { events: getDays(startMs, days), duties: getDuties(nowMs) };
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

/**
 * 月の帯：`義務` カレンダーから「今月まで に始まって、まだ済んでいないもの」と「来月のもの」を導出する。
 * カレンダーには何も書き戻さない（表示時に毎回計算する）。
 *
 * 済の判定：
 *   1. 帯のチップを2回タップ → markDone() で UserProperties に記録
 *   2. 表示中カレンダーに同じ名前の予定（例：「健診」の予約）があれば、予約済みとみなす
 */
function getDuties(nowMs: number): { current: Duty[]; next: Duty[] } {
  const cal = CalendarApp.getCalendarsByName(CONFIG.dutyCalendarName)[0];
  if (!cal) return { current: [], next: [] };

  const tz = Session.getScriptTimeZone();
  const now = new Date(nowMs);
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = new Date(y, m - CONFIG.lookbackMonths, 1);
  const nextStart = new Date(y, m + 1, 1);
  const nextEnd = new Date(y, m + 2, 1);
  const lookahead = new Date(nowMs + CONFIG.bookingLookaheadDays * 86400000);

  const done = PropertiesService.getUserProperties().getProperties();
  const mains = CONFIG.calendars
    .filter((c) => c.kind !== 'holiday')
    .map((c) => getCal_(c.id))
    .filter((c): c is Calendar => c !== null);

  const seen: Record<string, boolean> = {};
  const current: (Duty & { months: number })[] = [];
  const next: Duty[] = [];

  cal.getEvents(from, nextEnd).forEach((e) => {
    const title = e.getTitle().trim();
    if (!title) return;
    const s = e.getStartTime() as Date;
    const key = `done:${title}:${Utilities.formatDate(s, tz, 'yyyy-MM-dd')}`;
    if (done[key]) return;

    if (s >= nextStart) {
      if (!seen[`next:${title}`]) {
        seen[`next:${title}`] = true;
        next.push({ title, key });
      }
      return;
    }
    if (seen[title]) return; // 同じ義務は一番古い未完了だけ
    if (isBooked_(mains, title, s, lookahead)) return;
    seen[title] = true;
    const months = y * 12 + m - (s.getFullYear() * 12 + s.getMonth()) + 1;
    current.push({ title, key, months });
  });

  current.sort((a, b) => b.months - a.months);
  return { current, next };
}

/** 帯のチップを済にする */
function markDone(key: unknown) {
  if (typeof key !== 'string' || key.indexOf('done:') !== 0) throw new Error('invalid key');
  PropertiesService.getUserProperties().setProperty(key, new Date().toISOString());
  return true;
}

/** 済にしたものを全部戻す（間違えたとき用。エディタから手で実行） */
function resetDone() {
  const props = PropertiesService.getUserProperties();
  Object.keys(props.getProperties()).forEach((k) => {
    if (k.indexOf('done:') === 0) props.deleteProperty(k);
  });
}

function isBooked_(cals: Calendar[], title: string, from: Date, to: Date) {
  for (let i = 0; i < cals.length; i++) {
    const hits = cals[i].getEvents(from, to, { search: title });
    if (hits.some((h) => h.getTitle().indexOf(title) !== -1)) return true;
  }
  return false;
}

function getCal_(id: string): Calendar | null {
  if (id === 'primary') return CalendarApp.getDefaultCalendar();
  return CalendarApp.getCalendarById(id);
}
