import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// DATABASE_URL などを webServer / setup に渡すため先に読み込む
loadEnv({ path: [".env.local", ".env"], quiet: true });

/** ログイン済み状態を保存する場所（auth.setup.ts が生成する） */
export const STORAGE_STATE = "tests/e2e/.auth/user.json";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // 1 回だけログインして storageState を作る。以降のプロジェクトが再利用する
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // 3000 は他プロジェクトとの競合回避のため 3100 を使用。
    command: "npx next dev -p 3100",
    url: "http://localhost:3100/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_MOCK_LLM: "true",
      // ログイン画面のデモ用初期値は E2E では邪魔なので無効化する
      NEXT_PUBLIC_DEMO_LOGIN_HINT: "false",
      // .env.local に実 API キーがあっても E2E は必ずモック応答にする
      // （実 API を叩くとレスポンス内容が変わりテストが不安定になる）
      OPENAI_API_KEY: "",
      GOOGLE_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
  },
});
