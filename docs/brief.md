# Brief

## Idea

**universe** es una herramienta súper minimalista para mapear CUALQUIER sistema (flujos de software, proyectos, vida personal) como un mapa explorable de nodos conectados, cada uno con su explicación.

Inspiración: https://x.com/tanishqk/status/2113672226075730122. Pantalla dividida:

- **Izquierda**: canvas infinito (paneo y zoom) donde cada nodo es una mini tarjeta (vista previa de un estado), conectadas por flechas. Camino principal de izquierda a derecha; ramas hacia arriba y abajo para errores y casos límite. Control de zoom con porcentaje.
- **Derecha**: panel de detalle. Al hacer clic en un nodo muestra título, explicación, detalles y enlaces al nodo anterior, al siguiente y a las ramas conectadas.
- Modo claro/oscuro.

## Decisiones

- **Proyecto personal** y de código abierto de Santiago Sarabia.
- **Licencia MIT**.
- **Sin IA ni LLM** en ninguna parte: es una herramienta nativa, manipulada a mano.
- **Siempre shadcn/ui** (+ Tailwind 4, `next-themes`). Para el canvas, React Flow (`@xyflow/react`) con **React Flow UI** (componentes oficiales sobre shadcn).
- 100% en el cliente: sin backend, sin base de datos, sin login, sin API keys. Desplegable en Vercel con la configuración por defecto.
- Layout automático con dagre, estado con zustand, esquema con Zod.
- Copy de la interfaz en español.
- Estética: monocromo con UN color de acento para el nodo seleccionado y sus aristas, grilla de puntos sutil, líneas de 1px, tarjetas pequeñas, mucho espacio en blanco, tipografía Geist.
- **Referencias de diseño (Mobbin)**: OpenAI Agent Builder (minimalismo del canvas), Railway (canvas oscuro), Clay (flujo + panel derecho), WRITER (blueprint con ramas), AirOps (inspector a la derecha).
