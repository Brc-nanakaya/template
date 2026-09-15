import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * 全ページ・全 API をデフォルトで認証必須にする（fail-closed）。
 * 公開したいパスは PUBLIC_PATHS に足す。
 *
 * NOTE: middleware は Edge ランタイムで動くため DB へ接続できない。
 * ここでは Cookie の有無だけを見る安価なゲートに留め、
 * 実際のセッション検証は Node ランタイム側（`lib/auth/server.ts` の
 * `requireUser()` / `getCurrentUser()`）で行う。
 * このゲートだけを認可の根拠にしてはいけない。
 */

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

  // API はリダイレクトせず 401 を返す（fetch 側で扱いやすくする）
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "認証が必要です" },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // 静的アセットと favicon 以外すべてを対象にする
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$).*)"],
};
