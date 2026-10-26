# Ledger

## 2026-10-23: Slice 0, visor (rama `slice-0-viewer`)

### Qué se hizo

- Scaffold de Next.js 16 (App Router, TypeScript estricto, Tailwind 4, ESLint) con pnpm. Configuración por defecto de `create-next-app`, sin variables de entorno. `/` se prerenderiza como estática y todo corre en el cliente.
- shadcn/ui (preset Nova, base Radix): `resizable`, `sheet`, `toggle`, `toggle-group`, `tooltip`, `button`, `scroll-area`, `badge`, `select`, `separator`, `slider`. React Flow UI vía `npx shadcn@latest add https://ui.reactflow.dev/...`: `base-node` (base de las tarjetas) y `zoom-slider` (adaptado: copy en español, tooltips, lectura en % y botón **Ajustar**).
- Esquema `SystemMap` en Zod (`src/lib/schema.ts`): tipos, `summary` ≤ 140, ids únicos, aristas a nodos existentes. Documentado en el README.
- Lógica de grafo (`src/lib/graph.ts`): orden del camino principal, ancla de cada rama, anterior/siguiente, conexiones y etiquetas de posición.
- Layout (`src/lib/layout.ts`): dagre (`rankdir: LR`) asigna la columna de cada nodo. Después el camino principal se fija en una fila y cada subárbol de rama ocupa el carril libre más cercano arriba o abajo de su ancla. Las ramas se alternan; los casos límite que salen del camino principal van siempre abajo.
- UI: tarjetas mínimas (título, resumen de una línea, vista previa `text|list|code|metric|ui`), aristas tipadas (sólida, discontinua, punteada y atenuada) con flecha, un solo color de acento (`--highlight`) para el nodo seleccionado, sus aristas y sus vecinos. Grilla de puntos, líneas de 1px, Geist.
- Panel de detalle: posición ("3/9 · camino principal", "rama de X", "caso límite de X"), badge de tipo, explicación, vista previa, detalles en markdown simple, ← anterior / siguiente →, chips de conexiones que seleccionan y centran el nodo.
- Encabezado: "universe · título · N nodos", pista y leyenda. Selector de mapa y modo claro/oscuro (`next-themes`).
- Móvil (< 768px): canvas arriba, barra inferior con el nodo actual y anterior/siguiente, y detalle completo en un **Sheet** inferior.
- Mapas de ejemplo: "universe: el spec" (26 nodos) y "Share modal" (9 nodos).
- Tests: 23 unitarios (vitest) y 3 de smoke (Playwright) con capturas. Ver [checks.md](checks.md).
- Docs: brief, roadmap, checks, ledger, REVIEW.md, LICENSE MIT, README con esquema y capturas.

### Decisiones

- **Layout híbrido dagre + carriles.** Con dagre solo, las ramas quedaban intercaladas con el camino principal. Dagre decide el eje x (rangos) y un paso propio decide el eje y, para que el camino principal sea una línea recta y las ramas nunca se superpongan (lo cubre un test).
- **Ajuste inicial resistente al tamaño.** El canvas cambia de tamaño después del montaje (paneles redimensionables). Un `ResizeObserver` reajusta el camino principal hasta que la persona mueve el viewport. En canvas angostos (< 640px) el ajuste inicial cubre los 3 primeros nodos principales (con los 9 quedaba al 13%, ilegible). **Ajustar** siempre encuadra el camino principal completo.
- **Markdown propio y mínimo** (párrafos, listas, negrita, cursiva, código) en lugar de una dependencia: es todo lo que el esquema promete.
- **El tema arranca en claro** (`defaultTheme="light"`, sin seguir al sistema) para que el primer render sea determinista. Se puede cambiar a `system` más adelante.
- **Atribución de React Flow visible** (abajo a la derecha, con colores del tema). La quitamos solo con una suscripción Pro.
- `typecheck` corre `next typegen` antes de `tsc`. Sin eso, `LayoutProps` (tipo global que genera Next) no existe en un clon limpio y `tsc` falla. Se detectó al correr los checks desde cero.
- Los componentes shadcn generados usaban `bg-white` (slider) y `bg-black/10` (overlay del Sheet). Se cambiaron a tokens (`bg-background`, `bg-foreground/10`) para cumplir REVIEW.md.

### Problemas encontrados y resueltos

1. Ajuste inicial al 18% usando la mitad del canvas: el `fitView` corría antes de que se asentaran los paneles. Se resolvió con el reajuste por `ResizeObserver`.
2. Etiquetas de aristas invisibles en modo oscuro (cajas negras sin texto). Se resolvió dando color a texto y fondo de la etiqueta con tokens del tema.
3. Vistas previas de 2 líneas desbordaban la tarjeta. Se resolvió con altura de tarjeta de 108px y vistas previas `ui` de una línea en el canvas.
4. Playwright 1.64 necesitaba un Chromium nuevo. Se instaló dentro del repo (`.playwright-browsers/`, en `.gitignore`) para no tocar nada fuera de la carpeta.

### Temas abiertos

- Las referencias de Mobbin se tomaron del brief; en esta sesión no se navegaron pantallas de Mobbin.
- La vista general del mapa "universe: el spec" en escritorio queda al ~36% de zoom (9 nodos principales); se lee bien al acercar o al seguir anterior/siguiente, que centran a ≥75%.
- Las etiquetas de arista pueden cruzarse con líneas de ramas verticales cercanas (visible en "Share modal"). Es cosmético; se puede afinar en slice 1.
- No hay carga de JSON del usuario todavía (fuera de alcance: import/export es slice 2). El estado vacío existe en el visor, pero ningún mapa incluido lo ejercita.
- Selección y mapa activo no se reflejan en la URL (llega con los enlaces para compartir, slice 2).
- No se hizo deploy a producción; el preview de Vercel lo genera el PR.

### Reporte final

- **PR**: https://github.com/sarabiaproject/universe/pull/1 ("Slice 0: visor", `slice-0-viewer` → `main`). Sin merge, sin push a `main`, sin deploy a producción, sin comandos `vercel`.
- **Checks**: typecheck, lint, 23 tests unitarios, build y 3 tests de Playwright en verde (ver [checks.md](checks.md)).
- **Capturas**: `docs/screenshots/desktop-light.png`, `desktop-dark.png`, `mobile.png`.
- **Siguiente paso**: revisar el preview de Vercel del PR y arrancar slice 1 (edición + localStorage).

## 2026-10-23: Slice 0, revisión ronda 1 (rama `slice-0-viewer`)

Revisión independiente en `~/dev/universe-review/REVIEW-round-1.md`: cambios requeridos (menores), un bloqueante.

### Qué se arregló

- **B1 (bloqueante), opción (b)**: los nodos siguen siendo enfocables, ahora con anillo visible (`outline` de 2 px con `--foreground` en lugar de `outline: none`). Enter y Espacio seleccionan el nodo enfocado. Cada nodo tiene `aria-label` "título, posición". Las descripciones de React Flow (`ariaLabelConfig`) están en español. Los controles del encabezado van antes del canvas en el DOM y hay un enlace "Saltar al detalle" (primera parada de Tab) que lleva el foco al panel o, en móvil, a la barra inferior.
- **D1**: `NodeDetail` acepta `inSheet` y deja `pr-10` en la fila del badge; la X ya no lo tapa.
- **D2**: "Close" → "Cerrar" en el Sheet; títulos del mapa Share modal en español ("Por defecto: solo tú", "Email escrito", …); e2e actualizado. El título del mapa ("Share modal") se mantiene: es el nombre del ejemplo.
- **D3**: el e2e guarda capturas en `test-results/screenshots/`; `docs/screenshots/` solo con `UPDATE_SCREENSHOTS=1`. Tras todos los checks `git status` queda limpio.
- **D4**: `superRefine` exige un camino principal de una sola cadena (aristas `main` solo entre nodos `main`, ≤ 1 entrante y ≤ 1 saliente, un inicio que alcanza a todos), rechaza auto-lazos y usa `.trim().min(1)` en ids. 9 tests nuevos y regla documentada en el README.
- **D5**: fuera `aria-live` del `<article>`; una región `sr-only` anuncia solo "título, posición".
- **D6**: el `Slider` acepta `thumbLabel` y el thumb del zoom se llama "Zoom".
- **Opcionales**: O4 (README: `details?`), O6 (contextos de nodo en un `useMemo([map])`, salió gratis con los `aria-label`), O10 (áreas táctiles móviles ≥ 40 px, verificado en el e2e), O11 (`shadcn` en `devDependencies`). El resto (O1, O2, O3, O5, O7, O8, O9, O12) queda en `docs/roadmap.md` para el slice 1.
- **REVIEW.md**: tres checks nuevos, uno por clase de error: foco visible y teclado, copy en español fuera del chrome visible (`sr-only`, `aria-label`, mapas de ejemplo) y tests que no ensucian el árbol.

### Decisiones

- Anillo de foco con `--foreground` y no con `--ring`: el gris de `--ring` sobre fondo claro queda por debajo de 3:1. El acento (`--highlight`) se reserva para la selección.
- Enter/Espacio se manejan con un `onKeyDown` en el contenedor del canvas (filtrando `.react-flow__node`) en lugar de activar `elementsSelectable`, para no meter el estado de selección de React Flow junto al del store.

### Checks

`pnpm install --frozen-lockfile`, `typecheck`, `lint`, `test` (32/32), `build` y `test:e2e` (4/4) en verde desde un árbol limpio; grep de colores vacío; `git status` limpio tras los tests. Detalle en [checks.md](checks.md).


## 2026-10-26: Slice 1, editor (rama `slice-1-editor`)

### Qué se hizo

- **Núcleo de edición** (`src/lib/editor.ts`): `applyEdit`, un reductor puro con acciones para crear, editar, mover, borrar y conectar nodos, editar y borrar aristas y editar el mapa. Historial de deshacer/rehacer con límite de 100 pasos y agrupación por campo (escribir un título es un solo paso).
- **Store** (`src/store/map-store.ts`): "Mis mapas" en localStorage con `zustand/persist` (clave `universe`), validados con Zod al leerlos. Crear, renombrar, duplicar y borrar. Modo Ver/Editar, selección de nodo o arista, confirmación de borrado e historial del mapa abierto.
- **UI**: interruptor Ver/Editar, menú del mapa (`⋯`), selector con grupos "Mis mapas" y "Ejemplos (solo lectura)", barra de edición (añadir, deshacer, rehacer), estado vacío, diálogo de tipo de conexión, confirmación de borrado e inspector (nodo, arista y mapa) con validación en vivo y lista de problemas del grafo. En móvil, el inspector va en el Sheet.
- **Componentes shadcn nuevos**: dialog, alert-dialog, dropdown-menu, input, textarea y label. El overlay usa `bg-foreground/10` y "Close" pasó a "Cerrar".
- **Limpieza de la revisión**: O1 (`z.config(z.locales.es())` y mensajes propios), O2 (`z.strictObject`), O3 (`src/app/error.tsx` con `retry`, la API de Next 16), O5 (fuera `NodeContext.parent` y los subcomponentes sin uso de `base-node`), O7 (la UI se monta tras leer localStorage: no hay flash del layout de escritorio en móvil), O8 (la vista inicial y "Ajustar" encuadran todo el mapa, ramas incluidas), O9 (acento solo en la selección y sus aristas, ya no en vecinos ni en el badge), O12 (vista previa de código con `whitespace-pre-wrap` y `line-clamp-2`), O-N1 (padding del enlace de salto), O-N2 (descripciones de aristas, nodos movidos y aristas en español), O-N3 (el enlace de salto enfoca el viewport que hace scroll), O-N4 (`E2E_PORT`), O-N5 (ver decisiones) y chips de conexión de 40 px en móvil.
- **Tests**: 69 unitarios (antes 32) y 9 e2e (antes 4). Ver [checks.md](checks.md).

### Decisiones

- **Los ejemplos no se editan nunca.** Pulsar "Editar" sobre un ejemplo crea "… (copia)" en "Mis mapas" y abre la copia en modo edición, con un aviso por `role="status"`. Al duplicar se fijan las posiciones del layout automático, así arrastrar un nodo no mueve a los demás.
- **Los borradores pueden incumplir las reglas del grafo.** Insertar un paso en medio del camino principal pasa por estados inválidos (un nodo `main` suelto), y bloquearlos haría imposible editar. Por eso hay dos esquemas: `SystemMapDraftSchema` (campos y tipos) para guardar y `SystemMapSchema` (más las reglas del grafo) para importar y para los ejemplos. El editor lista los problemas arriba del panel. Los campos (título, resumen ≤ 140, contenido de la vista previa) sí se validan antes de guardar: un valor inválido se queda en el campo con su mensaje y no llega al mapa.
- **Ediciones que mantienen el camino principal coherente**: una arista `main` convierte sus extremos en `main`; pasar un nodo a "Rama" convierte sus aristas `main` en `branch`; borrar un nodo del medio une su anterior con su siguiente. "Añadir paso siguiente" continúa el camino desde su último nodo o crea una rama.
- **O-N5**: un mapa sin nodos es válido (es el estado vacío); un mapa con nodos necesita al menos uno `main`.
- **O8**: se eligió encuadrar todo el mapa. "universe: el spec" arranca al ~32% en escritorio con "Preguntas abiertas" visible. En canvas angostos (< 640 px) se mantiene el ajuste a los 3 primeros nodos principales.
- **Deshacer**: el historial es por sesión y por mapa; se reinicia al recargar o cambiar de mapa. Los atajos ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) no actúan dentro de campos de texto, donde manda el deshacer nativo. Mover con flechas agrupa las pulsaciones seguidas en un paso; cada arrastre es un paso.
- **Ids legibles**: los nodos nuevos reciben un id a partir del título inicial ("nuevo-nodo", "nuevo-nodo-2"); renombrar no cambia el id, para no romper aristas. Los mensajes del editor nombran los nodos por su título.
- **Conexiones**: no se permiten auto-lazos, ni conexiones duplicadas o inversas entre el mismo par. El diálogo propone el tipo: "principal" si extiende la cadena, si no "rama".
- **Hidratación**: `persist` con `skipHydration` y `rehydrate()` al montar; hasta entonces se muestra una pantalla neutra. Esto resuelve O7 y evita ver el ejemplo un instante antes del mapa guardado. React Flow se monta cuando su contenedor ya tiene tamaño (evita el warning #004 y un ajuste inicial con tamaño 0).
- **Handles fuera de la tarjeta**: el `overflow-hidden` de la tarjeta recortaba la mitad del conector y hacía que al arrastrar se moviera el nodo en lugar de conectar.

### Problemas encontrados y resueltos

1. Al borrar una arista, la selección (un índice) pasaba a señalar otra arista, y deshacer mostraba el editor de una arista distinta. Ahora la selección sigue a sus extremos (`from → to`) tras cada edición y cada deshacer. Lo cubren un test unitario y el e2e.
2. React Flow avisaba (#015) de que no podía arrastrar nodos sin medir: como son controlados, ahora se pasan con `measured`.
3. Arrastrar desde el conector movía la tarjeta (conector recortado). Se resolvió sacando los `Handle` del contenedor recortado.
4. `zustand/persist` captura `localStorage` al cargar el módulo; en vitest el falso se instala con `vi.hoisted`.

### Temas abiertos

- Mobbin se consultó para el patrón del editor (inspector con etiquetas a la derecha en AirOps y Klaviyo, Edit/Playground en fal, barra flotante con + y deshacer). No se guardaron colecciones.
- Conectar arrastrando es solo con puntero; con teclado se conecta desde el panel ("Conectar con…"), que también es la vía en móvil.
- El historial no sobrevive a la recarga (pasa a post-MVP).
- Los nodos nuevos no se colocan con dagre: van al centro visible (o a la derecha o debajo del nodo de origen) en el primer hueco libre.
- Importar/exportar JSON, enlaces para compartir y exportar PNG quedan para el slice 2.

### Reporte final

- **PR**: https://github.com/sarabiaproject/universe/pull/2 ("Slice 1: editor", `slice-1-editor` → `main`). Sin merge, sin push a `main`, sin deploy y sin comandos `vercel`; no se tocó el servicio del puerto 3100.
- **Checks**: install, typecheck, lint, 69 tests unitarios, build y 9 e2e (`E2E_PORT=3110`) en verde; greps vacíos; árbol limpio (ver [checks.md](checks.md)).

## 2026-10-26: Slice 1, revisión ronda 1 (rama `slice-1-editor`)

Revisión independiente en `~/dev/universe-review-s1/REVIEW-s1-round-1.md`: cambios requeridos, con 1 bloqueante y 4 "debería".

### Qué se arregló

- **B1. Almacenamiento bloqueado tumbaba toda la app.**
  - Causa: con `localStorage` lanzando `SecurityError`, `createJSONStorage` devolvía `undefined`, `persist` no instalaba su API y `rehydrate()` lanzaba.
  - Arreglo: `src/lib/storage.ts` prueba el acceso y, si falla, cae a memoria; la app funciona y avisa "los cambios no se guardarán".
  - El test unitario reprodujo el `TypeError` antes del arreglo. Hay además un e2e con el getter bloqueado.
- **D1. Datos guardados ilegibles se perdían en silencio.**
  - Arreglo: el JSON corrupto, otra versión o una entrada inválida se copian a `universe:backup-<hora>` antes de la siguiente escritura, con aviso visible.
  - `migrate` declarado con `STORAGE_VERSION`.
  - Un test unitario por caso.
- **D2. Aristas sin foco visible.** `.react-flow__edge:focus-visible .react-flow__edge-path` las pinta en `--foreground` a 3 px. Lo cubre un e2e.
- **D3. Foco a `<body>` tras borrar.**
  - El store publica qué enfocar: el nodo anterior del camino, el origen de la arista, un vecino o el lienzo (`role="group"`, "Lienzo del mapa", con anillo).
  - El diálogo de borrado no devuelve el foco al nodo borrado; al cancelar, sí vuelve al nodo.
  - Lo cubren un e2e y un unitario.
- **D4. Sugerencia "principal" que cerraba un ciclo.** `suggestedEdgeType` comprueba que el destino no esté aguas arriba del origen en la cadena. Lo cubre un unitario.
- **Opcionales hechos:**
  - **O2**: reglas de ids, referencias y auto-lazos en el esquema de borrador; `restore` descarta ids de mapa repetidos o de ejemplos, con copia.
  - **O3**: borrar un nodo del medio promueve una rama `prev → next` existente y nunca crea pares en ambos sentidos.
  - **O4**: una escritura rechazada por cuota avisa una vez.
  - **O5**: sin dagre cuando todos los nodos tienen posición.
  - **O6**: controles del Sheet de edición y "Cerrar" a 40 px.
  - **O7**: la clave de agrupación de la etiqueta usa `from → to`.
  - **O10**: evento `storage`; toma solo los mapas, conserva el mapa abierto y el modo de cada pestaña, y no reescribe si son iguales (evita el rebote entre pestañas).
- **Error boundary**: ya no dice que los mapas "siguen guardados".

### Para que no se repita (REVIEW.md y checks)

- ESLint prohíbe `localStorage` y `sessionStorage` fuera de `src/lib/storage.ts` (`no-restricted-globals` y `no-restricted-properties`). Comprobado con un archivo de prueba: los dos accesos dan error.
- REVIEW.md suma tres puntos: almacenamiento seguro, no perder datos en silencio (copia y `migrate`), y foco visible en aristas y conservado al borrar.
- El foco visible ya había fallado en el slice 0 (B1 de esa ronda, en nodos). Ahora el e2e de teclado del editor también verifica aristas, el lienzo y el foco tras borrar.

### Seguimientos (opcionales no hechos)

- **O1**: un valor inválido sin confirmar se pierde al cambiar de nodo; se podría conservar el borrador por `nodo:campo` o avisar.
- **O8'**: la vista inicial de "universe: el spec" queda al ~32% en escritorio. Es una decisión de producto: un `minZoom` para el ajuste inicial que priorice el camino principal.
- **O9**: las aristas activas (`zIndex: 1`) pueden interceptar clics sobre un nodo si pasan por debajo de él. Ya pasaba en `main`.
- **O10, límite**: dos pestañas editando el mismo mapa a la vez siguen con "gana la última escritura" a nivel de lista. El evento `storage` evita el caso de la revisión (una pestaña vieja que borra mapas nuevos), pero no fusiona ediciones simultáneas del mismo mapa.

### Checks

Desde cero: install, typecheck, lint, 87 tests unitarios (antes 69), build y 12 e2e (antes 9) en verde; greps vacíos; árbol limpio. Ver [checks.md](checks.md); logs en `.check-logs/s1-fix-r1/`.

## 2026-10-26: Slice 1, revisión ronda 2 (rama `slice-1-editor`)

Revisión independiente en `~/dev/universe-review-s1/REVIEW-s1-round-2.md`: cambios requeridos solo por D1-r2. Los arreglos de la ronda 1 quedaron verificados.

### Qué se arregló

- **D1-r2. En móvil, al borrar un nodo desde el Sheet, el foco salía del modal.**
  - Causa: el efecto `refocus` (arreglo de D3) enfocaba un nodo del canvas que estaba detrás del Sheet, dentro de contenido `aria-hidden`. Desde ahí, Tab escapaba del modal y Suprimir proponía borrar un nodo oculto.
  - Arreglo: mientras hay un diálogo abierto, el canvas no toma el foco; se queda en el diálogo, o vuelve a él si estaba fuera. En escritorio no cambia nada.
  - Prueba: un e2e móvil nuevo que falló antes del arreglo. El e2e de escritorio de D3 sigue pasando.
- **Foco al cerrar los diálogos del menú del mapa.** Renombrar (guardar o cancelar) y borrar un mapa devuelven el foco al botón "Acciones del mapa"; antes caía a `<body>`, porque el elemento del menú que los abrió ya no existe. Lo cubre el e2e de ejemplos.
- **ESLint ignora `.check-logs/`, `.playwright-browsers/` y `test-results/`.** El primer `lint` del revisor falló por sus scripts en `.check-logs/`, que git ignora pero ESLint no.

### Seguimientos (opcionales de la ronda 2)

- **O1-r2**: el aviso de copia de seguridad solo aparece en la carga en que se hace la copia. Para el slice 2, añadir "Descargar copia" (en el aviso o en el menú de mapas) junto con importar/exportar JSON.
- **O2-r2**: en escritorio, borrar una conexión con la papelera del panel lleva el foco al nodo origen en el canvas, no a la fila siguiente del panel. Se podría enfocar la fila siguiente cuando el borrado viene del panel.
- **O3-r2**: aclarar en la documentación que `map-store.ts` accede al almacenamiento solo a través de `src/lib/storage.ts`.

### Checks

Desde cero: install, typecheck, lint, 87 tests unitarios, build y 13 e2e en verde; greps vacíos; árbol limpio. Ver [checks.md](checks.md); logs en `.check-logs/s1-fix-r2/`.
