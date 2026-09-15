"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

/** ヘッダーのログアウトボタン */
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      data-testid="logout-button"
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      ログアウト
    </button>
  );
}
