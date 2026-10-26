"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import { BaseNode } from "@/components/base-node";
import type { NodeKind } from "@/lib/graph";
import { NODE_HEIGHT, NODE_WIDTH } from "@/lib/layout";
import type { MapNode as MapNodeData } from "@/lib/schema";
import { cn } from "@/lib/utils";

import { NodePreview } from "./node-preview";

export type MapFlowNode = Node<{ node: MapNodeData; kind: NodeKind; related: boolean }, "map">;

const handle = "!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent";

function MapNodeComponent({ data, selected }: NodeProps<MapFlowNode>) {
  const { node, kind, related } = data;
  return (
    <BaseNode
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      className={cn(
        "flex cursor-pointer flex-col gap-1.5 overflow-hidden rounded-lg p-2.5 shadow-none transition-colors",
        "hover:ring-0 hover:border-muted-foreground/50",
        "in-[.selected]:border-highlight in-[.selected]:shadow-none in-[.selected]:ring-2 in-[.selected]:ring-highlight/20",
        related && !selected && "border-highlight/40",
        kind === "edge_case" && !selected && "border-dashed",
      )}
      tabIndex={-1}
    >
      <Handle type="target" position={Position.Left} className={handle} isConnectable={false} />
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
        {node.summary}
      </p>
      {node.preview && (
        <div className="min-h-0 overflow-hidden">
          <NodePreview preview={node.preview} />
        </div>
      )}
      <Handle type="source" position={Position.Right} className={handle} isConnectable={false} />
    </BaseNode>
  );
}

export const MapNode = memo(MapNodeComponent);
