import { readFileSync } from "fs";

/**
 * PostgreSQL への TLS 設定を組み立てる。
 *
 * AWS RDS / Azure Database for PostgreSQL はいずれも TLS 必須で、
 * 「暗号化するだけ（require）」と「証明書まで検証する（verify-full）」の
 * 2 段階がある。中間者攻撃を防げるのは verify-full だけなので、
 * 本番では CA 証明書を渡して verify-full にする。
 *
 * 環境変数:
 *   DATABASE_SSL            disable | require | verify-full
 *                           （未指定なら localhost は disable、それ以外は require）
 *   DATABASE_CA_CERT        CA 証明書の PEM 本文（base64 でも可）
 *   DATABASE_CA_CERT_PATH   CA 証明書ファイルのパス
 */

export type SslMode = "disable" | "require" | "verify-full";

/** postgres-js の ssl オプションに渡せる値 */
export type SslOption =
  | false
  | "require"
  | "verify-full"
  | { ca: string; rejectUnauthorized: true };

export function isLocalDatabase(url: string): boolean {
  return /@(localhost|127\.0\.0\.1|host\.docker\.internal|db)[:/]/.test(url);
}

function resolveMode(url: string): SslMode {
  const raw = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (raw === "disable" || raw === "require" || raw === "verify-full") {
    return raw;
  }
  if (raw) {
    throw new Error(
      `DATABASE_SSL の値が不正です: "${raw}"（disable / require / verify-full のいずれか）`,
    );
  }
  return isLocalDatabase(url) ? "disable" : "require";
}

/** CA 証明書を読み込む。PEM 直書き / base64 / ファイルパスに対応 */
function loadCaCert(): string | undefined {
  const inline = process.env.DATABASE_CA_CERT?.trim();
  if (inline) {
    if (inline.includes("BEGIN CERTIFICATE")) return inline;
    // 環境変数に入れやすいよう base64 も受け付ける
    const decoded = Buffer.from(inline, "base64").toString("utf-8");
    if (decoded.includes("BEGIN CERTIFICATE")) return decoded;
    throw new Error(
      "DATABASE_CA_CERT を PEM として解釈できません（PEM 本文か base64 を設定してください）",
    );
  }

  const path = process.env.DATABASE_CA_CERT_PATH?.trim();
  if (path) {
    try {
      return readFileSync(path, "utf-8");
    } catch (e) {
      throw new Error(
        `DATABASE_CA_CERT_PATH を読み込めません: ${path}（${e instanceof Error ? e.message : e}）`,
      );
    }
  }

  return undefined;
}

/** 接続文字列から postgres-js の ssl オプションを決める */
export function resolveSsl(url: string): SslOption {
  const mode = resolveMode(url);
  if (mode === "disable") return false;
  if (mode === "require") return "require";

  const ca = loadCaCert();
  if (!ca) {
    // CA 未指定でも verify-full は動く（OS 標準のルート証明書を使う）。
    // AWS RDS / Azure は専用の CA なので、通常は CA の指定が必要になる
    return "verify-full";
  }
  return { ca, rejectUnauthorized: true };
}

/**
 * 1 プロセスあたりの最大接続数。
 *
 * ECS / App Runner / Container Apps のような常駐コンテナでは
 * 接続を再利用できるので数本持つのが効率的。
 * Lambda など「リクエストごとにプロセスが増える」実行形態では 1 にして、
 * 代わりに RDS Proxy / PgBouncer を前に置く。
 *
 * RDS db.t4g.micro の max_connections は約 80 なので、
 * `DATABASE_POOL_MAX × 最大インスタンス数` がそれを超えないようにする。
 */
export function resolvePoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX;
  if (!raw) return 5;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`DATABASE_POOL_MAX が不正です: "${raw}"（1 以上の整数）`);
  }
  return n;
}
