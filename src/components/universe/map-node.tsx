"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import { BaseNode } from "@/components/base-node";
import type { NodeKind } from "@/lib/graph";
import { NODE_HEIGHT, NODE_WIDTH } from "@/lib/layout";
import type { MapNode as MapNodeData } from "@/lib/schema";
import { cn } from "@/lib/utils";

import { NodePreview } from "./node-preview";

export type MapFlowNode = Node<{ node: MapNodeData; kind: NodeKind; editing: boolean }, "map">;

const hiddenHandle = "!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent";
// Edit mode: drag from the right dot onto another card to connect.
const editHandle =
  "!z-10 !size-3 !rounded-full !border !border-muted-foreground !bg-background hover:!border-highlight hover:!bg-highlight transition-colors";

function MapNodeComponent({ data, selected }: NodeProps<MapFlowNode>) {
  const { node, kind, editing } = data;
  const handle = editing ? editHandle : hiddenHandle;
  // Handles sit outside the card: its overflow-hidden would clip half of each dot.
  return (
    <>
      <Handle type="target" position={Position.Left} className={handle} isConnectable={editing} />
      <BaseNode
        style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
        className={cn(
          "flex flex-col gap-1.5 overflow-hidden rounded-lg p-2.5 shadow-none transition-colors",
          editing ? "cursor-grab" : "cursor-pointer",
          "hover:ring-0 hover:border-muted-foreground/50",
          "in-[.selected]:border-highlight in-[.selected]:shadow-none in-[.selected]:ring-2 in-[.selected]:ring-highlight/20",
          kind === "edge_case" && !selected && "border-dashed",
        )}
        tabIndex={-1}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              selected ? "bg-highlight" : kind === "main" ? "bg-foreground/70" : "border border-muted-foreground/60",
            )}
          />
          <h3 className="truncate text-[12px] font-medium leading-tight text-foreground">{node.title}</h3>
        </div>
        <p className={cn("text-[10.5px] leading-snug text-muted-foreground", node.preview ? "truncate" : "line-clamp-3")}>
          {node.summary || (editing && <span className="italic">Sin resumen</span>)}
        </p>
        {node.preview && (
          <div className="min-h-0 overflow-hidden">
            <NodePreview preview={node.preview} />
          </div>
        )}
      </BaseNode>
      <Handle type="source" position={Position.Right} className={handle} isConnectable={editing} />
    </>
  );
}

export const MapNode = memo(MapNodeComponent);
