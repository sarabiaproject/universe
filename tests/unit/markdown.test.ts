import { describe, expect, it } from "vitest";

import { parseMarkdown } from "@/lib/markdown";

describe("parseMarkdown", () => {
  it("parses paragraphs, bullets and inline marks", () => {
    const blocks = parseMarkdown("Hola **mundo**\n\n- uno `x`\n- *dos*");
    expect(blocks).toEqual([
      { type: "paragraph", content: [{ type: "text", value: "Hola " }, { type: "strong", value: "mundo" }] },
      {
        type: "list",
        items: [
          [{ type: "text", value: "uno " }, { type: "code", value: "x" }],
          [{ type: "em", value: "dos" }],
        ],
      },
    ]);
  });
});
