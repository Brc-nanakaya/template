// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildReport } from "@/lib/report-builder";
import { loadAllSampleData } from "@/lib/loaders";
import type { TrustDataset } from "@/lib/types";

const FIXED_DATE = new Date("2026-04-10T10:30:00");

async function dataset(): Promise<TrustDataset> {
  return loadAllSampleData();
}

describe("buildReport", () => {
  it("renders all 8 sections defined in T15", async () => {
    const ds = await dataset();
    const md = buildReport({ dataset: ds, generatedAt: FIXED_DATE });
    // 表紙には deal_name が H1
    expect(md).toMatch(/^# SBI新生住宅ローン信託/);
    // 1. 案件概要
    expect(md).toContain("## 1. 案件概要");
    // 2. 当月サマリー
    expect(md).toContain("## 2. 当月サマリー");
    // 3. プール実績
    expect(md).toContain("## 3. プール実績");
    // 4. キャッシュフロー配分
    expect(md).toContain("## 4. キャッシュフロー配分");
    // 5. トリガー状況
    expect(md).toContain("## 5. トリガー状況");
    // 6. ポートフォリオ特性
    expect(md).toContain("## 6. ポートフォリオ特性");
    // 7. 翌月留意事項
    expect(md).toContain("## 7. 翌月留意事項");
  });

  it("formats monetary values as 3桁区切り + 億円 (process.md 共通ルール)", async () => {
    const ds = await dataset();
    const md = buildReport({ dataset: ds, generatedAt: FIXED_DATE });
    // 初期プール残高 120,000 百万円 → "120,000.0百万円 (1200.0億円)"
    expect(md).toMatch(/120,000(\.0)?百万円\s+\(1200\.0億円\)/);
    // 当月プール残高 96,651 百万円前後
    expect(md).toMatch(/96,651(\.0)?百万円\s+\(966\.5億円\)/);
  });

  it("embeds current report month and generation timestamp on the cover", async () => {
    const ds = await dataset();
    const md = buildReport({ dataset: ds, generatedAt: FIXED_DATE });
    expect(md).toContain("報告基準月: **2026年03月**");
    expect(md).toContain("作成日時: 2026-04-10 10:30");
  });

  it("includes waterfall total and all tiers in CF section", async () => {
    const ds = await dataset();
    const md = buildReport({ dataset: ds, generatedAt: FIXED_DATE });
    expect(md).toContain("| 1 | 信託報酬・諸費用 |");
    expect(md).toContain("| 6 | 劣後受益権 配当 |");
    expect(md).toMatch(/\*\*合計\*\*/);
  });

  it("falls back to placeholder when aiCommentary is omitted", async () => {
    const ds = await dataset();
    const md = buildReport({ dataset: ds });
    expect(md).toContain("（AI 所見は未生成です");
  });

  it("inlines provided aiCommentary in the 翌月留意事項 section", async () => {
    const ds = await dataset();
    const commentary = `### 当月サマリー\n残高は順調に償却中。\n### 延滞デフォルト\n90日以上延滞率は閾値の85%まで上昇。`;
    const md = buildReport({ dataset: ds, aiCommentary: commentary });
    const notesIndex = md.indexOf("## 7. 翌月留意事項");
    const after = md.slice(notesIndex);
    expect(after).toContain("### 当月サマリー");
    expect(after).toContain("### 延滞デフォルト");
  });

  it("throws on empty monthly array", async () => {
    const ds = await dataset();
    expect(() => buildReport({ dataset: { ...ds, monthly: [] } })).toThrow(
      /monthly/,
    );
  });
});
