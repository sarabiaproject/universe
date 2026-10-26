import type { EdgeType, MapNode, Preview } from "@/lib/schema";

export const EDGE_LABEL: Record<EdgeType, string> = {
  main: "principal",
  branch: "rama",
  edge_case: "caso límite",
};

export const EDGE_HINT: Record<EdgeType, string> = {
  main: "Sigue el camino principal (línea sólida).",
  branch: "Sale hacia una rama (línea discontinua).",
  edge_case: "Error o caso límite (línea punteada, abajo).",
};

export const TRACK_LABEL: Record<MapNode["track"], string> = {
  main: "Camino principal",
  branch: "Rama",
};

export const PREVIEW_LABEL: Record<Preview["type"], string> = {
  text: "Texto",
  list: "Lista",
  code: "Código",
  metric: "Métrica",
  ui: "Interfaz",
};

export const PREVIEW_HINT: Record<Preview["type"], string> = {
  text: "Una o dos líneas de texto.",
  list: "Un elemento por línea.",
  code: "Fragmento de código.",
  metric: "Valor y unidad, por ejemplo: 42 ms",
  ui: "Un elemento de interfaz por línea.",
};

export const PREVIEW_SAMPLE: Record<Preview["type"], string> = {
  text: "Texto de ejemplo",
  list: "Primer elemento\nSegundo elemento",
  code: "const ok = true;",
  metric: "42 ms",
  ui: "[ Botón ]",
};
