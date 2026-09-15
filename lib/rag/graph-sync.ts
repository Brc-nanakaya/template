import {
  loadMemoryCorpus,
  replaceReferencesForLaw,
  resolveCrossLawReferences,
} from "./db";
import { deleteOrdinanceGraph, rebuildGraphFromCorpus } from "./graph";
import { extractReferences } from "./parse";

/** 既存チャンクから参照を再抽出し、Postgres と Neo4j を揃える */
export async function refreshReferencesAndGraph(): Promise<{
  laws: number;
  references: number;
  synced: number;
}> {
  const corpus = await loadMemoryCorpus();
  const byLaw = new Map<string, typeof corpus.chunks>();
  for (const chunk of corpus.chunks) {
    const list = byLaw.get(chunk.lawId) ?? [];
    list.push(chunk);
    byLaw.set(chunk.lawId, list);
  }

  let references = 0;
  const payload: {
    lawId: string;
    title: string;
    chunks: typeof corpus.chunks;
    references: typeof corpus.references;
  }[] = [];

  for (const [lawId, chunks] of byLaw) {
    const refs = chunks.flatMap((c) => extractReferences(c, lawId));
    references += refs.length;
    await replaceReferencesForLaw(lawId, refs);
    payload.push({
      lawId,
      title: chunks[0]?.lawTitle ?? lawId,
      chunks,
      references: refs,
    });
  }
  await resolveCrossLawReferences();
  const synced = await rebuildGraphFromCorpus(payload);
  return { laws: payload.length, references, synced };
}

export async function removeLawFromGraph(lawId: string): Promise<void> {
  await deleteOrdinanceGraph(lawId);
}
