import { z } from "zod";

export const PreviewSchema = z.object({
  type: z.enum(["text", "list", "code", "metric", "ui"]),
  content: z.string().min(1),
});

const Id = z.string().trim().min(1, "El id no puede estar vacío");

export const NodeSchema = z.object({
  id: Id,
  title: z.string().min(1),
  summary: z.string().max(140, "El resumen no puede superar 140 caracteres"),
  details: z.string().default(""),
  preview: PreviewSchema.optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  track: z.enum(["main", "branch"]),
});

export const EdgeSchema = z.object({
  from: Id,
  to: Id,
  type: z.enum(["main", "branch", "edge_case"]),
  label: z.string().optional(),
});

export const SystemMapSchema = z
  .object({
    version: z.literal(1),
    title: z.string().min(1),
    summary: z.string(),
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
  })
  .superRefine((map, ctx) => {
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
    checkMainPath(map, ctx);
  });

/**
 * The main path is drawn as a single row, so main nodes must form one chain:
 * main edges only between main nodes, at most one in and one out per node,
 * a single start and every main node reachable from it.
 */
function checkMainPath(
  map: { nodes: { id: string; track: string }[]; edges: { from: string; to: string; type: string }[] },
  ctx: z.RefinementCtx,
) {
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
        message: `Una arista main solo puede unir nodos con track "main": ${edge.from} → ${edge.to}`,
      });
      return;
    }
    if (next.has(edge.from)) {
      valid = false;
      ctx.addIssue({
        code: "custom",
        path: ["edges", i],
        message: `El camino principal se bifurca en ${edge.from}: usa una arista branch para las demás salidas`,
      });
      return;
    }
    if (incoming.has(edge.to)) {
      valid = false;
      ctx.addIssue({
        code: "custom",
        path: ["edges", i],
        message: `${edge.to} tiene más de una arista main entrante`,
      });
      return;
    }
    next.set(edge.from, edge.to);
    incoming.add(edge.to);
  });
  if (!valid || mainIds.size === 0) return;

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
      message: `Los nodos main deben formar una sola cadena unida por aristas main; fuera de la cadena: ${loose.join(", ")}`,
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

export function parseSystemMap(input: unknown): ParseResult {
  const result = SystemMapSchema.safeParse(input);
  if (result.success) return { ok: true, map: result.data };
  return {
    ok: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`,
    ),
  };
}
