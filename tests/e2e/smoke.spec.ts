import { expect, test, type Page } from "@playwright/test";

const SHOTS = "docs/screenshots";

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
    await expect(page.getByTestId("detail-title")).toHaveText("Default - only you");
    await page.getByTestId("nav-next").click();
    await expect(page.getByTestId("detail-title")).toHaveText("Email entered");
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

    await page.getByRole("button", { name: "Detalle" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByTestId("detail-title")).toHaveText("Mapa universal");
    await noHorizontalOverflow(page);
  });
});
