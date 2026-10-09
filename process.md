# 開発プロセス管理

## プロダクト概要
- **名称**: （プロダクト名を記入）
- **用途**: （想定ユーザー・利用シーンを記入）
- **技術スタック**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + PostgreSQL/Drizzle ORM + Vitest + Playwright
- **デザイン**: （カラーパレット・フォントなどを記入）

## 要件
<!-- 機能要件・非機能要件を箇条書きで整理する -->

- [ ] 要件 1
- [ ] 要件 2

## 画面構成
<!-- ページ一覧と各画面の役割を整理する -->

| パス | 画面名 | 概要 | 認証 |
| --- | --- | --- | --- |
| `/login` | ログイン | ID / パスワード認証 | 不要 |
| `/` | トップ | 業界別アプリ一覧（自動車・金融など） | 必要 |
| `/analysis` | データ分析 | Excel 取込 → プレビュー → PostgreSQL 格納 | 必要 |
| `/health-voice` | 健康アシスタント（音声） | OpenAI Realtime + WebRTC 音声対話 | 必要 |
| `/chat` | チャットボット | OpenAI 対話（キー未設定時はモック） | 必要 |
| `/todo` | ToDo 管理 | ブラウザ保存のタスク管理 | 必要 |
| `/ai-samples` | AI サンプル | Google ADK のワークフロー / エージェント | 必要 |
| `/rag` | 条例チャット | 条例への質問。根拠 PDF と該当箇所つき回答 | 必要 |
| `/rag/admin` | 条例管理 | 条例 PDF のアップロード・削除 | 必要（取込は管理者） |
| `/profile` | プロフィール | 自己紹介ページ | 必要 |

※ `middleware.ts` により全パスがデフォルト認証必須（fail-closed）。公開したいパスは `PUBLIC_PATHS` に追加する。

## タスク管理
<!-- タスクを分解し、ステータスを更新しながら進める -->

| ID | タスク | ステータス | メモ |
| --- | --- | --- | --- |
| T01 | | 未着手 | |

ステータス: 未着手 / 進行中 / レビュー待ち / 完了

## テスト方針
- ユニットテスト: `tests/unit/`（Vitest）。ロジックは `lib/` に切り出してテストする
  - DB を使うテストは `DATABASE_URL` に接続できないとき自動スキップ（`tests/unit/_db-available.ts`）
  - テストが作ったデータは必ず後片付けし、シード済みのデモデータには触らない
- E2E テスト: `tests/e2e/`（Playwright）。`data-testid` ベースで要素を特定する
  - `auth.setup.ts` が 1 回だけログインし storageState を共有する
  - 未ログイン状態を見たいテストは `test.use({ storageState: { cookies: [], origins: [] } })`
  - 実行前に `npm run db:setup` が必要

## 意思決定ログ
<!-- 設計上の判断とその理由を時系列で残す -->

| 日付 | 決定事項 | 理由 |
| --- | --- | --- |
| 2026-07-29 | データ分析の永続化は JSON ファイルストア（`data/analysis/`） | 外部 DB 未設定でも動くようにする。カラム定義は `lib/analysis/schema.ts` で後から連携 |
| 2026-07-29 | Excel 取込は xlsx（SheetJS） | .xlsx / .xls / .csv を同一経路で扱える |
| 2026-08-12 | 健康音声 bot は OpenAI Realtime + WebRTC（unified SDP 中継） | API キーをブラウザに出さず、公式推奨の低遅延接続にする |
| 2026-09-09 | 永続化を JSON ファイルストアから PostgreSQL + Drizzle ORM に移行 | クラウド（AWS RDS / Azure Database for PostgreSQL）へ `DATABASE_URL` の差し替えだけで移行できる。ローカルは Docker Compose で同じ PostgreSQL 16 を使う |
| 2026-09-09 | 行データは `dataset_rows.values`（jsonb）に格納 | 取り込む Excel の列が増減してもマイグレーション不要。列を固定したくなったら後からテーブルを足せる |
| 2026-09-09 | 認証は自前実装（scrypt + DB セッション + HttpOnly Cookie） | 依存ゼロで全体 200 行程度＝カスタムしやすい。bcrypt/argon2 のネイティブビルドを避け、サーバー側で即時失効できる（JWT ではない） |
| 2026-09-09 | middleware は Cookie の有無のみ判定し、実検証は Node 側で行う | middleware は Edge ランタイムで DB へ接続できない。API ルートは先頭で `getApiUser()` を呼ぶ規約にする |
| 2026-09-09 | 全パスをデフォルト認証必須（fail-closed）にする | 外部にデモを見せる前提で IP 制限をかけないため、追加したページが公開され続ける事故を防ぐ |
| 2026-09-09 | ダミーデータはシード固定の乱数で生成（`lib/analysis/dummy.ts`） | 営業デモで毎回同じ数字を見せられる |
| 2026-09-09 | デプロイ先は Azure Container Apps + PostgreSQL Flexible Server を推奨、AWS は App Runner + RDS | Vercel はアプリホスティングのみで DB を持たないため AWS / Azure に変更。Container Apps はゼロスケールでき無料枠でデモ用途をほぼカバーできる |
| 2026-09-09 | アプリとマイグレーションを単一 Docker イメージに統合（`output: "standalone"`） | イメージが 1 つならアプリとスキーマのバージョンがずれない。DB スクリプトを esbuild で CJS 単一ファイルにバンドルし、実行イメージに devDependencies を持ち込まない（1.2GB → 329MB） |
| 2026-09-09 | マイグレーションは起動時自動実行にせず、デプロイ手順の 1 ステップにする | 複数インスタンス同時起動時の競合とロールバック時の事故を避ける。念のため `pg_advisory_lock` で直列化もしている |
| 2026-09-09 | liveness（`/api/health/live`）と readiness（`/api/health`）を分ける | オーケストレータの生存確認に DB 依存のエンドポイントを使うと、DB の一時障害で再起動ループに入る |
| 2026-09-09 | TLS 設定を `DATABASE_SSL`（disable/require/verify-full）+ CA 証明書で切り替え | AWS RDS / Azure はいずれも TLS 必須。`require` は暗号化のみで中間者攻撃を防げないため、本番は `verify-full` にする |
| 2026-09-15 | 法令 RAG の本番は AWS 東京。ローカルは FS + 抽出型で制度だけ確認 | 大量 PDF 本文はグラフに入れない。条・参照は Postgres、原本は S3。Neptune は hop が足りなくなってから |
| 2026-10-09 | `/analysis` に売上ダッシュボード（KPI・月別推移・地域/担当者/カテゴリ/上位商品）を追加し、取り込み直後と初回表示・削除後は最新データセットを自動表示する | 取り込んだ結果をその場で数字として確認できるようにする。集計は保存せず `lib/analysis/dashboard.ts` で行データから都度計算する（jsonb の行データが正で、列の増減にも追従できる）。グラフは単系列のみ・ブランド赤 1 色にし、内訳は円グラフでなく横棒で比較しやすくする |
| 2026-10-09 | `/analysis` の取り込みに「既存データを全て入れ替え」モード（API は `mode=replace`）を追加。全削除と保存は `replaceAllDatasets()` で 1 トランザクションにし、画面では件数付きの警告と確認ダイアログを出す。実行は管理者（`users.role = admin`）のみで、API は 403、一般ユーザーの画面には選択肢を出さない | 本番のデータを丸ごと差し替えたい運用に対応する。保存に失敗しても既存データが消えないようにトランザクションでまとめる。元に戻せない操作のため、誤操作防止に既定は「追加して保存」にして毎回リセットする |
