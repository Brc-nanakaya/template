import { LAW_ALIASES } from "./demo-corpus";
import { lawIdFromName } from "./slug";
import type { RagChunk, RagReference, RagReferenceKind } from "./types";

export interface ParsedLaw {
  lawId: string;
  title: string;
  chunks: RagChunk[];
  references: RagReference[];
}

const HEADING_RE = /^第([0-9０-９]+)条(?:（([^）]+)）)?\s*$/;
const NAMED_LAW_RE =
  /([一-龯ァ-ヴーA-Za-z0-9]{2,40}(?:法(?:施行規則)?|条例|規程|規則))第([0-9０-９]+)条(?:第([0-9０-９]+)項)?(?:の規定を(準用|参照))?/g;
const BARE_ARTICLE_RE =
  /第([0-9０-９]+)条(?:第([0-9０-９]+)項)?(?:の規定)?(?:を(準用|参照)|に定め|の定め|により|に違反)/g;
const SPLIT_ARTICLE_RE = /第([0-9０-９]+)条(?=(?:[（(])|\s+)/g;

export function toAsciiDigits(value: string): string {
  return value.replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xfee0),
  );
}

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
        article: Number(toAsciiDigits(heading[1] ?? "0")),
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
  const seen = new Set<string>();
  const body = chunk.body;

  const add = (ref: RagReference) => {
    if (ref.toArticle === chunk.article && ref.toLawId === defaultLawId) return;
    const key = `${ref.toLawId}:${ref.toArticle}:${ref.kind}:${ref.rawText}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  };

  if (/前条/.test(body) && chunk.article > 1) {
    add({
      fromChunkKey: chunk.chunkKey,
      toLawId: defaultLawId,
      toArticle: chunk.article - 1,
      toChunkKey: `${defaultLawId}:${chunk.article - 1}`,
      kind: "refers",
      rawText: "前条",
    });
  }

  const namedSpans: { start: number; end: number }[] = [];
  NAMED_LAW_RE.lastIndex = 0;
  let named: RegExpExecArray | null;
  while ((named = NAMED_LAW_RE.exec(body))) {
    const lawHint = named[1] ?? "";
    const toArticle = Number(toAsciiDigits(named[2] ?? "0"));
    if (!toArticle) continue;
    namedSpans.push({ start: named.index, end: named.index + named[0].length });
    const toLawId = resolveLawId(lawHint, lawIdFromName(lawHint));
    const sameDoc = toLawId === defaultLawId || lawHint === chunk.lawTitle;
    add({
      fromChunkKey: chunk.chunkKey,
      toLawId: sameDoc ? defaultLawId : toLawId,
      toArticle,
      toChunkKey: sameDoc ? `${defaultLawId}:${toArticle}` : `${toLawId}:${toArticle}`,
      kind: named[4] === "準用" || /準用/.test(named[0]) ? "applies" : "refers",
      rawText: named[0],
    });
  }

  BARE_ARTICLE_RE.lastIndex = 0;
  let bare: RegExpExecArray | null;
  while ((bare = BARE_ARTICLE_RE.exec(body))) {
    const overlapped = namedSpans.some(
      (s) => bare!.index >= s.start && bare!.index < s.end,
    );
    if (overlapped) continue;
    const toArticle = Number(toAsciiDigits(bare[1] ?? "0"));
    if (!toArticle) continue;
    const kind: RagReferenceKind = bare[3] === "準用" ? "applies" : "refers";
    add({
      fromChunkKey: chunk.chunkKey,
      toLawId: defaultLawId,
      toArticle,
      toChunkKey: `${defaultLawId}:${toArticle}`,
      kind,
      rawText: bare[0],
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
  for (const m of query.matchAll(/第\s*([0-9０-９]+)\s*条/g)) {
    articles.add(Number(toAsciiDigits(m[1] ?? "0")));
  }
  return [...articles];
}

export function inferLawIds(
  query: string,
  titles: { lawId: string; title: string }[] = [],
): string[] {
  const hits = new Set<string>();
  for (const [lawId, aliases] of Object.entries(LAW_ALIASES)) {
    if (aliases.some((a) => query.includes(a))) hits.add(lawId);
  }
  for (const t of titles) {
    if (t.title && query.includes(t.title)) hits.add(t.lawId);
  }
  return [...hits];
}

/**
 * PDF 抽出テキスト（改行が崩れていても）を条単位に切る。
 * `第N条に` のような本文中の言及は新しい条にしない。
 */
export function parseOrdinancePages(input: {
  lawId: string;
  title: string;
  pages: { page: number; text: string }[];
}): ParsedLaw {
  const joined = input.pages
    .map((p) => p.text.replace(/\r\n/g, "\n"))
    .join("\n");
  const pageSpans: { page: number; start: number; end: number }[] = [];
  let cursor = 0;
  for (const p of input.pages) {
    const text = p.text.replace(/\r\n/g, "\n");
    pageSpans.push({ page: p.page, start: cursor, end: cursor + text.length });
    cursor += text.length + 1;
  }

  const matches = [...joined.matchAll(SPLIT_ARTICLE_RE)];
  const chunks: RagChunk[] = [];

  if (matches.length === 0) {
    input.pages
      .filter((p) => p.text.trim())
      .forEach((p) => {
        chunks.push({
          chunkKey: `${input.lawId}:p:${p.page}`,
          lawId: input.lawId,
          lawTitle: input.title,
          article: p.page,
          paragraph: null,
          heading: `p.${p.page}`,
          body: p.text.trim(),
          pageStart: p.page,
        });
      });
  } else {
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]!;
      const start = m.index ?? 0;
      const end = matches[i + 1]?.index ?? joined.length;
      const article = Number(toAsciiDigits(m[1] ?? "0"));
      const slice = joined.slice(start, end).trim();
      const headingMatch = slice.match(/^第[0-9０-９]+条(?:（([^）]+)）)?/);
      const heading = headingMatch?.[1]?.trim() || null;
      const body = slice.replace(/^第[0-9０-９]+条(?:（[^）]+）)?\s*/, "").trim();
      if (!body) continue;
      const pageStart =
        pageSpans.find((s) => start >= s.start && start < s.end)?.page ?? 1;
      chunks.push({
        chunkKey: `${input.lawId}:${article}`,
        lawId: input.lawId,
        lawTitle: input.title,
        article,
        paragraph: null,
        heading,
        body,
        pageStart,
      });
    }
  }

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
