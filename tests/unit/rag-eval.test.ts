import { describe, expect, it } from "vitest";
import { DEMO_LAWS } from "@/lib/rag/demo-corpus";
import { evaluateCorpus } from "@/lib/rag/eval";
import { parseLawMarkdown } from "@/lib/rag/parse";
import { retrieveFromMemory } from "@/lib/rag/retrieve";
import { answerExtractive } from "@/lib/rag/answer";

function demoCorpus() {
  const chunks = [];
  const references = [];
  for (const law of DEMO_LAWS) {
    const parsed = parseLawMarkdown({
      lawId: law.lawId,
      title: law.title,
      markdown: law.body,
    });
    chunks.push(...parsed.chunks);
    references.push(...parsed.references);
  }
  return { chunks, references };
}

describe("法令 RAG の制度確認", () => {
  const corpus = demoCorpus();

  it("評価セットがすべて通る", () => {
    const report = evaluateCorpus(corpus);
    expect(report.passed, JSON.stringify(report.results, null, 2)).toBe(true);
  });

  it("未知の質問は棄権する", () => {
    const hits = retrieveFromMemory("宇宙旅行の許可条件は何年ですか？", corpus).hits;
    const answer = answerExtractive("宇宙旅行の許可条件は何年ですか？", hits);
    expect(answer.abstained).toBe(true);
    expect(answer.citations).toHaveLength(0);
  });

  it("規程を跨ぐ準用を 1 hop する", () => {
    const hits = retrieveFromMemory("機密情報の保存期間は？", corpus).hits;
    expect(hits.some((h) => h.chunk.chunkKey === "demo-info-policy:3")).toBe(true);
    expect(
      hits.some(
        (h) => h.reason === "hop" && h.chunk.chunkKey === "demo-internal-control:6",
      ),
    ).toBe(true);
  });
});
