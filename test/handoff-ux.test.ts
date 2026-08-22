import { describe, expect, it } from "vitest";
import { presentHandoff } from "../src/shared/handoff-ux.js";
import type { ChatMessage } from "../src/shared/types.js";

describe("handoff chrome", () => {
  it("collapses the body by default and shows it when expanded", () => {
    const body = "please write a haiku about the harbor";
    const message: ChatMessage = {
      id: "msg_test",
      botId: "bot_poem",
      role: "handoff",
      text: body,
      createdAt: 1,
      fromBotId: "bot_chief",
      fromBotName: "Chief",
      toBotId: "bot_poem",
      toBotName: "PoemMaker",
    };

    const collapsed = presentHandoff(message);
    expect(collapsed.expanded).toBe(false);
    expect(collapsed.body).toBe(body);
    expect(collapsed.collapsedLabel).toContain("Chief");
    expect(collapsed.collapsedLabel).toContain("PoemMaker");
    expect(collapsed.collapsedLabel.includes(body)).toBe(false);

    const expanded = presentHandoff(message, { expanded: true });
    expect(expanded.expanded).toBe(true);
    expect(expanded.body).toBe(body);
    expect(expanded.collapsedLabel.includes(body)).toBe(false);
  });
});
