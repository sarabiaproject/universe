# Checks

Último registro: 2026-10-23, rama `slice-0-viewer` tras los arreglos de la revisión ronda 1 (HEAD `28f0eaa` más docs), macOS (arm64), Node v24.19.0, pnpm 11.22.0. Ejecutado desde un árbol limpio (`rm -rf .next test-results`), en este orden.

| # | Comando | Resultado |
| --- | --- | --- |
| 0 | `pnpm install --frozen-lockfile` | ✅ exit 0, lockfile al día |
| 1 | `pnpm typecheck` (`next typegen && tsc --noEmit`) | ✅ exit 0, sin errores |
| 2 | `pnpm lint` (`eslint`) | ✅ exit 0, sin warnings |
| 3 | `pnpm test` (`vitest run`) | ✅ 4 archivos, 32 tests pasan |
| 4 | `pnpm build` (`next build`) | ✅ exit 0, `/` prerenderizada como estática |
| 5 | `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers pnpm test:e2e` (`playwright test`, sobre `next start`) | ✅ 4 tests pasan |
| 6 | Colores hardcodeados: `grep -rnE '#[0-9a-fA-F]{3,8}\b\|rgba?\(\|oklch\(\|hsl\(' src \| grep -v globals.css` | ✅ sin resultados |
| 7 | `git status --short` después de todos los checks | ✅ vacío para archivos versionados: los tests ya no tocan `docs/screenshots/` |

## Salida

```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully

$ eslint

$ vitest run
 Test Files  4 passed (4)
      Tests  32 passed (32)

$ next build
▲ Next.js 16.4.2 (Turbopack)
✓ Compiled successfully in 1658ms
  Finished TypeScript in 1378ms ...
✓ Generating static pages using 5 workers (4/4) in 247ms
Route (app)
┌ ○ /
└ ○ /_not-found
○  (Static)  prerendered as static content

$ playwright test
[WebServer] $ next start --port 3100
Running 4 tests using 1 worker
  ✓  1 [chromium] › tests/e2e/smoke.spec.ts:23:7 › desktop › loads, selects nodes, navigates and toggles dark mode (3.0s)
  ✓  2 [chromium] › tests/e2e/smoke.spec.ts:75:7 › desktop › switches to the Share modal map (1.1s)
  ✓  3 [chromium] › tests/e2e/smoke.spec.ts:86:7 › desktop › keyboard: header controls first, visible node focus, Enter/Space select (904ms)
  ✓  4 [chromium] › tests/e2e/smoke.spec.ts:129:7 › mobile › has no horizontal overflow at 360px and keeps navigation (1.4s)
  4 passed (7.3s)
```

## Qué cubre cada test

**Unit (vitest, `tests/unit/`)**

- `schema.test.ts`: acepta un mapa válido y los dos mapas de ejemplo; rechaza `summary` > 140, tipos de arista/carril desconocidos, aristas a nodos inexistentes, ids duplicados, versión incorrecta y entradas que no son objetos. Estructura del camino principal: rechaza nodos `main` sin encadenar, dos cadenas separadas, bifurcaciones, dos aristas `main` entrantes, ciclos, aristas `main` que tocan nodos `branch`, auto-lazos e ids vacíos; recorta espacios en ids; acepta un solo nodo principal con ramas.
- `layout.test.ts`: el camino principal queda ordenado de izquierda a derecha en una sola fila (ambos mapas); las ramas quedan fuera de esa fila y ningún par de tarjetas se superpone; los casos límite que salen del camino principal van abajo; las ramas arrancan a la derecha de su ancla; se respetan las posiciones explícitas.
- `navigation.test.ts`: anterior/siguiente en el camino principal (incluye extremos), en ramas (anterior = padre, siguiente = siguiente nodo principal tras el ancla), casos límite anidados, rama del último nodo, conexiones entrantes y salientes, etiquetas de posición ("3/9 · camino principal").
- `markdown.test.ts`: párrafos, listas y marcas en línea.

**Smoke (Playwright, `tests/e2e/smoke.spec.ts`)**

- Escritorio 1440×900: carga con 26 nodos, encabezado, pista y lectura de zoom en %; arranca en "Problema" (1/9); clic en un nodo actualiza el panel; siguiente/anterior; navegación desde una rama; chip de conexión; modo oscuro (clase `dark` en `<html>`) y vuelta a claro; cambio al mapa "Share modal" (títulos en español).
- Teclado (escritorio): orden de tabulación "Saltar al detalle" → selector de mapa → tema → primer nodo; el nodo enfocado tiene `aria-label` ("Problema, 1/9 · camino principal") y `outline` visible; Enter y Espacio seleccionan; la región viva anuncia solo título y posición; "Saltar al detalle" lleva el foco al panel; el thumb del slider se llama "Zoom".
- Móvil 360×740: `scrollWidth <= clientWidth` al cargar, tras navegar y con el Sheet de detalle abierto; zoom, Ajustar, tema, selector, anterior/siguiente y Detalle miden ≥ 40 px de alto; el botón "Cerrar" del Sheet no se monta sobre el badge.
- Capturas: por defecto en `test-results/screenshots/` (ignorado). Con `UPDATE_SCREENSHOTS=1` se escriben en `docs/screenshots/`: `desktop-light.png`, `desktop-dark.png`, `desktop-keyboard-focus.png`, `mobile.png`, `mobile-sheet.png`. Se regeneraron así una vez en esta ronda.

## Notas

- `pnpm test:e2e` necesita Chromium para Playwright: `pnpm exec playwright install chromium`. En esta máquina se instaló dentro del repo (`PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers`, ignorado por git) para no escribir fuera de la carpeta del proyecto.
- `pnpm test:e2e` sirve el build de producción con `next start`, así que hay que correr `pnpm build` antes.
