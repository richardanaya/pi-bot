import { describe, expect, it } from "vitest";
import { arrangeRoster } from "../src/shared/roster.js";
import { Team } from "../src/server/team.js";

describe("roster pin and groups", () => {
  it("pins a bot to the top and groups others under a named section", () => {
    const team = new Team();
    const alpha = team.hire({ name: "Alpha", job: "One" });
    const beta = team.hire({ name: "Beta", job: "Two" });
    const gamma = team.hire({ name: "Gamma", job: "Three" });

    team.pinBot(beta.id, true);
    const sales = team.createGroup("Sales");
    team.assignBotGroup(gamma.id, sales.id);

    const sections = arrangeRoster(team.listBots(), team.listGroups());
    expect(sections[0]?.kind).toBe("pinned");
    expect(sections[0]?.title).toBe("Pinned");
    expect(sections[0]?.bots.map((bot) => bot.id)).toEqual([beta.id]);

    const salesSection = sections.find((section) => section.groupId === sales.id);
    expect(salesSection?.bots.map((bot) => bot.id)).toEqual([gamma.id]);
    expect(salesSection?.bots.some((bot) => bot.id === beta.id)).toBe(false);

    const other = sections.find((section) => section.kind === "ungrouped");
    expect(other?.bots.map((bot) => bot.id)).toEqual([alpha.id]);

    team.pinBot(beta.id, false);
    const after = arrangeRoster(team.listBots(), team.listGroups());
    expect(after.some((section) => section.kind === "pinned")).toBe(false);
    expect(
      after.find((section) => section.kind === "ungrouped")?.bots.map((bot) => bot.id),
    ).toContain(beta.id);
  });
});
