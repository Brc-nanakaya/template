import { closeDb } from "@/lib/db";
import "@/lib/db/env";
import { getGraphStats } from "@/lib/rag/graph";
import { refreshReferencesAndGraph } from "@/lib/rag/graph-sync";

/**
 * 既存チャンクから参照を再抽出し、Postgres と Neo4j を揃える。
 *   npm run rag:graph-sync
 */
async function main() {
  const result = await refreshReferencesAndGraph();
  const graph = await getGraphStats();
  console.log(
    `📜 laws=${result.laws} refs=${result.references} neo4jSynced=${result.synced}`,
  );
  console.log(
    graph.reachable
      ? `🕸  Neo4j ${graph.uri}  ordinances=${graph.ordinances} articles=${graph.articles} edges=${graph.edges}`
      : `⚠ Neo4j 未接続 (${graph.uri || "URI なし"}). npm run graph:up のあと再実行してください`,
  );
  for (const edge of graph.sample) {
    console.log(`   ${edge.from} -[${edge.type}]-> ${edge.to}  ${edge.rawText}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ グラフ同期失敗\n", e);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
