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
