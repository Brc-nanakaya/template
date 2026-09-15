import OpenAI from "openai";

/** チャットの 1 メッセージ。role はクライアントから送る発話者の種別。 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 使用する OpenAI モデル。環境変数で差し替え可能。 */
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

/** システムプロンプト（チャットボットの人格・方針）。 */
const SYSTEM_PROMPT =
  "あなたは丁寧でわかりやすい日本語で回答するアシスタントです。簡潔に、必要なら箇条書きで答えてください。";

/**
 * モックモード判定。
 * OPENAI_API_KEY が設定されていれば自動で実際の OpenAI 応答を使う。
 * キー未設定のときだけモック応答にフォールバックする（UI を試せるように）。
 */
export function isChatMockMode(): boolean {
  return !process.env.OPENAI_API_KEY;
}

/** モック応答。直近のユーザー発話をそのまま echo する単純な実装。 */
export function mockChatReply(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return `（モック応答）「${lastUser?.content ?? ""}」を受け取りました。OPENAI_API_KEY を設定すると自動で実際の OpenAI 応答に切り替わります。`;
}

/**
 * OpenAI Chat Completions API を呼び出して応答テキストを返す。
 * API キーを使うため、必ずサーバー側（Route Handler）から呼ぶこと。
 */
export async function runChat(messages: ChatMessage[]): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
  });

  return completion.choices[0]?.message?.content ?? "";
}
