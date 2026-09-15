import type { AiRunResult } from "./run";

/**
 * モック応答。API キーなし・E2E テスト・オフライン研修でも
 * 実際の実行結果と同じ形のレスポンスを確認できるようにする。
 */

export function mockAgentResult(message: string): AiRunResult {
  return {
    reply: `（モック応答）「${message}」について、calculate ツールの結果 42 を踏まえて回答しました。`,
    steps: [
      {
        author: "assistant_agent",
        functionCalls: [
          { name: "calculate", args: { a: 6, b: 7, operator: "*" } },
        ],
      },
      {
        author: "assistant_agent",
        functionResponses: [{ name: "calculate", response: { result: 42 } }],
      },
      {
        author: "assistant_agent",
        text: `（モック応答）「${message}」について、calculate ツールの結果 42 を踏まえて回答しました。`,
      },
    ],
  };
}

export function mockWorkflowResult(input: string): AiRunResult {
  const summary = `（モック要約）${input.slice(0, 30)}... を 3 行にまとめた要約です。`;
  const translation = "(Mock translation) This is an English translation of the summary.";
  const titles = "- （モック）タイトル案 1\n- （モック）タイトル案 2\n- （モック）タイトル案 3";
  return {
    reply: titles,
    steps: [
      { author: "summarizer", text: summary },
      { author: "translator", text: translation },
      { author: "title_writer", text: titles },
    ],
  };
}
