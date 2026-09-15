import { DEMO_LAWS } from "@/lib/rag/demo-corpus";
import { evaluateCorpus } from "@/lib/rag/eval";
import { parseLawMarkdown } from "@/lib/rag/parse";

/**
 * DB なしで制度（チャンク・参照・棄権）を確認する。
 *   npm run rag:eval
 */
function loadMemoryCorpus() {
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

function main() {
  const report = evaluateCorpus(loadMemoryCorpus());
  for (const r of report.results) {
    const mark = r.passed ? "OK" : "NG";
    const extra = [
      ...r.missingChunkKeys.map((k) => `missing ${k}`),
      ...r.missingHopKeys.map((k) => `missing hop ${k}`),
      r.unexpectedAnswer ? "abstain mismatch" : "",
    ]
      .filter(Boolean)
      .join(", ");
    console.log(`${mark}  ${r.id}  ${r.question}${extra ? `  (${extra})` : ""}`);
  }
  console.log(
    report.passed
      ? `\n✅ 評価セット ${report.passedCount}/${report.total}`
      : `\n❌ 評価セット ${report.passedCount}/${report.total}`,
  );
  if (!report.passed) process.exit(1);
}

main();
