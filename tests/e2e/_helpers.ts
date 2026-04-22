/**
 * E2E 共通フィクスチャ。
 * 全テストで react-joyride のツアーをスキップ状態にするため、
 * 各ページ起動前に `localStorage.trust:tour-seen=true` をセットする。
 */
import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("trust:tour-seen", "true");
      } catch {
        /* ignore */
      }
    });
    await use(page);
  },
});

export { expect };
