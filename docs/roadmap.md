# Roadmap

## Slice 0: visor ✅ (este PR)

- Carga un mapa JSON escrito a mano, validado con Zod.
- Layout automático con dagre: camino principal de izquierda a derecha, ramas arriba y abajo.
- Tarjetas mínimas (título, resumen, vista previa) y aristas tipadas (principal, rama, caso límite).
- Panel de detalle: posición, tipo, explicación, detalles en markdown, vista previa, anterior/siguiente y chips de conexiones.
- Encabezado con conteo de nodos, pista y leyenda; zoom con % y botón Ajustar.
- Modo claro/oscuro. Móvil: barra inferior + Sheet de detalle.
- Dos mapas de ejemplo: "universe: el spec" y "Share modal".

## Slice 1: edición

- Crear, editar, mover, conectar y borrar nodos a mano.
- Editar título, resumen, detalles y vista previa desde el panel.
- Persistencia en localStorage.
- Estado vacío para mapas nuevos.

### Pendientes de la revisión del slice 0 (ronda 1, opcionales)

De `REVIEW-round-1.md`. B1, D1–D6, O4, O6, O10 y O11 se resolvieron en el PR #1; estos quedan para el slice 1:

- **O1. Mensajes de Zod en español**: los errores genéricos salen en inglés. `z.config(z.locales.es())` o un `errorMap` propio antes de importar JSON (slice 2).
- **O2. Claves desconocidas**: `.strict()` en `NodeSchema`, `EdgeSchema` y `PreviewSchema` para que un typo como `"previw"` no desaparezca en silencio.
- **O3. Error boundary**: `src/app/error.tsx` cuando llegue la carga de JSON del usuario.
- **O5. Código muerto**: `NodeContext.parent` (igual a `prev`), tipo `MapEdge` sin uso, subcomponentes de `base-node` sin uso.
- **O7. Flash del layout de escritorio en móvil**: el snapshot del servidor de `useIsMobile` es `false`; resolver con CSS (`md:`) o un esqueleto neutro hasta montar.
- **O8. Vista inicial en escritorio**: arranca al ~36% y corta la rama "Preguntas abiertas". Incluir las ramas en el ajuste o arrancar centrado en el primer nodo a ≥ 75%.
- **O9. Acento fuera de la selección**: los vecinos y el badge "Camino principal" usan el acento. Confirmar con el dueño o quitarlo del badge.
- **O12. `NodePreview` de tipo code**: quitar `truncate` y dejar `whitespace-pre-wrap line-clamp-2 overflow-hidden`.
- Áreas táctiles de los chips de conexión en el Sheet móvil (24 px): subirlas junto con O10 si se confirman en dispositivo.

## Slice 2: compartir

- Enlaces para compartir con el mapa codificado (y comprimido) en la URL.
- Importar y exportar JSON.
- Paleta de comandos.

## Lanzamiento

- Deploy a producción en Vercel (tras revisar los previews).
- README con GIF, galería de mapas de ejemplo.
- Anuncio público.
