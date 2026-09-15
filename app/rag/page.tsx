"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toastError } from "@/lib/toast";
import { RAG_EVAL_CASES } from "@/lib/rag/eval-cases";
import type { Citation, RagAnswer } from "@/lib/rag/types";

interface ChatTurn {
  question: string;
  answer: RagAnswer;
}

export default function OrdinanceChatPage() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [asking, setAsking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, asking]);

  async function handleAsk(nextQuestion?: string) {
    const q = (nextQuestion ?? question).trim();
    if (!q || asking) return;
    setAsking(true);
    if (!nextQuestion) setQuestion("");
    try {
      const res = await fetch("/api/rag/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setTurns((prev) => [...prev, { question: q, answer: body as RagAnswer }]);
    } catch (e) {
      toastError("回答に失敗しました", e instanceof Error ? e.message : undefined);
    } finally {
      setAsking(false);
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-3rem)] max-w-5xl flex-col px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          ← トップへ戻る
        </Link>
        <h1 className="text-lg font-bold tracking-tight" data-testid="rag-title">
          条例チャット
        </h1>
        <Link
          href="/rag/admin"
          className="text-xs font-semibold text-[#bc0017] hover:underline"
          data-testid="rag-admin-link"
        >
          条例管理
        </Link>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        取り込んだ区の条例を、ベクトル・キーワード・参照関係で検索し、根拠付きで答えます。
      </p>

      <div
        className="mt-3 flex flex-wrap gap-2"
        data-testid="rag-sample-questions"
      >
        {RAG_EVAL_CASES.map((c) => (
          <button
            key={c.id}
            type="button"
            data-testid={`rag-sample-${c.id}`}
            onClick={() => handleAsk(c.question)}
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
          >
            {c.question}
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {turns.length === 0 && (
          <p className="text-sm text-muted-foreground">
            条例について質問してください。回答の下に、根拠 PDF と該当箇所が出ます。
          </p>
        )}
        {turns.map((turn, i) => (
          <article key={`${turn.question}-${i}`} className="space-y-2">
            <div className="rounded-xl bg-[#bc0017] px-4 py-3 text-sm text-white">
              {turn.question}
            </div>
            <div
              className="rounded-xl border bg-white p-4"
              data-testid={i === turns.length - 1 ? "rag-answer" : undefined}
            >
              {turn.answer.abstained && (
                <p
                  className="mb-2 text-xs font-semibold text-[#bc0017]"
                  data-testid={i === turns.length - 1 ? "rag-abstained" : undefined}
                >
                  根拠なし（棄権）
                </p>
              )}
              <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                {turn.answer.answer}
              </pre>
              {turn.answer.citations.length > 0 && (
                <CitationList
                  citations={turn.answer.citations}
                  testid={i === turns.length - 1 ? "rag-citations" : undefined}
                />
              )}
            </div>
          </article>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <textarea
          className="min-h-16 flex-1 rounded-md border px-3 py-2 text-sm"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例: 記録の保存期間は何年ですか？"
          data-testid="rag-question"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleAsk();
            }
          }}
        />
        <Button onClick={() => handleAsk()} disabled={asking} data-testid="rag-ask">
          {asking ? "検索中..." : "質問する"}
        </Button>
      </div>
    </main>
  );
}

function CitationList({
  citations,
  testid,
}: {
  citations: Citation[];
  testid?: string;
}) {
  return (
    <ul className="mt-3 space-y-2 text-xs" data-testid={testid}>
      {citations.map((c) => (
        <li key={c.chunkKey} className="rounded-md bg-muted px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">
              {c.lawTitle} 第{c.article}条
              {c.heading ? `（${c.heading}）` : ""}
              {c.pageStart ? ` / p.${c.pageStart}` : ""}
            </span>
            {c.fileUrl && (
              <a
                href={c.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#bc0017] underline"
              >
                根拠PDFを開く
              </a>
            )}
          </div>
          <p className="mt-1 text-muted-foreground">{c.quote}</p>
        </li>
      ))}
    </ul>
  );
}
