# Template

Node.js + Express + PostgreSQL のプロジェクト雛形。

## セットアップ

```bash
npm install
cp .env.example .env
```

`.env` を環境に合わせて編集してください。

## 起動

```bash
npm run dev    # 開発 (nodemon)
npm start      # 本番
```

## ディレクトリ構成

```
src/
├── index.js          エントリーポイント
├── config/
│   └── db.js         DB接続設定
├── routes/           ルーティング
├── controllers/      コントローラー
├── models/           モデル
└── middlewares/      ミドルウェア
```
