import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 3141;

export function defaultAgentDir(): string {
  return join(homedir(), ".pi", "agent");
}

export function defaultDataDir(): string {
  return join(homedir(), ".pi", "pi-bot");
}
