// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/generate-commentary/route";

const SAMPLE_BODY = {
  dealInfo: {
    deal_name: "TEST 信託",
    report_month: "2026-03",
    servicer: "テスト銀行",
  },
  currentMonth: { month: "2026-03", pool_balance_mm: 96_651 },
  monthlyHistory: [{ month: "2026-02", pool_balance_mm: 97_680 }],
  anomalies: [
    { severity: "high", title: "延滞急増", description: "desc" },
  ],
  triggerStatus: [],
};

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/generate-commentary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate-commentary", () => {
  const origMock = process.env.NEXT_PUBLIC_MOCK_LLM;
  const origKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });
  afterEach(() => {
    if (origMock === undefined) delete process.env.NEXT_PUBLIC_MOCK_LLM;
    else process.env.NEXT_PUBLIC_MOCK_LLM = origMock;
    if (origKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = origKey;
  });

  it("returns mock commentary when NEXT_PUBLIC_MOCK_LLM=true", async () => {
    process.env.NEXT_PUBLIC_MOCK_LLM = "true";
    const res = await POST(makeReq(SAMPLE_BODY) as never);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { commentary: string; mode: string };
    expect(data.mode).toBe("mock");
    expect(data.commentary).toContain("### 当月サマリー");
    expect(data.commentary).toContain("### 延滞デフォルト");
    expect(data.commentary).toContain("### トリガー");
    expect(data.commentary).toContain("### 翌月留意事項");
  });

  it("falls back to template when no API key and no mock", async () => {
    process.env.NEXT_PUBLIC_MOCK_LLM = "false";
    delete process.env.OPENAI_API_KEY;
    const res = await POST(makeReq(SAMPLE_BODY) as never);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { commentary: string; mode: string };
    expect(data.mode).toBe("fallback");
    // 4 section ヘッダーが揃っている
    const sectionCount = (data.commentary.match(/^### /gm) ?? []).length;
    expect(sectionCount).toBe(4);
  });

  it("returns 400 on invalid JSON body", async () => {
    process.env.NEXT_PUBLIC_MOCK_LLM = "false";
    const req = new Request("http://localhost/api/generate-commentary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("mock response completes quickly (<5s)", async () => {
    process.env.NEXT_PUBLIC_MOCK_LLM = "true";
    const start = Date.now();
    const res = await POST(makeReq(SAMPLE_BODY) as never);
    await res.json();
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
