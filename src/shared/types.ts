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
  hops?: number;
  toolName?: string;
  attachments?: Attachment[];
}

export interface Routine {
  id: string;
  botId: string;
  name: string;
  instruction: string;
  createdAt: number;
  lastRunAt?: number;
}

export interface TeamSnapshot {
  bots: Bot[];
  routines: Routine[];
  chats: Record<string, ChatMessage[]>;
  focusedBotId: string | null;
}
