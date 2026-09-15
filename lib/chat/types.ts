import { z } from "zod";
import type { ChatMessage } from "@/lib/ai/chat";

/**
 * 保存される 1 メッセージ。API に送る ChatMessage に id / createdAt を足したもの。
 * 保存対象は user / assistant のみ（system プロンプトはサーバー側で付与する）。
 */
export const storedMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.number(),
});

export type StoredMessage = z.infer<typeof storedMessageSchema>;

/** 1 つの会話セッション（= 会話スレッド）。 */
export const chatSessionSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  messages: z.array(storedMessageSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ChatSession = z.infer<typeof chatSessionSchema>;

export const chatSessionArraySchema = z.array(chatSessionSchema);

/** 新規会話のデフォルトタイトル。 */
export const DEFAULT_SESSION_TITLE = "新しい会話";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 役割・本文から保存用メッセージを生成する。 */
export function createMessage(
  role: StoredMessage["role"],
  content: string,
): StoredMessage {
  return {
    id: generateId(),
    role,
    content,
    createdAt: Date.now(),
  };
}

/** 空の会話セッションを生成する。 */
export function createSession(): ChatSession {
  const now = Date.now();
  return {
    id: generateId(),
    title: DEFAULT_SESSION_TITLE,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** 最初のユーザー発話から会話タイトルを作る（長い場合は切り詰める）。 */
export function deriveTitle(messages: StoredMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return DEFAULT_SESSION_TITLE;
  const text = firstUser.content.trim().replace(/\s+/g, " ");
  return text.length > 30 ? `${text.slice(0, 30)}…` : text;
}

/** 保存用メッセージ配列を、API 送信用の ChatMessage 配列へ変換する。 */
export function toApiMessages(messages: StoredMessage[]): ChatMessage[] {
  return messages.map(({ role, content }) => ({ role, content }));
}
