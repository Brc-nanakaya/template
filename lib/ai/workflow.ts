import { LlmAgent, SequentialAgent } from "@google/adk";
import { GEMINI_MODEL } from "./agent";

/**
 * AI ワークフローのサンプル（Google ADK の SequentialAgent）。
 *
 * エージェントと違い、処理の流れをコードで固定するのがワークフローの特徴。
 * ここでは「要約 → 英訳 → タイトル案」の 3 ステップを順番に実行する。
 *
 * 各ステップの出力は outputKey でセッション state に保存され、
 * 後続ステップの instruction 内で {summary} のように参照できる。
 */
export function createTextPipelineWorkflow(): SequentialAgent {
  const summarizer = new LlmAgent({
    name: "summarizer",
    description: "入力された文章を要約する",
    model: GEMINI_MODEL,
    instruction:
      "ユーザーから渡された文章を、日本語で 3 行以内に要約してください。要約のみを出力すること。",
    outputKey: "summary",
  });

  const translator = new LlmAgent({
    name: "translator",
    description: "要約を英訳する",
    model: GEMINI_MODEL,
    includeContents: "none",
    instruction: `次の日本語の要約を自然な英語に翻訳してください。翻訳のみを出力すること。

要約:
{summary}`,
    outputKey: "translation",
  });

  const titleWriter = new LlmAgent({
    name: "title_writer",
    description: "要約と英訳からタイトル案を作る",
    model: GEMINI_MODEL,
    includeContents: "none",
    instruction: `次の要約と英訳をもとに、記事タイトル案を日本語で 3 つ、箇条書きで出力してください。

要約:
{summary}

英訳:
{translation}`,
    outputKey: "titles",
  });

  return new SequentialAgent({
    name: "text_pipeline",
    description: "要約 → 英訳 → タイトル案を順に実行するワークフロー",
    subAgents: [summarizer, translator, titleWriter],
  });
}
