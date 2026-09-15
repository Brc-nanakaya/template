"use client";

import type { TranscriptEntry } from "@/lib/realtime/events";

interface TranscriptListProps {
  transcripts: TranscriptEntry[];
}

export function TranscriptList({ transcripts }: TranscriptListProps) {
  if (transcripts.length === 0) {
    return (
      <p
        data-testid="transcript-empty"
        className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground"
      >
        会話を開始すると、ここに文字起こしが表示されます
      </p>
    );
  }

  return (
    <ul className="space-y-3" data-testid="transcript-list">
      {transcripts.map((entry) => {
        const isUser = entry.role === "user";
        return (
          <li
            key={entry.id}
            data-testid={`transcript-${entry.role}`}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                isUser
                  ? "bg-[#bc0017] text-white"
                  : "bg-[#f5f5f5] text-[#050505]"
              }`}
            >
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                {isUser ? "あなた" : "アシスタント"}
                {entry.partial ? " · 入力中" : ""}
              </p>
              <p className="whitespace-pre-wrap">{entry.text}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
