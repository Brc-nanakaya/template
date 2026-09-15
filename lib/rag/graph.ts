import neo4j, { type Session } from "neo4j-driver";
import { getNeo4jAuth, getNeo4jBrowserUrl, getNeo4jUri } from "./config";
import type { RagChunk, RagReference } from "./types";

export interface GraphStats {
  enabled: boolean;
  reachable: boolean;
  uri: string;
  browserUrl: string;
  ordinances: number;
  articles: number;
  edges: number;
  sample: { from: string; type: string; to: string; rawText: string }[];
}

export function isGraphConfigured(): boolean {
  return Boolean(getNeo4jUri());
}

async function withSession<T>(
  run: (session: Session) => Promise<T>,
): Promise<T | null> {
  const uri = getNeo4jUri();
  if (!uri) return null;
  const auth = getNeo4jAuth();
  const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(auth.user, auth.password),
    { connectionTimeout: 3000, maxConnectionPoolSize: 5 },
  );
  const session = driver.session();
  try {
    return await run(session);
  } finally {
    await session.close();
    await driver.close();
  }
}

export async function syncOrdinanceGraph(input: {
  lawId: string;
  title: string;
  chunks: RagChunk[];
  references: RagReference[];
}): Promise<boolean> {
  try {
    const ok = await withSession(async (session) => {
      await session.executeWrite(async (tx) => {
        await tx.run(
          `
          MERGE (o:Ordinance {lawId: $lawId})
          SET o.title = $title
          `,
          { lawId: input.lawId, title: input.title },
        );
        await tx.run(
          `
          MATCH (o:Ordinance {lawId: $lawId})-[:HAS_ARTICLE]->(a:Article)
          DETACH DELETE a
          `,
          { lawId: input.lawId },
        );
        if (input.chunks.length > 0) {
          await tx.run(
            `
            MATCH (o:Ordinance {lawId: $lawId})
            UNWIND $chunks AS c
            MERGE (a:Article {chunkKey: c.chunkKey})
            SET a.lawId = c.lawId,
                a.article = c.article,
                a.heading = c.heading,
                a.body = c.body,
                a.lawTitle = c.lawTitle
            MERGE (o)-[:HAS_ARTICLE]->(a)
            `,
            {
              lawId: input.lawId,
              chunks: input.chunks.map((c) => ({
                chunkKey: c.chunkKey,
                lawId: c.lawId,
                article: c.article,
                heading: c.heading,
                body: c.body,
                lawTitle: c.lawTitle,
              })),
            },
          );
        }
        if (input.references.length > 0) {
          await tx.run(
            `
            UNWIND $refs AS r
            MATCH (from:Article {chunkKey: r.fromChunkKey})
            MERGE (to:Article {chunkKey: r.toChunkKey})
            ON CREATE SET
              to.lawId = r.toLawId,
              to.article = r.toArticle,
              to.external = r.external
            MERGE (from)-[rel:REFERS_TO]->(to)
            SET rel.kind = r.kind, rel.rawText = r.rawText
            `,
            {
              refs: input.references.map((r) => ({
                fromChunkKey: r.fromChunkKey,
                toChunkKey:
                  r.toChunkKey ?? `${r.toLawId}:${r.toArticle}`,
                toLawId: r.toLawId,
                toArticle: r.toArticle,
                kind: r.kind,
                rawText: r.rawText,
                external: !r.toChunkKey,
              })),
            },
          );
        }
      });
      return true;
    });
    return Boolean(ok);
  } catch {
    return false;
  }
}

export async function deleteOrdinanceGraph(lawId: string): Promise<void> {
  try {
    await withSession(async (session) => {
      await session.executeWrite((tx) =>
        tx.run(
          `
          MATCH (o:Ordinance {lawId: $lawId})
          OPTIONAL MATCH (o)-[:HAS_ARTICLE]->(a:Article)
          DETACH DELETE o, a
          `,
          { lawId },
        ),
      );
    });
  } catch {
    /* Neo4j 未起動でも削除は Postgres 側を優先する */
  }
}

export async function hopChunkKeys(chunkKeys: string[]): Promise<
  { from: string; to: string }[]
> {
  if (chunkKeys.length === 0) return [];
  try {
    const rows = await withSession(async (session) => {
      const res = await session.executeRead((tx) =>
        tx.run(
          `
          MATCH (from:Article)-[r:REFERS_TO]->(to:Article)
          WHERE from.chunkKey IN $keys AND to.chunkKey IS NOT NULL
          RETURN from.chunkKey AS fromKey, to.chunkKey AS toKey
          `,
          { keys: chunkKeys },
        ),
      );
      return res.records.map((rec) => ({
        from: String(rec.get("fromKey")),
        to: String(rec.get("toKey")),
      }));
    });
    return rows ?? [];
  } catch {
    return [];
  }
}

export async function getGraphStats(): Promise<GraphStats> {
  const uri = getNeo4jUri();
  const base: GraphStats = {
    enabled: Boolean(uri),
    reachable: false,
    uri: uri || "",
    browserUrl: getNeo4jBrowserUrl(),
    ordinances: 0,
    articles: 0,
    edges: 0,
    sample: [],
  };
  if (!uri) return base;
  try {
    const stats = await withSession(async (session) => {
      const countOf = (value: unknown) => {
        if (typeof value === "number") return value;
        if (
          value &&
          typeof value === "object" &&
          "toNumber" in value &&
          typeof value.toNumber === "function"
        ) {
          return value.toNumber();
        }
        return Number(value ?? 0);
      };
      const ordinances = await session.executeRead((tx) =>
        tx.run("MATCH (o:Ordinance) RETURN count(o) AS n"),
      );
      const articles = await session.executeRead((tx) =>
        tx.run("MATCH (a:Article) RETURN count(a) AS n"),
      );
      const edges = await session.executeRead((tx) =>
        tx.run("MATCH ()-[r:REFERS_TO]->() RETURN count(r) AS n"),
      );
      const sample = await session.executeRead((tx) =>
        tx.run(
          `
          MATCH (from:Article)-[r:REFERS_TO]->(to:Article)
          RETURN from.chunkKey AS fromKey, r.kind AS kind, to.chunkKey AS toKey, r.rawText AS rawText
          LIMIT 8
          `,
        ),
      );
      return {
        ordinances: countOf(ordinances.records[0]?.get("n")),
        articles: countOf(articles.records[0]?.get("n")),
        edges: countOf(edges.records[0]?.get("n")),
        sample: sample.records.map((rec) => ({
          from: String(rec.get("fromKey")),
          type: String(rec.get("kind") ?? "refers"),
          to: String(rec.get("toKey")),
          rawText: String(rec.get("rawText") ?? ""),
        })),
      };
    });
    if (!stats) return base;
    return { ...base, reachable: true, ...stats };
  } catch {
    return base;
  }
}

export async function rebuildGraphFromCorpus(input: {
  lawId: string;
  title: string;
  chunks: RagChunk[];
  references: RagReference[];
}[]): Promise<number> {
  try {
    await withSession(async (session) => {
      await session.executeWrite((tx) => tx.run("MATCH (n) DETACH DELETE n"));
    });
  } catch {
    /* 未起動なら各 law の sync が false になる */
  }
  let n = 0;
  for (const item of input) {
    if (await syncOrdinanceGraph(item)) n += 1;
  }
  return n;
}
