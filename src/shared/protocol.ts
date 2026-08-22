import type { Attachment, Bot, ChatMessage, Routine, TeamSnapshot } from "./types.js";

export type ClientFrame =
  | { type: "hire"; name: string; job: string; instructions?: string }
  | { type: "fire"; botId: string }
  | { type: "focus"; botId: string }
  | { type: "prompt"; botId: string; text: string; attachments?: Attachment[] }
  | { type: "abort"; botId: string }
  | { type: "create_routine"; botId: string; name: string; instruction: string }
  | { type: "run_routine"; routineId: string }
  | { type: "delete_routine"; routineId: string };

export type ServerFrame =
  | { type: "hello"; demo: boolean; cwd: string; agentDir: string }
  | { type: "snapshot"; snapshot: TeamSnapshot }
  | { type: "bot"; bot: Bot }
  | { type: "bot_removed"; botId: string }
  | { type: "focus"; botId: string | null }
  | { type: "message"; botId: string; message: ChatMessage }
  | { type: "routine"; routine: Routine }
  | { type: "routine_removed"; routineId: string }
  | { type: "error"; message: string };

export function parseClientFrame(raw: string): ClientFrame {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error("Invalid client frame");
  }
  return value as ClientFrame;
}

export function encodeFrame(frame: ClientFrame | ServerFrame): string {
  return JSON.stringify(frame);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
