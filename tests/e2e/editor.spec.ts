import { expect, test, type Page } from "@playwright/test";

// Versioned screenshots are only rewritten on purpose: `UPDATE_SCREENSHOTS=1 pnpm test:e2e`.
const SHOTS = process.env.UPDATE_SCREENSHOTS === "1" ? "docs/screenshots" : "test-results/screenshots";

type StoredNode = { id: string; title: string; position?: { x: number; y: number } };
type StoredMap = { id: string; map: { title: string; nodes: StoredNode[]; edges: unknown[] } };
type Stored = { state: { mapId: string; mode: string; userMaps: StoredMap[] } };

async function stored(page: Page): Promise<Stored> {
  return JSON.parse((await page.evaluate(() => localStorage.getItem("universe"))) ?? "null");
}

async function currentStoredMap(page: Page) {
  const { state } = await stored(page);
  return state.userMaps.find((m) => m.id === state.mapId)?.map;
}

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const title = (page: Page) => page.getByTestId("field-title");

async function newMap(page: Page) {
  await page.goto("/");
  await node(page, "problema").waitFor();
  await page.getByRole("button", { name: "Acciones del mapa" }).click();
  await page.getByRole("menuitem", { name: "Nuevo mapa" }).click();
  await expect(page.getByTestId("empty-state")).toBeVisible();
}

async function fit(page: Page) {
  await page.getByRole("button", { name: "Ajustar" }).click();
  await page.waitForTimeout(500);
}

/** Drags from the right dot of `from` onto the card `to`. */
async function connect(page: Page, from: string, to: string) {
  const handle = await node(page, from).locator(".react-flow__handle.source").boundingBox();
  const target = await node(page, to).locator(".react-flow__handle.target").boundingBox();
  if (!handle || !target) throw new Error("handles not visible");
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 30, target.y + 10, { steps: 10 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 5 });
  await page.mouse.up();
}

test.describe("editor (desktop)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("create a map, add 3 nodes, connect, edit, persist, undo/redo and delete", async ({ page }) => {
    await newMap(page);
    await expect(page.getByTestId("map-header")).toContainText("Mapa sin título · 0 nodos");
    await page.screenshot({ path: `${SHOTS}/editor-empty.png` });

    // 1st node from the empty state, 2nd continues the main path, 3rd is a free node.
    await page.getByTestId("create-first-node").click();
    await title(page).fill("Inicio");
    await page.getByRole("button", { name: "Añadir paso siguiente" }).click();
    await title(page).fill("Validar");
    await page.getByTestId("add-node").click();
    await title(page).fill("Pago rechazado");
    await expect(page.locator(".react-flow__node")).toHaveCount(3);
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);

    // Connect by dragging a handle; the dialog picks the type.
    await fit(page);
    await connect(page, "nuevo-nodo-2", "nuevo-nodo-3");
    const dialog = page.getByTestId("connect-dialog");
    await expect(dialog).toContainText("De «Validar» a «Pago rechazado»");
    await dialog.getByRole("button", { name: /caso límite/ }).click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);
    await expect(page.getByTestId("map-problems")).toHaveCount(0);

    // Edit the first node; invalid values show a Spanish message and are not saved.
    await node(page, "nuevo-nodo").click();
    await expect(title(page)).toHaveValue("Inicio");
    const summary = page.getByTestId("field-summary");
    const alert = page.getByTestId("detail-panel").getByRole("alert");
    await summary.fill("x".repeat(141));
    await expect(alert).toHaveText("El resumen no puede superar 140 caracteres");
    expect((await currentStoredMap(page))?.nodes[0]).toMatchObject({ summary: "" });
    await summary.fill("Todo empieza aquí.");
    await expect(alert).toHaveCount(0);
    await title(page).fill("");
    await expect(alert).toHaveText("El título no puede estar vacío");
    await title(page).fill("Inicio del pago");
    await page.getByTestId("field-details").fill("- Primero\n- **Segundo**");
    await page.getByTestId("field-preview-type").click();
    await page.getByRole("option", { name: "Código" }).click();
    await page.getByTestId("field-preview-content").fill("pay(order)");
    await expect(node(page, "nuevo-nodo")).toContainText("Inicio del pago");
    await expect(node(page, "nuevo-nodo")).toContainText("pay(order)");

    // Undo/redo with the keyboard (outside text fields) and with the toolbar.
    await page.locator(".react-flow__pane").click({ position: { x: 300, y: 700 } });
    await expect(page.getByTestId("map-settings")).toBeVisible();
    await page.keyboard.press("ControlOrMeta+z"); // preview content
    await page.keyboard.press("ControlOrMeta+z"); // preview type
    await expect(node(page, "nuevo-nodo")).not.toContainText("pay(order)");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(node(page, "nuevo-nodo")).toContainText("pay(order)");
    await page.getByRole("button", { name: "Deshacer" }).click();
    await page.getByRole("button", { name: "Rehacer" }).click();
    await expect(node(page, "nuevo-nodo")).toContainText("pay(order)");

    // Move a node by dragging: one undo step.
    const card = node(page, "nuevo-nodo-3");
    const before = await card.boundingBox();
    await page.mouse.move(before!.x + 80, before!.y + 40);
    await page.mouse.down();
    await page.mouse.move(before!.x + 80, before!.y + 160, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await card.boundingBox())!.y).toBeGreaterThan(before!.y + 50);
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(async () => Math.round((await card.boundingBox())!.y)).toBe(Math.round(before!.y));
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await page.screenshot({ path: `${SHOTS}/editor-desktop.png` });

    // Reload: the map is still there, exactly the same.
    const saved = await currentStoredMap(page);
    await page.reload();
    await node(page, "nuevo-nodo").waitFor();
    expect(await currentStoredMap(page)).toEqual(saved);
    await expect(page.getByTestId("map-header")).toContainText("Mapa sin título · 3 nodos");
    await expect(page.getByRole("radio", { name: "Editar" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);

    // Delete a node with edges: asks first; undo brings it back with its edges.
    await node(page, "nuevo-nodo-2").click();
    await page.getByRole("button", { name: "Borrar nodo" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("¿Borrar «Validar»?");
    await expect(confirm).toContainText("borrarán sus 2 conexiones");
    await confirm.getByRole("button", { name: "Borrar nodo" }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await expect(page.locator(".react-flow__edge")).toHaveCount(0);
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(3);
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);
    await page.getByRole("button", { name: "Rehacer" }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);

    // Edges: select one from the inspector, retype it, delete it.
    await page.getByRole("button", { name: "Deshacer" }).click();
    await node(page, "nuevo-nodo").click();
    await page.getByRole("button", { name: /Editar conexión hacia Validar/ }).click();
    await expect(page.getByTestId("edge-editor")).toBeVisible();
    await page.getByTestId("field-edge-label").fill("ok");
    await expect(page.locator(".react-flow__edge-text").filter({ hasText: "ok" })).toBeVisible();
    await page.getByRole("button", { name: "Borrar conexión" }).click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    // Without the main edge, Validar is a loose main node: the problem is listed in Spanish.
    await expect(page.getByTestId("map-problems")).toContainText("«Validar»");

    await expect(page.getByTestId("edge-editor")).toHaveCount(0);
    await page.getByRole("radio", { name: "Modo oscuro" }).click();
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.getByTestId("map-problems")).toHaveCount(0);
    await node(page, "nuevo-nodo").click();
    await page.getByRole("button", { name: /Editar conexión hacia Validar/ }).click();
    await expect(page.getByRole("radio", { name: "principal" })).toHaveAttribute("aria-checked", "true");
    await page.screenshot({ path: `${SHOTS}/editor-dark.png` });
  });

  test("builds a 10-node map with main path and branches that survives a reload", async ({ page }) => {
    await newMap(page);
    await page.getByTestId("create-first-node").click();
    await title(page).fill("Paso 1");
    for (let i = 2; i <= 7; i++) {
      await page.getByRole("button", { name: "Añadir paso siguiente" }).click();
      await title(page).fill(`Paso ${i}`);
    }
    // Branches hang off steps 2, 3 and 5 ("next step" from a node that already continues).
    for (const [from, name] of [
      ["nuevo-nodo-2", "Rama A"],
      ["nuevo-nodo-3", "Rama B"],
      ["nuevo-nodo-5", "Rama C"],
    ]) {
      await node(page, from).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Añadir paso siguiente" }).click();
      await title(page).fill(name);
    }
    await expect(page.locator(".react-flow__node")).toHaveCount(10);
    await expect(page.locator(".react-flow__edge")).toHaveCount(9);
    await expect(page.getByTestId("map-problems")).toHaveCount(0);
    await fit(page);

    const saved = await currentStoredMap(page);
    expect(saved?.nodes).toHaveLength(10);
    const transforms = () =>
      page.locator(".react-flow__node").evaluateAll((els) => els.map((el) => `${el.dataset.id} ${el.style.transform}`));
    const placed = await transforms();

    await page.reload();
    await node(page, "nuevo-nodo").waitFor();
    expect(await currentStoredMap(page)).toEqual(saved);
    expect(await transforms()).toEqual(placed);
    await page.locator(".react-flow__pane").click({ position: { x: 300, y: 700 } });
    await page.getByRole("radio", { name: "Ver" }).click();
    await node(page, "nuevo-nodo-9").click();
    await expect(page.getByTestId("detail-position")).toHaveText("rama de Paso 3");
    await page.screenshot({ path: `${SHOTS}/editor-ten-nodes.png` });
  });

  test("examples stay read-only; editing one makes a copy", async ({ page }) => {
    await page.goto("/");
    await node(page, "problema").waitFor();
    await expect(page.getByText("Ejemplo de solo lectura.")).toBeVisible();
    await page.getByRole("radio", { name: "Editar" }).click();
    await expect(page.getByTestId("map-header")).toContainText("universe: el spec (copia) · 26 nodos");
    await expect(page.getByTestId("notice")).toHaveText(/se creó una copia editable/);
    await title(page).fill("Problema editado");

    await page.getByTestId("map-picker").click();
    await expect(page.getByRole("group", { name: "Mis mapas" })).toBeVisible();
    await page.getByRole("option", { name: "universe: el spec", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Ver" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("detail-title")).toHaveText("Problema");
    const { state } = await stored(page);
    expect(state.userMaps).toHaveLength(1);
    expect(state.userMaps[0].map.nodes[0].title).toBe("Problema editado");

    // Rename and delete the copy from the map menu.
    await page.getByTestId("map-picker").click();
    await page.getByRole("option", { name: "universe: el spec (copia)" }).click();
    await page.getByRole("button", { name: "Acciones del mapa" }).click();
    await page.getByRole("menuitem", { name: "Renombrar…" }).click();
    await page.getByLabel("Nombre").fill("Mi spec");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByTestId("map-header")).toContainText("Mi spec");
    await page.getByRole("button", { name: "Acciones del mapa" }).click();
    await page.getByRole("menuitem", { name: "Borrar mapa…" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("¿Borrar «Mi spec»?");
    await page.getByRole("button", { name: "Borrar mapa" }).click();
    await expect(page.getByTestId("map-header")).toContainText("universe: el spec · 26 nodos");
    expect((await stored(page)).state.userMaps).toHaveLength(0);
  });

  test("keyboard: create, move, delete and undo without a mouse", async ({ page }) => {
    await newMap(page);
    await page.getByTestId("create-first-node").focus();
    await page.keyboard.press("Enter");
    await expect(title(page)).toHaveValue("Nuevo nodo");
    await page.getByRole("button", { name: "Añadir nodo" }).first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node")).toHaveCount(2);

    const second = node(page, "nuevo-nodo-2");
    await second.focus();
    await expect(second).toHaveAttribute("aria-label", /Nuevo nodo, rama/);
    expect(await second.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");
    const x0 = (await currentStoredMap(page))?.nodes[1]?.position?.x ?? 0;
    const x = async () => (await currentStoredMap(page))?.nodes[1]?.position?.x;
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect.poll(x).toBe(x0 + 10);

    await page.keyboard.press("Delete"); // no edges: deleted right away
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await page.keyboard.press("ControlOrMeta+z"); // the two arrow presses are one step
    await expect.poll(x).toBe(x0);
  });
});

test.describe("editor (desktop, round 1 fixes)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("keyboard: edges show focus and focus stays on the canvas after deletes (D2, D3)", async ({ page }) => {
    await newMap(page);
    await page.getByTestId("create-first-node").focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Añadir paso siguiente" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);

    // Edges come before nodes in the tab order: Shift+Tab from the first node lands on the edge.
    const first = node(page, "nuevo-nodo");
    await first.focus();
    await page.keyboard.press("Shift+Tab");
    const edge = page.locator(".react-flow__edge");
    await expect(edge).toBeFocused();
    const width = () => edge.locator(".react-flow__edge-path").evaluate((el) => getComputedStyle(el).strokeWidth);
    expect(await width()).toBe("3px");
    await first.focus();
    expect(await width()).not.toBe("3px");

    // Delete the focused edge: focus goes to its source node.
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Delete");
    await expect(page.locator(".react-flow__edge")).toHaveCount(0);
    await expect(first).toBeFocused();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);

    // Delete a node with an edge through the confirmation, only with the keyboard:
    // focus goes to the previous node on the path, not to <body>.
    await node(page, "nuevo-nodo-2").focus();
    await page.keyboard.press("Delete");
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Borrar nodo" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect(first).toBeFocused();

    // Cancelling returns focus to the node.
    await page.keyboard.press("ControlOrMeta+z");
    await node(page, "nuevo-nodo-2").focus();
    await page.keyboard.press("Delete");
    await page.keyboard.press("Escape");
    await expect(node(page, "nuevo-nodo-2")).toBeFocused();

    // Last node: focus falls back to the canvas, with a visible ring.
    await node(page, "nuevo-nodo-2").focus();
    await page.keyboard.press("Delete");
    await page.getByRole("alertdialog").getByRole("button", { name: "Borrar nodo" }).focus();
    await page.keyboard.press("Enter");
    await first.focus();
    await page.keyboard.press("Delete");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    const canvas = page.getByRole("group", { name: "Lienzo del mapa" });
    await expect(canvas).toBeFocused();
    expect(await canvas.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  });

  test("works with localStorage blocked: viewer, editing in memory and a warning (B1)", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
      });
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.locator(".react-flow__node")).toHaveCount(26);
    await expect(page.getByText("Algo salió mal")).toHaveCount(0);
    await expect(page.getByTestId("storage-warning")).toContainText("no se guardarán");

    await page.getByRole("button", { name: "Acciones del mapa" }).click();
    await page.getByRole("menuitem", { name: "Nuevo mapa" }).click();
    await page.getByTestId("create-first-node").click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await page.getByRole("button", { name: "Cerrar aviso" }).click();
    await expect(page.getByTestId("storage-warning")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("two tabs do not overwrite each other's maps (O10)", async ({ context }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    for (const p of [a, b]) {
      await p.goto("/");
      await node(p, "problema").waitFor();
    }
    // Tab A creates a map; tab B (opened before) creates another one afterwards.
    await a.getByRole("button", { name: "Acciones del mapa" }).click();
    await a.getByRole("menuitem", { name: "Nuevo mapa" }).click();
    await expect(a.getByTestId("map-header")).toContainText("Mapa sin título");
    await b.getByRole("button", { name: "Acciones del mapa" }).click();
    await b.getByRole("menuitem", { name: "Nuevo mapa" }).click();
    await expect(b.getByTestId("map-header")).toContainText("Mapa sin título 2");

    await a.reload();
    await node(a, "problema").or(a.getByTestId("empty-state")).first().waitFor();
    expect((await stored(a)).state.userMaps.map((m) => m.map.title)).toEqual(["Mapa sin título", "Mapa sin título 2"]);
  });
});

test.describe("editor (mobile)", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("edits from the Sheet without horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await node(page, "problema").waitFor();
    await page.getByRole("radio", { name: "Editar" }).click();
    await expect(page.getByTestId("map-header")).toContainText("(copia)");

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    for (const name of ["Añadir nodo", "Deshacer", "Rehacer", "Acciones del mapa", "Editar"]) {
      const box = await page.getByRole("button", { name, exact: true }).first().boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
    }

    await page.getByRole("button", { name: "Editar", exact: true }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByTestId("field-title").fill("Problema (móvil)");
    await sheet.getByTestId("field-summary").fill("Editado desde el teléfono.");
    // O6: the controls inside the edit Sheet are 40px touch targets too.
    for (const target of [
      sheet.getByTestId("field-title"),
      sheet.getByTestId("field-preview-type"),
      sheet.getByTestId("connect-target"),
      sheet.getByTestId("connect-type"),
      sheet.getByRole("button", { name: "Centrar en el canvas" }),
      sheet.getByRole("button", { name: "Cerrar" }),
    ]) {
      expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(40);
    }
    await page.waitForTimeout(400); // Sheet slide-in
    await page.screenshot({ path: `${SHOTS}/editor-mobile-sheet.png` });
    await sheet.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByTestId("detail-title")).toHaveText("Problema (móvil)");
    await expect(node(page, "problema")).toContainText("Editado desde el teléfono.");

    await page.getByRole("button", { name: "Añadir nodo" }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(27);
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(26);
  });
});
