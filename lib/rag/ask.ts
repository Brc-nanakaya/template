import { answerExtractive } from "./answer";
import { getRagLlmProvider } from "./config";
import { loadMemoryCorpus } from "./db";
import { retrieveFromMemory } from "./retrieve";
import type { RagAnswer } from "./types";

export async function askRag(question: string): Promise<RagAnswer> {
  const q = question.trim();
  if (!q) {
    return {
      answer: "質問を入力してください。",
      abstained: true,
      citations: [],
      hops: [],
      provider: "extractive",
    };
  }

  const corpus = await loadMemoryCorpus();
  const retrieved = retrieveFromMemory(q, corpus);

  if (getRagLlmProvider() === "bedrock") {
    const { answerWithBedrock } = await import("./bedrock");
    return answerWithBedrock(q, retrieved.hits);
  }

  return answerExtractive(q, retrieved.hits);
}
