# Checklist de revisión

Antes de aprobar un PR:

- [ ] **TypeScript estricto**: `strict: true` en `tsconfig.json`, `pnpm typecheck` sin errores, sin `any` ni `@ts-ignore` nuevos.
- [ ] **Sin colores hardcodeados fuera de los tokens del tema**: todos los colores salen de variables en `src/app/globals.css` (`--background`, `--foreground`, `--highlight`, `--edge`, `--grid`, …). Comprobación rápida: `grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(|oklch\(|hsl\(' src | grep -v globals.css` no devuelve nada.
- [ ] **Sin overflow horizontal a 360px**: el smoke test de Playwright (`pnpm test:e2e`) lo verifica.
- [ ] **Esquema validado con Zod**: todo mapa pasa por `parseSystemMap`; los cambios al esquema actualizan los tests y el README.
- [ ] Componentes de UI desde shadcn/ui (y React Flow UI para el canvas); nada de IA/LLM.
- [ ] Copy de la interfaz en español.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` y `pnpm test:e2e` en verde, registrados en `docs/checks.md`.
- [ ] **Foco visible y teclado**: todo lo enfocable muestra un indicador de foco (nunca `outline: none` sin reemplazo) y se activa con Enter/Espacio; los controles del encabezado van antes del canvas en el orden de tabulación (o hay "Saltar al detalle"); cada control tiene nombre accesible (también los `role="slider"`). Lo verifica el e2e de teclado.
- [ ] **Copy en español también fuera del chrome visible**: textos `sr-only` y `aria-label` de componentes generados (shadcn, React Flow `ariaLabelConfig`) y títulos de los mapas de ejemplo. Comprobación rápida: `grep -rnE 'sr-only|aria-label|ariaLabel|"title"' src` y revisar que todo esté en español.
- [ ] **Los tests no ensucian el árbol**: tras `pnpm test` y `pnpm test:e2e`, `git status --short` sale vacío. Las capturas van a `test-results/`; `docs/screenshots/` solo se regenera a propósito con `UPDATE_SCREENSHOTS=1 pnpm test:e2e`.
- [ ] **Almacenamiento seguro** (slice 1, B1): nada fuera de `src/lib/storage.ts` toca `localStorage`/`sessionStorage`; ESLint lo impide (`no-restricted-globals` y `no-restricted-properties`). Leer puede lanzar `SecurityError` (datos de sitio bloqueados) y escribir `QuotaExceededError`: la app debe funcionar igual, en memoria y con aviso. Lo verifican `tests/unit/store-blocked-storage.test.ts` y el e2e "localStorage blocked".
- [ ] **Nunca perder datos del usuario en silencio** (slice 1, D1): lo que no se pueda leer (JSON corrupto, otra versión, entradas inválidas) se copia a `universe:backup-<hora>` antes de sobrescribirlo, con aviso visible. Un cambio de formato sube `STORAGE_VERSION` y extiende `migrate` en `map-store.ts`, con un test del formato viejo.
- [ ] **Foco visible en todo lo enfocable del canvas, también aristas, y foco conservado al borrar** (slice 1, D2/D3): el e2e de teclado del editor comprueba el trazo de una arista enfocada y que tras borrar el foco queda en un vecino o en el lienzo, nunca en `<body>`.
- [ ] **Lo que entra de fuera nunca rompe la pantalla** (slice 2): enlaces `#m=`, archivos y texto pegado pasan por `decodeShareHash` / `parseImportText` (que nunca lanzan) y el esquema Zod; los errores se muestran en español con la ruta del campo y la app sigue en el mapa abierto. Un mapa abierto por enlace no se guarda hasta "Guardar en mis mapas". Lo verifican `tests/unit/share.test.ts`, `io.test.ts` y los e2e "corrupt or cut link" e "import a valid file, then an invalid one".
- [ ] **Diálogos que devuelven el foco** (slice 2): al cerrar un diálogo con Escape o Cancelar el foco vuelve al control que lo abrió (un `DialogTrigger`, o `onCloseAutoFocus` si se abrió desde un menú), nunca a `<body>`. Lo verifica el e2e de teclado de compartir.
