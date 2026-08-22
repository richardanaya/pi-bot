import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TeamSnapshot } from "../shared/types.js";
import type { Team } from "./team.js";

export function statePath(dataDir: string): string {
  return join(dataDir, "state.json");
}

export function loadSnapshot(dataDir: string): TeamSnapshot | null {
  try {
    const raw = readFileSync(statePath(dataDir), "utf8");
    return JSON.parse(raw) as TeamSnapshot;
  } catch {
    return null;
  }
}

export function saveSnapshot(dataDir: string, snapshot: TeamSnapshot): void {
  mkdirSync(dataDir, { recursive: true });
  const file = statePath(dataDir);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(snapshot, null, 2));
  renameSync(tmp, file);
}

export function persistTeam(dataDir: string, team: Team): () => void {
  const existing = loadSnapshot(dataDir);
  if (existing) team.restore(existing);
  saveSnapshot(dataDir, team.snapshot());
  return team.subscribe(() => {
    saveSnapshot(dataDir, team.snapshot());
  });
}
