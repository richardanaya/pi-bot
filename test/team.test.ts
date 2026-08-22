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

  it("fires a bot and drops its chat and routines", () => {
    const team = new Team();
    const keeper = team.hire({ name: "Keeper", job: "Stay" });
    const doomed = team.hire({ name: "Doomed", job: "Go" });
    team.createRoutine({
      botId: doomed.id,
      name: "Nightly",
      instruction: "Clean up",
    });
    team.appendMessage({ botId: doomed.id, role: "user", text: "hello" });
    expect(team.listRoutines(doomed.id)).toHaveLength(1);
    expect(team.chat(doomed.id)).toHaveLength(1);
    expect(team.focusedBotId).toBe(doomed.id);

    team.fire(doomed.id);
    expect(team.getBot(doomed.id)).toBeUndefined();
    expect(team.listBots().map((bot) => bot.id)).toEqual([keeper.id]);
    expect(team.listRoutines()).toEqual([]);
    expect(team.snapshot().chats[doomed.id]).toBeUndefined();
    expect(team.focusedBotId).toBe(keeper.id);
  });

  it("updates hired bot name, job, and instructions", () => {
    const team = new Team();
    const bot = team.hire({ name: "Draft", job: "Old job", instructions: "Be brief" });
    const updated = team.updateBot({
      botId: bot.id,
      name: "Final",
      job: "New job",
      instructions: "Be thorough",
    });
    expect(updated.name).toBe("Final");
    expect(updated.job).toBe("New job");
    expect(updated.instructions).toBe("Be thorough");
    expect(team.getBot(bot.id)?.name).toBe("Final");
  });

  it("stores and updates a routine cron schedule", () => {
    const team = new Team();
    const bot = team.hire({ name: "Ops", job: "Keep time" });
    const routine = team.createRoutine({
      botId: bot.id,
      name: "Standup",
      instruction: "Post standup",
    });
    expect(routine.schedule).toBeUndefined();
    const cron = "30 8 * * 1-5";
    const updated = team.updateRoutine({ routineId: routine.id, schedule: cron });
    expect(updated.schedule).toBe(cron);
    expect(team.getRoutine(routine.id).schedule).toBe(cron);
    const cleared = team.updateRoutine({ routineId: routine.id, schedule: "" });
    expect(cleared.schedule).toBeUndefined();
  });
});
