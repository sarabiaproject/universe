# Roadmap

## Slice 0: visor ✅ (PR #1)

- Carga un mapa JSON escrito a mano, validado con Zod.
- Layout automático con dagre: camino principal de izquierda a derecha, ramas arriba y abajo.
- Tarjetas mínimas (título, resumen, vista previa) y aristas tipadas (principal, rama, caso límite).
- Panel de detalle: posición, tipo, explicación, detalles en markdown, vista previa, anterior/siguiente y chips de conexiones.
- Encabezado con conteo de nodos, pista y leyenda; zoom con % y botón Ajustar.
- Modo claro/oscuro. Móvil: barra inferior + Sheet de detalle.
- Dos mapas de ejemplo: "universe: el spec" y "Share modal".

## Slice 1: edición ✅ (este PR)

- Modo Ver / Editar; los ejemplos son de solo lectura y se duplican para editarlos.
- Crear, editar, mover (posición en `position`), conectar (arrastrando, con tipo) y borrar nodos y aristas; confirmación al borrar un nodo con conexiones.
- Panel de edición: título, resumen (≤ 140), detalles, carril y vista previa, con validación Zod en vivo y mensajes en español; problemas del grafo listados.
- Deshacer / rehacer (⌘Z, ⇧⌘Z; Ctrl en otras plataformas) para toda edición.
- "Mis mapas" en localStorage: crear, renombrar, duplicar y borrar.
- Estado vacío para mapas nuevos.
- Limpieza de la revisión del slice 0: O1, O2, O3, O5, O7, O8, O9, O12, O-N1 a O-N5 y chips de conexión de 40 px en móvil.

## Slice 2: compartir

- Enlaces para compartir con el mapa codificado y comprimido en la URL.
- Importar y exportar JSON (validado con `parseSystemMap`; el error boundary de `error.tsx` ya está).
- Exportar PNG del canvas.

## Lanzamiento

- Deploy a producción en Vercel (tras revisar los previews).
- README con GIF, galería de mapas de ejemplo.
- Anuncio público.

## Después del MVP

- Paleta de comandos.
- Historial de deshacer persistente entre recargas.
- Edición de varios nodos a la vez (selección múltiple).
