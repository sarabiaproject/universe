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

## Slice 2: compartir

- Enlaces para compartir con el mapa codificado (y comprimido) en la URL.
- Importar y exportar JSON.
- Paleta de comandos.

## Lanzamiento

- Deploy a producción en Vercel (tras revisar los previews).
- README con GIF, galería de mapas de ejemplo.
- Anuncio público.
