import { describe, it, expect } from "vitest";
import {
  DEFAULT_SESSION_TITLE,
  createMessage,
  createSession,
  deriveTitle,
  toApiMessages,
} from "@/lib/chat/types";

describe("createMessage", () => {
  it("id / createdAt を補完する", () => {
    const m = createMessage("user", "こんにちは");
    expect(m.role).toBe("user");
    expect(m.content).toBe("こんにちは");
    expect(m.id).toBeTruthy();
    expect(typeof m.createdAt).toBe("number");
  });
});

describe("createSession", () => {
  it("空のメッセージ配列と既定タイトルを持つ", () => {
    const s = createSession();
    expect(s.messages).toEqual([]);
    expect(s.title).toBe(DEFAULT_SESSION_TITLE);
    expect(s.id).toBeTruthy();
  });
});

describe("deriveTitle", () => {
  it("最初のユーザー発話をタイトルにする", () => {
    const messages = [
      createMessage("assistant", "system 的な前置き"),
      createMessage("user", "天気を教えて"),
    ];
    expect(deriveTitle(messages)).toBe("天気を教えて");
  });

  it("30 文字を超える場合は切り詰める", () => {
    const long = "あ".repeat(50);
    const title = deriveTitle([createMessage("user", long)]);
    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBe(31);
  });

  it("ユーザー発話がなければ既定タイトル", () => {
    expect(deriveTitle([])).toBe(DEFAULT_SESSION_TITLE);
  });
});

describe("toApiMessages", () => {
  it("id / createdAt を落として role と content だけにする", () => {
    const stored = [createMessage("user", "A"), createMessage("assistant", "B")];
    expect(toApiMessages(stored)).toEqual([
      { role: "user", content: "A" },
      { role: "assistant", content: "B" },
    ]);
  });
});
