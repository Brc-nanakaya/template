"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** ログイン後に戻る先 */
  next: string;
  /** デモ用の初期値（NEXT_PUBLIC_DEMO_LOGIN_HINT が有効なときだけ埋める） */
  demoLoginId?: string;
  demoPassword?: string;
}

export function LoginForm({ next, demoLoginId = "", demoPassword = "" }: Props) {
  const router = useRouter();
  const [loginId, setLoginId] = useState(demoLoginId);
  const [password, setPassword] = useState(demoPassword);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "ログインに失敗しました");
        return;
      }
      // サーバーコンポーネントを再評価させてから遷移する
      router.replace(next);
      router.refresh();
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
      <div className="space-y-1.5">
        <label htmlFor="loginId" className="text-sm font-medium text-[#050505]">
          ログイン ID
        </label>
        <input
          id="loginId"
          name="loginId"
          type="text"
          autoComplete="username"
          required
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          data-testid="login-id"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#bc0017]"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-[#050505]">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="login-password"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#bc0017]"
        />
      </div>

      {error && (
        <p
          role="alert"
          data-testid="login-error"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        data-testid="login-submit"
        className="w-full bg-[#bc0017] hover:bg-[#a80014]"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <LogIn className="h-4 w-4" aria-hidden />
        )}
        ログイン
      </Button>
    </form>
  );
}
