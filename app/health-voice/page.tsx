"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TranscriptList } from "@/components/health-voice/TranscriptList";
import { VoiceControls } from "@/components/health-voice/VoiceControls";
import { Button } from "@/components/ui/button";
import { useHealthVoiceSession } from "@/hooks/useHealthVoiceSession";
import { toastError, toastSuccess } from "@/lib/toast";

export default function HealthVoicePage() {
  const {
    status,
    error,
    configured,
    transcripts,
    connect,
    disconnect,
    sendText,
    clearTranscripts,
  } = useHealthVoiceSession();

  const [textInput, setTextInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts.length]);

  useEffect(() => {
    if (error && status === "error") {
      toastError("接続エラー", error);
    }
  }, [error, status]);

  async function handleConnect() {
    await connect();
  }

  useEffect(() => {
    if (status === "connected") {
      toastSuccess("通話を開始しました", "マイクに向かって話しかけてください");
    }
  }, [status]);

  function handleDisconnect() {
    disconnect();
    toastSuccess("通話を終了しました");
  }

  function handleSendText() {
    const text = textInput.trim();
    if (!text || status !== "connected") return;
    sendText(text);
    setTextInput("");
  }

  return (
    <main className="min-h-screen bg-[#ececec]">
      <section className="bg-[#050505] text-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
          <Link
            href="/"
            className="text-xs text-white/75 transition hover:text-white"
            data-testid="back-to-top"
          >
            ← トップへ戻る
          </Link>
          <p className="text-xs text-white/75">OpenAI Realtime · WebRTC</p>
        </div>
      </section>

      <section className="bg-gradient-to-b from-[#bc0017] via-[#d30a1a] to-[#a80014] text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 text-center sm:py-20">
          <p className="text-sm font-medium tracking-[0.2em] text-[#f7dda8]">
            HEALTH VOICE
          </p>
          <h1
            className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl"
            data-testid="health-voice-title"
          >
            健康アシスタント
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/90 sm:text-base">
            音声で生活習慣のヒントを相談できます。診断や処方は行いません。
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl space-y-4 px-4 py-8">
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          data-testid="health-disclaimer"
        >
          本機能は一般的なウェルネス情報の提供を目的としており、医療行為ではありません。
          体調不良や緊急時は医療機関に相談してください。Realtime API
          は従量課金のため、通話時間にご注意ください。
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.1)] sm:p-6">
          <VoiceControls
            status={status}
            configured={configured}
            onConnect={() => void handleConnect()}
            onDisconnect={handleDisconnect}
          />

          {error && (
            <p
              className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              data-testid="voice-error"
            >
              {error}
            </p>
          )}

          {configured === false && status === "idle" && (
            <p
              className="mt-4 rounded-md bg-black/5 px-3 py-2 text-sm text-muted-foreground"
              data-testid="voice-key-hint"
            >
              `.env.local` に `OPENAI_API_KEY` を設定し、サーバーを再起動すると通話できます。
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.1)] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-[#050505]">文字起こし</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="transcript-clear"
              onClick={clearTranscripts}
              disabled={transcripts.length === 0}
            >
              クリア
            </Button>
          </div>

          <div className="max-h-[420px] overflow-y-auto pr-1">
            <TranscriptList transcripts={transcripts} />
            <div ref={bottomRef} />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              data-testid="voice-text-input"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSendText();
                }
              }}
              disabled={status !== "connected"}
              placeholder={
                status === "connected"
                  ? "テキストでも質問できます"
                  : "通話開始後にテキスト入力できます"
              }
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-[#bc0017] disabled:opacity-50"
            />
            <Button
              type="button"
              data-testid="voice-text-send"
              disabled={status !== "connected" || !textInput.trim()}
              onClick={handleSendText}
              className="bg-[#bc0017] hover:bg-[#a80014]"
            >
              送信
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
