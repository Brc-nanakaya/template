import { describe, it, expect, beforeEach } from "vitest";
import {
  CHAT_STORAGE_KEY,
  loadSessions,
  saveSessions,
} from "@/lib/chat/storage";
import { createMessage, createSession } from "@/lib/chat/types";

describe("chat storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("未保存時は空配列を返す", () => {
    expect(loadSessions()).toEqual([]);
  });

  it("save → load で会話セッションを往復できる", () => {
    const session = {
      ...createSession(),
      messages: [createMessage("user", "やあ"), createMessage("assistant", "こんにちは")],
    };
    saveSessions([session]);
    const loaded = loadSessions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].messages).toHaveLength(2);
    expect(loaded[0].messages[0].content).toBe("やあ");
  });

  it("不正な JSON は空配列にフォールバックする", () => {
    window.localStorage.setItem(CHAT_STORAGE_KEY, "{ broken");
    expect(loadSessions()).toEqual([]);
  });

  it("スキーマ不一致のデータは空配列にフォールバックする", () => {
    window.localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify([{ foo: "bar" }]),
    );
    expect(loadSessions()).toEqual([]);
  });
});
