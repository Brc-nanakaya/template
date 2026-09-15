import OpenAI from "openai";
import { OPENAI_MODEL } from "@/lib/ai/chat";
import { answerExtractive } from "./answer";
import type { RagAnswer, RetrievalHit } from "./types";

export async function answerWithOpenAI(
  query: string,
  hits: RetrievalHit[],
): Promise<RagAnswer> {
  const fallback = answerExtractive(query, hits);
  if (fallback.abstained || !process.env.OPENAI_API_KEY) return fallback;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const context = hits
    .map((h) => {
      const page = h.chunk.pageStart ? ` p.${h.chunk.pageStart}` : "";
      return `[${h.chunk.chunkKey}${page}] ${h.chunk.lawTitle} 第${h.chunk.article}条\n${h.chunk.body}`;
    })
    .join("\n\n");

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "あなたは区の条例に詳しい補助です。与えた条文だけを根拠に、日本語で簡潔に答えてください。条番号を必ず書いてください。根拠が足りなければ分からないと答えてください。",
      },
      {
        role: "user",
        content: `質問: ${query}\n\n条文:\n${context}`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim() || fallback.answer;
  return { ...fallback, answer: text, provider: "openai" };
}
