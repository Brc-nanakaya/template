import { LlmAgent } from "@google/adk";
import { calculatorTool, getCurrentTimeTool } from "./tools";

/** 使用するモデル。環境変数で差し替え可能。 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

/**
 * AI エージェントのサンプル（Google ADK の LlmAgent）。
 *
 * LLM 自身が「どのツールをいつ呼ぶか」を判断するのがエージェントの特徴。
 * ここでは日時取得と計算の 2 つのツールを持たせている。
 *
 * NOTE: ADK のエージェントはエージェントツリーに 1 度しか登録できないため、
 * リクエストごとにファクトリ関数で新しいインスタンスを生成する。
 */
export function createAssistantAgent(): LlmAgent {
  return new LlmAgent({
    name: "assistant_agent",
    description: "ツールを使ってユーザーの質問に答えるアシスタント",
    model: GEMINI_MODEL,
    instruction: `あなたは丁寧な日本語で回答するアシスタントです。
- 日時を聞かれたら get_current_time ツールを使うこと
- 計算が必要なら calculate ツールを使うこと（暗算しない）
- ツールの結果を踏まえて、簡潔に回答すること`,
    tools: [getCurrentTimeTool, calculatorTool],
  });
}
