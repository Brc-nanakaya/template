# Azure へのデプロイ（Container Apps + PostgreSQL Flexible Server）

最小・最安の構成です。共通の前提は [`deployment.md`](deployment.md) を先に読んでください。

```
インターネット
    │ HTTPS（証明書は Container Apps が自動発行）
    ▼
Container Apps（min 0〜1 / max 3）───▶ PostgreSQL Flexible Server (B1ms)
    · template-app イメージ                 · TLS 必須
    · Liveness: /api/health/live             · 32GB ストレージ
```

## 0. 前提

```bash
az login
az account set --subscription "<サブスクリプション名>"
az extension add --name containerapp --upgrade
```

以下の変数を使います（適宜変更してください）。

```bash
RG=rg-sales-demo
LOC=japaneast
ACR=acrsalesdemo$RANDOM          # ACR 名は全世界で一意・英数小文字のみ
PG=pg-sales-demo-$RANDOM         # DB サーバー名も一意である必要がある
APP=sales-demo
ENVNAME=cae-sales-demo
PGADMIN=pgadmin
PGPASS='<DB管理者の強いパスワード>'
```

## 1. リソースグループ

```bash
az group create --name $RG --location $LOC
```

## 2. PostgreSQL Flexible Server

```bash
az postgres flexible-server create \
  --resource-group $RG --name $PG --location $LOC \
  --tier Burstable --sku-name Standard_B1ms \
  --storage-size 32 --version 16 \
  --admin-user $PGADMIN --admin-password "$PGPASS" \
  --database-name app \
  --public-access 0.0.0.0     # Azure サービスからの接続を許可（後で絞る）
```

> `--tier Burstable --sku-name Standard_B1ms` が最小構成です。
> 新規サブスクリプションなら 12 か月間 750 時間/月 + 32GB が無料枠に入ります。

自分の PC からマイグレーションを流すため、一時的に自宅 / オフィスの IP を許可します。

```bash
MYIP=$(curl -s https://ifconfig.me)
az postgres flexible-server firewall-rule create \
  --resource-group $RG --name $PG \
  --rule-name my-ip --start-ip-address $MYIP --end-ip-address $MYIP
```

接続文字列を組み立てます。

```bash
PGHOST=$(az postgres flexible-server show -g $RG -n $PG --query fullyQualifiedDomainName -o tsv)
DB_URL="postgres://$PGADMIN:$PGPASS@$PGHOST:5432/app"
echo $DB_URL
```

## 3. イメージを Azure Container Registry へ push

```bash
az acr create --resource-group $RG --name $ACR --sku Basic --admin-enabled true
az acr login --name $ACR

# Apple Silicon から push する場合は linux/amd64 を明示する（重要）
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_DEMO_LOGIN_HINT=false \
  -t $ACR.azurecr.io/template-app:v1 .

docker push $ACR.azurecr.io/template-app:v1
```

> **Apple Silicon（M1〜）で `--platform linux/amd64` を忘れると起動しません。**
> Container Apps は amd64 のみです。ARM イメージを push すると
> `exec format error` でコンテナが落ちます。

## 4. Container Apps 環境とシークレット

```bash
az containerapp env create \
  --resource-group $RG --name $ENVNAME --location $LOC
```

CA 証明書（`verify-full` 用）を取得します。

```bash
curl -o azure-ca.pem https://cacerts.digicert.com/DigiCertGlobalRootG2.crt.pem
```

## 5. アプリをデプロイ

```bash
az containerapp create \
  --resource-group $RG --name $APP --environment $ENVNAME \
  --image $ACR.azurecr.io/template-app:v1 \
  --registry-server $ACR.azurecr.io \
  --target-port 3000 --ingress external \
  --cpu 0.5 --memory 1.0Gi \
  --min-replicas 1 --max-replicas 3 \
  --secrets "db-url=$DB_URL" "db-ca=$(base64 < azure-ca.pem | tr -d '\n')" \
  --env-vars \
    DATABASE_URL=secretref:db-url \
    DATABASE_CA_CERT=secretref:db-ca \
    DATABASE_SSL=verify-full \
    DATABASE_POOL_MAX=5
```

- `--secrets` に入れた値は Container Apps のシークレットとして保管され、
  `secretref:` で環境変数に注入されます（ポータルでも平文表示されません）
- `--min-replicas 1` にしているのは**コールドスタートを避けるため**です。
  コストを抑えたい期間は `0` に落とせます（下記）

Liveness プローブを設定します（DB に依存しない `/api/health/live` を使う）。

```bash
az containerapp update --resource-group $RG --name $APP \
  --liveness-probe-path /api/health/live \
  --liveness-probe-initial-delay 15
```

URL を確認します。

```bash
az containerapp show -g $RG -n $APP --query properties.configuration.ingress.fqdn -o tsv
```

## 6. マイグレーションとアカウント作成

同じイメージのコマンドを差し替えて、ローカルから実行します（手順 2 で自分の IP を許可済み）。

```bash
docker run --rm \
  -e DATABASE_URL="$DB_URL" -e DATABASE_SSL=require \
  $ACR.azurecr.io/template-app:v1 node scripts/db-migrate.cjs

docker run --rm \
  -e DATABASE_URL="$DB_URL" -e DATABASE_SSL=require \
  -e SEED_ADMIN_PASSWORD='<強いパスワード>' \
  -e SEED_MEMBER_PASSWORD='<強いパスワード>' \
  $ACR.azurecr.io/template-app:v1 node scripts/db-seed.cjs
```

### Container Apps ジョブとして実行する（DB を非公開にした後）

DB を VNet 内に閉じたら、ローカルからは届かないのでジョブにします。

```bash
az containerapp job create \
  --resource-group $RG --name migrate-job --environment $ENVNAME \
  --trigger-type Manual --replica-timeout 600 \
  --image $ACR.azurecr.io/template-app:v1 \
  --registry-server $ACR.azurecr.io \
  --cpu 0.5 --memory 1.0Gi \
  --command "node" --args "scripts/db-migrate.cjs" \
  --secrets "db-url=$DB_URL" \
  --env-vars DATABASE_URL=secretref:db-url DATABASE_SSL=require

az containerapp job start --resource-group $RG --name migrate-job
```

## 7. 動作確認

```bash
FQDN=$(az containerapp show -g $RG -n $APP --query properties.configuration.ingress.fqdn -o tsv)
curl https://$FQDN/api/health/live     # {"status":"ok",...}
curl https://$FQDN/api/health          # {"status":"ok","db":"ok",...}
```

ブラウザで `https://$FQDN` を開き、発行した ID / パスワードでログインできることを確認します。

## 更新（2 回目以降のデプロイ）

```bash
docker build --platform linux/amd64 -t $ACR.azurecr.io/template-app:v2 .
docker push $ACR.azurecr.io/template-app:v2

# スキーマ変更があるときは先にマイグレーション
docker run --rm -e DATABASE_URL="$DB_URL" -e DATABASE_SSL=require \
  $ACR.azurecr.io/template-app:v2 node scripts/db-migrate.cjs

az containerapp update --resource-group $RG --name $APP \
  --image $ACR.azurecr.io/template-app:v2
```

Container Apps はリビジョン管理されるので、問題があれば前のリビジョンに戻せます。

```bash
az containerapp revision list -g $RG -n $APP -o table
az containerapp revision activate -g $RG -n $APP --revision <前のリビジョン名>
```

## コストを抑える / 戻す

```bash
# 使わない期間はゼロスケール（コールドスタートは発生する）
az containerapp update -g $RG -n $APP --min-replicas 0

# デモの直前に 1 へ戻す
az containerapp update -g $RG -n $APP --min-replicas 1

# DB も止められる（最大 7 日。以降は自動再開）
az postgres flexible-server stop -g $RG -n $PG
az postgres flexible-server start -g $RG -n $PG
```

## セキュリティを本番寄りにする

最小構成では DB を公開アクセスにしています。段階的に締めていきます。

1. **自分の IP のファイアウォール規則を消す**（マイグレーションはジョブで実行する）
   ```bash
   az postgres flexible-server firewall-rule delete -g $RG -n $PG --rule-name my-ip --yes
   ```
2. **`DATABASE_SSL=verify-full` にする**（手順 5 で設定済み）
3. **VNet 統合に移す** — Container Apps 環境を VNet 内に作り、
   PostgreSQL を Private Access（VNet 統合）で作成する。
   既存リソースの変更ではなく作り直しになるため、最初から本番想定なら
   手順 2・4 の時点で VNet を用意しておく
4. **シークレットを Key Vault に移す** — Container Apps のマネージド ID から参照する
5. **DB 管理者以外のアプリ用ユーザーを作る** — 現状はサーバー管理者で接続している。
   `CREATE ROLE app_rw` を作り、必要な権限だけ付与する

## 片付け

```bash
az group delete --name $RG --yes --no-wait
```

## 全部消えた時の復旧

このアプリは**すべてダミーデータ**なので、リソースグループを作り直して
手順 1〜6 をやり直せば同じ状態に戻ります（`db-seed.cjs` はシード固定の乱数で
生成するため、売上データの数字も毎回同じになります）。
