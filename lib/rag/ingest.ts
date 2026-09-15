import { DEMO_LAWS } from "./demo-corpus";
import { listRagDocuments, replaceLawIngest, resolveCrossLawReferences } from "./db";
import { parseLawMarkdown } from "./parse";
import { objectKeyFor, putObject } from "./storage";

export interface IngestResult {
  lawId: string;
  title: string;
  chunkCount: number;
  referenceCount: number;
  objectKey: string;
}

export async function ingestDemoCorpus(options?: {
  force?: boolean;
}): Promise<IngestResult[]> {
  const existing = await listRagDocuments();
  if (existing.length > 0 && !options?.force) {
    return existing.map((d) => ({
      lawId: d.lawId,
      title: d.title,
      chunkCount: d.chunkCount,
      referenceCount: 0,
      objectKey: d.objectKey,
    }));
  }

  const results: IngestResult[] = [];
  for (const law of DEMO_LAWS) {
    const objectKey = objectKeyFor(law.fileName);
    await putObject(objectKey, law.body);
    const parsed = parseLawMarkdown({
      lawId: law.lawId,
      title: law.title,
      markdown: law.body,
    });
    await replaceLawIngest({
      lawId: law.lawId,
      title: law.title,
      fileName: law.fileName,
      objectKey,
      chunks: parsed.chunks,
      references: parsed.references,
    });
    results.push({
      lawId: law.lawId,
      title: law.title,
      chunkCount: parsed.chunks.length,
      referenceCount: parsed.references.length,
      objectKey,
    });
  }

  await resolveCrossLawReferences();
  return results;
}
