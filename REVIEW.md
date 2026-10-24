# Checklist de revisión

Antes de aprobar un PR:

- [ ] **TypeScript estricto**: `strict: true` en `tsconfig.json`, `pnpm typecheck` sin errores, sin `any` ni `@ts-ignore` nuevos.
- [ ] **Sin colores hardcodeados fuera de los tokens del tema**: todos los colores salen de variables en `src/app/globals.css` (`--background`, `--foreground`, `--highlight`, `--edge`, `--grid`, …). Comprobación rápida: `grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(|oklch\(|hsl\(' src | grep -v globals.css` no devuelve nada.
- [ ] **Sin overflow horizontal a 360px**: el smoke test de Playwright (`pnpm test:e2e`) lo verifica.
- [ ] **Esquema validado con Zod**: todo mapa pasa por `parseSystemMap`; los cambios al esquema actualizan los tests y el README.
- [ ] Componentes de UI desde shadcn/ui (y React Flow UI para el canvas); nada de IA/LLM.
- [ ] Copy de la interfaz en español.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` y `pnpm test:e2e` en verde, registrados en `docs/checks.md`.
