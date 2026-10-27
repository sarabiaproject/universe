import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

import { expect, test, type Download, type Page } from "@playwright/test";

import LZString from "lz-string";

import { newMapFromMenu } from "./helpers";

// Versioned screenshots are only rewritten on purpose: `UPDATE_SCREENSHOTS=1 pnpm test:e2e`.
const SHOTS = process.env.UPDATE_SCREENSHOTS === "1" ? "docs/screenshots" : "test-results/screenshots";

type StoredMap = { id: string; map: { title: string; nodes: unknown[]; edges: unknown[] } };
type Stored = { state: { mapId: string; mode: string; userMaps: StoredMap[] } };

async function stored(page: Page): Promise<Stored | null> {
  return JSON.parse((await page.evaluate(() => localStorage.getItem("universe"))) ?? "null");
}

async function currentStoredMap(page: Page) {
  const s = await stored(page);
  return s?.state.userMaps.find((m) => m.id === s.state.mapId)?.map;
}

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);

async function menu(page: Page, item: string) {
  await page.getByRole("button", { name: "Acciones del mapa" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

async function downloadOf(page: Page, item: string): Promise<Download> {
  const [download] = await Promise.all([page.waitForEvent("download"), menu(page, item)]);
  return download;
}

async function json(download: Download) {
  return JSON.parse(await readFile(await download.path(), "utf8"));
}

/** Width, height and the first pixel (RGBA) of a PNG. Row 0's first pixel reads the same under every filter. */
function readPng(buffer: Buffer) {
  expect(buffer.subarray(1, 4).toString()).toBe("PNG");
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const idat: Buffer[] = [];
  for (let offset = 8; offset < buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString();
    if (type === "IDAT") idat.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(idat));
  return { width, height, firstPixel: [...raw.subarray(1, 5)] };
}

/** Builds a small map in "Mis mapas" with the editor; every node gets a position. */
async function buildMap(page: Page, title: string) {
  await page.goto("/");
  await node(page, "problema").waitFor();
  await newMapFromMenu(page);
  await page.getByTestId("create-first-node").click();
  await page.getByTestId("field-title").fill("Inicio «ñ» 🚀");
  await page.getByTestId("field-summary").fill("Acentos, emoji y #?&= en la URL");
  await page.getByRole("button", { name: "Añadir paso siguiente" }).click();
  await page.getByTestId("field-title").fill("Pagar");
  await page.getByRole("button", { name: "Añadir paso siguiente" }).click();
  await page.getByTestId("field-title").fill("Listo");
  await page.getByRole("button", { name: "Acciones del mapa" }).click();
  await page.getByRole("menuitem", { name: "Renombrar…" }).click();
  await page.getByLabel("Nombre").fill(title);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("map-header")).toContainText(`${title} · 3 nodos`);
  const map = await currentStoredMap(page);
  expect(map?.nodes).toHaveLength(3);
  return map!;
}

test.describe("share, import and export (desktop)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("share → open the link in a clean profile (same map) → save", async ({ page, browser, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const source = await buildMap(page, "Mapa para compartir");

    await page.getByRole("button", { name: "Compartir" }).click();
    const dialog = page.getByTestId("share-dialog");
    await expect(dialog.getByTestId("share-status")).toHaveText("Enlace copiado al portapapeles.");
    const url = await dialog.getByTestId("share-url").inputValue();
    expect(url).toMatch(/\/#m=[A-Za-z0-9+\-$]+$/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
    await expect(dialog.getByTestId("share-long")).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/share-dialog.png` });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Compartir" })).toBeFocused();

    // A new browser profile: nothing in localStorage.
    const clean = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const other = await clean.newPage();
    const errors: string[] = [];
    other.on("pageerror", (e) => errors.push(e.message));
    await other.goto(url);
    await expect(other.getByTestId("shared-banner")).toBeVisible();
    await expect(other.getByTestId("map-header")).toContainText("Mapa para compartir · 3 nodos");
    await expect(other.getByRole("radio", { name: "Ver" })).toHaveAttribute("data-state", "on");
    await expect(other.locator(".react-flow__node")).toHaveCount(3);
    // Same map, exactly: what it exports equals what was shared.
    expect(await json(await downloadOf(other, "Exportar JSON"))).toEqual(source);
    // Opening a link saves nothing.
    expect((await stored(other))?.state.userMaps ?? []).toEqual([]);
    await other.screenshot({ path: `${SHOTS}/share-open-link.png` });

    await other.getByTestId("save-shared").click();
    await expect(other.getByTestId("shared-banner")).toHaveCount(0);
    await expect(other.getByRole("radio", { name: "Editar" })).toHaveAttribute("data-state", "on");
    await expect(other.getByTestId("notice")).toHaveText("Guardado en Mis mapas: Mapa para compartir");
    expect(await currentStoredMap(other)).toEqual(source);
    expect(new URL(other.url()).hash).toBe("");
    // After a reload it is a normal map in "Mis mapas".
    await other.reload();
    await expect(other.getByTestId("map-header")).toContainText("Mapa para compartir · 3 nodos");
    await expect(other.getByTestId("shared-banner")).toHaveCount(0);
    expect(errors).toEqual([]);
    await clean.close();
  });

  test("a corrupt or cut link shows a clear error and the app keeps working", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const hash of ["#m=esto-no-es-un-mapa", "#m=N4IgdghgtgpiBcIDKALA"]) {
      await page.goto(`/${hash}`);
      const alert = page.getByTestId("alert-banner");
      await expect(alert).toContainText("No se pudo abrir el enlace");
      await expect(alert).toContainText("dañado o incompleto");
      await expect(page.locator(".react-flow__node")).toHaveCount(26);
      expect(new URL(page.url()).hash).toBe("");
      await alert.getByRole("button", { name: "Cerrar aviso" }).click();
      await expect(alert).toHaveCount(0);
    }
    // A link to a map that breaks the schema names the field.
    const bad = JSON.stringify({
      version: 1,
      title: "x",
      summary: "",
      nodes: [{ id: "a", title: "A", summary: "x".repeat(141), track: "main" }],
      edges: [],
    });
    await page.goto(`/#m=${LZString.compressToEncodedURIComponent(bad)}`);
    await expect(page.getByTestId("alert-banner")).toContainText("nodes.0.summary: El resumen no puede superar 140 caracteres");
    // Still usable.
    await node(page, "mapa-universal").click();
    await expect(page.getByTestId("detail-title")).toHaveText("Mapa universal");
    expect(errors).toEqual([]);
  });

  test("a link pasted into an open tab opens it", async ({ page }) => {
    const source = await buildMap(page, "Pegado en la barra");
    await page.getByRole("button", { name: "Compartir" }).click();
    const url = await page.getByTestId("share-url").inputValue();
    await page.keyboard.press("Escape");
    await newMapFromMenu(page);
    await page.evaluate((hash) => (window.location.hash = hash), new URL(url).hash);
    await expect(page.getByTestId("shared-banner")).toBeVisible();
    expect(await json(await downloadOf(page, "Exportar JSON"))).toEqual(source);
    // Leaving the shared map removes the hash.
    await page.getByTestId("map-picker").click();
    await page.getByRole("option", { name: "universe: el spec" }).click();
    expect(new URL(page.url()).hash).toBe("");
  });

  test("import a valid file, then an invalid one and broken text", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await node(page, "problema").waitFor();
    const map = {
      version: 1,
      title: "Importado",
      summary: "Desde un archivo",
      nodes: [
        { id: "a", title: "Uno", summary: "", details: "", track: "main", position: { x: 0, y: 0 } },
        { id: "b", title: "Dos", summary: "", details: "", track: "main", position: { x: 300, y: 0 } },
      ],
      edges: [{ from: "a", to: "b", type: "main" }],
    };

    await menu(page, "Importar JSON…");
    const dialog = page.getByTestId("import-dialog");
    // The Spanish button opens the browser's file chooser.
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      dialog.getByRole("button", { name: "Elegir archivo JSON…" }).click(),
    ]);
    await chooser.setFiles({
      name: "importado.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(map)),
    });
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("map-header")).toContainText("Importado · 2 nodos");
    await expect(page.getByTestId("notice")).toHaveText("Mapa importado: Importado");
    expect(await currentStoredMap(page)).toEqual(map);

    // Invalid file: errors with their path, the dialog stays, nothing is added.
    await menu(page, "Importar JSON…");
    const bad = { ...map, nodes: [{ ...map.nodes[0], summary: "x".repeat(141) }, { ...map.nodes[1], track: "lateral" }] };
    await dialog.getByTestId("import-file").setInputFiles({
      name: "roto.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(bad)),
    });
    const list = dialog.getByTestId("import-errors");
    await expect(list).toContainText("No se pudo importar «roto.json»:");
    await expect(list).toContainText("nodes.0.summary: El resumen no puede superar 140 caracteres");
    await expect(list).toContainText("nodes.1.track:");
    await expect(dialog.getByLabel("O pega el JSON")).toHaveAttribute("aria-invalid", "false");
    await page.screenshot({ path: `${SHOTS}/import-errors.png` });

    // Broken pasted JSON.
    await dialog.getByLabel("O pega el JSON").fill('{ "version": 1,, }');
    await dialog.getByRole("button", { name: "Importar" }).click();
    await expect(list).toContainText("No se pudo importar el texto pegado:");
    await expect(list).toContainText("El texto no es JSON válido (línea 1");
    await expect(dialog.getByLabel("O pega el JSON")).toHaveAttribute("aria-invalid", "true");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Acciones del mapa" })).toBeFocused();
    expect((await stored(page))?.state.userMaps).toHaveLength(1);

    // Valid pasted text works too, and the app is fine.
    await menu(page, "Importar JSON…");
    await dialog.getByLabel("O pega el JSON").fill(JSON.stringify({ ...map, title: "Pegado" }));
    await dialog.getByRole("button", { name: "Importar" }).click();
    await expect(page.getByTestId("map-header")).toContainText("Pegado · 2 nodos");
    expect(errors).toEqual([]);
  });

  test("export JSON and PNG of an example (every node, 2x, light and dark)", async ({ page }) => {
    await page.goto("/");
    await node(page, "problema").waitFor();

    const jsonDownload = await downloadOf(page, "Exportar JSON");
    expect(jsonDownload.suggestedFilename()).toBe("universe-el-spec.json");
    const exported = await json(jsonDownload);
    expect(exported.title).toBe("universe: el spec");
    expect(exported.nodes).toHaveLength(26);

    // Expected size from the nodes on the canvas: their bounding box plus 48px padding, at 2x.
    const box = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll<HTMLElement>(".react-flow__node")];
      const rects = nodes.map((n) => {
        const m = /translate\((-?[\d.]+)px, ?(-?[\d.]+)px\)/.exec(n.style.transform)!;
        return { x: Number(m[1]), y: Number(m[2]), w: n.offsetWidth, h: n.offsetHeight };
      });
      const minX = Math.min(...rects.map((r) => r.x));
      const minY = Math.min(...rects.map((r) => r.y));
      const maxX = Math.max(...rects.map((r) => r.x + r.w));
      const maxY = Math.max(...rects.map((r) => r.y + r.h));
      return { width: maxX - minX, height: maxY - minY, count: rects.length };
    });
    expect(box.count).toBe(26);

    const png = await downloadOf(page, "Exportar PNG");
    expect(png.suggestedFilename()).toBe("universe-el-spec.png");
    await png.saveAs("test-results/screenshots/export-light.png");
    const light = readPng(await readFile(await png.path()));
    expect(Math.abs(light.width - (box.width + 96) * 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(light.height - (box.height + 96) * 2)).toBeLessThanOrEqual(2);
    expect(light.firstPixel[0]).toBeGreaterThan(240); // light background, no panel in the corner

    await page.getByRole("radio", { name: "Modo oscuro" }).click();
    const darkPng = await downloadOf(page, "Exportar PNG");
    await darkPng.saveAs("test-results/screenshots/export-dark.png");
    const dark = readPng(await readFile(await darkPng.path()));
    expect(dark.width).toBe(light.width);
    expect(dark.firstPixel[0]).toBeLessThan(60);
  });

  test("warns when the link is longer than 8000 characters", async ({ page }) => {
    await page.goto("/");
    await node(page, "problema").waitFor();
    // Random text barely compresses: ~80 nodes with 120-character summaries.
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647).toString(36).slice(2);
    const nodes = Array.from({ length: 80 }, (_, i) => ({
      id: `n${i}`,
      title: `Nodo ${i}`,
      summary: (random() + random() + random() + random() + random() + random()).slice(0, 120),
      details: "",
      track: i === 0 ? "main" : "branch",
      position: { x: (i % 10) * 300, y: Math.floor(i / 10) * 150 },
    }));
    const big = { version: 1, title: "Grande", summary: "", nodes, edges: [] };
    await menu(page, "Importar JSON…");
    await page.getByLabel("O pega el JSON").fill(JSON.stringify(big));
    await page.getByRole("button", { name: "Importar" }).click();
    await expect(page.getByTestId("map-header")).toContainText("Grande · 80 nodos");
    await page.getByRole("button", { name: "Compartir" }).click();
    const url = await page.getByTestId("share-url").inputValue();
    expect(url.length).toBeGreaterThan(8000);
    await expect(page.getByTestId("share-long")).toContainText("más de 8000");
    await expect(page.getByTestId("share-long")).toContainText("Exportar JSON");
  });

  test("keyboard: share, import and export without a mouse", async ({ page }) => {
    await page.goto("/");
    await node(page, "problema").waitFor();
    const share = page.getByRole("button", { name: "Compartir" });
    await share.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("share-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(share).toBeFocused();

    const trigger = page.getByRole("button", { name: "Acciones del mapa" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Importar JSON…" }).focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByTestId("import-dialog");
    await expect(dialog).toBeVisible();
    // The dialog starts on its first field.
    await expect(dialog.getByRole("button", { name: "Elegir archivo JSON…" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByLabel("O pega el JSON")).toBeFocused();
    await page.keyboard.type("[]");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Importar" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("alert")).toContainText("No se pudo importar el texto pegado");
    await page.keyboard.press("Escape");

    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Exportar JSON" }).focus();
    const [download] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
    expect(download.suggestedFilename()).toBe("universe-el-spec.json");
  });
});

test.describe("share (mobile)", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("shared link at 360px: no horizontal overflow, 40px save button", async ({ page }) => {
    await page.goto("/");
    await node(page, "problema").waitFor();
    await page.getByRole("button", { name: "Compartir" }).click();
    const url = await page.getByTestId("share-url").inputValue();
    await page.keyboard.press("Escape");
    // Same page, new hash: the open tab picks the link up (hashchange).
    await page.goto(url);
    const save = page.getByTestId("save-shared");
    await expect(save).toBeVisible();
    expect((await save.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(40);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await save.click();
    await expect(page.getByTestId("shared-banner")).toHaveCount(0);
    await expect(page.getByTestId("map-header")).toContainText("universe: el spec · 26 nodos");
  });
});
