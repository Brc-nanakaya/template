import { answerExtractive } from "./answer";
import { getRagLlmProvider } from "./config";
import { loadMemoryCorpus } from "./db";
import { expandHopsFromGraph, retrieveHybrid } from "./retrieve";
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
  const retrieved = await expandHopsFromGraph(retrieveHybrid(q, corpus), corpus);
  const provider = getRagLlmProvider();

  if (provider === "bedrock") {
    const { answerWithBedrock } = await import("./bedrock");
    return answerWithBedrock(q, retrieved.hits);
  }

  if (provider === "openai" || process.env.OPENAI_API_KEY) {
    const { answerWithOpenAI } = await import("./openai");
    return answerWithOpenAI(q, retrieved.hits);
  }

  return answerExtractive(q, retrieved.hits);
}
