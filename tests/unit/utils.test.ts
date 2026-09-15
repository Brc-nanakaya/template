import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("クラス名を結合する", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("falsy な値を無視する", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("Tailwind の競合クラスは後勝ちでマージされる", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
