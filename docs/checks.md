# Checks

Último registro: 2026-10-26, rama `slice-2-share` tras mergear `origin/main` (con el slice 1 ya mergeado, `dcc8825`), macOS (arm64), Node v26.7.0, pnpm 11.22.0. Ejecutado desde cero (`rm -rf node_modules .next test-results`), en este orden. Logs en `.check-logs/s2-main/` (ignorado por git y por ESLint).

| # | Comando | Resultado |
| --- | --- | --- |
| 0 | `pnpm install --frozen-lockfile` | ✅ exit 0, lockfile al día (nuevas: `lz-string`, `html-to-image`) |
| 1 | `pnpm typecheck` (`next typegen && tsc --noEmit`) | ✅ exit 0, sin errores |
| 2 | `pnpm lint` (`eslint`, incluye la regla que restringe `localStorage` a `src/lib/storage.ts`) | ✅ exit 0, sin warnings |
| 3 | `pnpm test` (`vitest run`) | ✅ 11 archivos, 120 tests pasan (antes 87) |
| 4 | `pnpm build` (`next build`) | ✅ exit 0, `/` prerenderizada como estática |
| 5 | `E2E_PORT=3120 PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers pnpm test:e2e` | ✅ 21 tests pasan (4 del visor, 9 del editor, 8 de compartir) |
| 6 | Colores hardcodeados: `grep -rnE '#[0-9a-fA-F]{3,8}\b\|rgba?\(\|oklch\(\|hsl\(' src \| grep -v globals.css` | ✅ sin resultados |
| 7 | `grep -rnE ":\s*any\b\|as any\|@ts-ignore\|@ts-expect-error\|eslint-disable" src tests` | ✅ sin resultados |
| 8 | `git status --short` después de todos los checks | ✅ vacío |

El puerto 3100 de esta máquina lo usa otro servicio y el 3110 el revisor de otra sesión, así que el e2e corrió con `E2E_PORT=3120`. `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers` apunta al Chromium instalado dentro del repo (en la caché global puede faltar la revisión que pide Playwright 1.64).

## Salida

```text
$ vitest run
 Test Files  11 passed (11)
      Tests  120 passed (120)

$ next build
✓ Compiled successfully
Route (app)
┌ ○ /
└ ○ /_not-found

$ playwright test
[WebServer] $ next start --port 3120
  21 passed (13.7s)
```

## Qué cubre cada test

**Unit (vitest, `tests/unit/`)**

- `schema.test.ts`: acepta un mapa válido y los dos mapas de ejemplo; rechaza `summary` > 140, tipos de arista/carril desconocidos, aristas a nodos inexistentes, ids duplicados, versión incorrecta y entradas que no son objetos. Estructura del camino principal: rechaza nodos `main` sin encadenar, dos cadenas separadas, bifurcaciones, dos aristas `main` entrantes, ciclos, aristas `main` que tocan nodos `branch`, auto-lazos e ids vacíos; recorta espacios en ids; acepta un solo nodo principal con ramas. Slice 1: rechaza claves desconocidas (`.strict()`), errores genéricos en español, título en blanco con mensaje propio, mapa vacío válido y mapa con nodos pero sin `main` inválido (O-N5), mensajes del camino principal con títulos y borradores (`parseDraftMap`) que saltan las reglas del grafo pero no las de campo.
- `editor.test.ts`: el reductor `applyEdit` no muta la entrada; crear (suelto o conectado), editar campos y vista previa, cambiar de carril (las aristas `main` pasan a `branch`), mover con redondeo, borrar un nodo uniendo el camino principal, promoción a `main`, rechazo de auto-lazos, nodos inexistentes y conexiones duplicadas, editar y borrar aristas, título del mapa. Ayudas: tipo sugerido, ids legibles y únicos, primer nodo `main`, hueco libre y "Añadir paso siguiente". Ronda 1: no sugiere "principal" si cierra un ciclo (D4); al borrar un nodo del medio promueve una rama existente y no crea pares en ambos sentidos (O3). Historial: deshacer/rehacer, una edición nueva borra el rehacer, ediciones con la misma clave se agrupan, límite de 100 pasos.
- `store-blocked-storage.test.ts` (B1): con un `localStorage` cuyo getter lanza `SecurityError`, el store hidrata, muestra los ejemplos, avisa que no se guardará y edita en memoria. Antes del arreglo fallaba con `TypeError: Cannot read properties of undefined (reading 'rehydrate')`.
- `store.test.ts`: arranca en el primer ejemplo; crear mapa vacío en modo edición; los ejemplos nunca cambian y editarlos crea una copia con posiciones fijas; deshacer/rehacer de crear, editar, mover, conectar y borrar (con confirmación) paso a paso; escribir en un campo es un solo paso; la arista seleccionada sigue a sus extremos; borrar sin conexiones es inmediato; renombrar, duplicar y borrar mapas; cambiar de mapa reinicia selección e historial; persistencia en localStorage (mapa, mapa abierto y modo) y descarte de mapas guardados inválidos. Ronda 1: copia de seguridad y aviso con una entrada inválida, con JSON corrupto y con otra versión (D1); ids de mapa duplicados o de ejemplos (O2); escritura rechazada por cuota (O4); sincronización con otra pestaña sin rebote de escrituras y con reinicio del historial (O10); foco tras borrar (D3).
- `layout.test.ts`: el camino principal queda ordenado de izquierda a derecha en una sola fila (ambos mapas); las ramas quedan fuera de esa fila y ningún par de tarjetas se superpone; los casos límite que salen del camino principal van abajo; las ramas arrancan a la derecha de su ancla; se respetan las posiciones explícitas; con todas las posiciones fijas no corre dagre (O5).
- `navigation.test.ts`: anterior/siguiente en el camino principal (incluye extremos), en ramas (anterior = padre, siguiente = siguiente nodo principal tras el ancla), casos límite anidados, rama del último nodo, conexiones entrantes y salientes, etiquetas de posición ("3/9 · camino principal").
- `markdown.test.ts`: párrafos, listas y marcas en línea.
- `share.test.ts` (slice 2): ida y vuelta exacta (`toEqual`) de los dos ejemplos y de un mapa con acentos, emoji, `#?&=` y posiciones decimales; la URL reemplaza el hash anterior y solo usa caracteres seguros; enlaces vacíos, cortados a la mitad o corruptos dan un error en español que menciona el enlace; un mapa que incumple el esquema da el error con su ruta (`nodes.0.summary: …`); JSON que no es un mapa.
- `io.test.ts` (slice 2): exportar → importar devuelve el mismo mapa (ejemplos incluidos); JSON con sangría; `details` por defecto; texto vacío; JSON roto con línea y columna; errores del esquema con ruta; claves desconocidas, otra versión y no-objetos; un borrador que solo rompe el camino principal se acepta con sus problemas; `slugify` (acentos, ñ, emoji, longitud).
- `export-image.test.ts` (slice 2): el marco del PNG contiene todos los nodos de ambos ejemplos con 48 px de margen a 2x; un nodo da tarjeta + margen exacto; mapas enormes bajan el `pixelRatio` en lugar de fallar.
- `store-share.test.ts` (slice 2): un hash sin mapa no hace nada; abrir un enlace muestra el mapa exacto en modo Ver, ignora ediciones y no se guarda (al recargar vuelve al mapa anterior); "Guardar en mis mapas" lo guarda igual y abre en edición; "Editar" sobre un compartido lo guarda primero; un enlace corrupto avisa y deja el mapa actual; se puede volver al compartido desde el selector; importar añade un mapa nuevo con título único y posiciones fijas, conserva exacto un mapa con posiciones y abre en edición los borradores con problemas.

**Smoke del visor (Playwright, `tests/e2e/smoke.spec.ts`)**

- Escritorio 1440×900: carga con 26 nodos, encabezado, pista y lectura de zoom en %; arranca en "Problema" (1/9); clic en un nodo actualiza el panel; siguiente/anterior; navegación desde una rama; chip de conexión; modo oscuro (clase `dark` en `<html>`) y vuelta a claro; cambio al mapa "Share modal" (títulos en español).
- Teclado (escritorio): orden de tabulación "Saltar al detalle" → selector de mapa → menú del mapa → Ver/Editar → tema → primer nodo; el nodo enfocado tiene `aria-label` ("Problema, 1/9 · camino principal") y `outline` visible; Enter y Espacio seleccionan; la región viva anuncia solo título y posición; "Saltar al detalle" lleva el foco al panel y, con el panel desbordado, PageDown lo desplaza (O-N3); el enlace conserva su padding al enfocarse (O-N1); el thumb del slider se llama "Zoom".
- Móvil 360×740: `scrollWidth <= clientWidth` al cargar, tras navegar y con el Sheet de detalle abierto; zoom, Ajustar, tema, selector, anterior/siguiente y Detalle miden ≥ 40 px de alto; el botón "Cerrar" del Sheet no se monta sobre el badge; los chips de conexión del Sheet miden ≥ 40 px.

**Editor (Playwright, `tests/e2e/editor.spec.ts`)**

- Crear un mapa, añadir 3 nodos (estado vacío, "Añadir paso siguiente" y "Añadir nodo"), conectar arrastrando un conector y eligiendo "caso límite", editar con validación en vivo (resumen de 141 caracteres y título vacío muestran el mensaje y no se guardan), vista previa de código, deshacer/rehacer con teclado y barra, mover arrastrando (un paso de deshacer), recargar (el mapa guardado es idéntico y sigue en modo edición), borrar un nodo con 2 conexiones (confirmación) y deshacerlo, editar etiqueta y borrar una arista (aparece el problema "«Validar»"), modo oscuro.
- Un mapa de 10 nodos (7 principales y 3 ramas) sin problemas: tras recargar, el JSON guardado y las posiciones en pantalla son idénticos; en modo Ver la rama dice "rama de Paso 3".
- Los ejemplos no cambian: Editar crea "(copia)" y avisa; el ejemplo sigue con "Problema"; renombrar y borrar la copia desde el menú.
- Solo teclado: Enter en "Crear el primer nodo" y en "Añadir nodo", foco visible en el nodo, flechas lo mueven 5 px, Suprimir lo borra, ⌘/Ctrl+Z lo restaura y las dos flechas se deshacen como un paso.
- Ronda 1, teclado (D2/D3): una arista enfocada dibuja su trazo a 3 px; tras borrar con Suprimir una arista o un nodo (confirmando el diálogo con teclado) el foco queda en el nodo origen o anterior; al cancelar vuelve al nodo; al borrar el último, al lienzo con anillo visible.
- Ronda 1, almacenamiento bloqueado (B1): con el getter de `localStorage` lanzando `SecurityError`, el visor carga los 26 nodos sin error boundary, aparece el aviso, se puede crear y editar un mapa y no hay `pageerror`.
- Ronda 1, dos pestañas (O10): A crea un mapa, B (abierta antes) crea otro; al recargar A están los dos.
- Móvil 360×740: Editar sobre el ejemplo, sin overflow horizontal, botones de edición ≥ 40 px, edición desde el Sheet (título, selects, "Centrar en el canvas" y "Cerrar" ≥ 40 px, O6) y añadir/deshacer un nodo.
- Ronda 2, móvil (D1-r2): borrar un nodo desde el Sheet deja el foco dentro del Sheet y fuera de contenido `aria-hidden`; Suprimir no abre el borrado de un nodo oculto y Tab no sale del Sheet. Fallaba antes del arreglo.
- Ronda 2: renombrar (guardar o cancelar) y borrar un mapa devuelven el foco al botón "Acciones del mapa".

**Compartir (Playwright, `tests/e2e/share.spec.ts`, slice 2)**

- Compartir → contexto limpio → guardar: se crea un mapa de 3 nodos (con «ñ», emoji y `#?&=`), "Compartir" copia el enlace (se lee del portapapeles), Escape devuelve el foco al botón; en un `browser.newContext()` nuevo el enlace muestra el banner, modo Ver y 3 nodos; el JSON que exporta es idéntico (`toEqual`) al mapa guardado en el origen; no escribe nada en localStorage; "Guardar en mis mapas" lo guarda idéntico, pasa a Editar, limpia el hash y sobrevive a la recarga. Sin `pageerror`.
- Enlace corrupto, cortado o con un mapa inválido: aviso "No se pudo abrir el enlace" (con `nodes.0.summary: …` en el inválido), se ven los 26 nodos del ejemplo, el hash se limpia, el aviso se cierra y la app responde. Sin `pageerror`.
- Enlace pegado en una pestaña abierta (`hashchange`): abre el mapa compartido; al cambiar de mapa se limpia el hash.
- Importar: un archivo válido (por el selector de archivos del botón en español) crea "Importado" idéntico en localStorage; un archivo inválido lista los errores con ruta y deja el diálogo abierto; JSON pegado roto dice línea y columna; Escape devuelve el foco al menú; texto pegado válido también importa. Sin `pageerror`.
- Exportar: JSON de "universe: el spec" como `universe-el-spec.json` con 26 nodos; PNG `universe-el-spec.png` cuyas dimensiones son exactamente (caja de los 26 nodos del canvas + 96) × 2 (±2 px), con píxel de esquina claro en tema claro y oscuro en tema oscuro.
- Enlace de más de 8000 caracteres (80 nodos con texto aleatorio): aparece el aviso.
- Solo teclado: Enter en "Compartir", Escape vuelve al botón; menú → "Importar JSON…" → foco en "Elegir archivo JSON…", Tab al textarea, Importar con Enter muestra el error en `role="alert"`; "Exportar JSON" con Enter descarga.
- Móvil 360×740: un enlace abierto sin overflow horizontal, "Guardar en mis mapas" ≥ 40 px y guarda. El smoke suma "Compartir" al orden de tabulación y a las áreas táctiles de ≥ 40 px.

- Capturas: por defecto en `test-results/screenshots/` (ignorado). Con `UPDATE_SCREENSHOTS=1` se escriben en `docs/screenshots/`: `desktop-light.png`, `desktop-dark.png`, `desktop-keyboard-focus.png`, `mobile.png`, `mobile-sheet.png`, `editor-empty.png`, `editor-desktop.png`, `editor-dark.png`, `editor-ten-nodes.png`, `editor-mobile-sheet.png`. Se regeneraron así una vez en el slice 1 (cambió la vista inicial por O8 y el encabezado).

## Notas

- `pnpm test:e2e` necesita Chromium para Playwright: `pnpm exec playwright install chromium`. En esta máquina se instaló dentro del repo (`PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers`, ignorado por git) para no escribir fuera de la carpeta del proyecto.
- `pnpm test:e2e` sirve el build de producción con `next start`, así que hay que correr `pnpm build` antes.
- `E2E_PORT` cambia el puerto del e2e (por defecto 3100).
- El e2e de compartir guarda `share-dialog.png`, `share-open-link.png` e `import-errors.png` con la misma regla de `UPDATE_SCREENSHOTS`, y los PNG exportados (`export-light.png`, `export-dark.png`) siempre en `test-results/screenshots/`. En este PR no se regeneró `docs/screenshots/`.
