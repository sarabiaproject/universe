import { layoutMap, NODE_HEIGHT, NODE_WIDTH } from "@/lib/layout";
import type { SystemMap } from "@/lib/schema";

/** Space around the nodes in the exported image, in flow pixels. */
export const IMAGE_PADDING = 48;
export const IMAGE_PIXEL_RATIO = 2;
/** Canvas limit that every browser handles; bigger maps get a lower pixel ratio. */
export const IMAGE_MAX_SIDE = 16000;

export type ImageFrame = {
  /** CSS size of the image (flow pixels plus padding). */
  width: number;
  height: number;
  /** Moves the React Flow viewport so the whole map lands inside the frame at zoom 1. */
  transform: string;
  pixelRatio: number;
};

/** Frame that holds every node of `map` at zoom 1 (as laid out on the canvas). */
export function imageFrame(map: SystemMap, positions = layoutMap(map)): ImageFrame {
  const points = map.nodes.map((n) => positions[n.id]).filter(Boolean);
  if (points.length === 0) {
    return { width: IMAGE_PADDING * 2, height: IMAGE_PADDING * 2, transform: "translate(0px, 0px) scale(1)", pixelRatio: IMAGE_PIXEL_RATIO };
  }
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxX = Math.max(...points.map((p) => p.x + NODE_WIDTH));
  const maxY = Math.max(...points.map((p) => p.y + NODE_HEIGHT));
  const width = Math.ceil(maxX - minX + IMAGE_PADDING * 2);
  const height = Math.ceil(maxY - minY + IMAGE_PADDING * 2);
  const pixelRatio = Math.min(IMAGE_PIXEL_RATIO, IMAGE_MAX_SIDE / Math.max(width, height));
  return {
    width,
    height,
    transform: `translate(${IMAGE_PADDING - minX}px, ${IMAGE_PADDING - minY}px) scale(1)`,
    pixelRatio,
  };
}

/** Parts of the viewport that are controls, not the map. */
const EXCLUDED = ["react-flow__handle", "react-flow__minimap", "react-flow__controls", "react-flow__panel"];

/**
 * PNG (data URL) of the whole map, drawn from the React Flow viewport element
 * with the theme's background. Browser only.
 */
export async function renderMapPng(viewport: HTMLElement, frame: ImageFrame, background: string): Promise<string> {
  const { toPng } = await import("html-to-image");
  return toPng(viewport, {
    backgroundColor: background,
    width: frame.width,
    height: frame.height,
    pixelRatio: frame.pixelRatio,
    style: { width: `${frame.width}px`, height: `${frame.height}px`, transform: frame.transform },
    filter: (node) => !(node instanceof Element && EXCLUDED.some((c) => node.classList.contains(c))),
  });
}

/** Saves `href` (data or object URL) as `name`. */
export function download(href: string, name: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}
