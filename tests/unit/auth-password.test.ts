// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  hashPassword,
  normalizeLoginId,
  verifyPassword,
} from "@/lib/auth/password";

describe("auth/password", () => {
  it("ハッシュ化したパスワードを検証できる", async () => {
    const hash = await hashPassword("demo1234");
    expect(await verifyPassword("demo1234", hash)).toBe(true);
  });

  it("違うパスワードは通らない", async () => {
    const hash = await hashPassword("demo1234");
    expect(await verifyPassword("demo12345", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("同じパスワードでも salt が異なるためハッシュは毎回変わる", async () => {
    const a = await hashPassword("demo1234");
    const b = await hashPassword("demo1234");
    expect(a).not.toBe(b);
    expect(await verifyPassword("demo1234", b)).toBe(true);
  });

  it("保存形式にパラメータが含まれる", async () => {
    const hash = await hashPassword("demo1234");
    const parts = hash.split("$");
    expect(parts[0]).toBe("scrypt");
    expect(Number(parts[1])).toBeGreaterThan(0);
    expect(parts).toHaveLength(6);
  });

  it("壊れたハッシュ文字列は例外を投げずに false", async () => {
    for (const broken of [
      "",
      "not-a-hash",
      "scrypt$x$8$1$aaaa$bbbb",
      "bcrypt$16384$8$1$aaaa$bbbb",
      "scrypt$16384$8$1$$",
    ]) {
      expect(await verifyPassword("demo1234", broken)).toBe(false);
    }
  });

  it("Unicode 正規化してから比較する（濁点の合成有無を吸収）", async () => {
    // "ガ" の合成済み / 結合文字版
    const composed = "ガード1234";
    const decomposed = "ガード1234".normalize("NFD");
    const hash = await hashPassword(composed);
    expect(await verifyPassword(decomposed, hash)).toBe(true);
  });

  it("ログイン ID は前後空白と大文字小文字を無視する", () => {
    expect(normalizeLoginId("  Demo@Example.COM ")).toBe("demo@example.com");
  });
});
