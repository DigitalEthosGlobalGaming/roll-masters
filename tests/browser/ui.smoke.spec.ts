import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/?ui-gallery");
  // The gallery boots the actual engine/assets without loading a player's save.
  await expect(page.getByRole("slider")).toHaveCount(3);
  expect(errors, "startup must not throw an uncaught error").toEqual([]);
});

test("real engine exposes working slider keyboard controls", async ({ page }) => {
  const slider = page.getByRole("slider").first();
  await expect(slider).toHaveValue("5");
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue("5.5");
  await slider.press("End");
  await expect(slider).toHaveValue("10");
});

test("narrow viewport and orientation changes preserve usable controls", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const slider = page.getByRole("slider").first();
  await slider.press("Home");
  await expect(slider).toHaveValue("0");
  await page.setViewportSize({ width: 640, height: 360 });
  await slider.press("End");
  await expect(slider).toHaveValue("10");
});

test("fresh contexts isolate gallery state between parallel tests", async ({ page }) => {
  await expect(page.getByRole("slider").first()).toHaveValue("5");
  expect(await page.evaluate(() => localStorage.getItem("save"))).toBeNull();
});
