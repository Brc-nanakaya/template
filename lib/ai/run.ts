import {
  type BaseAgent,
  getFunctionCalls,
  getFunctionResponses,
  InMemoryRunner,
  isFinalResponse,
  stringifyContent,
} from "@google/adk";

/** エージェント実行中の 1 イベントを UI 表示用に単純化したもの。 */
export interface AiStep {
  /** イベントを発生させたエージェント名（"user" or agent name） */
  author: string;
  /** テキスト出力（あれば） */
  text?: string;
  /** LLM が要求したツール呼び出し */
  functionCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  /** ツールの実行結果 */
  functionResponses?: Array<{ name: string; response: unknown }>;
}

export interface AiRunResult {
  /** 最終応答テキスト */
  reply: string;
  /** 実行トレース（ツール呼び出しや中間ステップ） */
  steps: AiStep[];
}

/**
 * ADK エージェント（単体 / ワークフロー）を実行し、
 * イベントストリームを UI 表示しやすい形に集約する。
 */
export async function runAdkAgent(
  agent: BaseAgent,
  message: string,
): Promise<AiRunResult> {
  const runner = new InMemoryRunner({ agent, appName: "training-template" });
  const steps: AiStep[] = [];
  let reply = "";

  for await (const event of runner.runEphemeral({
    userId: "demo-user",
    newMessage: { role: "user", parts: [{ text: message }] },
  })) {
    const text = stringifyContent(event);
    const functionCalls = getFunctionCalls(event).map((fc) => ({
      name: fc.name ?? "unknown",
      args: (fc.args ?? {}) as Record<string, unknown>,
    }));
    const functionResponses = getFunctionResponses(event).map((fr) => ({
      name: fr.name ?? "unknown",
      response: fr.response,
    }));

    if (text || functionCalls.length > 0 || functionResponses.length > 0) {
      steps.push({
        author: event.author ?? "unknown",
        text: text || undefined,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        functionResponses:
          functionResponses.length > 0 ? functionResponses : undefined,
      });
    }

    // SequentialAgent では各サブエージェントが final response を返すため、
    // 最後のものが全体の最終応答になる
    if (isFinalResponse(event) && text) {
      reply = text;
    }
  }

  return { reply, steps };
}

/**
 * モックモード判定。
 * API キー未設定でも UI を試せるよう、その場合もモックにフォールバックする。
 */
export function isMockMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_MOCK_LLM === "true" || !process.env.GOOGLE_API_KEY
  );
}
