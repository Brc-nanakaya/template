import { describe, it, expect } from "vitest";
import {
  fmtMm,
  fmtNumber,
  fmtPct,
  fmtSignedPct,
  fmtSignedPp,
  fmtSignedMm,
  fmtMonth,
} from "@/lib/formatters";

describe("formatters", () => {
  it("fmtMm: 3桁区切りと億円併記", () => {
    expect(fmtMm(96651)).toBe("96,651百万円 (966.5億円)");
    expect(fmtMm(1234.5)).toBe("1,234.5百万円 (12.3億円)");
    expect(fmtMm(500, { showOku: false })).toBe("500百万円");
  });

  it("fmtNumber: カンマ区切り整数", () => {
    expect(fmtNumber(1234567)).toBe("1,234,567");
    expect(fmtNumber(0)).toBe("0");
  });

  it("fmtPct: 小数を % 変換（既定 2 桁）", () => {
    expect(fmtPct(0.0065)).toBe("0.65%");
    expect(fmtPct(0.12345, 3)).toBe("12.345%");
    expect(fmtPct(0)).toBe("0.00%");
  });

  it("fmtSignedPct: 符号付き", () => {
    expect(fmtSignedPct(0.012)).toBe("+1.2%");
    expect(fmtSignedPct(-0.005)).toBe("-0.5%");
    expect(fmtSignedPct(0)).toBe("+0.0%");
  });

  it("fmtSignedPp: pp（既定 2 桁）", () => {
    expect(fmtSignedPp(0.0015)).toBe("+0.15pp");
    expect(fmtSignedPp(-0.003, 2)).toBe("-0.30pp");
  });

  it("fmtSignedMm: 百万円差分", () => {
    expect(fmtSignedMm(1200)).toBe("+1,200百万円");
    expect(fmtSignedMm(-450.5)).toBe("-450.5百万円");
  });

  it("fmtMonth: YYYY-MM → YYYY年MM月", () => {
    expect(fmtMonth("2026-03")).toBe("2026年03月");
    expect(fmtMonth("invalid")).toBe("invalid");
  });
});
