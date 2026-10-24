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
