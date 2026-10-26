import type { EdgeType, SystemMap } from "@/lib/schema";

const LEGEND: { type: EdgeType; label: string; dash?: string; opacity?: number }[] = [
  { type: "main", label: "principal" },
  { type: "branch", label: "rama", dash: "5 4" },
  { type: "edge_case", label: "caso límite", dash: "1 4", opacity: 0.7 },
];

export function MapHeader({ map }: { map: SystemMap }) {
  return (
    <div className="pointer-events-auto flex max-w-[min(26rem,calc(100vw-2rem))] flex-col gap-1.5 rounded-lg bg-background/80 p-1 backdrop-blur-sm">
      <h1 data-testid="map-header" className="truncate text-sm">
        <span className="font-semibold">universe</span>
        <span className="text-muted-foreground"> · {map.title} · {map.nodes.length} nodos</span>
      </h1>
      <p className="text-xs leading-snug text-muted-foreground">
        Sigue una rama y abre cada nodo. Arrastra para moverte, clic en un nodo.
      </p>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Leyenda">
        {LEGEND.map((item) => (
          <li key={item.type} className="flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden className="overflow-visible">
              <line
                x1="0"
                y1="3"
                x2="22"
                y2="3"
                style={{
                  stroke: "var(--muted-foreground)",
                  strokeWidth: 1.25,
                  strokeDasharray: item.dash,
                  strokeLinecap: "round",
                  opacity: item.opacity,
                }}
              />
            </svg>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
