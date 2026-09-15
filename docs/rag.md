# 法令 RAG（AWS 前提）

PDF / 条文を条単位で切り、参照・準用を辿って LLM が根拠付きで答えるための土台です。
**本番は AWS 東京（`ap-northeast-1`）**。ローカルは製品が違っても、制度（切り方・引き方・引用）を確認します。

詳細な環境の分け方は [`environments-aws.md`](environments-aws.md)、
東京への載せ方は [`../infra/aws/README.md`](../infra/aws/README.md) を見てください。

## データの置き場所

```
原本（PDF / テキスト）  →  ローカル FS または S3（東京）
条・項・メタデータ      →  PostgreSQL（rag_documents / rag_chunks）
参照・準用              →  PostgreSQL（rag_references）※ 本文は持たない
回答                    →  抽出型（ローカル）または Bedrock（デモ / 本番）
```

グラフ DB（Neptune）は、参照 hop が Postgres では足りなくなってから足します。
今のデモ規程は `rag_references` の 1 hop で確認できます。

## ローカルで確認できること / できないこと

| できる | できない |
| --- | --- |
| 条・項単位のチャンク | Bedrock 埋め込み・生成の品質 |
| 条番号での exact 検索 | 大量 PDF の取込時間 |
| 参照・準用の 1 hop | 東京へのデータ所在 |
| 根拠付き回答 / 無根拠は棄権 | S3 バルクロード / VPC / IAM |
| 評価セットでの取り違え検出 | Neptune / GraphRAG の性能 |

画面 `/rag` にも同じ一覧を出しています。

## コマンド

```bash
npm run db:setup      # Postgres + マイグレーション + デモ条文
npm run rag:eval      # DB なしで評価セット（制度）
npm run rag:ingest -- --force
npm run env:up        # 任意。MinIO（S3 API）も起動
```

ログイン後に http://localhost:3000/rag を開きます。

## チャンク ID

環境が違ってもこの形は変えません。

```
{lawId}:{article}          例: demo-internal-control:6
{lawId}:{article}:{para}   項を切るとき
```

回答は本文 + 根拠リスト（`chunkKey` / 法令名 / 条）です。
