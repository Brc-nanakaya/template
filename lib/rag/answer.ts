import type { Citation, RagAnswer, RetrievalHit } from "./types";

function toCitation(hit: RetrievalHit): Citation {
  const quote =
    hit.chunk.body.length > 280
      ? `${hit.chunk.body.slice(0, 280)}…`
      : hit.chunk.body;
  return {
    chunkKey: hit.chunk.chunkKey,
    lawTitle: hit.chunk.lawTitle,
    article: hit.chunk.article,
    heading: hit.chunk.heading,
    quote,
    documentId: hit.chunk.documentId,
    fileName: hit.chunk.fileName,
    pageStart: hit.chunk.pageStart ?? null,
    fileUrl: hit.chunk.documentId
      ? `/api/rag/documents/${hit.chunk.documentId}/file${
          hit.chunk.pageStart ? `#page=${hit.chunk.pageStart}` : ""
        }`
      : undefined,
  };
}

function label(hit: RetrievalHit): string {
  const heading = hit.chunk.heading ? `（${hit.chunk.heading}）` : "";
  const page = hit.chunk.pageStart ? `（PDF p.${hit.chunk.pageStart}）` : "";
  return `${hit.chunk.lawTitle} 第${hit.chunk.article}条${heading}${page}`;
}

/**
 * 根拠があるときだけ答える。LLM を使わず引用を組み立てる（ローカル確認用）。
 */
export function answerExtractive(
  query: string,
  hits: RetrievalHit[],
): RagAnswer {
  const primary = hits.filter((h) => h.reason !== "hop");
  const hops = hits.filter((h) => h.reason === "hop");

  if (primary.length === 0) {
    return {
      answer:
        "根拠となる条文が見つかりませんでした。条番号または条例名を指定して再度質問してください。",
      abstained: true,
      citations: [],
      hops: [],
      provider: "extractive",
    };
  }

  const lines = [
    `「${query}」について、次の条文を根拠に回答します。`,
    "",
    ...primary.map((h) => `・${label(h)}: ${h.chunk.body}`),
  ];
  if (hops.length > 0) {
    lines.push("", "参照・準用により次の条文も関係します。");
    lines.push(...hops.map((h) => `・${label(h)}: ${h.chunk.body}`));
  }

  return {
    answer: lines.join("\n"),
    abstained: false,
    citations: [...primary, ...hops].map(toCitation),
    hops,
    provider: "extractive",
  };
}
