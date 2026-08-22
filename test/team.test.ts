import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Team } from "../src/server/team.js";
import { createPiBotTools, executePiBotMessage, PI_BOT_TOOL_PREFIX } from "../src/server/tools.js";
import { persistTeam } from "../src/server/store.js";

describe("hire, focus, routines, and pi_bot_ handoff", () => {
  it("hires from a cold roster, focuses chat, saves a routine, and delivers a handoff", async () => {
    const team = new Team();
    expect(team.listBots()).toEqual([]);

    const name = "Ada Research";
    const job = "Account research";
    const hired = team.hire({ name, job });
    expect(hired.name).toBe(name);
    expect(hired.job).toBe(job);
    expect(team.listBots().map((bot) => bot.id)).toContain(hired.id);

    const focused = team.focus(hired.id);
    expect(focused.id).toBe(hired.id);
    expect(team.focusedBotId).toBe(hired.id);
    expect(team.chat(hired.id)).toEqual([]);

    const routineName = "Monday scoreboard";
    const instruction = `Draft a scoreboard for ${name}`;
    const routine = team.createRoutine({
      botId: hired.id,
      name: routineName,
      instruction,
    });
    expect(routine.botId).toBe(hired.id);
    const listed = team.listRoutines(hired.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe(routineName);
    expect(listed[0]?.instruction).toBe(instruction);

    const otherName = "Ben Comms";
    const other = team.hire({ name: otherName, job: "Outbound copy" });
    const tools = createPiBotTools(team, hired.id);
    expect(tools.every((tool) => tool.name.startsWith(PI_BOT_TOOL_PREFIX))).toBe(true);

    const messageTool = tools.find((tool) => tool.name === `${PI_BOT_TOOL_PREFIX}message`);
    expect(messageTool).toBeTruthy();
    const handoffText = `Need launch copy for ${otherName}`;
    await messageTool!.execute({ bot: other.name, text: handoffText });

    const inbound = team.chat(other.id);
    const delivered = inbound.find(
      (message) => message.role === "handoff" && message.text === handoffText,
    );
    expect(delivered).toBeTruthy();
    expect(delivered?.fromBotId).toBe(hired.id);
    expect(delivered?.fromBotName).toBe(hired.name);
    expect(delivered?.botId).toBe(other.id);

    const direct = executePiBotMessage(team, other.id, {
      bot: hired.id,
      text: `Reply to ${handoffText}`,
    });
    expect(direct.text).toBe(`Reply to ${handoffText}`);
    expect(
      team.chat(hired.id).some((message) => message.id === direct.id && message.role === "handoff"),
    ).toBe(true);
  });

  it("persists a hired bot and routine through the file store", () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-bot-store-"));
    const team = new Team();
    persistTeam(dir, team);
    const hired = team.hire({ name: "Stored", job: "Keep state" });
    const routine = team.createRoutine({
      botId: hired.id,
      name: "Nightly",
      instruction: "Summarize overnight mail",
    });
    const raw = readFileSync(join(dir, "state.json"), "utf8");
    expect(raw).toContain(hired.name);
    expect(raw).toContain(routine.name);

    const restored = new Team();
    persistTeam(dir, restored);
    expect(restored.listBots()[0]?.name).toBe(hired.name);
    expect(restored.listRoutines(restored.listBots()[0]!.id)[0]?.instruction).toBe(
      routine.instruction,
    );
  });
});
