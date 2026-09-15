import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ragChunks, ragDocuments, ragReferences } from "@/lib/db/schema";
import type { MemoryCorpus } from "./retrieve";
import type { RagChunk, RagDocumentSummary, RagReference } from "./types";

export async function listRagDocuments(): Promise<RagDocumentSummary[]> {
  const docs = await getDb()
    .select({
      id: ragDocuments.id,
      lawId: ragDocuments.lawId,
      title: ragDocuments.title,
      fileName: ragDocuments.fileName,
      objectKey: ragDocuments.objectKey,
      sourceType: ragDocuments.sourceType,
      pageCount: ragDocuments.pageCount,
      createdAt: ragDocuments.createdAt,
    })
    .from(ragDocuments)
    .orderBy(desc(ragDocuments.createdAt), ragDocuments.lawId);

  if (docs.length === 0) return [];

  const chunks = await getDb()
    .select({ lawId: ragChunks.lawId })
    .from(ragChunks)
    .where(
      inArray(
        ragChunks.lawId,
        docs.map((d) => d.lawId),
      ),
    );

  const counts = new Map<string, number>();
  for (const c of chunks) {
    counts.set(c.lawId, (counts.get(c.lawId) ?? 0) + 1);
  }

  return docs.map((d) => ({
    id: d.id,
    lawId: d.lawId,
    title: d.title,
    fileName: d.fileName,
    objectKey: d.objectKey,
    sourceType: d.sourceType,
    pageCount: d.pageCount,
    chunkCount: counts.get(d.lawId) ?? 0,
    createdAt: d.createdAt.toISOString(),
  }));
}

export async function getRagDocument(id: string) {
  const [doc] = await getDb()
    .select()
    .from(ragDocuments)
    .where(eq(ragDocuments.id, id))
    .limit(1);
  return doc ?? null;
}

export async function deleteRagDocument(id: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(ragDocuments)
    .where(eq(ragDocuments.id, id))
    .returning({ id: ragDocuments.id });
  return deleted.length > 0;
}

export async function loadMemoryCorpus(): Promise<MemoryCorpus> {
  const db = getDb();
  const docs = await db.select().from(ragDocuments);
  const titleByLaw = Object.fromEntries(docs.map((d) => [d.lawId, d.title]));
  const fileByLaw = Object.fromEntries(docs.map((d) => [d.lawId, d.fileName]));
  const idByLaw = Object.fromEntries(docs.map((d) => [d.lawId, d.id]));

  const chunkRows = await db.select().from(ragChunks);
  const refRows = await db.select().from(ragReferences);

  const chunks: RagChunk[] = chunkRows.map((row) => ({
    chunkKey: row.chunkKey,
    lawId: row.lawId,
    lawTitle: titleByLaw[row.lawId] ?? row.lawId,
    article: row.article,
    paragraph: row.paragraph,
    heading: row.heading,
    body: row.body,
    documentId: idByLaw[row.lawId],
    fileName: fileByLaw[row.lawId],
    pageStart: row.pageStart,
    embedding: row.embedding,
  }));

  const byId = new Map(chunkRows.map((r) => [r.id, r.chunkKey]));
  const references: RagReference[] = refRows.map((row) => ({
    fromChunkKey: byId.get(row.fromChunkId) ?? "",
    toLawId: row.toLawId,
    toArticle: row.toArticle,
    toChunkKey: row.toChunkId ? (byId.get(row.toChunkId) ?? null) : null,
    kind: row.kind,
    rawText: row.rawText,
  }));

  return { chunks, references };
}

export async function replaceLawIngest(input: {
  lawId: string;
  title: string;
  fileName: string;
  objectKey: string;
  sourceType?: string;
  pageCount?: number | null;
  uploadedBy?: string | null;
  chunks: RagChunk[];
  references: RagReference[];
}): Promise<string> {
  const db = getDb();
  await db.delete(ragDocuments).where(eq(ragDocuments.lawId, input.lawId));

  const [doc] = await db
    .insert(ragDocuments)
    .values({
      lawId: input.lawId,
      title: input.title,
      fileName: input.fileName,
      objectKey: input.objectKey,
      sourceType: input.sourceType ?? "text",
      pageCount: input.pageCount ?? null,
      uploadedBy: input.uploadedBy ?? null,
    })
    .returning({ id: ragDocuments.id });
  if (!doc) throw new Error(`文書の保存に失敗しました: ${input.lawId}`);

  if (input.chunks.length === 0) return doc.id;

  const inserted = await db
    .insert(ragChunks)
    .values(
      input.chunks.map((c) => ({
        documentId: doc.id,
        lawId: c.lawId,
        article: c.article,
        paragraph: c.paragraph,
        chunkKey: c.chunkKey,
        heading: c.heading,
        body: c.body,
        pageStart: c.pageStart ?? null,
        embedding: c.embedding ?? null,
      })),
    )
    .returning({ id: ragChunks.id, chunkKey: ragChunks.chunkKey });

  const keyToId = new Map(inserted.map((r) => [r.chunkKey, r.id]));
  if (input.references.length === 0) return doc.id;

  await db.insert(ragReferences).values(
    input.references.map((r) => {
      const fromChunkId = keyToId.get(r.fromChunkKey);
      if (!fromChunkId) {
        throw new Error(`参照元チャンクがありません: ${r.fromChunkKey}`);
      }
      return {
        fromChunkId,
        toLawId: r.toLawId,
        toArticle: r.toArticle,
        toChunkId: r.toChunkKey ? (keyToId.get(r.toChunkKey) ?? null) : null,
        kind: r.kind,
        rawText: r.rawText,
      };
    }),
  );
  return doc.id;
}

export async function replaceReferencesForLaw(
  lawId: string,
  references: RagReference[],
): Promise<void> {
  const db = getDb();
  const chunks = await db
    .select({ id: ragChunks.id, chunkKey: ragChunks.chunkKey })
    .from(ragChunks)
    .where(eq(ragChunks.lawId, lawId));
  if (chunks.length === 0) return;
  const keyToId = new Map(chunks.map((c) => [c.chunkKey, c.id]));
  await db.delete(ragReferences).where(
    inArray(
      ragReferences.fromChunkId,
      chunks.map((c) => c.id),
    ),
  );
  if (references.length === 0) return;
  await db.insert(ragReferences).values(
    references.map((r) => {
      const fromChunkId = keyToId.get(r.fromChunkKey);
      if (!fromChunkId) {
        throw new Error(`参照元チャンクがありません: ${r.fromChunkKey}`);
      }
      return {
        fromChunkId,
        toLawId: r.toLawId,
        toArticle: r.toArticle,
        toChunkId: r.toChunkKey ? (keyToId.get(r.toChunkKey) ?? null) : null,
        kind: r.kind,
        rawText: r.rawText,
      };
    }),
  );
}

/** 準用先が別法令のとき、取込後に to_chunk_id を結び直す */
export async function resolveCrossLawReferences(): Promise<void> {
  const db = getDb();
  const refs = await db.select().from(ragReferences);
  const chunks = await db.select().from(ragChunks);
  const byLawArticle = new Map(
    chunks.map((c) => [`${c.lawId}:${c.article}`, c.id]),
  );

  for (const ref of refs) {
    const targetId = byLawArticle.get(`${ref.toLawId}:${ref.toArticle}`);
    if (!targetId || targetId === ref.toChunkId) continue;
    await db
      .update(ragReferences)
      .set({ toChunkId: targetId })
      .where(eq(ragReferences.id, ref.id));
  }
}
