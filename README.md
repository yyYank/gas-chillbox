# gas-chillbox

Google のリソース（Calendar、Gmail、Drive、Tasks）をデータソースとして読み取り、用途別のビューを提供する Google Apps Script（GAS）製の Web アプリ。

## 概要

Google の各アプリは、データストアとしての信頼性と入力の利便性に優れる。一方、標準 UI は表示形式が固定されており、利用者の目的に応じた集計・可視化には向かない。

| アプリ | 標準 UI が答える問い | 標準 UI では得にくい情報 |
|---|---|---|
| Calendar | 指定した時間帯の予定 | 空き時間、翌月までの残り日数 |
| Gmail | 受信したメール | 未返信のスレッド |
| Drive | 保存されているファイル | 作業途中で更新が止まっているファイル |

本アプリは、データを Google 上に置いたまま、上記のような情報を表示するビューを提供する。データの移行や二重管理は行わない。設計は [gh-chillbox](https://github.com/yyYank/gh-chillbox) に準じる。

## 設計方針

- **Single source of truth**：データは Google のリソースにのみ保存する。本アプリ独自のデータストアは持たない。
- **読み取り専用**：データの作成・編集は各 Google アプリで行う。本アプリで行う操作は、完了マークやクリップボードへのコピーなど軽微なものに限る。
- **派生値は保存しない**：集計値や経過月数などは、表示のたびにソースから算出する。
- **ビュー単位の設計**：ビューは1つの用途に対応させる。Google の標準 UI を再現するものではない。
- **キャッシュによる初期表示**：前回取得したデータをクライアントに保存し、起動時に即時表示する。最新データは非同期で取得して差し替える。
- **通知機能は持たない**

## GAS を採用する理由

- 実行ユーザーを本人とし、アクセス範囲を「自分のみ」に設定できるため、認証基盤が不要
- サーバー、ドメイン、OAuth クライアントの用意が不要
- データが Google の外部に送信されない
- 発行された URL をスマートフォンのホーム画面に追加して利用できる
- `CalendarApp`、`GmailApp`、`DriveApp`、`SpreadsheetApp`、Tasks API を直接利用できる

## アーキテクチャ

```
Google リソース           GAS（サーバー）               クライアント
Calendar ──┐
Gmail    ──┼──▶  Source（リソースごと）  ──▶  View（用途ごと）
Drive    ──┤      共通形式に変換して返す        1 つの Web アプリに複数のビュー
Tasks    ──┘
```

| 構成要素 | 役割 |
|---|---|
| Source | リソースごとに実装する。データを取得し、共通形式（日時、タイトル、種別、元リソースへのリンク）に変換して返す |
| View | 用途ごとに実装する。Source が返す共通形式のみに依存し、GAS には依存しない |
| State | 完了フラグなど、Google 側に保存先がない状態のみを `UserProperties` に保存する |

View を GAS に依存させないことで、将来ネイティブアプリなどへ移行する場合も View を再利用できる。

## ビュー

| ビュー | ソース | 内容 | 状態 |
|---|---|---|---|
| Timeline | Calendar | 1 日を 1 画面とする横スクロール表示。予定をブロック、空き時間を余白として描画する | 実装済み |
| Monthly duties | Calendar（`義務`）、Tasks | 当月の未完了事項を経過月数付きで常時表示する。月末には未完了事項を強調表示する | 実装済み |
| Awaiting reply | Gmail | 未返信のスレッドを経過日数の長い順に表示する | 未着手 |
| Stalled files | Drive | 最近更新されたが一定期間変更のないファイルを表示する | 未着手 |

## スコープ外

- 各 Google アプリの代替となる編集機能
- 複数ユーザーでの利用、外部公開
- 外部サービスおよび外部 AI との連携
- 通知、リマインダー
- 独自データストア

## 制約事項

- **実行時間とクォータ**：GAS の 1 回の実行時間は最大 6 分。各サービスの呼び出し回数にも上限がある。各ビューは必要な範囲のデータのみを取得する。
- **HtmlService の制限**：Web アプリは iframe 内で動作するため、スクロールスナップやクリップボード API の挙動が端末によって異なる場合がある。
- **コールドスタート**：初回応答に数秒かかる場合がある。クライアントキャッシュで対処する。
- **Google Workspace アカウント**：Workspace のデータには直接アクセスしない。個人アカウントに共有された範囲のみを対象とする。

## 構成

```
viewer/            GAS プロジェクト（ウェブアプリ）
  src/
    Code.js        Source（リソース読み取り）
    index.html     View（GAS の外で開くとダミーデータで動く）
    appsscript.json
scripts/
  setup.mjs        GAS プロジェクト作成 → viewer/.clasp.json
  deploy.mjs       push → 既存デプロイを更新（URL は変わらない）
```

## セットアップ

前提：Node.js 20 以上、pnpm。

1. [Google Apps Script API](https://script.google.com/home/usersettings) をオンにする
2. プロジェクトを作成する

   ```sh
   pnpm install
   pnpm run login   # 使うアカウントでログイン
   pnpm run setup   # GAS プロジェクトを作成し viewer/.clasp.json を書く
   pnpm run push
   ```

3. `pnpm run open` でエディタを開き、「プロジェクトの設定 > スクリプト プロパティ」に追加する

   | プロパティ | 値 |
   |---|---|
   | `WORK_CALENDAR_ID` | 仕事カレンダーの ID（共有されている仕事のメールアドレス） |

4. エディタで `getInit` を一度実行し、カレンダーの権限を承認する
5. `pnpm run deploy` が表示する `/exec` の URL を開く

`.clasp.json` はコミットしない。別のマシンでは手順 2 の代わりに `{"scriptId": "...", "rootDir": "src"}` を `viewer/.clasp.json` に書く。

## 開発

```sh
pnpm run check    # viewer/src/Code.js の構文チェック
pnpm run watch    # 変更を push し続ける
pnpm run deploy   # push して同じ URL のまま新バージョンに
pnpm run logs     # 実行ログ
```

- View の調整は `viewer/src/index.html` をブラウザで直接開けばダミーデータで確認できる
- 実データで確かめるときは `pnpm run watch` しながらエディタの「デプロイをテスト」の `/dev` URL を開く
- デプロイの説明欄には直近のコミットが入る

## トラブルシューティング

- スマホで「権限がありません」と出る場合、ブラウザが別の Google アカウントで開いている。URL を `script.google.com/u/1/macros/s/…/exec` のようにアカウント番号付きにする
- 完了マークは `UserProperties` に入っている。すべて戻すときはエディタで `resetDone` を実行する

## ライセンス

[Apache License 2.0](./LICENSE)
