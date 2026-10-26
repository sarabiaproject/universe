import { expect, test, type Page } from "@playwright/test";

import { getMainPath } from "../../src/lib/graph";
import { BUNDLED_MAPS } from "../../src/maps";

// Versioned screenshots are only rewritten on purpose: `UPDATE_SCREENSHOTS=1 pnpm test:e2e`.
const SHOTS = process.env.UPDATE_SCREENSHOTS === "1" ? "docs/screenshots" : "test-results/screenshots";

const EXAMPLES = BUNDLED_MAPS.map(({ id, map }) => ({
  id,
  title: map.title,
  count: map.nodes.length,
  first: map.nodes.find((n) => n.id === getMainPath(map)[0])!.title,
}));

async function settle(page: Page) {
  await page.locator(".react-flow__node").first().waitFor();
  await page.waitForTimeout(400);
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function openGalleryFromPicker(page: Page) {
  await page.getByTestId("map-picker").click();
  await page.getByRole("option", { name: "Ver todos los ejemplos…" }).click();
  await expect(page.getByTestId("example-gallery")).toBeVisible();
}

async function expectExampleOpen(page: Page, example: (typeof EXAMPLES)[number]) {
  await expect(page.getByTestId("map-header")).toContainText(`${example.title} · ${example.count} nodos`);
  await expect(page.locator(".react-flow__node")).toHaveCount(example.count);
  await expect(page.getByTestId("detail-title")).toHaveText(example.first);
}

test.describe("examples gallery (desktop)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("bundles four examples and opens each one from the gallery", async ({ page }) => {
    const errors = trackErrors(page);
    expect(EXAMPLES).toHaveLength(4);
    await page.goto("/");
    await settle(page);

    for (const [i, example] of [...EXAMPLES].reverse().entries()) {
      await openGalleryFromPicker(page);
      const gallery = page.getByTestId("example-gallery");
      await expect(gallery.getByRole("heading", { name: "Ejemplos" })).toBeVisible();
      await expect(gallery.getByRole("list", { name: "Mapas de ejemplo" }).getByRole("listitem")).toHaveCount(4);
      if (i === 0) await page.screenshot({ path: `${SHOTS}/gallery-desktop.png` });

      const card = page.getByTestId(`example-${example.id}`);
      await expect(card).toContainText(example.title);
      await expect(card).toContainText(`${example.count} nodos`);
      await card.click();
      await expect(gallery).toBeHidden();
      await expectExampleOpen(page, example);
      // Examples open read-only, in view mode.
      await expect(page.getByText("Ejemplo de solo lectura.")).toBeVisible();
    }

    // The open map is marked in the gallery.
    await openGalleryFromPicker(page);
    await expect(page.getByTestId(`example-${EXAMPLES[0].id}`)).toHaveAttribute("aria-current", "true");
    await expect(page.locator('[data-testid^="example-"][aria-current="true"]')).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("map-picker")).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("new examples read well: click nodes, follow branches", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await openGalleryFromPicker(page);
    await page.getByTestId("example-mi-semana").click();
    await settle(page);
    await page.locator('.react-flow__node[data-id="moverse"]').click();
    await expect(page.getByTestId("detail-title")).toHaveText("Moverse");
    await expect(page.getByTestId("detail-position")).toHaveText("4/7 · camino principal");
    await page.getByTestId("connection-chip").filter({ hasText: "Lluvia o molestia" }).click();
    await expect(page.getByTestId("detail-position")).toHaveText("caso límite de Moverse");
    await page.screenshot({ path: `${SHOTS}/example-mi-semana.png` });

    await openGalleryFromPicker(page);
    await page.getByTestId("example-lanzar-open-source").click();
    await settle(page);
    await page.locator('.react-flow__node[data-id="demo"]').click();
    await expect(page.getByTestId("detail-title")).toHaveText("Demo en vivo");
    await page.getByTestId("nav-next").click();
    await expect(page.getByTestId("detail-title")).toHaveText("Anuncio");
    await page.screenshot({ path: `${SHOTS}/example-open-source.png` });
  });

  test("keyboard only: map menu → Ver ejemplos… → open a card; Escape gives focus back", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    const menu = page.getByTestId("map-menu");
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Ver ejemplos…" })).toBeVisible();
    // Nuevo mapa → Ver ejemplos…
    await expect(page.getByRole("menuitem", { name: "Nuevo mapa" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Ver ejemplos…" })).toBeFocused();
    await page.keyboard.press("Enter");
    const gallery = page.getByTestId("example-gallery");
    await expect(gallery).toBeVisible();

    // Escape returns to the menu trigger.
    await page.keyboard.press("Escape");
    await expect(gallery).toBeHidden();
    await expect(menu).toBeFocused();

    // Again, and open "Lanzar un proyecto open source" with Tab + Enter.
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Nuevo mapa" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Ver ejemplos…" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(gallery).toBeVisible();
    const target = page.getByTestId("example-lanzar-open-source");
    for (let i = 0; i < 8 && !(await target.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(target).toBeFocused();
    await expect(target).toHaveAccessibleName(/^Abrir Lanzar un proyecto open source: .+ 17 nodos\.$/);
    // Visible focus ring.
    const outline = await target.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(gallery).toBeHidden();
    await expectExampleOpen(page, EXAMPLES.find((e) => e.id === "lanzar-open-source")!);
    await expect(menu).toBeFocused();
  });

  test("keyboard only: map picker → Enter on Ver todos los ejemplos… opens the gallery, map unchanged (B1)", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await settle(page);
    await openGalleryFromPicker(page);
    await page.getByTestId("example-mi-semana").click();
    const semana = EXAMPLES.find((e) => e.id === "mi-semana")!;
    await expectExampleOpen(page, semana);

    const picker = page.getByTestId("map-picker");
    await picker.focus();
    await page.keyboard.press("Enter");
    const item = page.getByRole("option", { name: "Ver todos los ejemplos…" });
    await expect(page.getByRole("listbox")).toBeVisible();
    // Human pace: the bug needs the select to be settled (pressed back to back, Enter is lost).
    await page.waitForTimeout(300);
    await page.keyboard.press("End");
    await expect(item).toBeFocused();
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");

    // Enter must not fall through to a card: the gallery stays open and the map doesn't change.
    // Give a fallen-through click time to land (it switched maps and closed the dialog within ~100 ms).
    await page.waitForTimeout(400);
    await expect(page.getByTestId("map-header")).toContainText(`${semana.title} · ${semana.count} nodos`);
    const gallery = page.getByTestId("example-gallery");
    await expect(gallery).toBeVisible();
    // Initial focus is on the dialog itself, not on a card.
    await expect(gallery).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(gallery).toBeHidden();
    await expect(picker).toBeFocused();
    await expect(page.getByTestId("map-header")).toContainText(`${semana.title} · ${semana.count} nodos`);
    expect(errors).toEqual([]);
  });

  test("an empty map offers the gallery", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await settle(page);
    await page.getByTestId("map-menu").click();
    await page.getByRole("menuitem", { name: "Nuevo mapa" }).click();
    await expect(page.getByTestId("empty-state")).toBeVisible();
    const open = page.getByTestId("open-gallery-from-empty");
    await expect(open).toHaveText("O abre un ejemplo");
    await expect(page.getByRole("menu")).toBeHidden();
    await page.screenshot({ path: `${SHOTS}/empty-with-examples.png` });

    // Escape comes back to the button that opened it.
    await open.click();
    await page.keyboard.press("Escape");
    await expect(open).toBeFocused();

    await open.click();
    await page.getByTestId("example-mi-semana").click();
    await expectExampleOpen(page, EXAMPLES.find((e) => e.id === "mi-semana")!);
    await expect(page.getByTestId("map-picker")).toBeFocused();
    expect(errors).toEqual([]);
  });
});

test.describe("examples gallery (mobile)", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("fits at 360px with 40px cards and opens an example", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await openGalleryFromPicker(page);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    for (const { id } of EXAMPLES) {
      const box = await page.getByTestId(`example-${id}`).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(40);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    }
    await page.screenshot({ path: `${SHOTS}/gallery-mobile.png` });
    await page.getByTestId("example-lanzar-open-source").tap();
    await expectExampleOpen(page, EXAMPLES.find((e) => e.id === "lanzar-open-source")!);
  });
});

test.describe("launch basics", () => {
  test("built HTML carries Open Graph, Twitter and icon metadata", async ({ request }) => {
    const html = await (await request.get("/")).text();
    const meta = (attr: string, name: string) =>
      html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1];

    expect(html).toContain("<title>universe: mapas universales de sistemas</title>");
    expect(meta("name", "description")).toMatch(/^Mapea cualquier sistema/);
    expect(meta("property", "og:title")).toBe("universe: mapas universales de sistemas");
    expect(meta("property", "og:url")).toBe("https://universe-gamma-eosin.vercel.app");
    expect(meta("property", "og:locale")).toBe("es_ES");
    expect(meta("property", "og:image:width")).toBe("1200");
    expect(meta("property", "og:image:alt")).toBeTruthy();
    expect(meta("name", "twitter:card")).toBe("summary_large_image");

    // The cards point at the production URL; the same paths are served by this build.
    for (const key of ["property=\"og:image", "name=\"twitter:image"]) {
      const url = html.match(new RegExp(`<meta ${key}" content="([^"]*)"`))?.[1];
      expect(url).toMatch(/^https:\/\/universe-gamma-eosin\.vercel\.app\//);
      const res = await request.get(new URL(url!).pathname + new URL(url!).search);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toBe("image/png");
    }
    for (const icon of ["/favicon.ico", "/icon.svg", "/apple-icon"]) {
      expect(html).toContain(`href="${icon}`);
    }
    expect((await request.get("/favicon.ico")).status()).toBe(200);
  });

  test("unknown routes show the Spanish 404 with a way back", async ({ page }) => {
    const res = await page.goto("/no-existe");
    expect(res?.status()).toBe(404);
    await expect(page).toHaveTitle("Página no encontrada · universe");
    await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/not-found.png` });
    await page.getByRole("link", { name: "Ir al mapa" }).click();
    await expect(page).toHaveURL(/\/$/);
    await settle(page);
    await expect(page.getByTestId("map-header")).toContainText("universe: el spec");
  });
});
