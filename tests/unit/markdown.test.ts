import { describe, it, expect } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

describe("renderMarkdown", () => {
  it("renders headings and paragraphs to HTML", async () => {
    const html = await renderMarkdown("# 제목\n\n본문입니다.");
    expect(html).toContain("<h1");
    expect(html).toContain("본문입니다.");
  });

  it("supports GFM tables", async () => {
    const md = "| a | b |\n| - | - |\n| 1 | 2 |";
    const html = await renderMarkdown(md);
    expect(html).toContain("<table>");
  });

  it("applies syntax highlighting to code blocks", async () => {
    const md = "```ts\nconst x = 1;\n```";
    const html = await renderMarkdown(md);
    expect(html).toContain("hljs");
  });
});
