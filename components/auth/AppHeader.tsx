import Link from "next/link";
import type { AuthUser } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";

/**
 * 全ページ共通のヘッダー。ログイン中のユーザー名とログアウトを表示する。
 * サーバーコンポーネントから `user` を渡す。
 */
export function AppHeader({ user }: { user: AuthUser }) {
  return (
    <header className="sticky top-0 z-40 h-12 bg-[#050505] text-white">
      <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="text-xs text-white/75 transition hover:text-white"
          data-testid="header-home-link"
        >
          研修用 Web アプリ開発テンプレート
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/90" data-testid="header-user-name">
            {user.name}
            {user.role === "admin" && (
              <span className="ml-1.5 rounded bg-[#bc0017] px-1.5 py-0.5 text-[10px] font-semibold">
                管理者
              </span>
            )}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
