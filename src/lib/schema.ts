import { z } from "zod";

export const PreviewSchema = z.object({
  type: z.enum(["text", "list", "code", "metric", "ui"]),
  content: z.string().min(1),
});

export const NodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().max(140, "El resumen no puede superar 140 caracteres"),
  details: z.string().default(""),
  preview: PreviewSchema.optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  track: z.enum(["main", "branch"]),
});

export const EdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
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
    });
  });

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
