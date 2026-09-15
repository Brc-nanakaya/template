/** 画面に表示する 1 発話 */
export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** ストリーミング中かどうか */
  partial?: boolean;
}

type RealtimeEvent = {
  type?: string;
  transcript?: string;
  delta?: string;
  item_id?: string;
  response_id?: string;
  item?: {
    id?: string;
    role?: string;
    content?: Array<{ type?: string; transcript?: string; text?: string }>;
  };
};

function idFrom(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(":") || `t-${Date.now()}-${Math.random()}`;
}

/**
 * Realtime data channel イベントから transcript 更新を導出する。
 * API のイベント名ゆれに備え、複数パターンを受け入れる。
 */
export function applyRealtimeEventToTranscripts(
  prev: TranscriptEntry[],
  raw: unknown,
): TranscriptEntry[] {
  if (!raw || typeof raw !== "object") return prev;
  const event = raw as RealtimeEvent;
  const type = event.type ?? "";

  // ユーザー発話の文字起こし完了
  if (
    type === "conversation.item.input_audio_transcription.completed" ||
    type === "conversation.item.audio_transcription.completed"
  ) {
    const text = (event.transcript ?? "").trim();
    if (!text) return prev;
    const entry: TranscriptEntry = {
      id: idFrom(["user", event.item_id, String(prev.length)]),
      role: "user",
      text,
    };
    return [...prev, entry];
  }

  // アシスタント音声の文字起こし（差分）
  if (
    type === "response.output_audio_transcript.delta" ||
    type === "response.audio_transcript.delta"
  ) {
    const delta = event.delta ?? "";
    if (!delta) return prev;
    const key = idFrom(["assistant", event.response_id ?? "current"]);
    const existing = prev.find((t) => t.id === key && t.partial);
    if (existing) {
      return prev.map((t) =>
        t.id === key ? { ...t, text: t.text + delta, partial: true } : t,
      );
    }
    return [
      ...prev,
      { id: key, role: "assistant", text: delta, partial: true },
    ];
  }

  // アシスタント音声の文字起こし完了
  if (
    type === "response.output_audio_transcript.done" ||
    type === "response.audio_transcript.done"
  ) {
    const key = idFrom(["assistant", event.response_id ?? "current"]);
    const finalText = (event.transcript ?? "").trim();
    return prev.map((t) => {
      if (t.id !== key) return t;
      return {
        ...t,
        text: finalText || t.text,
        partial: false,
      };
    });
  }

  // テキスト応答の差分（フォールバック）
  if (type === "response.text.delta" || type === "response.output_text.delta") {
    const delta = event.delta ?? "";
    if (!delta) return prev;
    const key = idFrom(["assistant-text", event.response_id ?? "current"]);
    const existing = prev.find((t) => t.id === key && t.partial);
    if (existing) {
      return prev.map((t) =>
        t.id === key ? { ...t, text: t.text + delta, partial: true } : t,
      );
    }
    return [
      ...prev,
      { id: key, role: "assistant", text: delta, partial: true },
    ];
  }

  if (type === "response.text.done" || type === "response.output_text.done") {
    const key = idFrom(["assistant-text", event.response_id ?? "current"]);
    return prev.map((t) => (t.id === key ? { ...t, partial: false } : t));
  }

  return prev;
}

/** data channel 経由でユーザーテキストを送るイベントを組み立てる */
export function buildUserTextEvents(text: string): object[] {
  return [
    {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    },
    { type: "response.create" },
  ];
}
