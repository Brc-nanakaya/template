# AWS へのデプロイ（App Runner + RDS for PostgreSQL）

AWS で最小構成にする最短ルートです。共通の前提は [`deployment.md`](deployment.md) を先に読んでください。

```
インターネット
    │ HTTPS（証明書は App Runner が自動発行）
    ▼
App Runner（0.25 vCPU / 0.5GB）───▶ RDS for PostgreSQL (db.t4g.micro)
    · template-app イメージ（ECR）        · TLS 必須
    · ヘルスチェック: /api/health/live      · 20GB gp3
```

ALB を持たないので、最小構成では**ロードバランサ代がかかりません**。
VPC / ALB / IAM を細かく学びたい場合は後述の ECS Fargate 構成を参照してください。

## 0. 前提

```bash
aws configure          # 認証情報とリージョン（ap-northeast-1）を設定
aws sts get-caller-identity
```

以下の変数を使います。

```bash
REGION=ap-northeast-1
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REPO=template-app
DBID=sales-demo-db
DBPASS='<DB管理者の強いパスワード>'
ECR=$ACCOUNT.dkr.ecr.$REGION.amazonaws.com
```

## 1. RDS for PostgreSQL

```bash
aws rds create-db-instance \
  --region $REGION \
  --db-instance-identifier $DBID \
  --engine postgres --engine-version 16 \
  --db-instance-class db.t4g.micro \
  --allocated-storage 20 --storage-type gp3 \
  --master-username postgres --master-user-password "$DBPASS" \
  --db-name app \
  --backup-retention-period 7 \
  --no-multi-az \
  --publicly-accessible      # 最小構成のため。後で締める（下記）
```

> `db.t4g.micro` が最小です。新規アカウントなら 12 か月間 750 時間/月が無料枠に入ります。
> `--publicly-accessible` はローカルからマイグレーションを流すためです。
> 本番運用に移すときは非公開にして、マイグレーションを ECS タスクで実行します。

起動を待ってエンドポイントを取得します（10 分ほどかかります）。

```bash
aws rds wait db-instance-available --region $REGION --db-instance-identifier $DBID

PGHOST=$(aws rds describe-db-instances --region $REGION \
  --db-instance-identifier $DBID \
  --query 'DBInstances[0].Endpoint.Address' --output text)

DB_URL="postgres://postgres:$DBPASS@$PGHOST:5432/app"
echo $DB_URL
```

自分の IP からの 5432 を許可します。

```bash
SG=$(aws rds describe-db-instances --region $REGION --db-instance-identifier $DBID \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text)
MYIP=$(curl -s https://ifconfig.me)

aws ec2 authorize-security-group-ingress --region $REGION \
  --group-id $SG --protocol tcp --port 5432 --cidr $MYIP/32
```

## 2. イメージを ECR へ push

```bash
aws ecr create-repository --region $REGION --repository-name $REPO

aws ecr get-login-password --region $REGION \
  | docker login --username AWS --password-stdin $ECR

# Apple Silicon から push する場合は linux/amd64 を明示する（重要）
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_DEMO_LOGIN_HINT=false \
  -t $ECR/$REPO:v1 .

docker push $ECR/$REPO:v1
```

> **Apple Silicon（M1〜）で `--platform linux/amd64` を忘れると起動しません。**
> App Runner / Fargate は既定で amd64 です。ARM イメージだと
> `exec format error` でタスクが落ちます。

## 3. 接続情報を Secrets Manager に入れる

```bash
DB_SECRET_ARN=$(aws secretsmanager create-secret --region $REGION \
  --name sales-demo/database-url \
  --secret-string "$DB_URL" \
  --query ARN --output text)
echo $DB_SECRET_ARN
```

App Runner がシークレットと ECR を読めるよう、2 つのロールを作ります。

```bash
# (a) ECR からイメージを pull するロール
cat > /tmp/apprunner-build-trust.json <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow",
 "Principal":{"Service":"build.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
BUILD_ROLE_ARN=$(aws iam create-role --role-name AppRunnerECRAccessRole \
  --assume-role-policy-document file:///tmp/apprunner-build-trust.json \
  --query Role.Arn --output text)
aws iam attach-role-policy --role-name AppRunnerECRAccessRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess

# (b) 実行中のタスクがシークレットを読むロール
cat > /tmp/apprunner-task-trust.json <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow",
 "Principal":{"Service":"tasks.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
TASK_ROLE_ARN=$(aws iam create-role --role-name SalesDemoAppRunnerTaskRole \
  --assume-role-policy-document file:///tmp/apprunner-task-trust.json \
  --query Role.Arn --output text)

cat > /tmp/secret-read.json <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow",
 "Action":["secretsmanager:GetSecretValue"],"Resource":"$DB_SECRET_ARN"}]}
JSON
aws iam put-role-policy --role-name SalesDemoAppRunnerTaskRole \
  --policy-name ReadDatabaseUrl --policy-document file:///tmp/secret-read.json
```

## 4. App Runner サービスを作る

```bash
cat > /tmp/apprunner.json <<JSON
{
  "ServiceName": "sales-demo",
  "SourceConfiguration": {
    "AuthenticationConfiguration": { "AccessRoleArn": "$BUILD_ROLE_ARN" },
    "AutoDeploymentsEnabled": false,
    "ImageRepository": {
      "ImageIdentifier": "$ECR/$REPO:v1",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "DATABASE_SSL": "require",
          "DATABASE_POOL_MAX": "5"
        },
        "RuntimeEnvironmentSecrets": {
          "DATABASE_URL": "$DB_SECRET_ARN"
        }
      }
    }
  },
  "InstanceConfiguration": {
    "Cpu": "0.25 vCPU",
    "Memory": "0.5 GB",
    "InstanceRoleArn": "$TASK_ROLE_ARN"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/api/health/live",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  }
}
JSON

aws apprunner create-service --region $REGION --cli-input-json file:///tmp/apprunner.json
```

ヘルスチェックに `/api/health/live`（DB を見ない liveness）を指定しているのが重要です。
`/api/health` を指定すると、DB の一時障害でサービスが再起動ループに入ります。

URL を確認します。

```bash
aws apprunner list-services --region $REGION \
  --query "ServiceSummaryList[?ServiceName=='sales-demo'].ServiceUrl" --output text
```

## 5. マイグレーションとアカウント作成

同じイメージのコマンドを差し替えて、ローカルから実行します（手順 1 で自分の IP を許可済み）。

```bash
docker run --rm \
  -e DATABASE_URL="$DB_URL" -e DATABASE_SSL=require \
  $ECR/$REPO:v1 node scripts/db-migrate.cjs

docker run --rm \
  -e DATABASE_URL="$DB_URL" -e DATABASE_SSL=require \
  -e SEED_ADMIN_PASSWORD='<強いパスワード>' \
  -e SEED_MEMBER_PASSWORD='<強いパスワード>' \
  $ECR/$REPO:v1 node scripts/db-seed.cjs

docker run --rm -e DATABASE_URL="$DB_URL" -e DATABASE_SSL=require \
  $ECR/$REPO:v1 node scripts/db-user.cjs list
```

### DB を非公開にした後は ECS の一回限りタスクで実行する

```bash
# VPC 内の Fargate タスクとして 1 回だけ走らせる
aws ecs run-task --region $REGION \
  --cluster <クラスタ名> --launch-type FARGATE \
  --task-definition sales-demo-migrate \
  --network-configuration "awsvpcConfiguration={subnets=[<subnet-id>],securityGroups=[<sg-id>]}" \
  --overrides '{"containerOverrides":[{"name":"app","command":["node","scripts/db-migrate.cjs"]}]}'
```

タスク定義はアプリと同じイメージを指し、`command` だけ差し替えます。

## 6. 動作確認

```bash
URL=$(aws apprunner list-services --region $REGION \
  --query "ServiceSummaryList[?ServiceName=='sales-demo'].ServiceUrl" --output text)
curl https://$URL/api/health/live     # {"status":"ok",...}
curl https://$URL/api/health          # {"status":"ok","db":"ok",...}
```

## 更新（2 回目以降のデプロイ）

```bash
docker build --platform linux/amd64 -t $ECR/$REPO:v2 .
docker push $ECR/$REPO:v2

# スキーマ変更があるときは先にマイグレーション
docker run --rm -e DATABASE_URL="$DB_URL" -e DATABASE_SSL=require \
  $ECR/$REPO:v2 node scripts/db-migrate.cjs

ARN=$(aws apprunner list-services --region $REGION \
  --query "ServiceSummaryList[?ServiceName=='sales-demo'].ServiceArn" --output text)
aws apprunner update-service --region $REGION --service-arn $ARN \
  --source-configuration "ImageRepository={ImageIdentifier=$ECR/$REPO:v2,ImageRepositoryType=ECR}"
```

## コストを抑える

App Runner は**ゼロスケールしません**が、一時停止できます（再開まで課金されません）。

```bash
aws apprunner pause-service --region $REGION --service-arn $ARN
aws apprunner resume-service --region $REGION --service-arn $ARN
```

RDS も停止できます（最大 7 日で自動再開）。

```bash
aws rds stop-db-instance --region $REGION --db-instance-identifier $DBID
aws rds start-db-instance --region $REGION --db-instance-identifier $DBID
```

## セキュリティを本番寄りにする

最小構成では RDS を公開アクセスにしています。段階的に締めます。

1. **自分の IP の許可を消す**
   ```bash
   aws ec2 revoke-security-group-ingress --region $REGION \
     --group-id $SG --protocol tcp --port 5432 --cidr $MYIP/32
   ```
2. **RDS を非公開にする** — `--no-publicly-accessible` に変更し、
   App Runner に **VPC コネクタ**を付けて VPC 内から接続する
   ```bash
   aws apprunner create-vpc-connector --region $REGION \
     --vpc-connector-name sales-demo-vpc \
     --subnets <private-subnet-id> --security-groups <sg-id>
   ```
   その後 `update-service` の `NetworkConfiguration.EgressConfiguration` で紐づける
3. **`DATABASE_SSL=verify-full` にする**
   ```bash
   curl -o rds-ca.pem https://truststore.pki.rds.amazonaws.com/ap-northeast-1/ap-northeast-1-bundle.pem
   # PEM を base64 にして環境変数 DATABASE_CA_CERT に入れる（または Secrets Manager 経由）
   ```
4. **アプリ用の DB ユーザーを作る** — 現状はマスターユーザーで接続している
5. **RDS Proxy を挟む** — レプリカ数を増やして接続が枯れる段階になったら検討する

## 代替: ECS Fargate + ALB

VPC・ALB・IAM・CloudWatch を一通り学びたい場合はこちら。App Runner との違いは、
自分で用意するものが増える点です。

| 必要なもの | 備考 |
| --- | --- |
| VPC（public / private サブネット） | RDS は private に置く |
| ALB + ターゲットグループ | ヘルスチェックパスに `/api/health/live` を指定 |
| ACM 証明書 | ALB に紐づけて HTTPS 化 |
| ECS クラスタ + タスク定義 + サービス | タスク定義は本アプリのイメージ、`portMappings: 3000` |
| CloudWatch Logs グループ | `awslogs` ドライバで出力 |

ALB だけで月 $18 程度かかるため、**最小構成にはなりません**。
一方でマイグレーションを `ecs run-task` で回す形が素直に作れるので、
本番運用を見据えるならこちらが標準的です。

## 法令 RAG を乗せるとき

条文原本の S3 と IAM は [`infra/aws/README.md`](../infra/aws/README.md) の CloudFormation で、
デモ / 本番を別スタックにします。アプリ側は次を足します。

```
APP_ENV=demo          # または prod
AWS_REGION=ap-northeast-1
RAG_STORAGE=s3
RAG_S3_BUCKET=<CloudFormation の BucketName>
RAG_S3_PREFIX=demo
RAG_LLM=extractive    # 本番は bedrock
```

ローカルの制度確認は DB と `/rag` だけで足ります。手順は [`docs/rag.md`](rag.md)。

## 片付け

```bash
aws apprunner delete-service --region $REGION --service-arn $ARN
aws rds delete-db-instance --region $REGION --db-instance-identifier $DBID \
  --skip-final-snapshot --delete-automated-backups
aws ecr delete-repository --region $REGION --repository-name $REPO --force
aws secretsmanager delete-secret --region $REGION --secret-id sales-demo/database-url \
  --force-delete-without-recovery
```
