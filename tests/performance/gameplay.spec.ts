import { test, expect, type Page } from "@playwright/test";

async function tapControl(page: Page, name: string) {
  await expect.poll(() => page.evaluate(name => window.gameBenchmark!.controlCenter(name), name)).not.toBeNull();
  const point = await page.evaluate(name => window.gameBenchmark!.controlCenter(name), name);
  await page.touchscreen.tap(point!.x, point!.y);
}

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`gameplay input and lazy menus ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.setViewportSize(viewport);
    await page.goto("/?pieces=0");
    await page.waitForFunction(() => !!window.gameBenchmark);
    await tapControl(page, "Menu");
    await expect(page.getByRole("button", { name: "Help", exact: true })).toBeVisible();
    await tapControl(page, "Close");
    await tapControl(page, "Ascend:");
    await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
    await tapControl(page, "Close");
    await tapControl(page, "Dice, 10 gold");
    const point = await page.evaluate(() => window.gameBenchmark!.cellCenter(8, 8));
    await page.touchscreen.tap(point.x, point.y);
    await expect.poll(() => page.evaluate(() => window.gameBenchmark!.inspect().dice)).toBe(1);
    await tapControl(page, "Roll");
    await page.touchscreen.tap(point.x, point.y);
    await expect.poll(() => page.evaluate(() => window.gameBenchmark!.inspect().score)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.gameBenchmark!.inspect().enabledBuildingColliders)).toBe(0);
    const processing = await page.evaluate(() => window.gameBenchmark!.inspect());
    expect(processing.collisionProcessing).toBe(false);
    expect(processing.buildingPointers).toBe(0);
    expect(processing.gridCellActors).toBe(0);
    // Reopening must refresh the wallet after scoring while the modal was closed.
    await tapControl(page, "Ascend:");
    await tapControl(page, "Close");
    // Shrinking removes the cell and its piece from the real entity hierarchy.
    await page.evaluate(() => window.gameBenchmark!.resize(8));
    await expect.poll(() => page.evaluate(() => window.gameBenchmark!.inspect().dice)).toBe(0);
    await page.evaluate(() => window.gameBenchmark!.resize(18));
    await page.screenshot({ path: info.outputPath("resized-board.png") });
    expect(errors).toEqual([]);
  });
}

test("adjacent pawns survive save/reload and keep automating", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/?pieces=0");
  await page.waitForFunction(() => !!window.gameBenchmark);
  await page.evaluate(() => window.gameBenchmark!.addPawnChain());
  await expect.poll(() => page.evaluate(() => window.gameBenchmark!.inspect().pawns)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.gameBenchmark!.inspect().score), { timeout: 20_000 }).toBeGreaterThan(10);
  const before = await page.evaluate(() => window.gameBenchmark!.inspect());
  await page.evaluate(() => window.gameBenchmark!.reloadSave());
  await expect.poll(() => page.evaluate(() => window.gameBenchmark!.inspect().playerId)).not.toBe(before.playerId);
  await expect.poll(() => page.evaluate(() => window.gameBenchmark!.inspect().pawns)).toBe(2);
  expect(await page.evaluate(() => window.gameBenchmark!.inspect().pawnTimer)).toBe(true);
  const score = await page.evaluate(() => window.gameBenchmark!.inspect().score);
  await expect.poll(() => page.evaluate(() => window.gameBenchmark!.inspect().score), { timeout: 20_000 }).toBeGreaterThan(score);
  expect(errors).toEqual([]);
});
