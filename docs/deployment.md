# デプロイ（AWS / Azure）

このアプリは **1 つの Docker イメージ**として動きます。AWS でも Azure でも、
やることは「コンテナを動かす」＋「マネージド PostgreSQL を用意する」の 2 つだけです。

- AWS 手順 → [`deployment-aws.md`](deployment-aws.md)
- Azure 手順 → [`deployment-azure.md`](deployment-azure.md)
- 法令 RAG（AWS 東京前提）→ [`rag.md`](rag.md) / [`environments-aws.md`](environments-aws.md)

## 構成の選択肢

10 名以下・営業デモ用途（アクセスは断続的、データは数 MB）を前提にした比較です。

| クラウド | アプリ | DB | ゼロスケール | 月額の目安 | 向き |
| --- | --- | --- | --- | --- | --- |
| **Azure（推奨）** | Container Apps | Database for PostgreSQL Flexible Server (B1ms) | ✅ できる | 約 $15〜20 | 最小・最安。手順も短い |
| **AWS** | App Runner | RDS for PostgreSQL (db.t4g.micro) | ⚠️ 一時停止のみ | 約 $18〜25 | AWS に寄せたい場合の最短ルート |
| AWS | ECS Fargate + ALB | RDS (db.t4g.micro) | ❌ | 約 $40〜 | ALB / VPC / IAM を細かく学びたい場合 |
| Azure | App Service (Linux コンテナ) | 同上 | ❌ | 約 $28〜 | 常時起動が前提でよい場合 |

金額は東京リージョンの目安です（変動します。必ず各社の料金計算ツールで確認してください）。
**AWS も Azure も、新規アカウントなら 12 か月の無料枠で DB 代がほぼゼロになります。**

### どちらを選ぶか

**Azure Container Apps を推奨します。**

- **ゼロスケールできる**（最小レプリカ 0）。使っていない時間の課金がほぼ発生しない
- 無料枠が月あたり 180,000 vCPU 秒 + 200 万リクエストあり、デモ用途なら実質アプリ代 0 円
- ロードバランサ・TLS 証明書・独自ドメインが最初から付いてくる（AWS の App Runner も同様だが、
  ECS 構成だと ALB を別途用意する必要がある）
- レプリカ数の上限を上げるだけで水平スケールする

AWS を選ぶ理由があるなら **App Runner** が最短です。ECS Fargate + ALB は
学習効果は高いものの、ALB だけで月 $18 程度かかり最小構成にはなりません。

> **⚠️ ゼロスケールの落とし穴**
> レプリカ 0 から起動するとコールドスタートで数秒待たされます。
> 顧客の前でデモする時間帯だけ最小レプリカを 1 にしておくのが安全です
> （Azure なら `--min-replicas 1`、コマンド 1 本で戻せます）。

## 共通してやること

どちらのクラウドでも流れは同じです。

### 1. コンテナイメージを作る

```bash
npm run docker:build         # docker build -t template-app .
```

`NEXT_PUBLIC_*` は**ビルド時に焼き込まれる**ため、実行時の環境変数では変わりません。
デモ用のログインヒントを出したい/出したくない場合はビルド引数で指定します。

```bash
docker build -t template-app --build-arg NEXT_PUBLIC_DEMO_LOGIN_HINT=false .
```

本番と同じイメージをローカルで確認できます。

```bash
npm run docker:up     # → http://localhost:3001（DB も一緒に起動）
npm run docker:logs
npm run docker:down
```

### 2. マネージド PostgreSQL を用意する

最小構成（AWS: `db.t4g.micro` / Azure: `B1ms`）で十分です。
**TLS 接続が必須**なので、接続文字列と `DATABASE_SSL` を合わせて設定します（後述）。

### 3. マイグレーションとアカウント作成

**アプリと同じイメージ**のコマンドを差し替えて実行します。イメージが 1 つなので、
アプリとマイグレーションのバージョンがずれません。

```bash
# スキーマ適用
docker run --rm -e DATABASE_URL='...' -e DATABASE_SSL=require \
  template-app node scripts/db-migrate.cjs

# ダミーデータ + アカウント作成（パスワードは必ず変更する）
docker run --rm -e DATABASE_URL='...' -e DATABASE_SSL=require \
  -e SEED_ADMIN_PASSWORD='<強いパスワード>' -e SEED_MEMBER_PASSWORD='<強いパスワード>' \
  template-app node scripts/db-seed.cjs

# 営業担当を個別に追加
docker run --rm -e DATABASE_URL='...' -e DATABASE_SSL=require \
  template-app node scripts/db-user.cjs add sato@example.com 'パスワード' --name "佐藤"
```

ローカルの Node からでも同じことができます（`npm run db:migrate` 等に `DATABASE_URL` を前置き）。
DB を VPC / VNet の内側に置いた場合はネットワークが通らないので、
クラウド側の一回限りジョブ（ECS run-task / Container Apps Job）として実行します。

> マイグレーションは PostgreSQL のアドバイザリロックで直列化しているため、
> 複数インスタンスから同時に走っても壊れません（`scripts/db-migrate.ts`）。
> ただし**アプリ起動時の自動マイグレーションはしていません**。
> デプロイのステップとして明示的に 1 回流す方が、ロールバック時の事故が少ないためです。

### 4. 環境変数を設定する

| 変数 | 値 | 備考 |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://user:pass@host:5432/db` | **シークレット管理に入れる**（平文で置かない） |
| `DATABASE_SSL` | `require` または `verify-full` | 本番は `verify-full` 推奨（下記） |
| `DATABASE_CA_CERT` | CA 証明書の PEM / base64 | `verify-full` のときに指定 |
| `DATABASE_POOL_MAX` | `5`（既定） | `この値 × 最大インスタンス数` が DB の `max_connections` を超えないこと |
| `PORT` | プラットフォームが設定 | 既定 3000 |
| `OPENAI_API_KEY` 等 | 任意 | AI 機能を使う場合のみ。シークレット管理へ |

`NODE_ENV=production` はイメージ側で設定済みです（Cookie の `Secure` 属性が自動で付きます）。

### 5. ヘルスチェックを設定する

用途の違う 2 つを用意しています。**取り違えると DB 障害で再起動ループに入ります。**

| パス | 種類 | DB を見るか | 使いどころ |
| --- | --- | --- | --- |
| `/api/health/live` | liveness | ❌ | ALB のターゲットグループ、App Runner、Container Apps の Liveness |
| `/api/health` | readiness | ✅ | デプロイ後の疎通確認、監視・アラート |

どちらも認証不要です（`middleware.ts` の `PUBLIC_PATHS`）。

## TLS（証明書検証）について

AWS RDS も Azure Database for PostgreSQL も TLS 必須ですが、2 段階あります。

| `DATABASE_SSL` | 挙動 | 中間者攻撃を防げるか |
| --- | --- | --- |
| `disable` | 平文 | ローカル Docker のみ |
| `require` | 暗号化するが証明書は検証しない | ❌ |
| `verify-full` | 証明書とホスト名を検証する | ✅ |

**本番では `verify-full` にしてください。** 各クラウドの CA 証明書を渡します。

```bash
# AWS（東京リージョン）
curl -o rds-ca.pem https://truststore.pki.rds.amazonaws.com/ap-northeast-1/ap-northeast-1-bundle.pem

# Azure
curl -o azure-ca.pem https://cacerts.digicert.com/DigiCertGlobalRootG2.crt.pem
```

環境変数への渡し方は 2 通りあります。

```bash
# (a) PEM 本文をそのまま（base64 でも受け付ける）
DATABASE_CA_CERT="$(cat rds-ca.pem)"
DATABASE_CA_CERT="$(base64 < rds-ca.pem)"

# (b) イメージに同梱したファイルを指すパス
DATABASE_CA_CERT_PATH=/app/certs/rds-ca.pem
```

実装は `lib/db/ssl.ts` にまとまっています。

## 本番で必ず確認すること

- [ ] `NEXT_PUBLIC_DEMO_LOGIN_HINT=false` でビルドした（ログイン画面にパスワードを出さない）
- [ ] `SEED_ADMIN_PASSWORD` / `SEED_MEMBER_PASSWORD` を `demo1234` から変更した
- [ ] `DATABASE_URL` をシークレット管理（Secrets Manager / Key Vault）に置いた
- [ ] `DATABASE_SSL=verify-full` + CA 証明書を設定した
- [ ] HTTPS で配信されている（Container Apps / App Runner は既定で TLS 付き）
- [ ] DB は外部公開していない、または接続元を絞っている
- [ ] `curl https://<your-app>/api/health` が `{"status":"ok","db":"ok"}` を返す

**IP 制限をかけない前提**なので、アカウントのパスワード強度が唯一の防壁になります。
使わなくなったアカウントは `db-user.cjs remove <loginId>` で消してください。

## スケールさせるときの順番

効く順です。上から試してください。

1. **最小レプリカを 1 以上にする** — コールドスタートが消える。デモ体験に一番効く
2. **DB のスペックを上げる** — B1ms → B2s / t4g.micro → t4g.small。1 コマンドで済む
3. **`DATABASE_POOL_MAX` と最大レプリカ数を調整する** — `POOL_MAX × レプリカ数 < max_connections`
   （`db.t4g.micro` の `max_connections` は約 80）。超えるなら RDS Proxy / PgBouncer を挟む
4. **集計を SQL 側へ寄せる** — 現在は `lib/analysis/aggregate.ts` でアプリ側集計している。
   行数が数十万を超えたら `dataset_rows` に対する集計クエリに移す
5. **リージョンをアプリと DB で揃える** — 別リージョンだとレイテンシが支配的になる

現状の 480 行程度のデモデータなら 1 も 2 も不要です。
