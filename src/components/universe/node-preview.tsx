import type { Preview } from "@/lib/schema";
import { cn } from "@/lib/utils";

/** Mini preview of a node state, shared by canvas cards and the detail panel. */
export function NodePreview({
  preview,
  size = "card",
}: {
  preview: Preview;
  size?: "card" | "panel";
}) {
  const card = size === "card";
  const box = cn(
    "rounded-md border bg-muted/40 text-muted-foreground",
    card ? "px-2 py-1.5 text-[10px] leading-snug" : "px-3 py-2.5 text-xs leading-relaxed",
  );
  const lines = preview.content.split("\n").filter(Boolean);

  switch (preview.type) {
    case "code":
      return <pre className={cn(box, "overflow-hidden font-mono whitespace-pre-wrap break-words", card && "line-clamp-2")}>{preview.content}</pre>;
    case "list":
      return (
        <ul className={cn(box, "flex flex-col gap-0.5")}>
          {(card ? lines.slice(0, 2) : lines).map((line, i) => (
            <li key={i} className="flex items-center gap-1.5 truncate">
              <span aria-hidden className="size-1 shrink-0 rounded-full bg-muted-foreground/50" />
              {line}
            </li>
          ))}
        </ul>
      );
    case "metric": {
      const [value, ...rest] = preview.content.split(" ");
      return (
        <div className={cn(box, "flex items-baseline gap-1.5")}>
          <span className={cn("font-medium text-foreground tabular-nums", card ? "text-sm" : "text-lg")}>{value}</span>
          <span className="truncate">{rest.join(" ")}</span>
        </div>
      );
    }
    case "ui":
      return (
        <div className={cn(box, "flex flex-col gap-1 font-mono")}>
          {(card ? lines.slice(0, 1) : lines).map((line, i) => (
            <div key={i} className="truncate rounded-sm border border-dashed bg-background/60 px-1.5 py-0.5">
              {line}
            </div>
          ))}
        </div>
      );
    default:
      return <p className={cn(box, card && "line-clamp-2")}>{preview.content}</p>;
  }
}
