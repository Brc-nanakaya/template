import { describe, it, expect } from "vitest";
import {
  applyRealtimeEventToTranscripts,
  buildUserTextEvents,
  type TranscriptEntry,
} from "@/lib/realtime/events";

describe("applyRealtimeEventToTranscripts", () => {
  it("ユーザー文字起こし完了を追加する", () => {
    const next = applyRealtimeEventToTranscripts([], {
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "item1",
      transcript: "  眠れていません  ",
    });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      role: "user",
      text: "眠れていません",
    });
  });

  it("アシスタント transcript の delta を蓄積し done で確定する", () => {
    let entries: TranscriptEntry[] = [];
    entries = applyRealtimeEventToTranscripts(entries, {
      type: "response.output_audio_transcript.delta",
      response_id: "r1",
      delta: "睡眠は",
    });
    entries = applyRealtimeEventToTranscripts(entries, {
      type: "response.output_audio_transcript.delta",
      response_id: "r1",
      delta: "大切です",
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.text).toBe("睡眠は大切です");
    expect(entries[0]?.partial).toBe(true);

    entries = applyRealtimeEventToTranscripts(entries, {
      type: "response.output_audio_transcript.done",
      response_id: "r1",
      transcript: "睡眠は大切です。",
    });
    expect(entries[0]?.text).toBe("睡眠は大切です。");
    expect(entries[0]?.partial).toBe(false);
  });

  it("無関係なイベントは無視する", () => {
    const prev: TranscriptEntry[] = [
      { id: "1", role: "user", text: "hi" },
    ];
    const next = applyRealtimeEventToTranscripts(prev, {
      type: "session.created",
    });
    expect(next).toBe(prev);
  });
});

describe("buildUserTextEvents", () => {
  it("conversation.item.create と response.create を返す", () => {
    const events = buildUserTextEvents("水分を摂りたい");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: "conversation.item.create",
      item: {
        role: "user",
        content: [{ type: "input_text", text: "水分を摂りたい" }],
      },
    });
    expect(events[1]).toEqual({ type: "response.create" });
  });
});
