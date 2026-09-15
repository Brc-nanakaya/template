import { closeDb } from "@/lib/db";
import "@/lib/db/env";
import { ingestDemoCorpus } from "@/lib/rag/ingest";

/**
 * デモ条文をストレージと Postgres に取り込む。
 *   npm run rag:ingest
 *   npm run rag:ingest -- --force
 */
async function main() {
  const force = process.argv.includes("--force");
  const results = await ingestDemoCorpus({ force });
  for (const r of results) {
    console.log(
      `📜 ${r.title}  chunks=${r.chunkCount} refs=${r.referenceCount}  ${r.objectKey}`,
    );
  }
  console.log("✅ RAG 取込完了");
}

main()
  .catch((e) => {
    console.error("❌ RAG 取込失敗\n", e);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
