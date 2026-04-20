# Template

Node.js + Express + Prisma (PostgreSQL) のプロジェクト雛形。

## セットアップ

```bash
npm install
cp .env.example .env
```

`.env` の `DATABASE_URL` をあなたの DB に合わせて編集してください。

### DB マイグレーション

```bash
npm run prisma:migrate   # マイグレーション作成 & 適用
npm run prisma:generate  # Prisma Client 再生成
npm run prisma:studio    # GUI で DB を確認
```

## 起動

```bash
npm run dev    # 開発 (nodemon)
npm start      # 本番
```

サーバ起動後、`http://localhost:3000` で確認できます。

## API エンドポイント

| Method | Path            | 説明             |
| ------ | --------------- | ---------------- |
| GET    | `/`             | ヘルスチェック   |
| GET    | `/api/health`   | ヘルスチェック   |
| GET    | `/api/users`    | ユーザー一覧     |
| POST   | `/api/users`    | ユーザー作成     |
| GET    | `/api/users/:id`| ユーザー詳細     |

## ディレクトリ構成

```
prisma/
└── schema.prisma     Prisma スキーマ
src/
├── index.js          エントリーポイント
├── config/
│   └── db.js         Prisma Client
├── routes/           ルーティング
├── controllers/      コントローラー
├── models/           (Prisma使用のため空)
└── middlewares/      ミドルウェア
```

## DB を変更したい場合

`prisma/schema.prisma` の `datasource db` の `provider` を
`mysql` / `sqlite` / `mongodb` などに変更し、`.env` の `DATABASE_URL` を調整してください。
