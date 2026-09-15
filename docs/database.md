# データベース（PostgreSQL + Drizzle）

## なぜこの構成か

| 選択 | 理由 |
| --- | --- |
| PostgreSQL | ローカル（Docker）とクラウド（AWS RDS / Azure Database for PostgreSQL）で同じものが使える。`DATABASE_URL` を差し替えるだけでコード変更が要らない |
| Drizzle ORM | 型が SQL に近く、生成される SQL が読める。マイグレーション（drizzle-kit）が同梱で外部ツール不要 |
| postgres-js ドライバ | ローカルもクラウドも単一コードパス。`DATABASE_URL` の差し替えだけで動く |
| 行データを jsonb | 取り込む Excel の列が増減してもマイグレーションが不要。列を固定したくなったら後からテーブルを足せる |

## テーブル

```
users          営業担当・管理者のアカウント（login_id は一意、パスワードは scrypt ハッシュ）
sessions       ログインセッション（Cookie の生トークンではなく SHA-256 ハッシュを保存）
datasets       取り込んだデータセットのヘッダー（名前・列定義・行数・取込者）
dataset_rows   1 行 = 1 レコード。値は jsonb（row_index で取り込み順を保持）
rag_documents  法令・規程の原本メタ（S3 / FS の object_key）
rag_chunks     条・項単位の本文
rag_references 参照・準用の辺（本文は持たない）
```

`datasets` → `dataset_rows` は `ON DELETE CASCADE`。
`users` → `datasets.created_by` は `ON DELETE SET NULL`（担当者を消してもデータは残る）。

定義は `lib/db/schema.ts`。生成された SQL は `drizzle/` 配下に入る。

## よく使うコマンド

```bash
npm run db:up         # ローカル Postgres 起動（Docker）
npm run db:setup      # 起動 + マイグレーション + ダミーデータ投入（初回はこれ 1 本）
npm run db:studio     # ブラウザで中身を見る（Drizzle Studio）
npm run db:reset      # データを全部消してやり直す
npm run db:down       # 停止（データは残る）
```

## スキーマを変更する手順

1. `lib/db/schema.ts` を編集する
2. `npm run db:generate` — 差分 SQL が `drizzle/` に生成される（**中身を必ず読む**）
3. `npm run db:migrate` — 適用する
4. 生成された SQL を Git にコミットする（本番でも同じ SQL が流れる）

試行錯誤の段階では `npm run db:push`（マイグレーションファイルを作らず直接反映）が速い。
ただし**本番には push を使わず、必ず generate → migrate を通す**。

## アカウントを管理する

```bash
npm run db:user -- list
npm run db:user -- add sato@example.com 'パスワード' --name "佐藤" [--admin]
npm run db:user -- passwd sato@example.com '新しいパスワード'   # 既存セッションも失効する
npm run db:user -- remove sato@example.com
```

## ダミーデータ

`lib/analysis/dummy.ts` がシード固定の乱数で売上明細を生成する。
同じ seed なら常に同じデータになるので、**営業デモで毎回同じ数字を見せられる**。

```ts
import { generateDummySales } from "@/lib/analysis/dummy";

const parsed = generateDummySales({ rows: 480, startMonth: "2026-04", monthCount: 12, seed: 20260401 });
```

`npm run db:seed` はこれを「デモ売上データ（2026年度）」として投入する。
作り直すときは `npm run db:seed -- --force`。

## ポートが衝突したとき

ホスト側は既定で `5434`。既に使われている場合は `.env`（`.env.local` ではなく **`.env`**。
docker compose が読むのはこちら）に `DB_PORT=5435` を書き、`.env.local` の
`DATABASE_URL` も同じポートに合わせる。

```bash
lsof -nP -iTCP:5434 -sTCP:LISTEN   # 誰が使っているか確認
```

## TLS（本番では必須）

AWS RDS も Azure Database for PostgreSQL も TLS 必須。`DATABASE_SSL` で 3 段階を選ぶ。

| 値 | 挙動 | 用途 |
| --- | --- | --- |
| `disable` | 平文 | ローカル Docker |
| `require` | 暗号化するが証明書は検証しない | 動作確認・マイグレーション実行時 |
| `verify-full` | 証明書とホスト名を検証する | **本番** |

`verify-full` では CA 証明書を `DATABASE_CA_CERT`（PEM 本文 / base64）または
`DATABASE_CA_CERT_PATH`（ファイルパス）で渡す。未指定なら OS 標準のルート証明書を使う。

```bash
# AWS（東京リージョン）
curl -o rds-ca.pem https://truststore.pki.rds.amazonaws.com/ap-northeast-1/ap-northeast-1-bundle.pem
# Azure
curl -o azure-ca.pem https://cacerts.digicert.com/DigiCertGlobalRootG2.crt.pem
```

未指定時の既定は「localhost / host.docker.internal / db なら `disable`、それ以外は `require`」。
実装は `lib/db/ssl.ts`。

## 接続数について

既定は 1 プロセス 5 接続（`DATABASE_POOL_MAX`）。ECS / App Runner / Container Apps の
ような常駐コンテナは接続を再利用できるため、数本持つのが効率的。

**`DATABASE_POOL_MAX × 最大インスタンス数` が DB の `max_connections` を超えないこと。**
`db.t4g.micro` / `B1ms` の `max_connections` は約 80。超える規模になったら
RDS Proxy や PgBouncer を前に置く。

Lambda など「リクエストごとにプロセスが増える」実行形態に載せる場合は
`DATABASE_POOL_MAX=1` にしてプーラーを併用する。

## コンテナからマイグレーションを流す

アプリと同じイメージのコマンドを差し替えて実行する（`scripts/` は
esbuild でバンドル済みなので tsx や node_modules を必要としない）。

```bash
docker run --rm -e DATABASE_URL='...' -e DATABASE_SSL=require \
  template-app node scripts/db-migrate.cjs
docker run --rm -e DATABASE_URL='...' -e DATABASE_SSL=require \
  template-app node scripts/db-seed.cjs
docker run --rm -e DATABASE_URL='...' -e DATABASE_SSL=require \
  template-app node scripts/db-user.cjs list
```

マイグレーションは PostgreSQL のアドバイザリロックで直列化しているため、
複数インスタンスから同時に走っても壊れない。ただし**アプリ起動時の自動実行はしていない**
（デプロイのステップとして明示的に 1 回流す方がロールバック時の事故が少ない）。
