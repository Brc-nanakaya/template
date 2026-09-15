import { describe, expect, it } from "vitest";
import { INDUSTRIES, listCatalogApps } from "@/lib/catalog/industries";

describe("業界カタログ", () => {
  it("自動車と金融を含む", () => {
    expect(INDUSTRIES.map((i) => i.id)).toEqual(
      expect.arrayContaining(["automotive", "finance"]),
    );
    expect(INDUSTRIES.find((i) => i.id === "automotive")?.name).toBe("自動車");
    expect(INDUSTRIES.find((i) => i.id === "finance")?.name).toBe("金融");
  });

  it("各業界に 1 つ以上のアプリがあり、testid は重複しない", () => {
    for (const industry of INDUSTRIES) {
      expect(industry.apps.length, industry.id).toBeGreaterThan(0);
    }
    const ids = listCatalogApps().map((a) => a.testid);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
