"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyRealtimeEventToTranscripts,
  buildUserTextEvents,
  type TranscriptEntry,
} from "@/lib/realtime/events";
import {
  connectHealthVoice,
  type HealthVoiceConnection,
} from "@/lib/realtime/webrtc";

export type VoiceSessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error";

export interface UseHealthVoiceSessionResult {
  status: VoiceSessionStatus;
  error: string | null;
  configured: boolean | null;
  transcripts: TranscriptEntry[];
  connect: () => Promise<void>;
  disconnect: () => void;
  sendText: (text: string) => void;
  clearTranscripts: () => void;
}

export function useHealthVoiceSession(): UseHealthVoiceSessionResult {
  const [status, setStatus] = useState<VoiceSessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const connectionRef = useRef<HealthVoiceConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/realtime/session");
        const body = (await res.json()) as { configured?: boolean };
        if (!cancelled) setConfigured(Boolean(body.configured));
      } catch {
        if (!cancelled) setConfigured(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const disconnect = useCallback(() => {
    connectionRef.current?.close();
    connectionRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      connectionRef.current?.close();
      connectionRef.current = null;
    };
  }, []);

  const connect = useCallback(async () => {
    if (status === "connecting" || status === "connected") return;
    setError(null);
    setTranscripts([]);

    if (configured === false) {
      setStatus("error");
      setError(
        "OPENAI_API_KEY が未設定です。.env.local に設定してサーバーを再起動してください。",
      );
      return;
    }

    setStatus("connecting");

    try {
      const connection = await connectHealthVoice({
        onEvent: (event) => {
          setTranscripts((prev) =>
            applyRealtimeEventToTranscripts(prev, event),
          );
          const type =
            event && typeof event === "object"
              ? (event as { type?: string }).type
              : undefined;
          if (type === "error") {
            const message =
              (event as { error?: { message?: string } }).error?.message ||
              "Realtime エラーが発生しました";
            setError(message);
          }
        },
        onConnectionStateChange: (state) => {
          if (state === "failed" || state === "disconnected") {
            connectionRef.current?.close();
            connectionRef.current = null;
            setStatus((prev) => (prev === "connecting" ? "error" : "idle"));
            if (state === "failed") {
              setError("WebRTC 接続に失敗しました");
            }
          } else if (state === "connected") {
            setStatus("connected");
          }
        },
      });

      connectionRef.current = connection;
      // data channel / ICE 完了前でも通話開始扱いにする（音声は ontrack で流れる）
      setStatus("connected");
      setConfigured(true);
    } catch (e) {
      connectionRef.current = null;
      setStatus("error");
      setError(
        e instanceof Error ? e.message : "接続に失敗しました",
      );
    }
  }, [status, configured]);

  const sendText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !connectionRef.current) return;
    setTranscripts((prev) => [
      ...prev,
      {
        id: `user-text-${Date.now()}`,
        role: "user",
        text: trimmed,
      },
    ]);
    for (const event of buildUserTextEvents(trimmed)) {
      connectionRef.current.sendEvent(event);
    }
  }, []);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
  }, []);

  return {
    status,
    error,
    configured,
    transcripts,
    connect,
    disconnect,
    sendText,
    clearTranscripts,
  };
}
