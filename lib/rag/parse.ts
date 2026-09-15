import { LAW_ALIASES } from "./demo-corpus";
import type { RagChunk, RagReference, RagReferenceKind } from "./types";

export interface ParsedLaw {
  lawId: string;
  title: string;
  chunks: RagChunk[];
  references: RagReference[];
}

const HEADING_RE = /^第(\d+)条(?:（([^）]+)）)?\s*$/;
const REF_RE =
  /(?:(デモ内部統制規程|デモ情報管理規程|内部統制規程|情報管理規程))?第(\d+)条(?:の規定)?を(準用|参照)/g;

/**
 * Markdown の条文を条単位のチャンクと参照辺に分解する。
 * 項が明示されていない規程は 1 条 = 1 チャンクにする。
 */
export function parseLawMarkdown(input: {
  lawId: string;
  title: string;
  markdown: string;
}): ParsedLaw {
  const chunks: RagChunk[] = [];
  const lines = input.markdown.replace(/\r\n/g, "\n").split("\n");
  let current: { article: number; heading: string | null; body: string[] } | null =
    null;

  const flush = () => {
    if (!current) return;
    const body = current.body.join("\n").trim();
    if (!body) {
      current = null;
      return;
    }
    chunks.push({
      chunkKey: `${input.lawId}:${current.article}`,
      lawId: input.lawId,
      lawTitle: input.title,
      article: current.article,
      paragraph: null,
      heading: current.heading,
      body,
    });
    current = null;
  };

  for (const line of lines) {
    const heading = line.match(HEADING_RE);
    if (heading) {
      flush();
      current = {
        article: Number(heading[1]),
        heading: heading[2]?.trim() || null,
        body: [],
      };
      continue;
    }
    if (current) current.body.push(line);
  }
  flush();

  const references = chunks.flatMap((chunk) =>
    extractReferences(chunk, input.lawId),
  );

  return {
    lawId: input.lawId,
    title: input.title,
    chunks,
    references,
  };
}

export function extractReferences(
  chunk: RagChunk,
  defaultLawId: string,
): RagReference[] {
  const refs: RagReference[] = [];
  const body = chunk.body;
  REF_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REF_RE.exec(body))) {
    const lawHint = match[1];
    const toArticle = Number(match[2]);
    const kind: RagReferenceKind = match[3] === "準用" ? "applies" : "refers";
    const toLawId = resolveLawId(lawHint, defaultLawId);
    refs.push({
      fromChunkKey: chunk.chunkKey,
      toLawId,
      toArticle,
      toChunkKey: `${toLawId}:${toArticle}`,
      kind,
      rawText: match[0],
    });
  }
  return refs;
}

export function resolveLawId(
  hint: string | undefined,
  fallbackLawId: string,
): string {
  if (!hint) return fallbackLawId;
  for (const [lawId, aliases] of Object.entries(LAW_ALIASES)) {
    if (aliases.some((a) => hint.includes(a) || a.includes(hint))) {
      return lawId;
    }
  }
  return fallbackLawId;
}

export function parseArticleMentions(query: string): number[] {
  const articles = new Set<number>();
  for (const m of query.matchAll(/第\s*(\d+)\s*条/g)) {
    articles.add(Number(m[1]));
  }
  return [...articles];
}

export function inferLawIds(query: string): string[] {
  const hits: string[] = [];
  for (const [lawId, aliases] of Object.entries(LAW_ALIASES)) {
    if (aliases.some((a) => query.includes(a))) hits.push(lawId);
  }
  return hits;
}
