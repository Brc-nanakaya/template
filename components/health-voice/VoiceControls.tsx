"use client";

import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VoiceSessionStatus } from "@/hooks/useHealthVoiceSession";

interface VoiceControlsProps {
  status: VoiceSessionStatus;
  configured: boolean | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

const STATUS_LABEL: Record<VoiceSessionStatus, string> = {
  idle: "待機中",
  connecting: "接続中…",
  connected: "通話中",
  error: "エラー",
};

export function VoiceControls({
  status,
  configured,
  onConnect,
  onDisconnect,
}: VoiceControlsProps) {
  const connected = status === "connected";
  const connecting = status === "connecting";

  return (
    <div
      className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between"
      data-testid="voice-controls"
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${
            connected
              ? "bg-emerald-100 text-emerald-700"
              : connecting
                ? "bg-amber-100 text-amber-700"
                : "bg-black/5 text-muted-foreground"
          }`}
          aria-hidden
        >
          {connected ? (
            <Mic className="h-5 w-5" />
          ) : (
            <MicOff className="h-5 w-5" />
          )}
        </span>
        <div>
          <p
            className="text-sm font-semibold text-[#050505]"
            data-testid="voice-status"
          >
            {STATUS_LABEL[status]}
          </p>
          <p className="text-xs text-muted-foreground">
            {configured === false
              ? "OPENAI_API_KEY が未設定です"
              : connected
                ? "マイクに向かって話してください（サーバー側 VAD）"
                : "通話開始後、ブラウザでマイク許可が必要です"}
          </p>
        </div>
      </div>

      {connected || connecting ? (
        <Button
          type="button"
          variant="destructive"
          data-testid="voice-disconnect"
          disabled={connecting}
          onClick={onDisconnect}
        >
          <PhoneOff className="h-4 w-4" aria-hidden />
          通話を終了
        </Button>
      ) : (
        <Button
          type="button"
          data-testid="voice-connect"
          className="bg-[#bc0017] hover:bg-[#a80014]"
          onClick={onConnect}
        >
          <Phone className="h-4 w-4" aria-hidden />
          通話を開始
        </Button>
      )}
    </div>
  );
}
