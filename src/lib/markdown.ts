export type Inline =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "em"; value: string }
  | { type: "code"; value: string };

export type Block =
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; items: Inline[][] };

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;

export function parseInline(text: string): Inline[] {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((part): Inline => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return { type: "strong", value: part.slice(2, -2) };
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return { type: "code", value: part.slice(1, -1) };
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return { type: "em", value: part.slice(1, -1) };
      }
      return { type: "text", value: part };
    });
}

/** Tiny markdown subset: paragraphs, "-"/"*" bullet lists, bold, italic, code. */
export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: Inline[][] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", content: parseInline(paragraph.join(" ")) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: "list", items: list });
      list = null;
    }
  };

  for (const raw of source.split("\n")) {
    const line = raw.trim();
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      list ??= [];
      list.push(parseInline(bullet[1]));
    } else if (line === "") {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
