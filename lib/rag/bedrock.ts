import { answerExtractive } from "./answer";
import { getAwsRegion, getBedrockModelId } from "./config";
import type { RagAnswer, RetrievalHit } from "./types";

/**
 * 本番 / デモ用。キーが無い・呼べないときは抽出型に落とす。
 * ローカルの制度確認は extractive のまま行う。
 */
export async function answerWithBedrock(
  query: string,
  hits: RetrievalHit[],
): Promise<RagAnswer> {
  const fallback = answerExtractive(query, hits);
  if (fallback.abstained || hits.length === 0) return fallback;

  try {
    const { BedrockRuntimeClient, ConverseCommand } = await import(
      "@aws-sdk/client-bedrock-runtime"
    );
    const client = new BedrockRuntimeClient({ region: getAwsRegion() });
    const context = hits
      .map(
        (h) =>
          `[${h.chunk.chunkKey}] ${h.chunk.lawTitle} 第${h.chunk.article}条\n${h.chunk.body}`,
      )
      .join("\n\n");

    const res = await client.send(
      new ConverseCommand({
        modelId: getBedrockModelId(),
        messages: [
          {
            role: "user",
            content: [
              {
                text: [
                  "あなたは法令担当の補助です。与えた条文だけを根拠に答えてください。",
                  "根拠が足りなければ「分からない」と答えてください。条番号を必ず書いてください。",
                  "",
                  `質問: ${query}`,
                  "",
                  "条文:",
                  context,
                ].join("\n"),
              },
            ],
          },
        ],
      }),
    );

    const text =
      res.output?.message?.content
        ?.map((c) => ("text" in c ? c.text : ""))
        .join("")
        .trim() || fallback.answer;

    return { ...fallback, answer: text, provider: "bedrock" };
  } catch {
    return fallback;
  }
}
