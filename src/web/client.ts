import type { ClientFrame, ServerFrame } from "../shared/protocol.js";
import type { Attachment, Bot, ChatMessage, Routine, TeamSnapshot } from "../shared/types.js";

export type ClientListener = (frame: ServerFrame) => void;

export class PiBotClient {
  snapshot: TeamSnapshot = { bots: [], groups: [], routines: [], chats: {}, focusedBotId: null };
  demo = false;
  cwd = "";
  agentDir = "";
  connected = false;
  ready = false;
  lastError = "";
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<ClientListener>();
  private reconnectTimer: number | undefined;

  subscribe(listener: ClientListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  connect(): void {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${location.host}/ws`);
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.connected = true;
      this.lastError = "";
    });
    socket.addEventListener("message", (event) => {
      const frame = JSON.parse(String(event.data)) as ServerFrame;
      this.apply(frame);
      for (const listener of this.listeners) listener(frame);
    });
    socket.addEventListener("close", () => {
      this.connected = false;
      this.scheduleReconnect();
    });
    socket.addEventListener("error", () => {
      this.lastError = "WebSocket error";
    });
  }

  send(frame: ClientFrame): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.lastError = "Not connected";
      return;
    }
    this.socket.send(JSON.stringify(frame));
  }

  focusedBot(): Bot | null {
    const id = this.snapshot.focusedBotId;
    return this.snapshot.bots.find((bot) => bot.id === id) ?? null;
  }

  messagesFor(botId: string | null): ChatMessage[] {
    if (!botId) return [];
    return this.snapshot.chats[botId] ?? [];
  }

  routinesFor(botId: string | null): Routine[] {
    if (!botId) return [];
    return this.snapshot.routines.filter((routine) => routine.botId === botId);
  }

  private apply(frame: ServerFrame): void {
    if (frame.type === "hello") {
      this.demo = frame.demo;
      this.cwd = frame.cwd;
      this.agentDir = frame.agentDir;
    }
    if (frame.type === "snapshot") {
      this.snapshot = { groups: [], ...frame.snapshot };
      this.ready = true;
    }
    if (frame.type === "bot") {
      this.snapshot.bots = upsert(this.snapshot.bots, frame.bot, (item) => item.id);
      if (!this.snapshot.chats[frame.bot.id]) this.snapshot.chats[frame.bot.id] = [];
    }
    if (frame.type === "bot_removed") {
      this.snapshot.bots = this.snapshot.bots.filter((bot) => bot.id !== frame.botId);
      this.snapshot.routines = this.snapshot.routines.filter((item) => item.botId !== frame.botId);
      delete this.snapshot.chats[frame.botId];
      if (this.snapshot.focusedBotId === frame.botId) {
        this.snapshot.focusedBotId = this.snapshot.bots[0]?.id ?? null;
      }
    }
    if (frame.type === "focus") this.snapshot.focusedBotId = frame.botId;
    if (frame.type === "message") {
      const list = this.snapshot.chats[frame.botId] ?? [];
      this.snapshot.chats[frame.botId] = upsert(list, frame.message, (item) => item.id);
    }
    if (frame.type === "routine") {
      this.snapshot.routines = upsert(this.snapshot.routines, frame.routine, (item) => item.id);
    }
    if (frame.type === "routine_removed") {
      this.snapshot.routines = this.snapshot.routines.filter((item) => item.id !== frame.routineId);
    }
    if (frame.type === "group") {
      this.snapshot.groups = upsert(this.snapshot.groups, frame.group, (item) => item.id);
    }
    if (frame.type === "group_removed") {
      this.snapshot.groups = this.snapshot.groups.filter((item) => item.id !== frame.groupId);
      this.snapshot.bots = this.snapshot.bots.map((bot) =>
        bot.groupId === frame.groupId ? { ...bot, groupId: undefined } : bot,
      );
    }
    if (frame.type === "error") this.lastError = frame.message;
  }

  private scheduleReconnect(): void {
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.connect(), 750);
  }
}

function upsert<T>(list: T[], item: T, key: (item: T) => string): T[] {
  const id = key(item);
  const index = list.findIndex((entry) => key(entry) === id);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

export async function uploadMedia(file: File): Promise<Attachment> {
  const data = await fileToBase64(file);
  const response = await fetch("/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      data,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as Attachment;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
