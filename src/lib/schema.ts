import { z } from "zod";

// Generic messages (types, unknown keys, …) in Spanish; the common ones get a custom message below.
z.config(z.locales.es());

export const SUMMARY_MAX = 140;

export const PreviewSchema = z.strictObject({
  type: z.enum(["text", "list", "code", "metric", "ui"]),
  content: z.string().min(1, "El contenido de la vista previa no puede estar vacío"),
});

const Id = z.string().trim().min(1, "El id no puede estar vacío");

export const NodeSchema = z.strictObject({
  id: Id,
  title: z.string().refine((v) => v.trim().length > 0, "El título no puede estar vacío"),
  summary: z.string().max(SUMMARY_MAX, `El resumen no puede superar ${SUMMARY_MAX} caracteres`),
  details: z.string().default(""),
  preview: PreviewSchema.optional(),
  position: z.strictObject({ x: z.number(), y: z.number() }).optional(),
  track: z.enum(["main", "branch"]),
});

export const EdgeSchema = z.strictObject({
  from: Id,
  to: Id,
  type: z.enum(["main", "branch", "edge_case"]),
  label: z.string().optional(),
});

/**
 * Field, id and reference rules, without the main path rules. Maps in "Mis mapas"
 * are stored with this schema so a work in progress (e.g. a main node not yet
 * chained) survives a reload; ids and references are never transitional.
 */
export const SystemMapDraftSchema = z.strictObject({
  version: z.literal(1),
  title: z.string().refine((v) => v.trim().length > 0, "El título del mapa no puede estar vacío"),
  summary: z.string(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
}).superRefine((map, ctx) => {
  const ids = new Set<string>();
  map.nodes.forEach((node, i) => {
    if (ids.has(node.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["nodes", i, "id"],
        message: `Id de nodo duplicado: ${node.id}`,
      });
    }
    ids.add(node.id);
  });
  map.edges.forEach((edge, i) => {
    for (const key of ["from", "to"] as const) {
      if (!ids.has(edge[key])) {
        ctx.addIssue({
          code: "custom",
          path: ["edges", i, key],
          message: `La arista apunta a un nodo inexistente: ${edge[key]}`,
        });
      }
    }
    if (edge.from === edge.to) {
      ctx.addIssue({
        code: "custom",
        path: ["edges", i],
        message: `Arista de un nodo a sí mismo: ${edge.from}`,
      });
    }
  });
});

/** Draft rules plus a single main chain. Examples and imports must pass this one. */
export const SystemMapSchema = SystemMapDraftSchema.superRefine((map, ctx) => checkMainPath(map, ctx));

/**
 * The main path is drawn as a single row, so main nodes must form one chain:
 * main edges only between main nodes, at most one in and one out per node,
 * a single start and every main node reachable from it.
 */
function checkMainPath(
  map: { nodes: { id: string; title: string; track: string }[]; edges: { from: string; to: string; type: string }[] },
  ctx: z.RefinementCtx,
) {
  // Messages name nodes by title: they are shown in the editor, where ids are not visible.
  const titles = new Map(map.nodes.map((n) => [n.id, n.title]));
  const name = (id: string) => `«${titles.get(id) || id}»`;
  const mainIds = new Set(map.nodes.filter((n) => n.track === "main").map((n) => n.id));
  const next = new Map<string, string>();
  const incoming = new Set<string>();
  let valid = true;

  map.edges.forEach((edge, i) => {
    if (edge.type !== "main" || edge.from === edge.to) return;
    if (!mainIds.has(edge.from) || !mainIds.has(edge.to)) {
      valid = false;
      ctx.addIssue({
        code: "custom",
        path: ["edges", i, "type"],
        message: `Una arista principal solo puede unir nodos del camino principal: ${name(edge.from)} → ${name(edge.to)}`,
      });
      return;
    }
    if (next.has(edge.from)) {
      valid = false;
      ctx.addIssue({
        code: "custom",
        path: ["edges", i],
        message: `El camino principal se bifurca en ${name(edge.from)}: usa una rama para las demás salidas`,
      });
      return;
    }
    if (incoming.has(edge.to)) {
      valid = false;
      ctx.addIssue({
        code: "custom",
        path: ["edges", i],
        message: `${name(edge.to)} tiene más de una arista principal entrante`,
      });
      return;
    }
    next.set(edge.from, edge.to);
    incoming.add(edge.to);
  });
  if (!valid) return;
  // An empty map is a valid empty state; once it has nodes, it needs a main path.
  if (mainIds.size === 0) {
    if (map.nodes.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["nodes"],
        message: "El mapa necesita al menos un nodo en el camino principal",
      });
    }
    return;
  }

  const starts = [...mainIds].filter((id) => !incoming.has(id));
  const visited = new Set<string>();
  let id: string | undefined = starts[0];
  while (id !== undefined && !visited.has(id)) {
    visited.add(id);
    id = next.get(id);
  }
  if (starts.length !== 1 || visited.size !== mainIds.size) {
    const loose = [...mainIds].filter((id) => !visited.has(id));
    ctx.addIssue({
      code: "custom",
      path: ["nodes"],
      message: `Los nodos del camino principal deben formar una sola cadena unida por aristas principales; fuera de la cadena: ${loose.map(name).join(", ")}`,
    });
  }
}

export type Preview = z.infer<typeof PreviewSchema>;
export type MapNode = z.infer<typeof NodeSchema>;
export type MapEdge = z.infer<typeof EdgeSchema>;
export type EdgeType = MapEdge["type"];
export type SystemMap = z.infer<typeof SystemMapSchema>;

export type ParseResult =
  | { ok: true; map: SystemMap }
  | { ok: false; errors: string[] };

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`);
}

export function parseSystemMap(input: unknown): ParseResult {
  const result = SystemMapSchema.safeParse(input);
  if (result.success) return { ok: true, map: result.data };
  return { ok: false, errors: formatIssues(result.error) };
}

/** Like `parseSystemMap`, but without the graph rules (see `SystemMapDraftSchema`). */
export function parseDraftMap(input: unknown): ParseResult {
  const result = SystemMapDraftSchema.safeParse(input);
  if (result.success) return { ok: true, map: result.data };
  return { ok: false, errors: formatIssues(result.error) };
}

/** Graph-rule problems of a map, in Spanish, without the path prefix. */
export function mapProblems(map: SystemMap): string[] {
  const result = SystemMapSchema.safeParse(map);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}
