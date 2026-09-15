"use client";

import Link from "next/link";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AiRunResult, AiStep } from "@/lib/ai/run";
import { toastError } from "@/lib/toast";

async function callApi(
  path: string,
  body: Record<string, string>,
): Promise<AiRunResult> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as AiRunResult;
}

function StepTrace({ steps }: { steps: AiStep[] }) {
  return (
    <ol className="space-y-2" data-testid="ai-steps">
      {steps.map((step, i) => (
        <li
          key={i}
          className="rounded-lg border bg-card px-4 py-3 text-left text-sm"
        >
          <p className="text-xs font-semibold text-muted-foreground">
            {i + 1}. {step.author}
          </p>
          {step.functionCalls?.map((fc, j) => (
            <p key={j} className="mt-1 font-mono text-xs">
              ツール呼び出し: {fc.name}({JSON.stringify(fc.args)})
            </p>
          ))}
          {step.functionResponses?.map((fr, j) => (
            <p key={j} className="mt-1 font-mono text-xs">
              ツール結果: {fr.name} → {JSON.stringify(fr.response)}
            </p>
          ))}
          {step.text && (
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              {step.text}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

interface RunnerPanelProps {
  idPrefix: string;
  label: string;
  placeholder: string;
  apiPath: string;
  bodyKey: string;
}

function RunnerPanel({
  idPrefix,
  label,
  placeholder,
  apiPath,
  bodyKey,
}: RunnerPanelProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiRunResult | null>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      setResult(await callApi(apiPath, { [bodyKey]: input }));
    } catch (e) {
      toastError("実行に失敗しました", e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-lg border bg-card p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid={`${idPrefix}-input`}
      />
      <button
        type="button"
        onClick={run}
        disabled={loading || input.trim() === ""}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid={`${idPrefix}-run`}
      >
        {loading ? "実行中..." : label}
      </button>

      {result && (
        <div className="space-y-4" data-testid={`${idPrefix}-result`}>
          <div className="rounded-lg border-l-4 border-primary bg-card p-4 text-left">
            <p className="text-xs font-semibold text-muted-foreground">
              最終応答
            </p>
            <p
              className="mt-1 whitespace-pre-wrap text-sm"
              data-testid={`${idPrefix}-reply`}
            >
              {result.reply}
            </p>
          </div>
          <details open>
            <summary className="cursor-pointer text-left text-xs font-semibold text-muted-foreground">
              実行トレース（{result.steps.length} ステップ）
            </summary>
            <div className="mt-2">
              <StepTrace steps={result.steps} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

export default function AiSamplesPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-xs text-muted-foreground hover:underline">
        ← トップへ戻る
      </Link>
      <h1
        className="mt-4 text-2xl font-bold tracking-tight"
        data-testid="ai-samples-title"
      >
        AI サンプル（Google ADK）
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Google Agent Development Kit (@google/adk) を使った 2 つの実装パターンです。
        API キー未設定時はモック応答が返ります（実装は lib/ai/ を参照）。
      </p>

      <Tabs defaultValue="workflow" className="mt-8">
        <TabsList>
          <TabsTrigger value="workflow" data-testid="tab-workflow">
            AI ワークフロー
          </TabsTrigger>
          <TabsTrigger value="agent" data-testid="tab-agent">
            AI エージェント
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflow">
          <p className="mb-4 text-left text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">SequentialAgent</strong>
            による固定パイプライン: 要約 → 英訳 → タイトル案 の 3
            ステップをコードで定義した順に実行します。
          </p>
          <RunnerPanel
            idPrefix="workflow"
            label="ワークフローを実行"
            placeholder="要約したい文章を入力してください"
            apiPath="/api/ai/workflow"
            bodyKey="text"
          />
        </TabsContent>

        <TabsContent value="agent">
          <p className="mb-4 text-left text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">LlmAgent + FunctionTool</strong>
            による自律エージェント: LLM
            が必要に応じて日時取得・計算ツールを自分で呼び出して回答します。
          </p>
          <RunnerPanel
            idPrefix="agent"
            label="エージェントに質問"
            placeholder="例: 123 × 456 はいくつ？今何時？"
            apiPath="/api/ai/agent"
            bodyKey="message"
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}
