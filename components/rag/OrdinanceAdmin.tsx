"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/lib/toast";
import type { GraphStats } from "@/lib/rag/graph";
import type { RagDocumentSummary } from "@/lib/rag/types";

export function OrdinanceAdmin({ isAdmin }: { isAdmin: boolean }) {
  const [documents, setDocuments] = useState<RagDocumentSummary[]>([]);
  const [graph, setGraph] = useState<GraphStats | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    const [docsRes, statusRes] = await Promise.all([
      fetch("/api/rag/documents"),
      fetch("/api/rag/status"),
    ]);
    const docsBody = await docsRes.json();
    if (!docsRes.ok) throw new Error(docsBody.error ?? docsRes.statusText);
    setDocuments(docsBody.documents ?? []);
    if (statusRes.ok) {
      const statusBody = await statusRes.json();
      setGraph(statusBody.graph ?? null);
    }
  }

  useEffect(() => {
    load().catch((e) =>
      toastError("一覧の取得に失敗しました", e instanceof Error ? e.message : undefined),
    );
  }, []);

  async function handleUpload() {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      if (title.trim()) form.set("title", title.trim());
      const res = await fetch("/api/rag/documents", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail ?? body.error ?? res.statusText);
      toastSuccess(
        "条例を取り込みました",
        `${body.ingested.title}（${body.ingested.chunkCount} チャンク / ${body.ingested.referenceCount ?? 0} 参照）`,
      );
      setFile(null);
      setTitle("");
      await load();
    } catch (e) {
      toastError("取り込みに失敗しました", e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("この条例を削除しますか？")) return;
    const res = await fetch(`/api/rag/documents/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      toastError("削除に失敗しました", body.error);
      return;
    }
    toastSuccess("削除しました");
    await load();
  }

  async function handleGraphSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/rag/graph/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail ?? body.error ?? res.statusText);
      setGraph(body.graph ?? null);
      toastSuccess(
        "グラフを同期しました",
        body.graph?.reachable
          ? `${body.graph.ordinances} 法令 / ${body.graph.edges} 辺`
          : "Neo4j 未接続（Postgres の参照だけ更新）",
      );
    } catch (e) {
      toastError("グラフ同期に失敗しました", e instanceof Error ? e.message : undefined);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href="/rag" className="text-xs text-muted-foreground hover:underline">
          ← 条例チャットへ
        </Link>
        <h1 className="text-lg font-bold tracking-tight" data-testid="rag-admin-title">
          条例管理
        </h1>
      </div>

      <section className="rounded-xl border bg-white p-4">
        <p className="text-sm text-muted-foreground">
          区の条例 PDF を取り込むと、条単位に切り、ベクトル・キーワード・参照グラフ（Neo4j）へ格納します。
        </p>
        {isAdmin ? (
          <div className="mt-4 space-y-3" data-testid="rag-upload-form">
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="条例名（空なら PDF から推定）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="rag-upload-title"
            />
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              data-testid="rag-upload-file"
            />
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              data-testid="rag-upload-submit"
            >
              {uploading ? "取り込み中..." : "PDF を取り込む"}
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#bc0017]">取り込みは管理者のみです。</p>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4" data-testid="rag-graph-status">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">参照グラフ（Neo4j）</h2>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGraphSync}
              disabled={syncing}
              data-testid="rag-graph-sync"
            >
              {syncing ? "同期中..." : "再同期"}
            </Button>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {graph?.reachable
            ? `接続中 ${graph.uri} / 法令 ${graph.ordinances} / 条 ${graph.articles} / 辺 ${graph.edges}`
            : `未接続（${graph?.uri || "bolt://localhost:7687"}）。npm run graph:up のあと再同期してください。`}
        </p>
        {graph?.browserUrl && (
          <a
            className="mt-1 inline-block text-xs font-semibold text-[#bc0017] underline"
            href={graph.browserUrl}
            target="_blank"
            rel="noreferrer"
          >
            Neo4j Browser
          </a>
        )}
        {graph?.sample && graph.sample.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {graph.sample.map((e) => (
              <li key={`${e.from}-${e.to}-${e.rawText}`}>
                {e.from} → {e.to}
                {e.rawText ? `（${e.rawText}）` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold">取り込み済み</h2>
        <ul className="mt-3 space-y-2" data-testid="rag-document-list">
          {documents.length === 0 && (
            <li className="text-sm text-muted-foreground">まだありません。</li>
          )}
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm"
              data-testid={`rag-doc-${d.lawId}`}
            >
              <div>
                <p className="font-medium">{d.title}</p>
                <p className="text-xs text-muted-foreground">
                  {d.fileName} / {d.chunkCount} チャンク
                  {d.pageCount ? ` / ${d.pageCount} ページ` : ""} / {d.sourceType}
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  className="text-xs font-semibold text-[#bc0017] underline"
                  href={`/api/rag/documents/${d.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                >
                  PDF
                </a>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(d.id)}
                    data-testid={`rag-doc-delete-${d.lawId}`}
                  >
                    削除
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
