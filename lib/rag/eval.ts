import { answerExtractive } from "./answer";
import { RAG_EVAL_CASES } from "./eval-cases";
import { retrieveFromMemory, type MemoryCorpus } from "./retrieve";
import type { RagEvalCaseResult, RagEvalReport } from "./types";

export function evaluateCorpus(
  corpus: MemoryCorpus,
  cases = RAG_EVAL_CASES,
): RagEvalReport {
  const results: RagEvalCaseResult[] = cases.map((c) => {
    const retrieved = retrieveFromMemory(c.question, corpus);
    const keys = new Set(retrieved.hits.map((h) => h.chunk.chunkKey));
    const hopKeys = new Set(
      retrieved.hits.filter((h) => h.reason === "hop").map((h) => h.chunk.chunkKey),
    );
    const answer = answerExtractive(c.question, retrieved.hits);

    const missingChunkKeys = (c.expectedChunkKeys ?? []).filter((k) => !keys.has(k));
    const missingHopKeys = (c.expectedHopKeys ?? []).filter((k) => !hopKeys.has(k));
    const unexpectedAnswer = Boolean(c.abstain) !== answer.abstained;

    return {
      id: c.id,
      question: c.question,
      passed:
        missingChunkKeys.length === 0 &&
        missingHopKeys.length === 0 &&
        !unexpectedAnswer,
      missingChunkKeys,
      missingHopKeys,
      unexpectedAnswer,
    };
  });

  const passedCount = results.filter((r) => r.passed).length;
  return {
    passed: passedCount === results.length,
    total: results.length,
    passedCount,
    results,
  };
}
