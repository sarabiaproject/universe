import { parseMarkdown, type Inline } from "@/lib/markdown";

function InlineContent({ content }: { content: Inline[] }) {
  return content.map((part, i) => {
    switch (part.type) {
      case "strong":
        return <strong key={i} className="font-medium text-foreground">{part.value}</strong>;
      case "em":
        return <em key={i}>{part.value}</em>;
      case "code":
        return (
          <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] break-all">
            {part.value}
          </code>
        );
      default:
        return <span key={i}>{part.value}</span>;
    }
  });
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
      {parseMarkdown(source).map((block, i) =>
        block.type === "list" ? (
          <ul key={i} className="flex flex-col gap-1.5">
            {block.items.map((item, j) => (
              <li key={j} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                <span className="min-w-0">
                  <InlineContent content={item} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <InlineContent content={block.content} />
          </p>
        ),
      )}
    </div>
  );
}
