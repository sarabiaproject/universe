"use client";

import React from "react";
import { Minus, Plus } from "lucide-react";

import {
  Panel,
  useViewport,
  useStore,
  useReactFlow,
  type PanelProps,
} from "@xyflow/react";

import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * React Flow UI zoom-slider, adapted for universe: Spanish copy, tooltips and
 * an "Ajustar" button that delegates fitting to the caller.
 */
export function ZoomSlider({
  className,
  onFit,
  ...props
}: Omit<PanelProps, "children"> & { onFit: () => void }) {
  const { zoom } = useViewport();
  const { zoomTo, zoomIn, zoomOut } = useReactFlow();
  const minZoom = useStore((state) => state.minZoom);
  const maxZoom = useStore((state) => state.maxZoom);

  return (
    <Panel
      className={cn(
        "flex items-center gap-0.5 rounded-lg border bg-background p-0.5",
        className,
      )}
      {...props}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="max-md:size-10"
            aria-label="Alejar"
            onClick={() => zoomOut({ duration: 200 })}
          >
            <Minus />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Alejar</TooltipContent>
      </Tooltip>
      <Slider
        className="hidden w-24 sm:flex"
        thumbLabel="Zoom"
        value={[zoom]}
        min={minZoom}
        max={maxZoom}
        step={0.01}
        onValueChange={(values) => zoomTo(values[0])}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="max-md:size-10"
            aria-label="Acercar"
            onClick={() => zoomIn({ duration: 200 })}
          >
            <Plus />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Acercar</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            data-testid="zoom-readout"
            className="w-12 font-mono text-xs tabular-nums max-md:h-10"
            variant="ghost"
            size="sm"
            onClick={() => zoomTo(1, { duration: 200 })}
          >
            {(100 * zoom).toFixed(0)}%
          </Button>
        </TooltipTrigger>
        <TooltipContent>Volver a 100%</TooltipContent>
      </Tooltip>
      <Button variant="ghost" size="sm" className="text-xs max-md:h-10" onClick={onFit}>
        Ajustar
      </Button>
    </Panel>
  );
}
