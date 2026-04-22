/**
 * 異常値検出 (T05)。
 * 8 つのルールを適用して `Anomaly[]` を返す。各 Anomaly.description には具体的な数値を
 * 含む日本語コメントを格納し、ダッシュボード（T08）・AI 所見（T14）・レポート（T15）から
 * 共通に参照できるようにする。
 *
 * ルール:
 *   1. 延滞率急増 (high): 90日以上延滞率が前月比 +15% 超 or 3ヶ月連続上昇
 *   2. デフォルト急増 (high): 当月デフォルト件数が過去 6 ヶ月平均の 1.5 倍超
 *   3. トリガー接近 (high): 累積デフォルト率 / 90日以上延滞率が閾値の 70% 超
 *   4. CPR 急変 (medium): 年率 CPR 前月比 ±30% 超
 *   5. サービサー回収率低下 (medium): 直近 12 ヶ月平均が前 12 ヶ月平均比 -0.5pp 以上
 *   6. サービサー格付変動 (high): 前月記録との差異
 *   7. 劣後受益権配当減少 (low): 3 ヶ月連続減少
 *   8. 累積デフォルト率加速 (medium): 直近 3 ヶ月傾きが前 3 ヶ月傾きの 1.5 倍超
 */

import type {
  Anomaly,
  AnomalyKind,
  AnomalySeverity,
  DealInfo,
  DefaultRecord,
  MonthlyPerformance,
  TriggerTest,
  WaterfallRecord,
} from "./types";

export interface DetectAnomaliesInput {
  monthly: MonthlyPerformance[];
  defaults: DefaultRecord[];
  triggers: TriggerTest[];
  deal: DealInfo;
  waterfall: WaterfallRecord[];
  /** 前月報告時のサービサー格付（提供されなければルール6はスキップ）。 */
  previousServicerRating?: string;
  /** 分析対象月（省略時は monthly の最終月）。 */
  targetMonth?: string;
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------
function fmtPct(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}
function fmtMm(value: number): string {
  const oku = (value / 100).toFixed(1);
  return `${value.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}百万円 (${oku}億円)`;
}
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// -----------------------------------------------------------------------------
// detectAnomalies
// -----------------------------------------------------------------------------
export function detectAnomalies(input: DetectAnomaliesInput): Anomaly[] {
  const { monthly, triggers, deal, waterfall, previousServicerRating } = input;
  if (monthly.length === 0) return [];
  const sorted = [...monthly].sort((a, b) => a.month.localeCompare(b.month));
  const targetIdx = input.targetMonth
    ? sorted.findIndex((m) => m.month === input.targetMonth)
    : sorted.length - 1;
  if (targetIdx < 0) throw new Error(`detectAnomalies: month ${input.targetMonth} not in monthly`);
  const cur = sorted[targetIdx];
  const prev = targetIdx > 0 ? sorted[targetIdx - 1] : null;

  const out: Anomaly[] = [];

  const push = (
    kind: AnomalyKind,
    severity: AnomalySeverity,
    title: string,
    description: string,
    opts: {
      metric_value?: number;
      metric_reference?: number;
      sectionAnchor?: string;
    } = {},
  ) => {
    out.push({
      id: `${kind}-${cur.month}-${out.length}`,
      kind,
      severity,
      title,
      description,
      metric_value: opts.metric_value ?? null,
      metric_reference: opts.metric_reference ?? null,
      detected_month: cur.month,
      sectionAnchor: opts.sectionAnchor,
    });
  };

  // ---------------------------------------------------------------------------
  // Rule 1: 延滞率急増 (high)
  // ---------------------------------------------------------------------------
  if (prev) {
    const prevRate = prev.delinquency_90_plus_rate;
    const curRate = cur.delinquency_90_plus_rate;
    const relChange = prevRate > 0 ? (curRate - prevRate) / prevRate : 0;
    const recent3 = sorted.slice(Math.max(0, targetIdx - 2), targetIdx + 1);
    const strictlyRising =
      recent3.length === 3 &&
      recent3[0].delinquency_90_plus_rate < recent3[1].delinquency_90_plus_rate &&
      recent3[1].delinquency_90_plus_rate < recent3[2].delinquency_90_plus_rate;
    if (relChange > 0.15) {
      push(
        "delinquency_surge",
        "high",
        "90日以上延滞率が急増",
        `当月の90日以上延滞率 ${fmtPct(curRate)} は前月 ${fmtPct(prevRate)} から +${fmtPct(curRate - prevRate, 3)}（相対 +${(relChange * 100).toFixed(1)}%）と、閾値の +15% を上回りました。延滞債権の増加要因を個別債権レベルで精査してください。`,
        {
          metric_value: curRate,
          metric_reference: prevRate,
          sectionAnchor: "delinquency-section",
        },
      );
    } else if (strictlyRising) {
      push(
        "delinquency_surge",
        "high",
        "90日以上延滞率が3ヶ月連続上昇",
        `90日以上延滞率が ${recent3[0].month} ${fmtPct(recent3[0].delinquency_90_plus_rate)} → ${recent3[1].month} ${fmtPct(recent3[1].delinquency_90_plus_rate)} → ${recent3[2].month} ${fmtPct(recent3[2].delinquency_90_plus_rate)} と3ヶ月連続で悪化しています。`,
        {
          metric_value: curRate,
          metric_reference: recent3[0].delinquency_90_plus_rate,
          sectionAnchor: "delinquency-section",
        },
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 2: デフォルト急増 (high)
  // ---------------------------------------------------------------------------
  if (targetIdx >= 6) {
    const lookback = sorted.slice(targetIdx - 6, targetIdx);
    const avg = mean(lookback.map((m) => m.default_count));
    if (avg > 0 && cur.default_count > avg * 1.5) {
      push(
        "default_surge",
        "high",
        "当月デフォルト件数が急増",
        `当月デフォルト件数 ${cur.default_count}件 は過去6ヶ月平均 ${avg.toFixed(1)}件 の ${(cur.default_count / avg).toFixed(2)} 倍であり、1.5 倍の閾値を上回りました。処分状況・事由別の内訳を確認してください。`,
        {
          metric_value: cur.default_count,
          metric_reference: avg,
          sectionAnchor: "default-section",
        },
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 3: トリガー接近 (high)
  // ---------------------------------------------------------------------------
  const curTriggers = triggers.filter((t) => t.month === cur.month);
  for (const t of curTriggers) {
    if (t.direction !== "above_breach") continue;
    if (t.threshold === 0) continue;
    const ratio = t.current_value / t.threshold;
    if (ratio >= 0.7 && !t.breach) {
      push(
        "trigger_approaching",
        "high",
        `${t.trigger_name} がトリガー閾値の70%超に接近`,
        `${t.trigger_name} は当月 ${fmtPct(t.current_value, 3)}（閾値 ${fmtPct(t.threshold, 2)} の ${(ratio * 100).toFixed(1)}%）まで上昇しています。抵触した場合の事後措置（劣後配当停止・早期償還等）を契約書で確認してください。`,
        {
          metric_value: t.current_value,
          metric_reference: t.threshold,
          sectionAnchor: "trigger-section",
        },
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 4: CPR 急変 (medium)
  // ---------------------------------------------------------------------------
  if (prev && prev.cpr_annual > 0) {
    const relChange = (cur.cpr_annual - prev.cpr_annual) / prev.cpr_annual;
    if (Math.abs(relChange) > 0.3) {
      const dir = relChange > 0 ? "上昇" : "低下";
      push(
        "cpr_swing",
        "medium",
        `年率CPRが ${dir}`,
        `年率CPRは前月 ${fmtPct(prev.cpr_annual)} から当月 ${fmtPct(cur.cpr_annual)} へ ${(relChange * 100).toFixed(1)}% ${dir}しました。借換市場・金利環境の変化、大口期限前弁済の発生有無を確認してください。`,
        {
          metric_value: cur.cpr_annual,
          metric_reference: prev.cpr_annual,
          sectionAnchor: "prepayment-section",
        },
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 5: サービサー回収率低下 (medium)
  // ---------------------------------------------------------------------------
  if (targetIdx >= 11) {
    const last12 = sorted.slice(targetIdx - 11, targetIdx + 1);
    const prev12 = sorted.slice(Math.max(0, targetIdx - 23), Math.max(0, targetIdx - 11));
    const recentAvg = mean(last12.map((m) => m.servicer_recovery_rate));
    const priorAvg = prev12.length >= 6 ? mean(prev12.map((m) => m.servicer_recovery_rate)) : recentAvg;
    const drop = priorAvg - recentAvg;
    if (drop >= 0.005) {
      push(
        "servicer_recovery_decline",
        "medium",
        "サービサー回収率が低下傾向",
        `直近12ヶ月平均回収率 ${fmtPct(recentAvg)} は前12ヶ月平均 ${fmtPct(priorAvg)} から -${(drop * 100).toFixed(2)}pp 低下しています。任意売却完了件数・競売進捗の減速など、実務要因を精査してください。`,
        {
          metric_value: recentAvg,
          metric_reference: priorAvg,
          sectionAnchor: "servicer-section",
        },
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 6: サービサー格付変動 (high)
  // ---------------------------------------------------------------------------
  if (previousServicerRating && previousServicerRating !== deal.servicer_rating) {
    push(
      "servicer_rating_change",
      "high",
      "サービサー格付が変動",
      `サービサー格付が ${previousServicerRating} から ${deal.servicer_rating} (${deal.servicer_rating_agency}) に変更されました。バックアップサービサー（${deal.backup_servicer}）への切替トリガーに抵触していないか確認してください。`,
      {
        sectionAnchor: "servicer-section",
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Rule 7: 劣後受益権配当減少 (low)
  // ---------------------------------------------------------------------------
  const subDividendByMonth = new Map<string, number>();
  for (const w of waterfall) {
    if (w.tier_name === "劣後受益権 配当") {
      subDividendByMonth.set(w.month, (subDividendByMonth.get(w.month) ?? 0) + w.amount_mm);
    }
  }
  const divMonths = [...subDividendByMonth.keys()].sort();
  const curDivIdx = divMonths.indexOf(cur.month);
  if (curDivIdx >= 2) {
    const a = subDividendByMonth.get(divMonths[curDivIdx - 2])!;
    const b = subDividendByMonth.get(divMonths[curDivIdx - 1])!;
    const c = subDividendByMonth.get(divMonths[curDivIdx])!;
    if (a > b && b > c && a > 0) {
      push(
        "subordinated_dividend_decline",
        "low",
        "劣後受益権 配当が3ヶ月連続減少",
        `劣後受益権配当が ${divMonths[curDivIdx - 2]} ${fmtMm(a)} → ${divMonths[curDivIdx - 1]} ${fmtMm(b)} → ${cur.month} ${fmtMm(c)} と3ヶ月連続で減少しました。ウォーターフォール上位配分（諸費用・優先受益権利息・元本）の増加要因を確認してください。`,
        {
          metric_value: c,
          metric_reference: a,
          sectionAnchor: "waterfall-section",
        },
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 8: 累積デフォルト率加速 (medium)
  // ---------------------------------------------------------------------------
  if (targetIdx >= 5) {
    const late = sorted.slice(targetIdx - 2, targetIdx + 1);
    const early = sorted.slice(targetIdx - 5, targetIdx - 2);
    const slopeLate = late[2].cumulative_default_rate - late[0].cumulative_default_rate;
    const slopeEarly = early[2].cumulative_default_rate - early[0].cumulative_default_rate;
    if (slopeEarly > 0 && slopeLate > slopeEarly * 1.5) {
      push(
        "cumulative_default_acceleration",
        "medium",
        "累積デフォルト率の増加ペースが加速",
        `累積デフォルト率の直近3ヶ月の増分 ${fmtPct(slopeLate, 3)} は、その前3ヶ月の増分 ${fmtPct(slopeEarly, 3)} の ${(slopeLate / slopeEarly).toFixed(2)} 倍となり、上昇ペースが加速しています。トリガー抵触月の前倒しリスクを評価してください。`,
        {
          metric_value: slopeLate,
          metric_reference: slopeEarly,
          sectionAnchor: "default-section",
        },
      );
    }
  }

  // 重要度降順・検出順にソート
  const rank: Record<AnomalySeverity, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
