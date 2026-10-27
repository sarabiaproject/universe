// Records docs/media/demo.gif (open an example from the gallery → explore nodes → edit → share)
// and docs/screenshots/share-dialog.png.
//
//   pnpm build && pnpm demo:gif            # serves the build on DEMO_PORT (3140 by default)
//
// The browser opens the app at DEMO_ORIGIN (the production URL by default) and every request
// to that origin is answered by the local build. So what's recorded is this build, and the
// links it shows (the "Compartir" dialog) carry the public URL instead of localhost.
//
// Playwright records a WebM of the flow and ffmpeg (required on PATH) turns it into a GIF
// with its own palette. Videos don't show the pointer, so the page draws a small cursor.
import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.DEMO_PORT ?? 3140);
const BASE = `http://localhost:${PORT}`;
const ORIGIN = (process.env.DEMO_ORIGIN ?? "https://universe-gamma-eosin.vercel.app").replace(/\/$/, "");
const OUT = "docs/media/demo.gif";
const SHARE_SHOT = "docs/screenshots/share-dialog.png";
const SIZE = { width: 1120, height: 680 };
const GIF_WIDTH = 800;
const FPS = 8;

const server = spawn("node_modules/.bin/next", ["start", "--port", String(PORT)], { stdio: "ignore" });
const stop = () => server.kill();
process.on("exit", stop);

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No server on ${BASE}`);
}

const CURSOR = `
  addEventListener("DOMContentLoaded", () => {
    const dot = document.createElement("div");
    dot.style.cssText = "position:fixed;z-index:2147483647;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;" +
      "background:rgba(20,20,20,.35);border:2px solid white;pointer-events:none;left:-40px;top:-40px;transition:transform .12s";
    document.body.appendChild(dot);
    addEventListener("mousemove", (e) => { dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => (dot.style.transform = "scale(.7)"), true);
    addEventListener("mouseup", () => (dot.style.transform = ""), true);
  });
`;

/** A context that sees the app at ORIGIN, served by the local build. */
async function newContext(browser, options) {
  const context = await browser.newContext({ colorScheme: "light", ...options });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN });
  await context.route(`${ORIGIN}/**`, async (route) => {
    const response = await route.fetch({ url: BASE + route.request().url().slice(ORIGIN.length) });
    await route.fulfill({ response });
  });
  return context;
}

async function record(browser, videoDir) {
  const context = await newContext(browser, { viewport: SIZE, recordVideo: { dir: videoDir, size: SIZE } });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  const pause = (ms) => page.waitForTimeout(ms);
  // Moves the pointer in steps so the cursor glides, then clicks.
  const click = async (locator, ms = 700) => {
    const box = await locator.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
    await pause(150);
    await locator.click();
    await pause(ms);
  };

  await page.goto(ORIGIN);
  await page.locator(".react-flow__node").first().waitFor();
  await page.mouse.move(640, 380);
  await pause(1200);

  // Gallery → "Lanzar un proyecto open source".
  await click(page.getByTestId("map-picker"), 500);
  await click(page.getByRole("option", { name: "Ver todos los ejemplos…" }), 1200);
  await click(page.getByTestId("example-lanzar-open-source"), 1400);

  // Explore: siguiente / anterior center the node and zoom in; a branch below the path.
  await click(page.getByTestId("nav-next"), 1300);
  await click(page.locator('.react-flow__node[data-id="alcance"]'), 1300);
  await click(page.getByTestId("nav-next"), 1200);
  await click(page.getByTestId("nav-next"), 1300);

  // Edit: the example is read-only, so "Editar" makes a copy (it opens on the first node,
  // with the whole map in view). "Centrar en el canvas" zooms in so the card can be read.
  await click(page.getByRole("radio", { name: "Editar" }), 1000);
  await click(page.getByRole("button", { name: "Centrar en el canvas" }), 1100);
  const title = page.getByLabel("Título", { exact: true });
  await click(title, 200);
  await title.press("ControlOrMeta+a");
  await title.pressSequentially("Un problema que me duele", { delay: 60 });
  await pause(1300);

  // Share: the map travels in the link.
  await click(page.getByTestId("share-button"), 2200);
  const link = await page.getByTestId("share-url").inputValue();
  if (!link.startsWith(`${ORIGIN}/#m=`)) throw new Error(`Unexpected share link: ${link}`);
  await page.keyboard.press("Escape");
  await pause(800);

  await context.close();
}

/** The "Compartir" dialog over an example, at the size of the other screenshots. */
async function shareScreenshot(browser) {
  const context = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(ORIGIN);
  await page.locator(".react-flow__node").first().waitFor();
  await page.getByTestId("map-picker").click();
  await page.getByRole("option", { name: "Lanzar un proyecto open source" }).click();
  await page.locator('.react-flow__node[data-id="problema"]').waitFor();
  await page.waitForTimeout(600);
  await page.getByTestId("share-button").click();
  await page.getByText("Enlace copiado al portapapeles.").waitFor();
  const link = await page.getByTestId("share-url").inputValue();
  if (!link.startsWith(`${ORIGIN}/#m=`)) throw new Error(`Unexpected share link: ${link}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHARE_SHOT });
  await context.close();
}

await waitForServer();
// Inside the repo, ignored by git.
const videoDir = "test-results/demo-video";
rmSync(videoDir, { recursive: true, force: true });
const browser = await chromium.launch();
try {
  await record(browser, videoDir);
  await shareScreenshot(browser);
  console.log(`${SHARE_SHOT}: link at ${ORIGIN}`);
  const video = join(videoDir, readdirSync(videoDir).find((f) => f.endsWith(".webm")));
  mkdirSync("docs/media", { recursive: true });
  const filter =
    `fps=${FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,split[a][b];` +
    `[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
  const ffmpeg = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", video, "-vf", filter, "-loop", "0", OUT], {
    stdio: "inherit",
  });
  if (ffmpeg.status !== 0) throw new Error("ffmpeg failed");
  console.log(`${OUT}: ${(statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`);
} finally {
  await browser.close();
  rmSync(videoDir, { recursive: true, force: true });
  stop();
}
