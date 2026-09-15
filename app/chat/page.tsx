"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useChatHistory } from "@/hooks/useChatHistory";
import { Button } from "@/components/ui/button";
import { toastError } from "@/lib/toast";

export default function ChatPage() {
  const {
    sessions,
    activeSession,
    activeId,
    hydrated,
    loading,
    sendMessage,
    newChat,
    selectChat,
    deleteChat,
  } = useChatHistory();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  async function handleSend() {
    const text = input.trim();
    if (text === "" || loading) return;
    setInput("");
    try {
      await sendMessage(text);
    } catch (e) {
      toastError(
        "応答の取得に失敗しました",
        e instanceof Error ? e.message : undefined,
      );
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // IME（日本語変換）の確定 Enter では送信しない。
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-3rem)] max-w-5xl flex-col px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          ← トップへ戻る
        </Link>
        <h1 className="text-lg font-bold tracking-tight" data-testid="chat-title">
          チャットボット
        </h1>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 sm:flex-row">
        {/* 会話履歴サイドバー */}
        <aside className="flex shrink-0 flex-col gap-2 sm:w-60">
          <Button
            variant="outline"
            onClick={newChat}
            className="justify-start"
            data-testid="chat-new"
          >
            <Plus className="h-4 w-4" aria-hidden />
            新しい会話
          </Button>
          <ul
            className="flex max-h-32 flex-col gap-1 overflow-y-auto sm:max-h-none sm:flex-1"
            data-testid="chat-session-list"
          >
            {hydrated && sessions.length === 0 && (
              <li className="px-2 py-3 text-xs text-muted-foreground">
                会話履歴はまだありません。
              </li>
            )}
            {sessions.map((s) => (
              <li key={s.id}>
                <div
                  className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm transition ${
                    s.id === activeId
                      ? "bg-primary/10 text-foreground"
                      : "hover:bg-muted"
                  }`}
                  data-testid="chat-session"
                  data-active={s.id === activeId}
                >
                  <button
                    type="button"
                    onClick={() => selectChat(s.id)}
                    className="flex-1 truncate text-left"
                    title={s.title}
                  >
                    {s.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteChat(s.id)}
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                    aria-label="この会話を削除"
                    data-testid="chat-session-delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* チャット本体 */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className="flex-1 space-y-3 overflow-y-auto rounded-lg border bg-card p-4"
            data-testid="chat-log"
          >
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                メッセージを入力して会話を始めましょう。過去のやり取りは自動で保存されます。
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user" ? "flex justify-end" : "flex justify-start"
                }
                data-testid={`chat-message-${m.role}`}
              >
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start" data-testid="chat-loading">
                <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
                  入力中…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="mt-4 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力（Enter で送信 / Shift+Enter で改行）"
              rows={2}
              className="flex-1 resize-none rounded-lg border bg-card p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="chat-input"
            />
            <Button
              onClick={handleSend}
              disabled={loading || input.trim() === ""}
              data-testid="chat-send"
            >
              送信
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
