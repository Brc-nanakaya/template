import { test, expect } from "@playwright/test";

test("home page renders title, subtitle, primary CTA and upload area", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-title")).toBeVisible();
  await expect(page.getByTestId("home-subtitle")).toBeVisible();
  await expect(page.getByTestId("home-btn-load-sample")).toBeVisible();
  await expect(page.getByTestId("home-upload-area")).toBeVisible();
  await expect(page.getByTestId("home-input-file")).toBeAttached();
  // go-to-dashboard button is rendered but disabled until a file is chosen
  const goBtn = page.getByTestId("home-btn-go-dashboard");
  await expect(goBtn).toBeVisible();
  await expect(goBtn).toBeDisabled();
});

test("sample-data CTA navigates to /dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("home-btn-load-sample").click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByTestId("dashboard-main")).toBeVisible();
});
