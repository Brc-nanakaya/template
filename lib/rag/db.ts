import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ragChunks, ragDocuments, ragReferences } from "@/lib/db/schema";
import type { MemoryCorpus } from "./retrieve";
import type { RagChunk, RagDocumentSummary, RagReference } from "./types";

const TITLE_BY_LAW: Record<string, string> = {};

export async function listRagDocuments(): Promise<RagDocumentSummary[]> {
  const docs = await getDb()
    .select({
      lawId: ragDocuments.lawId,
      title: ragDocuments.title,
      fileName: ragDocuments.fileName,
      objectKey: ragDocuments.objectKey,
    })
    .from(ragDocuments)
    .orderBy(ragDocuments.lawId);

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
    ...d,
    chunkCount: counts.get(d.lawId) ?? 0,
  }));
}

export async function loadMemoryCorpus(): Promise<MemoryCorpus> {
  const db = getDb();
  const docs = await db.select().from(ragDocuments);
  for (const d of docs) TITLE_BY_LAW[d.lawId] = d.title;

  const chunkRows = await db.select().from(ragChunks);
  const refRows = await db.select().from(ragReferences);

  const chunks: RagChunk[] = chunkRows.map((row) => ({
    chunkKey: row.chunkKey,
    lawId: row.lawId,
    lawTitle: TITLE_BY_LAW[row.lawId] ?? row.lawId,
    article: row.article,
    paragraph: row.paragraph,
    heading: row.heading,
    body: row.body,
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
  chunks: RagChunk[];
  references: RagReference[];
}): Promise<void> {
  const db = getDb();
  await db.delete(ragDocuments).where(eq(ragDocuments.lawId, input.lawId));

  const [doc] = await db
    .insert(ragDocuments)
    .values({
      lawId: input.lawId,
      title: input.title,
      fileName: input.fileName,
      objectKey: input.objectKey,
      sourceType: "text",
    })
    .returning({ id: ragDocuments.id });
  if (!doc) throw new Error(`文書の保存に失敗しました: ${input.lawId}`);

  if (input.chunks.length === 0) return;

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
      })),
    )
    .returning({ id: ragChunks.id, chunkKey: ragChunks.chunkKey });

  const keyToId = new Map(inserted.map((r) => [r.chunkKey, r.id]));
  if (input.references.length === 0) return;

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
