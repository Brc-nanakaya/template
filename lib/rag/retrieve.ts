import { inferLawIds, parseArticleMentions } from "./parse";
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

const STOP = new Set(["この", "こと", "ため", "について", "における", "および"]);

export function tokenize(text: string): string[] {
  return text
    .split(/[\s、。．，,.!！?？「」『』（）()【】・]/)
    .flatMap((part) => part.match(/[一-龯ァ-ヴーa-zA-Z0-9]{2,}/g) ?? [])
    .filter((t) => !STOP.has(t));
}

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
  const lawIds = inferLawIds(query);

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
