# Checks

Último registro: 2026-10-26, rama `slice-1-editor` (HEAD `170c2ac` más docs), macOS (arm64), Node v26.7.0, pnpm 11.22.0. Ejecutado desde un árbol limpio (`rm -rf .next test-results`), en este orden.

| # | Comando | Resultado |
| --- | --- | --- |
| 0 | `pnpm install --frozen-lockfile` | ✅ exit 0, lockfile al día |
| 1 | `pnpm typecheck` (`next typegen && tsc --noEmit`) | ✅ exit 0, sin errores |
| 2 | `pnpm lint` (`eslint`) | ✅ exit 0, sin warnings |
| 3 | `pnpm test` (`vitest run`) | ✅ 6 archivos, 69 tests pasan (antes 32) |
| 4 | `pnpm build` (`next build`) | ✅ exit 0, `/` prerenderizada como estática |
| 5 | `E2E_PORT=3110 PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers pnpm test:e2e` (`playwright test`, sobre `next start`) | ✅ 9 tests pasan (4 del visor, 5 del editor) |
| 6 | Colores hardcodeados: `grep -rnE '#[0-9a-fA-F]{3,8}\b\|rgba?\(\|oklch\(\|hsl\(' src \| grep -v globals.css` | ✅ sin resultados |
| 7 | `grep -rnE ":\s*any\b\|as any\|@ts-ignore\|@ts-expect-error\|eslint-disable" src tests` | ✅ sin resultados |
| 8 | `git status --short` después de todos los checks | ✅ vacío para archivos versionados: las capturas del e2e van a `test-results/` |

El puerto 3100 de esta máquina lo usa otro servicio, así que el e2e corrió con `E2E_PORT=3110` (O-N4). Sin la variable usa 3100.

## Salida

```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully

$ eslint

$ vitest run
 Test Files  6 passed (6)
      Tests  69 passed (69)

$ next build
▲ Next.js 16.4.2 (Turbopack)
✓ Compiled successfully in 1521ms
Route (app)
┌ ○ /
└ ○ /_not-found
○  (Static)  prerendered as static content

$ playwright test
[WebServer] $ next start --port 3110
  ✓  1 smoke.spec.ts › desktop › loads, selects nodes, navigates and toggles dark mode (2.7s)
  ✓  2 editor.spec.ts › editor (desktop) › create a map, add 3 nodes, connect, edit, persist, undo/redo and delete (3.1s)
  ✓  3 smoke.spec.ts › desktop › switches to the Share modal map (1.1s)
  ✓  4 editor.spec.ts › editor (desktop) › builds a 10-node map with main path and branches that survives a reload (1.6s)
  ✓  5 smoke.spec.ts › desktop › keyboard: header controls first, visible node focus, Enter/Space select (1.0s)
  ✓  7 smoke.spec.ts › mobile › has no horizontal overflow at 360px and keeps navigation (1.3s)
  ✓  6 editor.spec.ts › editor (desktop) › examples stay read-only; editing one makes a copy (2.1s)
  ✓  8 editor.spec.ts › editor (desktop) › keyboard: create, move, delete and undo without a mouse (308ms)
  ✓  9 editor.spec.ts › editor (mobile) › edits from the Sheet without horizontal overflow (1.1s)
  9 passed (9.0s)
```

## Qué cubre cada test

**Unit (vitest, `tests/unit/`)**

- `schema.test.ts`: acepta un mapa válido y los dos mapas de ejemplo; rechaza `summary` > 140, tipos de arista/carril desconocidos, aristas a nodos inexistentes, ids duplicados, versión incorrecta y entradas que no son objetos. Estructura del camino principal: rechaza nodos `main` sin encadenar, dos cadenas separadas, bifurcaciones, dos aristas `main` entrantes, ciclos, aristas `main` que tocan nodos `branch`, auto-lazos e ids vacíos; recorta espacios en ids; acepta un solo nodo principal con ramas. Slice 1: rechaza claves desconocidas (`.strict()`), errores genéricos en español, título en blanco con mensaje propio, mapa vacío válido y mapa con nodos pero sin `main` inválido (O-N5), mensajes del camino principal con títulos y borradores (`parseDraftMap`) que saltan las reglas del grafo pero no las de campo.
- `editor.test.ts`: el reductor `applyEdit` no muta la entrada; crear (suelto o conectado), editar campos y vista previa, cambiar de carril (las aristas `main` pasan a `branch`), mover con redondeo, borrar un nodo uniendo el camino principal, promoción a `main`, rechazo de auto-lazos, nodos inexistentes y conexiones duplicadas, editar y borrar aristas, título del mapa. Ayudas: tipo sugerido, ids legibles y únicos, primer nodo `main`, hueco libre y "Añadir paso siguiente". Historial: deshacer/rehacer, una edición nueva borra el rehacer, ediciones con la misma clave se agrupan, límite de 100 pasos.
- `store.test.ts`: arranca en el primer ejemplo; crear mapa vacío en modo edición; los ejemplos nunca cambian y editarlos crea una copia con posiciones fijas; deshacer/rehacer de crear, editar, mover, conectar y borrar (con confirmación) paso a paso; escribir en un campo es un solo paso; la arista seleccionada sigue a sus extremos; borrar sin conexiones es inmediato; renombrar, duplicar y borrar mapas; cambiar de mapa reinicia selección e historial; persistencia en localStorage (mapa, mapa abierto y modo) y descarte de mapas guardados inválidos.
- `layout.test.ts`: el camino principal queda ordenado de izquierda a derecha en una sola fila (ambos mapas); las ramas quedan fuera de esa fila y ningún par de tarjetas se superpone; los casos límite que salen del camino principal van abajo; las ramas arrancan a la derecha de su ancla; se respetan las posiciones explícitas.
- `navigation.test.ts`: anterior/siguiente en el camino principal (incluye extremos), en ramas (anterior = padre, siguiente = siguiente nodo principal tras el ancla), casos límite anidados, rama del último nodo, conexiones entrantes y salientes, etiquetas de posición ("3/9 · camino principal").
- `markdown.test.ts`: párrafos, listas y marcas en línea.

**Smoke del visor (Playwright, `tests/e2e/smoke.spec.ts`)**

- Escritorio 1440×900: carga con 26 nodos, encabezado, pista y lectura de zoom en %; arranca en "Problema" (1/9); clic en un nodo actualiza el panel; siguiente/anterior; navegación desde una rama; chip de conexión; modo oscuro (clase `dark` en `<html>`) y vuelta a claro; cambio al mapa "Share modal" (títulos en español).
- Teclado (escritorio): orden de tabulación "Saltar al detalle" → selector de mapa → menú del mapa → Ver/Editar → tema → primer nodo; el nodo enfocado tiene `aria-label` ("Problema, 1/9 · camino principal") y `outline` visible; Enter y Espacio seleccionan; la región viva anuncia solo título y posición; "Saltar al detalle" lleva el foco al panel y, con el panel desbordado, PageDown lo desplaza (O-N3); el enlace conserva su padding al enfocarse (O-N1); el thumb del slider se llama "Zoom".
- Móvil 360×740: `scrollWidth <= clientWidth` al cargar, tras navegar y con el Sheet de detalle abierto; zoom, Ajustar, tema, selector, anterior/siguiente y Detalle miden ≥ 40 px de alto; el botón "Cerrar" del Sheet no se monta sobre el badge; los chips de conexión del Sheet miden ≥ 40 px.

**Editor (Playwright, `tests/e2e/editor.spec.ts`)**

- Crear un mapa, añadir 3 nodos (estado vacío, "Añadir paso siguiente" y "Añadir nodo"), conectar arrastrando un conector y eligiendo "caso límite", editar con validación en vivo (resumen de 141 caracteres y título vacío muestran el mensaje y no se guardan), vista previa de código, deshacer/rehacer con teclado y barra, mover arrastrando (un paso de deshacer), recargar (el mapa guardado es idéntico y sigue en modo edición), borrar un nodo con 2 conexiones (confirmación) y deshacerlo, editar etiqueta y borrar una arista (aparece el problema "«Validar»"), modo oscuro.
- Un mapa de 10 nodos (7 principales y 3 ramas) sin problemas: tras recargar, el JSON guardado y las posiciones en pantalla son idénticos; en modo Ver la rama dice "rama de Paso 3".
- Los ejemplos no cambian: Editar crea "(copia)" y avisa; el ejemplo sigue con "Problema"; renombrar y borrar la copia desde el menú.
- Solo teclado: Enter en "Crear el primer nodo" y en "Añadir nodo", foco visible en el nodo, flechas lo mueven 5 px, Suprimir lo borra, ⌘/Ctrl+Z lo restaura y las dos flechas se deshacen como un paso.
- Móvil 360×740: Editar sobre el ejemplo, sin overflow horizontal, botones de edición ≥ 40 px, edición desde el Sheet y añadir/deshacer un nodo.
- Capturas: por defecto en `test-results/screenshots/` (ignorado). Con `UPDATE_SCREENSHOTS=1` se escriben en `docs/screenshots/`: `desktop-light.png`, `desktop-dark.png`, `desktop-keyboard-focus.png`, `mobile.png`, `mobile-sheet.png`, `editor-empty.png`, `editor-desktop.png`, `editor-dark.png`, `editor-ten-nodes.png`, `editor-mobile-sheet.png`. Se regeneraron así una vez en el slice 1 (cambió la vista inicial por O8 y el encabezado).

## Notas

- `pnpm test:e2e` necesita Chromium para Playwright: `pnpm exec playwright install chromium`. En esta máquina se instaló dentro del repo (`PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers`, ignorado por git) para no escribir fuera de la carpeta del proyecto.
- `pnpm test:e2e` sirve el build de producción con `next start`, así que hay que correr `pnpm build` antes.
- `E2E_PORT` cambia el puerto del e2e (por defecto 3100).
