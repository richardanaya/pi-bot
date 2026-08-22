import { cronMatches, sameMinute } from "../shared/cron.js";
import type { Routine } from "../shared/types.js";
import type { Team } from "./team.js";

export function dueRoutines(routines: Routine[], now: Date): Routine[] {
  const stamp = now.getTime();
  return routines.filter((routine) => {
    if (!routine.schedule) return false;
    if (!cronMatches(routine.schedule, now)) return false;
    if (routine.lastRunAt !== undefined && sameMinute(routine.lastRunAt, stamp)) return false;
    return true;
  });
}

export function startRoutineScheduler(
  team: Team,
  onRun: (routineId: string) => void,
  intervalMs = 15_000,
): () => void {
  const tick = () => {
    const now = new Date();
    for (const routine of dueRoutines(team.listRoutines(), now)) {
      onRun(routine.id);
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
