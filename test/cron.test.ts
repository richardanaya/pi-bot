import { describe, expect, it } from "vitest";
import { cronMatches, normalizeSchedule } from "../src/shared/cron.js";
import { dueRoutines } from "../src/server/scheduler.js";

describe("cron schedules", () => {
  it("matches 5-field expressions and lists due routines", () => {
    const nine = new Date(2026, 7, 22, 9, 0, 0);
    const nineOhOne = new Date(2026, 7, 22, 9, 1, 0);
    const expr = "0 9 * * *";
    expect(cronMatches(expr, nine)).toBe(true);
    expect(cronMatches(expr, nineOhOne)).toBe(false);
    expect(normalizeSchedule(" 0 9 * * * ")).toBe(expr);
    expect(normalizeSchedule("")).toBeUndefined();
    expect(() => normalizeSchedule("nightly")).toThrow();

    const due = dueRoutines(
      [
        {
          id: "rtn_a",
          botId: "bot_a",
          name: "Morning",
          instruction: "Brief",
          createdAt: 1,
          schedule: expr,
        },
        {
          id: "rtn_b",
          botId: "bot_a",
          name: "Manual",
          instruction: "By hand",
          createdAt: 1,
        },
      ],
      nine,
    );
    expect(due.map((routine) => routine.id)).toEqual(["rtn_a"]);
    expect(due[0]?.schedule).toBe(expr);
  });
});
