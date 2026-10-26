import { expect, test, type Page } from "@playwright/test";

// Versioned screenshots are only rewritten on purpose: `UPDATE_SCREENSHOTS=1 pnpm test:e2e`.
const SHOTS = process.env.UPDATE_SCREENSHOTS === "1" ? "docs/screenshots" : "test-results/screenshots";

async function noHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

async function settle(page: Page) {
  await page.locator(".react-flow__node").first().waitFor();
  // Let fit/center animations finish before asserting or capturing.
  await page.waitForTimeout(600);
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("loads, selects nodes, navigates and toggles dark mode", async ({ page }) => {
    await page.goto("/");
    await settle(page);

    await expect(page.getByTestId("map-header")).toContainText("universe · universe: el spec · 26 nodos");
    await expect(page.getByText("Sigue una rama y abre cada nodo.")).toBeVisible();
    await expect(page.locator(".react-flow__node")).toHaveCount(26);
    await expect(page.getByTestId("zoom-readout")).toHaveText(/^\d+%$/);

    const title = page.getByTestId("detail-title");
    const position = page.getByTestId("detail-position");
    await expect(title).toHaveText("Problema");
    await expect(position).toHaveText("1/9 · camino principal");
    await expect(page.getByTestId("nav-prev")).toBeDisabled();

    await page.screenshot({ path: `${SHOTS}/desktop-light.png` });

    // Clicking a node updates the panel.
    await page.locator('.react-flow__node[data-id="stack"]').click();
    await expect(title).toHaveText("Stack");
    await expect(position).toHaveText("4/9 · camino principal");

    // siguiente / anterior follow the main path.
    await page.getByTestId("nav-next").click();
    await expect(title).toHaveText("Arquitectura");
    await page.getByTestId("nav-prev").click();
    await page.getByTestId("nav-prev").click();
    await expect(title).toHaveText("Flujo de usuario");

    // Branch node: anterior = parent, siguiente = next main node.
    await page.locator('.react-flow__node[data-id="referencias-mobbin"]').click();
    await expect(position).toHaveText("rama de Flujo de usuario");
    await page.getByTestId("nav-next").click();
    await expect(title).toHaveText("Stack");

    // Chips select connected nodes.
    await page.getByTestId("connection-chip").filter({ hasText: "React Flow UI" }).click();
    await expect(title).toHaveText("React Flow UI");

    // Dark mode.
    await page.getByRole("radio", { name: "Modo oscuro" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByTestId("nav-prev").click();
    await expect(title).toHaveText("Stack");
    await page.getByRole("button", { name: "Ajustar" }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/desktop-dark.png` });

    await page.getByRole("radio", { name: "Modo claro" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("switches to the Share modal map", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await page.getByTestId("map-picker").click();
    await page.getByRole("option", { name: "Share modal" }).click();
    await expect(page.getByTestId("map-header")).toContainText("Share modal · 9 nodos");
    await expect(page.getByTestId("detail-title")).toHaveText("Por defecto: solo tú");
    await page.getByTestId("nav-next").click();
    await expect(page.getByTestId("detail-title")).toHaveText("Email escrito");
  });

  test("keyboard: header controls first, visible node focus, Enter/Space select", async ({ page }) => {
    await page.goto("/");
    await settle(page);

    // Tab order: skip link, map picker, map menu, mode and theme come before the canvas nodes.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Saltar al detalle" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("map-picker")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Acciones del mapa" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("radio", { name: "Ver" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("radio", { name: "Modo claro" })).toBeFocused();
    await page.keyboard.press("Tab");

    const first = page.locator('.react-flow__node[data-id="problema"]');
    await expect(first).toBeFocused();
    await expect(first).toHaveAttribute("aria-label", "Problema, 1/9 · camino principal");
    const outline = await first.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    await page.screenshot({ path: `${SHOTS}/desktop-keyboard-focus.png` });

    // Enter and Space select the focused node.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    const title = page.getByTestId("detail-title");
    await expect(title).toHaveText("Mapa universal");
    await expect(page.getByTestId("selection-announcer")).toHaveText("Mapa universal, 2/9 · camino principal");
    await page.keyboard.press("Tab");
    await page.keyboard.press(" ");
    await expect(title).not.toHaveText("Mapa universal");

    // The skip link jumps over the nodes to the detail.
    await page.getByRole("link", { name: "Saltar al detalle" }).focus();
    await page.keyboard.press("Enter");
    const panel = page.getByTestId("detail-panel");
    await expect(panel).toBeFocused();
    // The focused element is the one that scrolls, so the keyboard scrolls the detail (O-N3).
    await page.setViewportSize({ width: 1440, height: 480 });
    await panel.focus();
    expect(await panel.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await page.keyboard.press("PageDown");
    await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1440, height: 900 });

    // The skip link keeps its padding when it shows up (O-N1).
    const skip = page.getByRole("link", { name: "Saltar al detalle" });
    await skip.focus();
    expect((await skip.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(30);

    // Zoom slider thumb has an accessible name.
    await expect(page.getByRole("slider", { name: "Zoom" })).toBeVisible();
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("has no horizontal overflow at 360px and keeps navigation", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await noHorizontalOverflow(page);

    const title = page.getByTestId("detail-title");
    await expect(title).toHaveText("Problema");
    await page.getByTestId("nav-next").click();
    await expect(title).toHaveText("Mapa universal");
    await noHorizontalOverflow(page);
    await page.screenshot({ path: `${SHOTS}/mobile.png` });

    // Touch targets in the mobile chrome are at least 40px tall.
    for (const target of [
      page.getByRole("button", { name: "Alejar" }),
      page.getByRole("button", { name: "Acercar" }),
      page.getByRole("button", { name: "Ajustar" }),
      page.getByRole("radio", { name: "Modo claro" }),
      page.getByTestId("map-picker"),
      page.getByTestId("nav-prev"),
      page.getByTestId("nav-next"),
      page.getByRole("button", { name: "Detalle" }),
    ]) {
      const box = await target.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
    }

    await page.getByRole("button", { name: "Detalle" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByTestId("detail-title")).toHaveText("Mapa universal");
    await noHorizontalOverflow(page);

    // The close button is in Spanish and does not cover the kind badge.
    const close = sheet.getByRole("button", { name: "Cerrar" });
    await expect(close).toBeVisible();
    const closeBox = await close.boundingBox();
    const badgeBox = await sheet.getByText("Camino principal", { exact: true }).boundingBox();
    expect(closeBox && badgeBox).toBeTruthy();
    if (closeBox && badgeBox) expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(closeBox.x);
    // Connection chips are comfortable touch targets too.
    const chip = sheet.getByTestId("connection-chip").first();
    expect((await chip.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(40);
    await page.waitForTimeout(400); // Sheet slide-in
    await page.screenshot({ path: `${SHOTS}/mobile-sheet.png` });
  });
});
