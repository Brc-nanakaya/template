import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "crypto";

/**
 * scrypt の Promise ラッパー。
 * `promisify(scrypt)` の型は options 付きオーバーロードを拾えないため自前で包む。
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keyLen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

/**
 * パスワードハッシュ。Node.js 標準の scrypt のみを使い外部依存を持たない。
 *
 * 保存形式: `scrypt$N$r$p$<salt(base64)>$<hash(base64)>`
 * パラメータを文字列に含めるため、後からコストを上げても既存ハッシュを検証できる。
 */

const N = 16384; // CPU/メモリコスト（2^14）
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

export const PASSWORD_MIN_LENGTH = 8;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEY_LEN, {
    N,
    r: R,
    p: P,
    // scrypt のデフォルト maxmem (32MB) は N=16384 では足りるが明示しておく
    maxmem: 64 * 1024 * 1024,
  });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  let expected: Buffer;
  let salt: Buffer;
  try {
    expected = Buffer.from(hashB64, "base64");
    salt = Buffer.from(saltB64, "base64");
  } catch {
    return false;
  }
  if (expected.length === 0 || salt.length === 0) return false;

  let actual: Buffer;
  try {
    actual = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: 256 * 1024 * 1024,
    });
  } catch {
    // 保存値のパラメータが不正（メモリ超過など）でも例外を漏らさない
    return false;
  }

  // 長さが同じことは保証されているのでそのまま定数時間比較
  return timingSafeEqual(actual, expected);
}

/** ログイン ID は大文字小文字・前後空白を無視して突合する */
export function normalizeLoginId(loginId: string): string {
  return loginId.trim().toLowerCase();
}
