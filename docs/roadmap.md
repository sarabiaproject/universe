# Roadmap

## Slice 0: visor ✅ (PR #1)

- Carga un mapa JSON escrito a mano, validado con Zod.
- Layout automático con dagre: camino principal de izquierda a derecha, ramas arriba y abajo.
- Tarjetas mínimas (título, resumen, vista previa) y aristas tipadas (principal, rama, caso límite).
- Panel de detalle: posición, tipo, explicación, detalles en markdown, vista previa, anterior/siguiente y chips de conexiones.
- Encabezado con conteo de nodos, pista y leyenda; zoom con % y botón Ajustar.
- Modo claro/oscuro. Móvil: barra inferior + Sheet de detalle.
- Dos mapas de ejemplo: "universe: el spec" y "Share modal".

## Slice 1: edición ✅ (PR #2)

- Modo Ver / Editar; los ejemplos son de solo lectura y se duplican para editarlos.
- Crear, editar, mover (posición en `position`), conectar (arrastrando, con tipo) y borrar nodos y aristas; confirmación al borrar un nodo con conexiones.
- Panel de edición: título, resumen (≤ 140), detalles, carril y vista previa, con validación Zod en vivo y mensajes en español; problemas del grafo listados.
- Deshacer / rehacer (⌘Z, ⇧⌘Z; Ctrl en otras plataformas) para toda edición.
- "Mis mapas" en localStorage: crear, renombrar, duplicar y borrar.
- Estado vacío para mapas nuevos.
- Limpieza de la revisión del slice 0: O1, O2, O3, O5, O7, O8, O9, O12, O-N1 a O-N5 y chips de conexión de 40 px en móvil.

## Slice 2: compartir ✅ (PR #3)

- "Compartir": enlace con el mapa comprimido en el hash (`#m=`, lz-string), copiado al portapapeles; aviso por encima de 8000 caracteres.
- Abrir un enlace: modo Ver de solo lectura, sin guardar; "Guardar en mis mapas" crea una copia editable. Enlaces dañados o inválidos muestran el error y la app sigue.
- Importar JSON (archivo o texto pegado) validado con Zod, errores en español con la ruta; crea un mapa nuevo en "Mis mapas".
- Exportar JSON (`<slug>.json`, esquema exacto) y PNG de todo el mapa (2x, fondo del tema).
- Todo con teclado y `aria` en español.

## Slice 3: lanzamiento ✅ (este PR)

- Galería de ejemplos: 4 mapas (suma "Mi semana" y "Lanzar un proyecto open source"), tarjetas con título, una línea, tamaño y mini mapa. Se abre desde el selector de mapa, el menú `⋯` y el estado vacío; con teclado, `aria` en español y a 360 px.
- README de lanzamiento: pitch, funciones, cómo correrlo, esquema, GIF (`docs/media/demo.gif`, grabado con `pnpm demo:gif`) y capturas nuevas.
- Metadatos: título, descripción, Open Graph y Twitter con imagen generada en el build (`next/og`), favicon e iconos propios, 404 en español. `pnpm build` sin variables de entorno.

## Lanzamiento (pendiente, fuera de este repo)

- Deploy a producción en Vercel (tras revisar los previews) en https://universe-gamma-eosin.vercel.app.
- Anuncio público.

## Después del MVP

- Paleta de comandos.
- Historial de deshacer persistente entre recargas.
- Edición de varios nodos a la vez (selección múltiple).
