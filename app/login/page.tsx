import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/auth/server";

export const metadata = { title: "ログイン | brc-sales-hub" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: { next?: string };
}

/** ログイン後の遷移先。オープンリダイレクトを防ぐため自サイト内のパスに限定する */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.startsWith("/login")) return "/";
  return next;
}

export default async function LoginPage({ searchParams }: Props) {
  const next = safeNext(searchParams.next);

  // すでにログイン済みならそのまま通す
  const user = await getCurrentUser();
  if (user) redirect(next);

  // デモ用: 有効時のみログイン欄に初期値を入れる（本番では必ず false にする）
  const showHint = process.env.NEXT_PUBLIC_DEMO_LOGIN_HINT === "true";

  return (
    <main className="flex min-h-screen flex-col bg-[#ececec]">
      <div className="bg-[#050505] text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-5">
          <p className="text-xs text-white/75">研修用 Web アプリ開発テンプレート</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-black/5 bg-white p-8 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
          <h1
            className="text-2xl font-bold tracking-tight text-[#050505]"
            data-testid="login-title"
          >
            ログイン
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            発行された ID とパスワードを入力してください。
          </p>

          <div className="mt-6">
            <LoginForm
              next={next}
              demoLoginId={showHint ? "demo@example.com" : ""}
              demoPassword={showHint ? "demo1234" : ""}
            />
          </div>

          {showHint && (
            <p
              className="mt-6 rounded-md bg-[#bc0017]/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
              data-testid="login-demo-hint"
            >
              デモ用アカウントが入力済みです（<code>demo@example.com</code> /{" "}
              <code>demo1234</code>）。
              <br />
              本番では <code>NEXT_PUBLIC_DEMO_LOGIN_HINT</code> を外してください。
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
