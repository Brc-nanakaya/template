/**
 * AI 所見生成 API (T14)。
 *
 * POST /api/generate-commentary
 *   body: { dealInfo, currentMonth, monthlyHistory, anomalies, portfolioStats,
 *           triggerStatus }
 *   res:  { commentary: string, mode: "mock" | "openai" | "fallback" }
 *
 * 動作モード:
 *   1. `process.env.NEXT_PUBLIC_MOCK_LLM === "true"` → 固定モック応答（E2E 向け）
 *   2. `process.env.OPENAI_API_KEY` が設定 → OpenAI gpt-4o-mini 呼び出し
 *   3. 上記いずれでもない / OpenAI 呼び出しエラー → フォールバックテンプレート
 *
 * 生成される所見は 4 セクション固定:
 *   - 当月サマリー
 *   - 延滞デフォルト
 *   - トリガー
 *   - 翌月留意事項
 * 各 2〜4 文、Markdown 見出し `### {セクション名}` 形式。
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface RequestBody {
  dealInfo?: {
    deal_name?: string;
    report_month?: string;
    servicer?: string;
    trigger_thresholds?: Record<string, number>;
  };
  currentMonth?: Record<string, number | string>;
  monthlyHistory?: Record<string, number | string>[];
  anomalies?: Array<{ severity: string; title: string; description: string }>;
  portfolioStats?: Record<string, unknown>;
  triggerStatus?: Array<Record<string, number | string | boolean>>;
}

const SYSTEM_PROMPT = `あなたは SBI 新生信託銀行 信託事業推進部の期中管理担当者です。
資産流動化案件（住宅ローン信託）の月次レポートに掲載する「当月所見」を日本語で執筆します。

出力要件:
- Markdown 形式で、以下 4 セクション（H3 見出し）を必ず含める
  1. "### 当月サマリー"  … プール残高・延滞率・デフォルトの推移を総括
  2. "### 延滞デフォルト" … 異常値アラート・デフォルト件数・回収進捗を専門的に言及
  3. "### トリガー"      … 各トリガー（累積デフォルト率 / 90日以上延滞率 / CPR / 劣後比率）の余裕度と抵触リスクに触れる
  4. "### 翌月留意事項" … 翌月のサービサー対応・投資家向けアップデートの提案
- 各セクション本文は 2〜4 文で簡潔に
- 数値は 3桁区切り + 「百万円 (X.X億円)」併記
- 信託業界用語を正確に使用（期中管理、優先/劣後受益権、ウォーターフォール 等）
- 事実に基づかない憶測は避ける`;

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  // 1. モックモード — E2E 向け決定論的応答
  if (process.env.NEXT_PUBLIC_MOCK_LLM === "true") {
    return NextResponse.json({
      commentary: buildMockCommentary(body),
      mode: "mock",
    });
  }

  // 2. OpenAI 呼び出し
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey });
      const userPrompt = buildUserPrompt(body);
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });
      const commentary = completion.choices[0]?.message?.content?.trim();
      if (!commentary) throw new Error("empty completion");
      return NextResponse.json({ commentary, mode: "openai" });
    } catch (err) {
      console.error("[generate-commentary] OpenAI error:", err);
      // フォールバックへ続行
    }
  }

  // 3. フォールバックテンプレート
  return NextResponse.json({
    commentary: buildFallbackCommentary(body),
    mode: "fallback",
  });
}

// -----------------------------------------------------------------------------
// prompt composition
// -----------------------------------------------------------------------------
function buildUserPrompt(body: RequestBody): string {
  const { dealInfo, currentMonth, monthlyHistory, anomalies, triggerStatus } = body;
  const anomalyLines = (anomalies ?? [])
    .map((a) => `  - [${a.severity}] ${a.title}: ${a.description}`)
    .join("\n");
  const triggerLines = (triggerStatus ?? [])
    .map(
      (t) =>
        `  - ${String(t.trigger_name)}: 閾値 ${t.threshold} / 当月 ${t.current_value} / breach=${t.breach}`,
    )
    .join("\n");
  return [
    `案件: ${dealInfo?.deal_name ?? "(不明)"}`,
    `報告月: ${dealInfo?.report_month ?? "(不明)"}`,
    `サービサー: ${dealInfo?.servicer ?? "(不明)"}`,
    ``,
    `当月主要指標:`,
    JSON.stringify(currentMonth ?? {}, null, 2),
    ``,
    `検知された異常値:`,
    anomalyLines || "  (なし)",
    ``,
    `トリガー状況:`,
    triggerLines || "  (なし)",
    ``,
    `過去12ヶ月の推移（抜粋）:`,
    JSON.stringify((monthlyHistory ?? []).slice(-12), null, 2),
    ``,
    `上記事実を元に、所定の4セクション構成で当月所見を生成してください。`,
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Mock & fallback
// -----------------------------------------------------------------------------
function buildMockCommentary(body: RequestBody): string {
  const month = body.dealInfo?.report_month ?? "当月";
  return [
    `### 当月サマリー`,
    `${month} のプール残高は計画線上で順調に償却しています。前月比で大きな乖離はなく、残存率・劣後比率ともに許容範囲内で推移しました。サービサー回収率も安定していますが、延滞率指標に若干の上昇傾向が見られます。`,
    ``,
    `### 延滞デフォルト`,
    `90日以上延滞率が 3 ヶ月連続で上昇し、当月検知された異常値アラートのうち複数件が high 判定となりました。当月デフォルト件数は過去6ヶ月平均を上回り、担保処分進捗の加速が必要です。回収ペースに大きな遅延はないものの、個別債権のサービサー対応状況を継続的に確認すべき局面です。`,
    ``,
    `### トリガー`,
    `累積デフォルト率および 90日以上延滞率はトリガー閾値の 70% 水準に到達しており、抵触までの余裕度が縮小しています。CPR（年率）および劣後比率下限については当面の抵触リスクは低いものの、抵触予測月の再計算と早期是正措置の事前検討を開始することを推奨します。`,
    ``,
    `### 翌月留意事項`,
    `翌月は借換繁忙期に該当するため CPR の上振れ余地があり、キャッシュフロー見通しの再計算が必要です。劣後受益権配当への影響を投資家向けにアップデートし、サービサーに対しては延滞 60日以上案件の督促強化を要請します。バックアップサービサー体制のレビューもこの機会に実施します。`,
  ].join("\n");
}

function buildFallbackCommentary(body: RequestBody): string {
  const month = body.dealInfo?.report_month ?? "当月";
  const anomalyCount = body.anomalies?.length ?? 0;
  return [
    `### 当月サマリー`,
    `${month} のプール実績を集計しました。詳細な生成には OpenAI API キー（環境変数 OPENAI_API_KEY）の設定が必要です。現段階ではテンプレート所見を表示しています。`,
    ``,
    `### 延滞デフォルト`,
    `当月は ${anomalyCount} 件の異常値を検知しています。個別の詳細はダッシュボードの異常値アラートバナーから確認してください。サービサー督促状況および担保処分進捗の確認が推奨されます。`,
    ``,
    `### トリガー`,
    `各トリガーの現状値・閾値・余裕度はダッシュボードの「トリガー状況」セクションで確認可能です。閾値の 70% 水準に到達している指標があれば優先的にモニタリングしてください。`,
    ``,
    `### 翌月留意事項`,
    `翌月に向けてはサービサー対応状況の継続確認、投資家向け報告資料の準備、必要に応じてトリガー抵触時の対応フロー再確認が必要です。`,
  ].join("\n");
}
