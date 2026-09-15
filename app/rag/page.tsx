"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/lib/toast";
import { RAG_EVAL_CASES } from "@/lib/rag/eval-cases";
import type { RagRuntimeStatus } from "@/lib/rag/config";
import type { RagAnswer, RagDocumentSummary, RagEvalReport } from "@/lib/rag/types";

interface StatusPayload extends RagRuntimeStatus {
  documents: RagDocumentSummary[];
}

export default function RagPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [question, setQuestion] = useState(RAG_EVAL_CASES[0]?.question ?? "");
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [evalReport, setEvalReport] = useState<RagEvalReport | null>(null);
  const [asking, setAsking] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [ingesting, setIngesting] = useState(false);

  async function loadStatus() {
    const res = await fetch("/api/rag/status");
    if (!res.ok) throw new Error(await res.text());
    setStatus((await res.json()) as StatusPayload);
  }

  useEffect(() => {
    loadStatus().catch((e) =>
      toastError("状態の取得に失敗しました", e instanceof Error ? e.message : undefined),
    );
  }, []);

  async function handleAsk() {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setEvalReport(null);
    try {
      const res = await fetch("/api/rag/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setAnswer(body as RagAnswer);
    } catch (e) {
      toastError("回答に失敗しました", e instanceof Error ? e.message : undefined);
    } finally {
      setAsking(false);
    }
  }

  async function handleEval() {
    setEvaluating(true);
    try {
      const res = await fetch("/api/rag/eval", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setEvalReport(body as RagEvalReport);
      if (body.passed) toastSuccess("評価セットはすべて成功しました");
    } catch (e) {
      toastError("評価に失敗しました", e instanceof Error ? e.message : undefined);
    } finally {
      setEvaluating(false);
    }
  }

  async function handleIngest() {
    setIngesting(true);
    try {
      const res = await fetch("/api/rag/ingest", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      await loadStatus();
      toastSuccess("デモ条文を再取り込みしました");
    } catch (e) {
      toastError("取り込みに失敗しました", e instanceof Error ? e.message : undefined);
    } finally {
      setIngesting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          ← トップへ戻る
        </Link>
        <h1 className="text-lg font-bold tracking-tight" data-testid="rag-title">
          法令 RAG（制度確認）
        </h1>
      </div>

      {status && (
        <section
          className="rounded-xl border bg-white p-4 text-sm"
          data-testid="rag-status"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge label={`環境: ${status.env}`} />
            <Badge label={`リージョン: ${status.region}`} />
            <Badge label={`保管: ${status.storage}`} />
            <Badge label={`回答: ${status.llm}`} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            ローカルはスタックが本番（S3 / Bedrock / Neptune）と違っても、条の切り方・参照・引用の制度を確認します。
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <CheckList title="ここで確認できる" items={status.verifiable} testid="rag-verifiable" />
            <CheckList title="ここでは確認できない" items={status.notVerifiable} testid="rag-not-verifiable" />
          </div>
          <div className="mt-3 text-xs">
            取込済み:{" "}
            {status.documents.length === 0
              ? "なし（管理者で再取り込み、または npm run db:seed）"
              : status.documents
                  .map((d) => `${d.title}（${d.chunkCount} 条）`)
                  .join(" / ")}
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-white p-4">
        <p className="text-xs font-medium text-muted-foreground">評価用の質問</p>
        <div className="mt-2 flex flex-wrap gap-2" data-testid="rag-sample-questions">
          {RAG_EVAL_CASES.map((c) => (
            <button
              key={c.id}
              type="button"
              data-testid={`rag-sample-${c.id}`}
              onClick={() => setQuestion(c.question)}
              className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            >
              {c.question}
            </button>
          ))}
        </div>
        <textarea
          className="mt-3 min-h-24 w-full rounded-md border px-3 py-2 text-sm"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          data-testid="rag-question"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={handleAsk} disabled={asking} data-testid="rag-ask">
            {asking ? "検索中..." : "条文を根拠に回答"}
          </Button>
          <Button
            variant="outline"
            onClick={handleEval}
            disabled={evaluating}
            data-testid="rag-eval"
          >
            {evaluating ? "評価中..." : "評価セットを実行"}
          </Button>
          <Button
            variant="ghost"
            onClick={handleIngest}
            disabled={ingesting}
            data-testid="rag-ingest"
          >
            {ingesting ? "取込中..." : "デモ条文を再取込"}
          </Button>
        </div>
      </section>

      {answer && (
        <section className="rounded-xl border bg-white p-4" data-testid="rag-answer">
          {answer.abstained && (
            <p className="mb-2 text-xs font-semibold text-[#bc0017]" data-testid="rag-abstained">
              根拠なし（棄権）
            </p>
          )}
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">{answer.answer}</pre>
          {answer.citations.length > 0 && (
            <ul className="mt-3 space-y-2 text-xs" data-testid="rag-citations">
              {answer.citations.map((c) => (
                <li key={c.chunkKey} className="rounded-md bg-muted px-3 py-2">
                  <span className="font-semibold">
                    {c.lawTitle} 第{c.article}条
                    {c.heading ? `（${c.heading}）` : ""}
                  </span>
                  <span className="ml-2 text-muted-foreground">{c.chunkKey}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {evalReport && (
        <section className="rounded-xl border bg-white p-4" data-testid="rag-eval-report">
          <p className="text-sm font-semibold">
            評価: {evalReport.passedCount} / {evalReport.total}
            {evalReport.passed ? "（成功）" : "（失敗あり）"}
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {evalReport.results.map((r) => (
              <li key={r.id} data-testid={`rag-eval-${r.id}`}>
                {r.passed ? "OK" : "NG"} {r.question}
                {!r.passed && r.missingChunkKeys.length > 0 && (
                  <span className="ml-2 text-[#bc0017]">
                    不足: {r.missingChunkKeys.join(", ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-[#bc0017]/10 px-2.5 py-0.5 text-xs font-medium text-[#bc0017]">
      {label}
    </span>
  );
}

function CheckList({
  title,
  items,
  testid,
}: {
  title: string;
  items: string[];
  testid: string;
}) {
  return (
    <div data-testid={testid}>
      <p className="text-xs font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
