import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as agentPost } from "@/app/api/ai/agent/route";
import { POST as workflowPost } from "@/app/api/ai/workflow/route";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("AI API ルート（モックモード）", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_MOCK_LLM", "true");
  });

  it("POST /api/ai/agent はモック応答を返す", async () => {
    const res = await agentPost(
      jsonRequest("http://localhost/api/ai/agent", { message: "1+1は？" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toContain("モック応答");
    expect(json.steps.length).toBeGreaterThan(0);
    expect(json.steps[0].functionCalls?.[0].name).toBe("calculate");
  });

  it("POST /api/ai/agent は message なしで 400 を返す", async () => {
    const res = await agentPost(
      jsonRequest("http://localhost/api/ai/agent", {}),
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/ai/workflow はモック応答を返す", async () => {
    const res = await workflowPost(
      jsonRequest("http://localhost/api/ai/workflow", { text: "長い文章..." }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.steps.map((s: { author: string }) => s.author)).toEqual([
      "summarizer",
      "translator",
      "title_writer",
    ]);
  });

  it("POST /api/ai/workflow は不正な JSON で 400 を返す", async () => {
    const res = await workflowPost(
      new Request("http://localhost/api/ai/workflow", {
        method: "POST",
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });
});
