// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  loadAllSampleData,
  loadDealInfo,
  loadLoanTape,
  loadMonthlyPerformance,
  parseNumber,
  parseBoolean,
  stripBOM,
  parseCSV,
  parseMonthlyPerformance,
  parseTriggerHistory,
  convertUserUpload,
} from "@/lib/loaders";

describe("stripBOM", () => {
  it("removes leading UTF-8 BOM", () => {
    const withBom = `﻿col\n1\n`;
    expect(stripBOM(withBom)).toBe("col\n1\n");
  });

  it("leaves plain strings untouched", () => {
    expect(stripBOM("hello")).toBe("hello");
  });
});

describe("parseNumber", () => {
  it("handles カンマ区切り・前後空白", () => {
    expect(parseNumber(" 1,234.5 ")).toBe(1234.5);
  });

  it("normalizes % to decimal", () => {
    expect(parseNumber("0.65%")).toBeCloseTo(0.0065, 6);
  });

  it("returns null for empty/dash/N/A", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("-")).toBeNull();
    expect(parseNumber("N/A")).toBeNull();
  });

  it("strips 円・百万・¥", () => {
    expect(parseNumber("¥1,234")).toBe(1234);
    expect(parseNumber("1,234百万円")).toBe(1234);
  });
});

describe("parseBoolean", () => {
  it("accepts true/false tokens", () => {
    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean("FALSE")).toBe(false);
    expect(parseBoolean("1")).toBe(true);
    expect(parseBoolean("はい")).toBe(true);
    expect(parseBoolean("")).toBeNull();
  });
});

describe("parseCSV", () => {
  it("auto-coerces numeric columns and trims strings", () => {
    const csv = `name,amount\n"東京","1,234"\n"大阪","2,345"\n`;
    const rows = parseCSV<{ name: string; amount: number }>(csv, { numericColumns: ["amount"] });
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("東京");
    expect(rows[0].amount).toBe(1234);
    expect(rows[1].amount).toBe(2345);
  });

  it("raises a CSV parse error when column count mismatches", () => {
    // 引用符で囲まれていないカンマ付き数値は列がずれるため、明示的にエラーにする
    const malformed = "name,amount\n東京, 1,234\n";
    expect(() => parseCSV(malformed)).toThrow(/CSV parse errors/);
  });

  it("handles BOM prefix", () => {
    const csv = `﻿key,value\nfoo,1\n`;
    const rows = parseCSV<{ key: string; value: number }>(csv, { numericColumns: ["value"] });
    expect(rows[0].key).toBe("foo");
    expect(rows[0].value).toBe(1);
  });
});

describe("parseMonthlyPerformance", () => {
  it("coerces numeric columns to number", () => {
    const csv =
      "month,pool_balance_mm,delinquency_90_plus_rate\n2026-03,96651,0.0065\n";
    const rows = parseMonthlyPerformance(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].pool_balance_mm).toBe(96651);
    expect(rows[0].delinquency_90_plus_rate).toBeCloseTo(0.0065, 6);
  });
});

describe("parseTriggerHistory", () => {
  it("coerces breach column to boolean", () => {
    const csv =
      "month,trigger_name,threshold,current_value,breach,direction\n" +
      "2026-03,累積デフォルト率,0.03,0.002,false,above_breach\n";
    const rows = parseTriggerHistory(csv);
    expect(rows[0].breach).toBe(false);
    expect(rows[0].threshold).toBe(0.03);
  });
});

describe("loaders (sample data)", () => {
  it("loadDealInfo returns deal metadata", async () => {
    const deal = await loadDealInfo();
    expect(deal.deal_id).toBe("SBIST-RMBS-2024-01");
    expect(deal.trigger_thresholds.delinquency_90_rate).toBeCloseTo(0.015, 4);
    expect(deal.waterfall_priority).toHaveLength(6);
  });

  it("loadMonthlyPerformance returns 24 rows with current pool 96,651", async () => {
    const rows = await loadMonthlyPerformance();
    expect(rows).toHaveLength(24);
    expect(rows[23].pool_balance_mm).toBe(96651);
  });

  it("loadLoanTape returns 200 loans", async () => {
    const loans = await loadLoanTape();
    expect(loans).toHaveLength(200);
    expect(loans[0].loan_id).toMatch(/^L\d{5}$/);
    expect(loans[0].prefecture.length).toBeGreaterThan(1);
  });

  it("loadAllSampleData returns correct record counts", async () => {
    const ds = await loadAllSampleData();
    expect(ds.loans).toHaveLength(200);
    expect(ds.monthly).toHaveLength(24);
    expect(ds.defaults).toHaveLength(118);
    expect(ds.prepayments).toHaveLength(586);
    expect(ds.regional.length).toBeGreaterThanOrEqual(47);
    expect(ds.triggers.length).toBe(96); // 4 trigger × 24 month
    expect(ds.waterfall.length).toBe(144); // 6 tier × 24 month
    expect(ds.aging.length).toBe(72); // 3 bucket × 24 month
    expect(ds.servicerReport.report_month).toBe("2026-03");
  });
});

describe("convertUserUpload", () => {
  it("parses uploaded monthly_performance CSV text", () => {
    const csv = "month,pool_balance_mm\n2026-03,96651\n";
    const result = convertUserUpload("monthly_performance", csv);
    expect(result.kind).toBe("monthly_performance");
    if (result.kind === "monthly_performance") {
      expect(result.data[0].pool_balance_mm).toBe(96651);
    }
  });

  it("parses uploaded deal_info JSON text", () => {
    const json = JSON.stringify({
      deal_id: "X",
      deal_name: "Y",
      contract_number: "Z",
    });
    const result = convertUserUpload("deal_info", json);
    expect(result.kind).toBe("deal_info");
    if (result.kind === "deal_info") {
      expect(result.data.deal_id).toBe("X");
    }
  });
});
