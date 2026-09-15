import { defineConfig } from "drizzle-kit";
import "./lib/db/env";

/**
 * drizzle-kit の設定。
 * DATABASE_URL をローカル（Docker）とクラウド（AWS RDS / Azure）で切り替えるだけでよい。
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
