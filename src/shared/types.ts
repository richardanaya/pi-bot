export type BotStatus = "idle" | "working" | "error";

export type ChatRole = "user" | "assistant" | "handoff" | "system" | "tool";

export interface Attachment {
  id: string;
  kind: "image" | "video";
  url: string;
  mimeType: string;
  name: string;
}

export interface Bot {
  id: string;
  name: string;
  job: string;
  instructions: string;
  status: BotStatus;
  createdAt: number;
  hiredBy?: string;
  error?: string;
  pinned?: boolean;
  pinOrder?: number;
  groupId?: string;
}

export interface BotGroup {
  id: string;
  name: string;
  collapsed?: boolean;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  botId: string;
  role: ChatRole;
  text: string;
  createdAt: number;
  streaming?: boolean;
  fromBotId?: string;
  fromBotName?: string;
  toBotId?: string;
  toBotName?: string;
  hops?: number;
  toolName?: string;
  toolCallId?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  toolError?: boolean;
  attachments?: Attachment[];
}

export interface Routine {
  id: string;
  botId: string;
  name: string;
  instruction: string;
  createdAt: number;
  lastRunAt?: number;
  /** 5-field cron (minute hour day month weekday). Empty/undefined = manual only. */
  schedule?: string;
}

export interface TeamSnapshot {
  bots: Bot[];
  groups: BotGroup[];
  routines: Routine[];
  chats: Record<string, ChatMessage[]>;
  focusedBotId: string | null;
}
