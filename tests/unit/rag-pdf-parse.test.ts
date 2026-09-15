import { describe, expect, it } from "vitest";
import { embedLocal, cosineSimilarity } from "@/lib/rag/embed";
import { parseOrdinancePages } from "@/lib/rag/parse";

describe("条例 PDF 相当テキストの分解", () => {
  it("改行が崩れても条で切る", () => {
    const parsed = parseOrdinancePages({
      lawId: "ward-sample",
      title: "○○区○○条例",
      pages: [
        {
          page: 1,
          text: "○○区○○条例 第1条（目的）この条例は区民の安全を確保することを目的とする。第2条（定義）この条例において「事業者」とは区内で事業を営む者をいう。",
        },
        {
          page: 2,
          text: "第3条（保存）記録の保存については第2条の規定を準用する。",
        },
      ],
    });

    expect(parsed.chunks.map((c) => c.article)).toEqual([1, 2, 3]);
    expect(parsed.chunks[0]?.pageStart).toBe(1);
    expect(parsed.chunks[2]?.pageStart).toBe(2);
    expect(parsed.references[0]).toEqual(
      expect.objectContaining({
        fromChunkKey: "ward-sample:3",
        toArticle: 2,
        kind: "applies",
      }),
    );
  });

  it("本文中の『第6条に』は新しい条にしない", () => {
    const parsed = parseOrdinancePages({
      lawId: "x",
      title: "x",
      pages: [
        {
          page: 1,
          text: "第1条（違反）第6条に違反した者は処分する。",
        },
      ],
    });
    expect(parsed.chunks).toHaveLength(1);
    expect(parsed.chunks[0]?.article).toBe(1);
  });
});

describe("ローカル埋め込み", () => {
  it("近い文の方がコサイン類似度が高い", () => {
    const a = embedLocal("記録は7年間保存しなければならない");
    const b = embedLocal("内部統制の記録の保存期間は何年か");
    const c = embedLocal("宇宙旅行の許可条件");
    expect(cosineSimilarity(a, b)).toBeGreaterThan(cosineSimilarity(a, c));
  });
});
