import { describe, expect, it } from "vitest";
import { dispatchComposerSend } from "../src/server/dispatch.js";
import { filterMentionRoster, mentionQueryAt } from "../src/shared/mentions.js";
import { Team } from "../src/server/team.js";

describe("composer @mention send", () => {
  it("routes Hey @Name, make a poem to the hired bot and ignores unknown @", () => {
    const team = new Team();
    expect(team.listBots()).toEqual([]);

    const coordinator = team.hire({ name: "Coordinator", job: "Route work" });
    const poemMaker = team.hire({ name: "PoemMaker", job: "Write poems" });
    const beforeIds = new Set(team.listBots().map((bot) => bot.id));

    const composer = `Hey @${poemMaker.name}, make a poem`;
    const result = dispatchComposerSend(team, {
      fromBotId: coordinator.id,
      text: composer,
    });

    expect(result.kind).toBe("mention");
    if (result.kind !== "mention") throw new Error("expected mention");
    expect(result.targetId).toBe(poemMaker.id);
    expect(result.targetName).toBe(poemMaker.name);
    expect(result.ask).toContain("make a poem");
    expect(result.inbound.botId).toBe(poemMaker.id);
    expect(result.inbound.text).toContain("make a poem");
    expect(team.chat(poemMaker.id).some((message) => message.text.includes("make a poem"))).toBe(
      true,
    );
    expect(team.chat(coordinator.id).some((message) => message.role === "user")).toBe(false);

    const unknown = dispatchComposerSend(team, {
      fromBotId: coordinator.id,
      text: "Hey @NotOnTheRoster, make a poem",
    });
    expect(unknown.kind).toBe("prompt");
    expect(team.listBots().every((bot) => beforeIds.has(bot.id))).toBe(true);
    expect(team.listBots().some((bot) => bot.name === "NotOnTheRoster")).toBe(false);
    const extraHandoff = team
      .chat(poemMaker.id)
      .filter((message) => message.role === "handoff" && message.text.includes("NotOnTheRoster"));
    expect(extraHandoff).toEqual([]);
  });

  it("reads an @query at the caret and filters the roster", () => {
    const text = "Hey @Po";
    expect(mentionQueryAt(text, text.length)).toEqual({ start: 4, query: "Po" });
    expect(mentionQueryAt("mail@host", 9)).toBeNull();
    expect(mentionQueryAt("Hey @Po more", 12)).toBeNull();
    expect(mentionQueryAt("@", 1)).toEqual({ start: 0, query: "" });

    const roster = [
      { id: "self", name: "Coordinator" },
      { id: "b1", name: "PoemMaker" },
      { id: "b2", name: "PinTop Chief" },
    ];
    expect(filterMentionRoster(roster, "Po", "self").map((bot) => bot.name)).toEqual(["PoemMaker"]);
    expect(filterMentionRoster(roster, "", "self").map((bot) => bot.id)).toEqual(["b2", "b1"]);
    expect(filterMentionRoster(roster, "zzz", "self")).toEqual([]);
  });
});
