# 認証（ID / パスワード）

## なぜ自前実装か

営業デモを外部に見せる前提で、必要なのは「複数人が ID / PW で入れる」ことだけ。
そのため外部の認証ライブラリを入れず、Node.js 標準機能だけで組んでいる。

| 判断 | 理由 |
| --- | --- |
| ライブラリを使わない | 依存ゼロ。全体で 200 行程度なので中身を全部追える＝**カスタムしやすい** |
| scrypt（`node:crypto`） | bcrypt / argon2 はネイティブビルドが必要でサーバーレスで詰まりやすい。scrypt は標準搭載 |
| DB セッション（JWT でない） | サーバー側で即時失効できる。パスワード変更時に既存セッションを切れる |
| Cookie にはトークン、DB にはハッシュ | DB が漏れてもセッションを乗っ取られない |

将来 SSO（Google / Microsoft）に替えたくなったら、`lib/auth/` を差し替えて
`getCurrentUser()` の戻り値だけ合わせればページ側は無変更で済む。

## 構成

```
middleware.ts              全ページ・全 API をデフォルトで閉じる（fail-closed）
lib/auth/password.ts       scrypt によるハッシュ化・検証
lib/auth/session.ts        セッション発行 / 検証 / 失効、ログイン認証
lib/auth/server.ts         Cookie 操作、getCurrentUser() / requireUser()
app/login/page.tsx         ログイン画面
app/api/auth/login|logout|me/route.ts
components/auth/           ログインフォーム / 共通ヘッダー / ログアウトボタン
```

## 二段構えになっている理由（重要）

`middleware.ts` は **Edge ランタイム**で動くため DB に接続できない。
そのため middleware は「Cookie があるか」だけを見る安価なゲートにしている。

```
リクエスト
  ├─ middleware（Edge）: Cookie 無し → /login へ or 401     ← 安価なゲート
  └─ ページ / API（Node）: getCurrentUser() で DB 検証        ← 本当の認可
```

**middleware のゲートだけを認可の根拠にしてはいけない。**
新しく API ルートを追加したら、必ず先頭で検証する:

```ts
import { getApiUser } from "@/lib/auth/server";

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  // ...
}
```

サーバーコンポーネントなら `requireUser()` を使う（未ログインなら `/login` へリダイレクト）:

```ts
import { requireUser } from "@/lib/auth/server";

export default async function Page() {
  const user = await requireUser("/some-page");
  return <div>{user.name}</div>;
}
```

## 公開パスを増やす

`middleware.ts` の `PUBLIC_PATHS` に足す。既定で公開しているのは以下だけ:

```
/login  /api/auth/login  /api/auth/logout  /api/health
```

## 権限

`users.role` は `admin` / `member` の 2 段階。現状はヘッダーのバッジ表示にしか
使っていないので、削除操作などを管理者に限定したい場合は各ルートで判定を足す:

```ts
if (user.role !== "admin") {
  return NextResponse.json({ error: "権限がありません" }, { status: 403 });
}
```

## セキュリティ上の設定

| 項目 | 値 | 場所 |
| --- | --- | --- |
| Cookie | `HttpOnly` / `SameSite=Lax` / 本番は `Secure` | `lib/auth/server.ts` |
| セッション有効期間 | 7 日 | `SESSION_TTL_DAYS` |
| scrypt コスト | N=16384, r=8, p=1 | `lib/auth/password.ts` |
| ログイン失敗時の応答 | ID / PW のどちらが違うかは伝えない | `app/api/auth/login/route.ts` |
| ユーザー不存在時 | ダミー検証で応答時間を揃える | `lib/auth/session.ts` |

**IP 制限はかけない前提**なので、パスワード強度が唯一の防壁になる。
本番では `SEED_ADMIN_PASSWORD` / `SEED_MEMBER_PASSWORD` を必ず変更する。

## 未実装（必要になったら足す）

- ログイン試行回数の制限（レートリミット）。AWS なら WAF のレートベースルール、Azure なら Front Door / Application Gateway の WAF で入れられる
- 期限切れセッションの定期削除。`pruneExpiredSessions()` を用意済みなので、
  EventBridge Scheduler + ECS タスク / Container Apps ジョブから定期実行する
- パスワード変更 UI（現状は `npm run db:user -- passwd` で運用）
