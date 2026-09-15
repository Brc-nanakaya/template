// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "@/middleware";
import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * middleware は「Cookie の有無だけを見る安価なゲート」。
 * デフォルト全閉（fail-closed）になっていることを担保する。
 */

function req(path: string, withCookie = false): NextRequest {
  const r = new NextRequest(new URL(`http://localhost:3000${path}`));
  if (withCookie) r.cookies.set(SESSION_COOKIE, "dummy-token");
  return r;
}

describe("middleware", () => {
  it("未ログインのページアクセスは /login へリダイレクトする", () => {
    const res = middleware(req("/analysis"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/analysis");
  });

  it("クエリ付きのパスも next に引き継ぐ", () => {
    const res = middleware(req("/analysis?id=abc"));
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe("/analysis?id=abc");
  });

  it("未ログインの API アクセスは 401 を返す（リダイレクトしない）", () => {
    const res = middleware(req("/api/analysis/datasets"));
    expect(res.status).toBe(401);
    expect(res.headers.get("location")).toBeNull();
  });

  it("Cookie があれば通す", () => {
    expect(middleware(req("/analysis", true)).status).toBe(200);
    expect(middleware(req("/api/analysis/datasets", true)).status).toBe(200);
  });

  it("公開パスは未ログインでも通す", () => {
    for (const path of [
      "/login",
      "/api/auth/login",
      "/api/auth/logout",
      "/api/health",
    ]) {
      expect(middleware(req(path)).status, path).toBe(200);
    }
  });

  it("知らないパスはデフォルトで閉じる（fail-closed）", () => {
    const res = middleware(req("/some/new/page"));
    expect(res.status).toBe(307);
  });

  it("公開パスの前方一致で別パスが漏れない", () => {
    // /loginx は公開パスではない
    expect(middleware(req("/loginx")).status).toBe(307);
    // /api/auth/me は保護対象
    expect(middleware(req("/api/auth/me")).status).toBe(401);
  });
});
