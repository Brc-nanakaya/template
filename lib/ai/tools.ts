import { FunctionTool } from "@google/adk";
import { z } from "zod";

/**
 * AI エージェントに渡すツールのサンプル。
 * FunctionTool は「LLM が呼び出せる関数」で、name / description /
 * parameters（Zod スキーマ）をもとにモデルへ関数定義が公開される。
 */

/** 現在日時を返すツール。引数なしのシンプルな例。 */
export const getCurrentTimeTool = new FunctionTool({
  name: "get_current_time",
  description: "現在の日時を ISO 8601 形式で返す",
  execute: () => ({ now: new Date().toISOString() }),
});

/** 四則演算ツール。Zod スキーマで引数を型安全に受け取る例。 */
export const calculatorTool = new FunctionTool({
  name: "calculate",
  description: "2 つの数値の四則演算を行い、結果を返す",
  parameters: z.object({
    a: z.number().describe("左辺の数値"),
    b: z.number().describe("右辺の数値"),
    operator: z.enum(["+", "-", "*", "/"]).describe("演算子"),
  }),
  execute: ({ a, b, operator }) => {
    switch (operator) {
      case "+":
        return { result: a + b };
      case "-":
        return { result: a - b };
      case "*":
        return { result: a * b };
      case "/":
        if (b === 0) return { error: "0 で割ることはできません" };
        return { result: a / b };
    }
  },
});
