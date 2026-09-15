# 環境（AWS 前提）

法令 RAG は **同じデータ型** を、サイズと運用だけ変えて 3 環境に置きます。
ローカルだけ Postgres + ローカル FS + 抽出型回答でも、制度の確認はできます。

| | ローカル | デモ | 本番 |
| --- | --- | --- | --- |
| `APP_ENV` | `local` | `demo` | `prod` |
| 目的 | 制度確認 | 営業・結合 | 実利用 |
| アプリ | `npm run dev` | App Runner または ECS（東京） | 同じイメージ |
| RDB | Docker PostgreSQL 16 | RDS / Aurora（東京・小さい枠） | 一段上。バックアップあり |
| 原本 | `data/rag/objects` または MinIO | S3 デモバケット（東京） | S3 本番バケット（別） |
| 回答 | 抽出型（引用を組み立てる） | 抽出型または Bedrock | Bedrock |
| グラフ | 使わない（`rag_references`） | 必要なら Neptune Serverless | 参照が核なら Neptune Database |
| データ | 架空のデモ規程 | 見せる用の固定セット | 実法令。デモと混ぜない |
| ログインヒント | ON 可 | ON 可 | **OFF** |

## 環境変数

テンプレート:

- ローカル: [`.env.local.example`](../.env.local.example)
- デモ: [`.env.demo.example`](../.env.demo.example)
- 本番: [`.env.prod.example`](../.env.prod.example)

揃えるもの: チャンク ID、参照（from → to）、回答（本文 + 根拠）。
変えるもの: バケット、DB、LLM、レプリカ。

## デモと本番を分ける

- バケット・RDS・シードを共用しない
- 本番では `NEXT_PUBLIC_DEMO_LOGIN_HINT=false`
- マイグレーションは起動時自動実行せず、デプロイ手順で `node scripts/db-migrate.cjs`
- 取込はバッチ（S3 配置 → `rag-ingest`）。巨大 PDF を画面アップロードしない

## 後から足すもの

1. Textract / Bedrock Knowledge Bases で実 PDF を切る  
2. Aurora pgvector または OpenSearch で意味検索  
3. 参照グラフが大きくなったら Neptune（東京）  
4. 評価セットを実法令の質問に差し替える  
