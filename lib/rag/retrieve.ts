import { cosineSimilarity, embedLocal } from "./embed";
import { hopChunkKeys } from "./graph";
import { inferLawIds, parseArticleMentions } from "./parse";
import { tokenize } from "./tokens";
import type {
  RagChunk,
  RagReference,
  RetrievalHit,
  RetrievalResult,
} from "./types";

export interface MemoryCorpus {
  chunks: RagChunk[];
  references: RagReference[];
}

export { tokenize } from "./tokens";

function tokenHits(qToken: string, bodyTokens: string[], body: string): boolean {
  if (body.includes(qToken) || bodyTokens.includes(qToken)) return true;
  return bodyTokens.some(
    (b) =>
      (qToken.length >= 2 && b.includes(qToken)) ||
      (b.length >= 2 && qToken.includes(b)),
  );
}

function scoreKeyword(query: string, chunk: RagChunk): number {
  const q = [...new Set(tokenize(query))];
  if (q.length === 0) return 0;
  const body = `${chunk.heading ?? ""} ${chunk.body} ${chunk.lawTitle}`;
  const tokens = tokenize(body);
  let hit = 0;
  for (const t of q) {
    if (tokenHits(t, tokens, body)) hit += 1;
  }
  return hit / q.length;
}

/**
 * exact（条番号）→ キーワード → 参照 1 hop。
 * 埋め込みは使わない（ローカルで制度確認できる検索）。
 */
export function retrieveFromMemory(
  query: string,
  corpus: MemoryCorpus,
): RetrievalResult {
  const hits = new Map<string, RetrievalHit>();
  const articles = parseArticleMentions(query);
  const lawIds = inferLawIds(
    query,
    corpus.chunks.map((c) => ({ lawId: c.lawId, title: c.lawTitle })),
  );

  const candidates = corpus.chunks.filter((c) =>
    lawIds.length === 0 ? true : lawIds.includes(c.lawId),
  );

  for (const chunk of candidates) {
    if (articles.includes(chunk.article)) {
      hits.set(chunk.chunkKey, { chunk, reason: "exact", score: 1 });
    }
  }

  if (hits.size === 0) {
    const ranked = candidates
      .map((chunk) => ({ chunk, score: scoreKeyword(query, chunk) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    for (const { chunk, score } of ranked) {
      hits.set(chunk.chunkKey, { chunk, reason: "keyword", score });
    }
  }

  const seedKeys = [...hits.keys()];
  for (const key of seedKeys) {
    const outgoing = corpus.references.filter((r) => r.fromChunkKey === key);
    for (const ref of outgoing) {
      const target = corpus.chunks.find(
        (c) =>
          c.chunkKey === ref.toChunkKey ||
          (c.lawId === ref.toLawId && c.article === ref.toArticle),
      );
      if (!target || hits.has(target.chunkKey)) continue;
      hits.set(target.chunkKey, {
        chunk: target,
        reason: "hop",
        score: 0.8,
        viaChunkKey: key,
      });
    }
  }

  return {
    query,
    hits: [...hits.values()].sort((a, b) => b.score - a.score),
  };
}

const VECTOR_MIN = 0.55;

/**
 * exact + キーワード + ベクトルを合成し、参照グラフを 1 hop する。
 */
export function retrieveHybrid(
  query: string,
  corpus: MemoryCorpus,
): RetrievalResult {
  const base = retrieveFromMemory(query, corpus);
  const hits = new Map(base.hits.map((h) => [h.chunk.chunkKey, h]));
  const queryVec = embedLocal(query);

  const ranked = corpus.chunks
    .filter((c) => c.embedding && c.embedding.length > 0)
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryVec, chunk.embedding ?? []),
    }))
    .filter((x) => x.score >= VECTOR_MIN)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  for (const { chunk, score } of ranked) {
    const existing = hits.get(chunk.chunkKey);
    if (!existing) {
      hits.set(chunk.chunkKey, { chunk, reason: "vector", score });
      continue;
    }
    hits.set(chunk.chunkKey, {
      ...existing,
      reason: existing.reason === "hop" ? existing.reason : "hybrid",
      score: Math.max(existing.score, score),
    });
  }

  const seedKeys = [...hits.keys()];
  for (const key of seedKeys) {
    const outgoing = corpus.references.filter((r) => r.fromChunkKey === key);
    for (const ref of outgoing) {
      const target = corpus.chunks.find(
        (c) =>
          c.chunkKey === ref.toChunkKey ||
          (c.lawId === ref.toLawId && c.article === ref.toArticle),
      );
      if (!target || hits.has(target.chunkKey)) continue;
      hits.set(target.chunkKey, {
        chunk: target,
        reason: "hop",
        score: 0.8,
        viaChunkKey: key,
      });
    }
  }

  return {
    query,
    hits: [...hits.values()].sort((a, b) => b.score - a.score),
  };
}

/** Neo4j が生きていれば参照辺で 1 hop を足す。落ちていれば Postgres 側の hop のまま。 */
export async function expandHopsFromGraph(
  result: RetrievalResult,
  corpus: MemoryCorpus,
): Promise<RetrievalResult> {
  const hops = await hopChunkKeys(result.hits.map((h) => h.chunk.chunkKey));
  if (hops.length === 0) return result;

  const hits = new Map(result.hits.map((h) => [h.chunk.chunkKey, h]));
  for (const hop of hops) {
    if (hits.has(hop.to)) continue;
    const target = corpus.chunks.find((c) => c.chunkKey === hop.to);
    if (!target) continue;
    hits.set(hop.to, {
      chunk: target,
      reason: "hop",
      score: 0.8,
      viaChunkKey: hop.from,
    });
  }

  return {
    query: result.query,
    hits: [...hits.values()].sort((a, b) => b.score - a.score),
  };
}
