import { describe, expect, it } from "vitest";
import { formatToolPayload, presentToolUse } from "../src/shared/tool-ux.js";
import type { ChatMessage } from "../src/shared/types.js";

describe("tool use chrome", () => {
  it("exposes formatted input and output for a tool message", () => {
    const path = "src/index.ts";
    const contents = "export const n = 1";
    const message: ChatMessage = {
      id: "msg_tool",
      botId: "bot_a",
      role: "tool",
      text: "read",
      createdAt: 1,
      toolName: "read",
      toolInput: { path },
      toolOutput: { content: contents },
    };
    const presented = presentToolUse(message);
    expect(presented.name).toBe("read");
    expect(presented.input).toContain(path);
    expect(presented.output).toContain(contents);
    expect(presented.pending).toBe(false);
    expect(formatToolPayload({ path })).toContain(path);
  });
});
