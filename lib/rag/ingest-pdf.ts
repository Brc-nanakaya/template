import { replaceLawIngest, resolveCrossLawReferences } from "./db";
import { syncOrdinanceGraph } from "./graph";
import { embedLocal } from "./embed";
import { extractPdf, isPdfFileName } from "./pdf";
import { parseOrdinancePages } from "./parse";
import { lawIdFromName } from "./slug";
import { objectKeyForUpload, putBinary } from "./storage";
import type { IngestResult } from "./ingest";

export const MAX_PDF_BYTES = 15 * 1024 * 1024;

export async function ingestOrdinancePdf(input: {
  fileName: string;
  buffer: Buffer;
  title?: string;
  uploadedBy?: string | null;
}): Promise<IngestResult & { id: string }> {
  if (!isPdfFileName(input.fileName)) {
    throw new Error("PDF ファイルを指定してください");
  }
  if (input.buffer.byteLength === 0) {
    throw new Error("空のファイルです");
  }
  if (input.buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error("ファイルサイズは 15MB までです");
  }

  const extracted = await extractPdf(input.buffer);
  if (!extracted.fullText.trim()) {
    throw new Error("PDF からテキストを抽出できませんでした（画像のみの可能性があります）");
  }

  const title =
    input.title?.trim() ||
    extracted.title ||
    input.fileName.replace(/\.pdf$/i, "");
  const lawId = lawIdFromName(title);
  const objectKey = objectKeyForUpload(input.fileName);
  await putBinary(objectKey, input.buffer, "application/pdf");

  const parsed = parseOrdinancePages({
    lawId,
    title,
    pages: extracted.pages,
  });
  if (parsed.chunks.length === 0) {
    throw new Error("条文チャンクを作れませんでした");
  }

  const chunks = parsed.chunks.map((c) => ({
    ...c,
    embedding: embedLocal(`${c.heading ?? ""} ${c.body}`),
  }));

  const id = await replaceLawIngest({
    lawId,
    title,
    fileName: input.fileName,
    objectKey,
    sourceType: "pdf",
    pageCount: extracted.pageCount,
    uploadedBy: input.uploadedBy ?? null,
    chunks,
    references: parsed.references,
  });
  await resolveCrossLawReferences();
  await syncOrdinanceGraph({
    lawId,
    title,
    chunks,
    references: parsed.references,
  });

  return {
    id,
    lawId,
    title,
    chunkCount: chunks.length,
    referenceCount: parsed.references.length,
    objectKey,
  };
}
