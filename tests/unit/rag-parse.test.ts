import { describe, expect, it } from "vitest";
import { DEMO_LAWS } from "@/lib/rag/demo-corpus";
import {
  extractReferences,
  inferLawIds,
  parseArticleMentions,
  parseLawMarkdown,
} from "@/lib/rag/parse";

describe("parseLawMarkdown", () => {
  const internal = DEMO_LAWS.find((l) => l.lawId === "demo-internal-control")!;
  const parsed = parseLawMarkdown({
    lawId: internal.lawId,
    title: internal.title,
    markdown: internal.body,
  });

  it("条単位でチャンク化する", () => {
    expect(parsed.chunks.map((c) => c.chunkKey)).toEqual([
      "demo-internal-control:1",
      "demo-internal-control:2",
      "demo-internal-control:3",
      "demo-internal-control:4",
      "demo-internal-control:5",
      "demo-internal-control:6",
      "demo-internal-control:7",
    ]);
    expect(parsed.chunks[6]?.heading).toBe("違反");
    expect(parsed.chunks[3]?.heading).toBe("取締役の責任");
  });

  it("準用を参照辺にする", () => {
    const hops = parsed.references.filter((r) => r.fromChunkKey === "demo-internal-control:5");
    expect(hops).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toLawId: "demo-internal-control",
          toArticle: 4,
          kind: "applies",
          toChunkKey: "demo-internal-control:4",
        }),
      ]),
    );
  });
});

describe("extractReferences", () => {
  it("前条と他法令の条項を取る", () => {
    const chunk = {
      chunkKey: "sample-ordinance:3",
      lawId: "sample-ordinance",
      lawTitle: "サンプル条例",
      article: 3,
      paragraph: null,
      heading: null,
      body: "前条の手続に加え、建築士法施行規則第21条第4項の保存が必要である。監査の手続については第4条の規定を準用する。",
    };
    const refs = extractReferences(chunk, "sample-ordinance");
    expect(refs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toLawId: "sample-ordinance",
          toArticle: 2,
          rawText: "前条",
        }),
        expect.objectContaining({
          toArticle: 21,
          rawText: "建築士法施行規則第21条第4項",
        }),
        expect.objectContaining({
          toLawId: "sample-ordinance",
          toArticle: 4,
          kind: "applies",
        }),
      ]),
    );
  });
});

describe("query helpers", () => {
  it("条番号を抽出する", () => {
    expect(parseArticleMentions("第 6 条の保存")).toEqual([6]);
  });

  it("規程名から法令 ID を推定する", () => {
    expect(inferLawIds("機密情報の保存期間")).toContain("demo-info-policy");
  });
});
