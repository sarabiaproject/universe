"use client";

import { ArrowLeft, ArrowRight, CirclePlus, Link2, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { connectionError, nextStepAction, suggestedEdgeType } from "@/lib/editor";
import { KIND_LABEL, positionLabel, type NodeContext } from "@/lib/graph";
import { layoutMap } from "@/lib/layout";
import {
  EdgeSchema,
  NodeSchema,
  PreviewSchema,
  SUMMARY_MAX,
  SystemMapDraftSchema,
  mapProblems,
  type EdgeType,
  type Preview,
  type SystemMap,
} from "@/lib/schema";
import { cn } from "@/lib/utils";
import { useMapStore } from "@/store/map-store";

import { EDGE_HINT, EDGE_LABEL, PREVIEW_HINT, PREVIEW_LABEL, PREVIEW_SAMPLE, TRACK_LABEL } from "./labels";

const EDGE_TYPES: EdgeType[] = ["main", "branch", "edge_case"];
const PREVIEW_TYPES = Object.keys(PREVIEW_LABEL) as Preview["type"][];

/** First Zod message for `value`, or null when it is valid. */
function check(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? "Valor inválido");
}

/**
 * A text field validated live against the schema. Valid values are committed as
 * you type (one undo step per field); invalid ones stay local with their message.
 */
function useValidatedField(value: string, schema: z.ZodType, commit: (value: string) => void) {
  const [draft, setDraft] = useState<string | null>(null);
  const error = draft === null ? null : check(schema, draft);
  return {
    value: draft ?? value,
    error,
    onChange: (next: string) => {
      if (check(schema, next)) {
        setDraft(next);
        return;
      }
      setDraft(null);
      if (next !== value) commit(next);
    },
  };
}

function Field({
  label,
  error,
  hint,
  aside,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        {aside}
      </div>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{children}</h3>;
}

/** Graph-rule problems of the map (single main chain, …), shown while editing. */
export function MapProblems({ map }: { map: SystemMap }) {
  const problems = useMemo(() => mapProblems(map), [map]);
  if (problems.length === 0) return null;
  return (
    <section
      aria-label="Problemas del mapa"
      data-testid="map-problems"
      className="mx-5 mt-5 flex flex-col gap-1.5 rounded-lg border border-destructive/30 p-3 text-xs"
    >
      <p className="flex items-center gap-1.5 font-medium text-destructive">
        <TriangleAlert className="size-3.5" />
        {problems.length === 1 ? "1 problema" : `${problems.length} problemas`} en el mapa
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
        {problems.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
      <p className="text-muted-foreground">Se guarda igual; corrígelo cuando quieras.</p>
    </section>
  );
}

export function NodeEditor({ map, ctx }: { map: SystemMap; ctx: NodeContext }) {
  const { node } = ctx;
  const edit = useMapStore((s) => s.edit);
  const select = useMapStore((s) => s.select);
  const selectEdge = useMapStore((s) => s.selectEdge);
  const requestDeleteNode = useMapStore((s) => s.requestDeleteNode);
  const update = (field: string) => (value: string) =>
    edit({ type: "updateNode", id: node.id, patch: { [field]: value } }, { key: `${node.id}:${field}` });

  const title = useValidatedField(node.title, NodeSchema.shape.title, update("title"));
  const summary = useValidatedField(node.summary, NodeSchema.shape.summary, update("summary"));
  const details = useValidatedField(node.details, NodeSchema.shape.details, update("details"));
  const previewContent = useValidatedField(node.preview?.content ?? "", PreviewSchema.shape.content, (content) =>
    node.preview &&
    edit(
      { type: "updateNode", id: node.id, patch: { preview: { ...node.preview, content } } },
      { key: `${node.id}:preview` },
    ),
  );

  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const edges = map.edges.map((e, index) => ({ ...e, index })).filter((e) => e.from === node.id || e.to === node.id);
  const candidates = map.nodes.filter((n) => connectionError(map, node.id, n.id) === null);

  const [target, setTarget] = useState("");
  const [targetType, setTargetType] = useState<EdgeType | "">("");
  const connectType = targetType || (target ? suggestedEdgeType(map, node.id, target) : "branch");

  return (
    <article className="flex flex-col gap-5 p-5" aria-label={`Editar nodo ${node.title}`} data-testid="node-editor">
      <header className="flex items-center justify-between gap-2">
        <span data-testid="detail-position" className="truncate font-mono text-[11px] text-muted-foreground">
          {positionLabel(ctx)}
        </span>
        <Badge variant="outline" className="shrink-0 font-normal">
          {KIND_LABEL[ctx.kind]}
        </Badge>
      </header>

      <Field label="Título" error={title.error}>
        {(props) => (
          <Input
            {...props}
            className="max-md:h-10"
            data-testid="field-title"
            value={title.value}
            onChange={(e) => title.onChange(e.target.value)}
            autoComplete="off"
          />
        )}
      </Field>

      <Field
        label="Resumen"
        error={summary.error}
        hint="Una línea que se ve en la tarjeta."
        aside={
          <span
            className={cn(
              "font-mono text-[11px] tabular-nums",
              summary.value.length > SUMMARY_MAX ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {summary.value.length}/{SUMMARY_MAX}
          </span>
        }
      >
        {(props) => (
          <Textarea
            {...props}
            data-testid="field-summary"
            rows={2}
            value={summary.value}
            onChange={(e) => summary.onChange(e.target.value)}
          />
        )}
      </Field>

      <Field
        label="Detalles"
        error={details.error}
        hint="Markdown simple: párrafos, listas con «-», **negrita**, *cursiva* y `código`."
      >
        {(props) => (
          <Textarea
            {...props}
            data-testid="field-details"
            rows={5}
            className="font-mono text-xs"
            value={details.value}
            onChange={(e) => details.onChange(e.target.value)}
          />
        )}
      </Field>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs" id={`${node.id}-track`}>
          Carril
        </Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-labelledby={`${node.id}-track`}
          value={node.track}
          onValueChange={(v) =>
            (v === "main" || v === "branch") && edit({ type: "updateNode", id: node.id, patch: { track: v } })
          }
          className="w-full"
        >
          {(["main", "branch"] as const).map((track) => (
            <ToggleGroupItem key={track} value={track} className="flex-1 max-md:h-10">
              {TRACK_LABEL[track]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-3">
        <Field label="Vista previa">
          {(props) => (
            <Select
              value={node.preview?.type ?? "none"}
              onValueChange={(v) => {
                const type = PREVIEW_TYPES.find((t) => t === v);
                const preview = type ? { type, content: node.preview?.content || PREVIEW_SAMPLE[type] } : null;
                edit({ type: "updateNode", id: node.id, patch: { preview } });
              }}
            >
              <SelectTrigger id={props.id} className="w-full max-md:data-[size=default]:h-10" data-testid="field-preview-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin vista previa</SelectItem>
                {PREVIEW_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PREVIEW_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        {node.preview && (
          <Field label="Contenido de la vista previa" error={previewContent.error} hint={PREVIEW_HINT[node.preview.type]}>
            {(props) => (
              <Textarea
                {...props}
                data-testid="field-preview-content"
                rows={3}
                className={cn(node.preview?.type !== "text" && "font-mono text-xs")}
                value={previewContent.value}
                onChange={(e) => previewContent.onChange(e.target.value)}
              />
            )}
          </Field>
        )}
      </div>

      <Separator />

      <section className="flex flex-col gap-2">
        <SectionTitle>Conexiones</SectionTitle>
        {edges.length === 0 && <p className="text-xs text-muted-foreground">Este nodo aún no tiene conexiones.</p>}
        <ul className="flex flex-col gap-1.5">
          {edges.map((e) => {
            const out = e.from === node.id;
            const other = byId.get(out ? e.to : e.from);
            return (
              <li key={e.index} className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-w-0 flex-1 justify-start font-normal max-md:h-10"
                  onClick={() => selectEdge(e.index)}
                  aria-label={`Editar conexión ${out ? "hacia" : "desde"} ${other?.title}, ${EDGE_LABEL[e.type]}`}
                >
                  {out ? <ArrowRight /> : <ArrowLeft />}
                  <span className="truncate">{other?.title}</span>
                  <span className="text-muted-foreground">· {EDGE_LABEL[e.type]}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="max-md:size-10"
                  aria-label={`Borrar conexión con ${other?.title}`}
                  onClick={() => edit({ type: "deleteEdge", index: e.index })}
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>

        {candidates.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed p-2.5">
            <Label className="text-xs" htmlFor={`${node.id}-connect`}>
              Conectar con…
            </Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id={`${node.id}-connect`} className="w-full max-md:data-[size=default]:h-10" data-testid="connect-target">
                <SelectValue placeholder="Elige un nodo" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1.5">
              <Select value={connectType} onValueChange={(v) => setTargetType(EDGE_TYPES.find((t) => t === v) ?? "")}>
                <SelectTrigger className="flex-1 max-md:data-[size=default]:h-10" aria-label="Tipo de conexión" data-testid="connect-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDGE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {EDGE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 max-md:h-10"
                disabled={!target}
                onClick={() => {
                  edit({ type: "addEdge", edge: { from: node.id, to: target, type: connectType } });
                  setTarget("");
                  setTargetType("");
                }}
              >
                <Link2 /> Conectar
              </Button>
            </div>
          </div>
        )}
      </section>

      <Separator />

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="max-md:h-10"
          onClick={() => {
            const action = nextStepAction(map, node.id, layoutMap(map));
            if (action) edit(action);
          }}
        >
          <CirclePlus /> Añadir paso siguiente
        </Button>
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive max-md:h-10"
          onClick={() => requestDeleteNode(node.id)}
        >
          <Trash2 /> Borrar nodo
        </Button>
        <Button
          variant="link"
          size="sm"
          className="self-start px-0 text-muted-foreground max-md:h-10"
          onClick={() => select(node.id, { center: true })}>
          Centrar en el canvas
        </Button>
      </div>
    </article>
  );
}

export function EdgeEditor({ map, index }: { map: SystemMap; index: number }) {
  const edge = map.edges[index];
  const edit = useMapStore((s) => s.edit);
  const select = useMapStore((s) => s.select);
  const label = useValidatedField(edge?.label ?? "", EdgeSchema.shape.label, (value) =>
    edit({ type: "updateEdge", index, patch: { label: value } }, { key: `edge:${edge?.from}->${edge?.to}:label` }),
  );
  if (!edge) return null;
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const from = byId.get(edge.from);
  const to = byId.get(edge.to);

  return (
    <article className="flex flex-col gap-5 p-5" aria-label="Editar conexión" data-testid="edge-editor">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">Conexión</span>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <Button variant="outline" size="sm" className="max-md:h-10" onClick={() => from && select(from.id, { center: true })}>
            {from?.title}
          </Button>
          <ArrowRight className="size-4 text-muted-foreground" aria-label="hacia" />
          <Button variant="outline" size="sm" className="max-md:h-10" onClick={() => to && select(to.id, { center: true })}>
            {to?.title}
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs" id={`edge-${index}-type`}>
          Tipo
        </Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-labelledby={`edge-${index}-type`}
          value={edge.type}
          onValueChange={(v) => {
            const type = EDGE_TYPES.find((t) => t === v);
            if (type) edit({ type: "updateEdge", index, patch: { type } });
          }}
          className="w-full"
        >
          {EDGE_TYPES.map((t) => (
            <ToggleGroupItem key={t} value={t} className="flex-1 max-md:h-10">
              {EDGE_LABEL[t]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">{EDGE_HINT[edge.type]}</p>
      </div>

      <Field label="Etiqueta" error={label.error} hint="Opcional. Se ve sobre la flecha.">
        {(props) => (
          <Input
            {...props}
            className="max-md:h-10"
            data-testid="field-edge-label"
            value={label.value}
            onChange={(e) => label.onChange(e.target.value)}
            autoComplete="off"
          />
        )}
      </Field>

      <Separator />

      <Button
        variant="ghost"
        className="text-destructive hover:text-destructive max-md:h-10"
        onClick={() => edit({ type: "deleteEdge", index })}
      >
        <Trash2 /> Borrar conexión
      </Button>
    </article>
  );
}

/** Edit mode with nothing selected: the map itself. */
export function MapSettings({ map, onAddNode }: { map: SystemMap; onAddNode: () => void }) {
  const edit = useMapStore((s) => s.edit);
  const update = (field: "title" | "summary") => (value: string) =>
    edit({ type: "updateMap", patch: { [field]: value } }, { key: `map:${field}` });
  const title = useValidatedField(map.title, SystemMapDraftSchema.shape.title, update("title"));
  const summary = useValidatedField(map.summary, SystemMapDraftSchema.shape.summary, update("summary"));

  return (
    <article className="flex flex-col gap-5 p-5" aria-label="Editar mapa" data-testid="map-settings">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[11px] text-muted-foreground">
          Mapa · {map.nodes.length} {map.nodes.length === 1 ? "nodo" : "nodos"} · {map.edges.length}{" "}
          {map.edges.length === 1 ? "conexión" : "conexiones"}
        </span>
        <p className="text-sm text-muted-foreground">Selecciona un nodo o una conexión para editarlo.</p>
      </header>
      <Field label="Título del mapa" error={title.error}>
        {(props) => (
          <Input
            {...props}
            className="max-md:h-10"
            data-testid="field-map-title"
            value={title.value}
            onChange={(e) => title.onChange(e.target.value)}
            autoComplete="off"
          />
        )}
      </Field>
      <Field label="Descripción" error={summary.error}>
        {(props) => (
          <Textarea {...props} rows={3} value={summary.value} onChange={(e) => summary.onChange(e.target.value)} />
        )}
      </Field>
      <Button variant="outline" className="max-md:h-10" onClick={onAddNode}>
        <Plus /> Añadir nodo
      </Button>
      <Separator />
      <section className="flex flex-col gap-2 text-xs text-muted-foreground">
        <SectionTitle>Cómo editar</SectionTitle>
        <ul className="flex list-disc flex-col gap-1 pl-4">
          <li>Arrastra una tarjeta para moverla (o enfócala y usa las flechas).</li>
          <li>Arrastra desde el punto derecho de una tarjeta hasta otra para conectarlas.</li>
          <li>Suprimir borra el nodo o la conexión enfocados.</li>
          <li>⌘Z deshace y ⇧⌘Z rehace (Ctrl en Windows y Linux).</li>
        </ul>
      </section>
    </article>
  );
}
