import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startPiBotSession } from "../src/server/pi-session.js";
import { Team } from "../src/server/team.js";
import { PI_BOT_TOOL_PREFIX } from "../src/server/tool-names.js";

describe("pi session start", () => {
  it("creates a session from ~/.pi with pi_bot_ tools", async () => {
    const team = new Team();
    const bot = team.hire({ name: "Tool Probe", job: "Verify pi_bot_ tools" });
    const started = await startPiBotSession({
      bot,
      team,
      cwd: process.cwd(),
    });
    try {
      expect(started.agentDir).toBe(join(homedir(), ".pi", "agent"));
      const names = started.toolNames();
      const prefixed = names.filter((name) => name.startsWith(PI_BOT_TOOL_PREFIX));
      expect(prefixed.length).toBeGreaterThan(0);
      expect(prefixed.some((name) => name === `${PI_BOT_TOOL_PREFIX}message`)).toBe(true);
    } finally {
      started.dispose();
    }
  });
});
