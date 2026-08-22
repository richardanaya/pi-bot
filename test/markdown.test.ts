import { describe, expect, it } from "vitest";
import { renderMarkdown, rewriteMedia } from "../src/shared/markdown.js";

describe("markdown media", () => {
  it("renders images, videos, and strips script", () => {
    const markdown = [
      "# Title",
      "",
      "Hello **team**",
      "",
      "![Chart](/media/demo-chart.png)",
      "",
      "![Clip](/media/demo-clip.mp4)",
      "",
      "<script>alert(1)</script>",
    ].join("\n");
    const html = renderMarkdown(markdown);
    expect(html).toContain("<h1");
    expect(html).toContain("<img");
    expect(html).toContain("/media/demo-chart.png");
    expect(html).toContain("<video");
    expect(html).toContain("/media/demo-clip.mp4");
    expect(html).not.toContain("script");
    expect(html).not.toContain("alert");
  });

  it("rewrites image tags with video sources to video elements", () => {
    const html = rewriteMedia(`<img src="https://example.com/note.webm" alt="Note">`);
    expect(html).toContain("<video");
    expect(html).toContain("https://example.com/note.webm");
  });
});
