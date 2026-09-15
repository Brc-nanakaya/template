# 研修用 Web アプリ開発テンプレート

Next.js 14 (App Router) ベースの研修用スターターテンプレートです。
**PostgreSQL + Drizzle ORM のデータベース**と **ID / パスワード認証**を最初から組み込んであり、
**単一の Docker イメージ**として AWS / Azure にそのままデプロイできます。

営業デモを複数人で見せる想定の軽量構成（同時 10 名以下）で、必要になったら
レプリカ数と DB のスペックを上げるだけでスケールできます。

## 技術スタック

| 分類 | 採用技術 |
| --- | --- |
| フレームワーク | Next.js 14 (App Router) / React 18 / TypeScript |
| データベース | PostgreSQL 16（ローカルは Docker、本番は AWS RDS / Azure Database for PostgreSQL） |
| ORM / マイグレーション | Drizzle ORM + drizzle-kit |
| 認証 | ID / パスワード（自前実装・依存ゼロ。scrypt + DB セッション + HttpOnly Cookie） |
| コンテナ | Docker（Next.js standalone / 329MB / 非 root 実行） |
| スタイリング | Tailwind CSS / tailwindcss-animate / shadcn/ui 互換コンポーネント (Radix UI) |
| グラフ | recharts |
| Excel / CSV | xlsx (SheetJS) / papaparse |
| バリデーション | zod |
| AI エージェント | Google Agent Development Kit (@google/adk) + Gemini |
| 法令 RAG | 条単位チャンク + 参照 hop。本番は AWS 東京（S3 / RDS / Bedrock） |
| AI 連携 | OpenAI SDK / Anthropic SDK |
| Markdown 描画 | react-markdown + remark-gfm |
| 通知 | sonner（`lib/toast.tsx` にラッパーあり） |
| アイコン | lucide-react |
| ユニットテスト | Vitest + Testing Library (jsdom) |
| E2E テスト | Playwright（chromium / firefox / webkit） |

## セットアップ

### 前提

- Node.js 18 以上
- npm
- Docker Desktop（ローカル DB 用）

### 手順

```bash
npm install
cp .env.local.example .env.local   # 必要に応じて API キーを設定
npm run db:setup                   # Postgres 起動 → マイグレーション → ダミーデータ投入
npm run dev                        # http://localhost:3000
```

ブラウザで http://localhost:3000 を開くとログイン画面になります。

| ログイン ID | パスワード | 権限 |
| --- | --- | --- |
| `demo@example.com` | `demo1234` | 管理者 |
| `sales1@example.com` 〜 `sales3@example.com` | `demo1234` | 一般 |

パスワードは `SEED_ADMIN_PASSWORD` / `SEED_MEMBER_PASSWORD` で変更できます。
**本番では必ず変更してください。**

## ディレクトリ構成

```
app/                        # App Router のページ・レイアウト・API ルート
  layout.tsx                # ルートレイアウト（Noto Sans JP / Toaster / 共通ヘッダー）
  page.tsx                  # トップページ（機能一覧ハブ）
  login/                    # ログイン画面
  globals.css               # Tailwind ベース + shadcn/ui テーマ変数
  analysis/                 # データ分析（Excel 取込 → プレビュー → DB 格納）
  todo/ chat/ health-voice/ ai-samples/ rag/ profile/
  api/
    auth/login|logout|me/   # 認証 API
    health/                 # ヘルスチェック（認証不要）
    analysis/datasets/      # データセット CRUD
    rag/                    # 法令 RAG（status / ask / eval / ingest）
    ai/ chat/ realtime/     # AI 系 API
middleware.ts               # 全ページ・全 API をデフォルトで認証必須にする
components/
  auth/                     # ログインフォーム / 共通ヘッダー / ログアウト
  ui/                       # shadcn/ui 互換コンポーネント
  analysis/ todo/ health-voice/
lib/
  db/
    schema.ts               # Drizzle のテーブル定義（ここを編集して db:generate）
    index.ts                # DB クライアント（接続キャッシュ・プール設定）
    ssl.ts                  # TLS モードと接続数の解決（RDS / Azure の CA 対応）
    env.ts                  # スクリプト用の .env.local ローダー / 単一接続クライアント
  auth/
    password.ts             # scrypt ハッシュ化・検証
    session.ts              # セッション発行 / 検証 / 失効
    server.ts               # getCurrentUser() / requireUser()
  rag/                      # 法令 RAG（チャンク・参照・評価・S3/FS）
  analysis/
    schema.ts               # 売上データの列定義とマスタ
    db.ts                   # データセットの永続化（PostgreSQL）
    dummy.ts                # デモ用ダミーデータ生成（シード固定＝再現性あり）
    excel.ts import.ts aggregate.ts sales.ts
  ai/                       # ADK ワークフロー / エージェント / モック
  utils.ts toast.tsx
drizzle/                    # 生成されたマイグレーション SQL（コミット対象）
scripts/
  db-migrate.ts             # マイグレーション適用
  db-seed.ts                # ダミーデータ投入
  db-user.ts                # ユーザー追加 / パスワード変更 / 一覧 / 削除
tests/
  unit/                     # Vitest ユニットテスト
  e2e/                      # Playwright E2E テスト（auth.setup.ts で 1 回ログイン）
docs/
  database.md               # DB 設計・スキーマ変更手順
  auth.md                   # 認証の仕組みと拡張方法
  rag.md                    # 法令 RAG の制度確認
  environments-aws.md       # local / demo / prod（AWS 東京前提）
  deployment.md             # クラウドへのデプロイ手順
infra/aws/                  # RAG 用 S3 + IAM（CloudFormation）
  todo-app-guide.md
docker-compose.yml          # ローカル PostgreSQL
drizzle.config.ts           # drizzle-kit 設定
```

## npm スクリプト

### 開発・テスト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run start` | ビルド済みアプリの起動 |
| `npm run lint` | ESLint |
| `npm test` | ユニットテスト（Vitest）を 1 回実行 |
| `npm run test:watch` | ユニットテストをウォッチモードで実行 |
| `npm run test:e2e` | E2E テスト（Playwright、ポート 3100 で dev サーバーを自動起動） |
| `npm run test:e2e:ui` | Playwright UI モード |
| `npm run test:all` | ユニット + E2E をまとめて実行 |

### データベース

| コマンド | 内容 |
| --- | --- |
| `npm run db:setup` | **初回はこれ 1 本**。起動 → マイグレーション → ダミーデータ＋デモ条文 |
| `npm run rag:eval` | DB なしで法令 RAG の評価セット（制度確認） |
| `npm run rag:ingest` | デモ条文の再取込（`-- --force` で作り直し） |
| `npm run env:up` | Postgres + MinIO（S3 互換）。任意 |
| `npm run db:up` / `db:down` | ローカル Postgres の起動 / 停止（データは残る） |
| `npm run db:nuke` | 停止してデータも削除 |
| `npm run db:reset` | 全部消してやり直す |
| `npm run db:generate` | `lib/db/schema.ts` の変更から差分 SQL を生成 |
| `npm run db:migrate` | マイグレーションを適用 |
| `npm run db:push` | マイグレーションを作らず直接反映（試行錯誤用。本番では使わない） |
| `npm run db:studio` | Drizzle Studio で中身をブラウザ表示 |
| `npm run db:seed` | ダミーデータ投入（`-- --force` で作り直し） |
| `npm run db:user` | ユーザー管理（後述） |

### コンテナ

| コマンド | 内容 |
| --- | --- |
| `npm run docker:build` | 本番イメージをビルド |
| `npm run docker:up` | 本番と同じコンテナ + DB を起動（http://localhost:3001） |
| `npm run docker:logs` | アプリコンテナのログ |
| `npm run docker:down` | 停止 |
| `npm run build:scripts` | DB スクリプトを単一 JS にバンドル（Docker ビルド内で自動実行） |

```bash
npm run db:user -- list
npm run db:user -- add sato@example.com 'パスワード' --name "佐藤" --admin
npm run db:user -- passwd sato@example.com '新しいパスワード'
npm run db:user -- remove sato@example.com
```

DB を使うユニットテストは `DATABASE_URL` に接続できないとき自動スキップされるため、
DB を立てていない環境でも `npm test` は通ります。
E2E は DB が必須です（`npm run db:setup` を先に実行してください）。

## 環境変数

`.env.local.example` をコピーして `.env.local` を作成してください。

| 変数 | 必須 | 内容 |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL 接続文字列。ローカルは `postgres://app:app@localhost:5434/app` |
| `DATABASE_SSL` | | `disable` / `require` / `verify-full`。既定はローカル `disable`、それ以外 `require`。**本番は `verify-full`** |
| `DATABASE_CA_CERT` / `DATABASE_CA_CERT_PATH` | | `verify-full` 用の CA 証明書（PEM 本文 / base64 / ファイルパス） |
| `DATABASE_POOL_MAX` | | 1 プロセスあたりの最大接続数（既定 5）。`この値 × 最大インスタンス数 < max_connections` |
| `NEXT_PUBLIC_DEMO_LOGIN_HINT` | | `true` でログイン画面にデモ用アカウントを初期入力。**本番では外す** |
| `SEED_ADMIN_PASSWORD` / `SEED_MEMBER_PASSWORD` | | `db:seed` が作るアカウントのパスワード（既定 `demo1234`） |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | | チャットボット用。未設定ならモック応答 |
| `OPENAI_REALTIME_MODEL` | | 音声アシスタントのモデル上書き（既定 `gpt-realtime`） |
| `GOOGLE_API_KEY` / `GEMINI_MODEL` | | Google ADK サンプルで Gemini を実行する場合 |
| `ANTHROPIC_API_KEY` | | 外部 AI API を使う演習で設定 |
| `NEXT_PUBLIC_MOCK_LLM` | | `true` のとき LLM 呼び出しをモックに差し替える |
| `APP_ENV` | | `local` / `demo` / `prod`。法令 RAG の環境名 |
| `AWS_REGION` | | 既定 `ap-northeast-1` |
| `RAG_STORAGE` / `RAG_LLM` | | `fs` または `s3` / `extractive` または `bedrock` |

`DB_PORT` はホスト側の Postgres ポート（既定 5434）。衝突したら **`.env`**（`.env.local`
ではなく）に書きます — docker compose が読むのは `.env` だけです。

## 認証について

全ページ・全 API が**デフォルトで認証必須**（fail-closed）です。公開したいパスは
`middleware.ts` の `PUBLIC_PATHS` に追加してください。

新しく API ルートを作るときは、先頭で必ず検証を入れてください:

```ts
const user = await getApiUser();
if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
```

middleware は Edge ランタイムで動き DB に触れないため、Cookie の有無しか見ていません。
詳細は [`docs/auth.md`](docs/auth.md) を参照してください。

## デプロイ（AWS / Azure）

アプリは**単一の Docker イメージ**です。マイグレーションも同じイメージのコマンドを
差し替えて実行するため、アプリとスキーマのバージョンがずれません。

| クラウド | 構成 | ゼロスケール | 月額の目安 |
| --- | --- | --- | --- |
| **Azure（推奨）** | Container Apps + PostgreSQL Flexible Server (B1ms) | ✅ | 約 $15〜20 |
| AWS | App Runner + RDS (db.t4g.micro) | ⚠️ 一時停止のみ | 約 $18〜25 |
| AWS | ECS Fargate + ALB + RDS | ❌ | 約 $40〜 |

どちらも新規アカウントなら 12 か月の無料枠で DB 代がほぼゼロになります。

- 共通の前提・TLS・ヘルスチェック・チェックリスト → [`docs/deployment.md`](docs/deployment.md)
- AWS の手順 → [`docs/deployment-aws.md`](docs/deployment-aws.md)
- Azure の手順 → [`docs/deployment-azure.md`](docs/deployment-azure.md)

```bash
# ビルド（Apple Silicon からクラウドへ push する場合は --platform linux/amd64 が必須）
docker build --platform linux/amd64 --build-arg NEXT_PUBLIC_DEMO_LOGIN_HINT=false -t template-app .

# マイグレーションとアカウント作成（同じイメージのコマンドを差し替える）
docker run --rm -e DATABASE_URL='...' -e DATABASE_SSL=require template-app node scripts/db-migrate.cjs
docker run --rm -e DATABASE_URL='...' -e DATABASE_SSL=require \
  -e SEED_ADMIN_PASSWORD='<強いパスワード>' template-app node scripts/db-seed.cjs

curl https://<your-app>/api/health     # {"status":"ok","db":"ok",...}
```

### ローカルで本番同等のコンテナを確認する

```bash
npm run docker:up      # → http://localhost:3001（DB も一緒に起動）
npm run docker:logs
npm run docker:down
```

### ヘルスチェック

用途の違う 2 つがあります。**取り違えると DB 障害で再起動ループに入ります。**

| パス | 種類 | DB を見るか | 使いどころ |
| --- | --- | --- | --- |
| `/api/health/live` | liveness | ❌ | ALB / App Runner / Container Apps の生存確認 |
| `/api/health` | readiness | ✅ | デプロイ後の疎通確認・監視 |

## AI サンプル（Google ADK）

`/ai-samples` ページで 2 つの実装パターンを試せます。

| パターン | 使用クラス | 特徴 |
| --- | --- | --- |
| AI ワークフロー | `SequentialAgent` | 処理の流れ（要約 → 英訳 → タイトル案）をコードで固定。各ステップの出力は `outputKey` で state に保存し、次ステップの instruction から `{summary}` のように参照 |
| AI エージェント | `LlmAgent` + `FunctionTool` | LLM 自身が必要なツール（日時取得・計算）を判断して呼び出す |

- `GOOGLE_API_KEY` を設定し `NEXT_PUBLIC_MOCK_LLM=false` にすると Gemini で実際に実行されます
- API キー未設定時は自動的にモック応答へフォールバックするため、オフラインでも UI と実行トレースを確認できます

## 演習の進め方（例）

1. `app/page.tsx` を書き換えて画面を作る
2. データを持たせるなら `lib/db/schema.ts` にテーブルを足し、`npm run db:generate` → `npm run db:migrate`
3. ロジックは `lib/` に切り出し、`tests/unit/` にユニットテストを書く
4. 画面の振る舞いは `tests/e2e/` に Playwright テストを書く（`data-testid` を活用）
5. API が必要なら `app/api/<name>/route.ts` を作成する（**認証チェックを忘れない**）

開発プロセスの管理には `process.md` のテンプレートを利用できます。
