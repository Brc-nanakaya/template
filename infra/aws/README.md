# AWS 東京（法令 RAG）

アプリ本体の載せ方は [`docs/deployment-aws.md`](../../docs/deployment-aws.md) です。
こちらは **条文原本の S3 と、アプリが Bedrock / S3 を触る IAM** だけを作ります。

デモ用と本番用は **スタックを 2 つ** に分けます。

```bash
aws sts get-caller-identity
# リージョンは東京
export AWS_REGION=ap-northeast-1

aws cloudformation deploy \
  --region ap-northeast-1 \
  --template-file infra/aws/rag-foundation.yaml \
  --stack-name brc-rag-demo \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides ProjectName=brc-rag Environment=demo

aws cloudformation deploy \
  --region ap-northeast-1 \
  --template-file infra/aws/rag-foundation.yaml \
  --stack-name brc-rag-prod \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides ProjectName=brc-rag Environment=prod
```

出力されたバケット名を `RAG_S3_BUCKET` に、`Environment` を `RAG_S3_PREFIX` / `APP_ENV` に入れます。
RDS と App Runner / ECS は既存手順のあと、タスクにこの IAM ロールを付けます。

まだ AWS アカウントが無い、または権限が無い場合は、ローカルの `npm run db:setup` だけで制度確認できます。
