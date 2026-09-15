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
参照グラフ              →  ローカル Neo4j（条–条の辺だけ。本文は持たない）
回答                    →  抽出型（ローカル）または Bedrock（デモ / 本番）
```

ローカルのグラフは **Neo4j**（Cypher）。本番で hop が増えたら **Neptune**（openCypher）に載せ替える想定で、ノードは `Ordinance` / `Article`、辺は `HAS_ARTICLE` / `REFERS_TO` です。チャンク ID `{lawId}:{article}` は変えません。
Neo4j が止まっていても取込・検索は Postgres だけで動きます。

## ローカルで確認できること / できないこと

| できる | できない |
| --- | --- |
| 条・項単位のチャンク | Bedrock 埋め込み・生成の品質 |
| 条番号での exact 検索 | 大量 PDF の取込時間 |
| 参照・準用の 1 hop（Postgres + Neo4j） | 東京へのデータ所在 |
| 根拠付き回答 / 無根拠は棄権 | S3 バルクロード / VPC / IAM |
| 評価セットでの取り違え検出 | Neptune（openCypher）の性能 |

画面 `/rag` にも同じ一覧を出しています。

## ローカルでの使い方（区の条例）

1. `npm run db:setup`
2. `npm run graph:up`（Neo4j。http://localhost:7474 / `neo4j` / `raglocal`）
3. 管理者でログインし、[/rag/admin](http://localhost:3000/rag/admin) から条例 PDF を取り込む（既存データは「再同期」または `npm run rag:graph-sync`）
4. [/rag](http://localhost:3000/rag) の条例チャットで質問する
5. 回答の下に **根拠 PDF** と **該当箇所（条・ページ）** が出る

検索はローカルで次の 3 つを混ぜます。

- ベクトル（ハッシュ埋め込み。`OPENAI_API_KEY` があれば生成も OpenAI）
- キーワード / 条番号
- 参照・準用のグラフ（1 hop）

画像のみの PDF はテキストが取れないため、文字付き PDF を使ってください。

## コマンド

```bash
npm run db:setup         # Postgres + マイグレーション + デモ条文
npm run graph:up         # ローカル Neo4j
npm run rag:graph-sync   # 既存チャンクから参照を再抽出し Neo4j へ
npm run rag:eval         # DB なしで評価セット（制度）
npm run rag:ingest -- --force
npm run env:up           # 任意。MinIO（S3 API）+ Neo4j
```

Neo4j Browser で辺を見る例:

```cypher
MATCH (from:Article)-[r:REFERS_TO]->(to:Article)
RETURN from, r, to
LIMIT 50
```

ログイン後に http://localhost:3000/rag を開きます。

## チャンク ID

環境が違ってもこの形は変えません。

```
{lawId}:{article}          例: demo-internal-control:6
{lawId}:{article}:{para}   項を切るとき
```

回答は本文 + 根拠リスト（`chunkKey` / 法令名 / 条）です。
