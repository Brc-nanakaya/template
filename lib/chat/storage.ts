import { ChatSession, chatSessionArraySchema } from "./types";

/** localStorage の保存キー。 */
export const CHAT_STORAGE_KEY = "training-chat-sessions";

/**
 * localStorage から会話セッション一覧を読み込む。
 * SSR (window 不在)・未保存・JSON 破損・スキーマ不一致のいずれでも空配列を返す。
 */
export function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = chatSessionArraySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** 会話セッション一覧を localStorage に保存する。SSR 時・容量超過時は黙って無視する。 */
export function saveSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    /* quota などのエラーは無視 */
  }
}
