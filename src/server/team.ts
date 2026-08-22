import { normalizeSchedule } from "../shared/cron.js";
import { newId } from "../shared/ids.js";
import type {
  Bot,
  BotGroup,
  BotStatus,
  ChatMessage,
  Routine,
  TeamSnapshot,
} from "../shared/types.js";

export const MAX_HANDOFF_HOPS = 3;

export type TeamEvent =
  | { type: "bot"; bot: Bot }
  | { type: "bot_removed"; botId: string }
  | { type: "focus"; botId: string | null }
  | { type: "message"; botId: string; message: ChatMessage }
  | { type: "routine"; routine: Routine }
  | { type: "routine_removed"; routineId: string }
  | { type: "handoff"; fromBotId: string; toBotId: string; message: ChatMessage }
  | { type: "status"; bot: Bot }
  | { type: "group"; group: BotGroup }
  | { type: "group_removed"; groupId: string };

export type TeamListener = (event: TeamEvent) => void;

export class Team {
  private readonly bots = new Map<string, Bot>();
  private readonly chats = new Map<string, ChatMessage[]>();
  private readonly routines = new Map<string, Routine>();
  private readonly groups = new Map<string, BotGroup>();
  private readonly inboundHops = new Map<string, number>();
  private readonly listeners = new Set<TeamListener>();
  private focusedId: string | null = null;

  subscribe(listener: TeamListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get focusedBotId(): string | null {
    return this.focusedId;
  }

  listBots(): Bot[] {
    return [...this.bots.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  getBot(botId: string): Bot | undefined {
    return this.bots.get(botId);
  }

  requireBot(botId: string): Bot {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Unknown bot: ${botId}`);
    return bot;
  }

  chat(botId: string): ChatMessage[] {
    this.requireBot(botId);
    return [...(this.chats.get(botId) ?? [])];
  }

  listGroups(): BotGroup[] {
    return [...this.groups.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  listRoutines(botId?: string): Routine[] {
    const all = [...this.routines.values()].sort((a, b) => a.createdAt - b.createdAt);
    return botId ? all.filter((routine) => routine.botId === botId) : all;
  }

  snapshot(): TeamSnapshot {
    const chats: TeamSnapshot["chats"] = {};
    for (const bot of this.bots.values()) {
      chats[bot.id] = this.chat(bot.id);
    }
    return {
      bots: this.listBots(),
      groups: this.listGroups(),
      routines: this.listRoutines(),
      chats,
      focusedBotId: this.focusedId,
    };
  }

  hire(input: { name: string; job: string; instructions?: string; hiredBy?: string }): Bot {
    const name = required(input.name, "Bot name is required");
    const job = required(input.job, "Bot job is required");
    const bot: Bot = {
      id: newId("bot"),
      name,
      job,
      instructions: input.instructions?.trim() ?? "",
      status: "idle",
      createdAt: Date.now(),
      hiredBy: input.hiredBy,
    };
    this.bots.set(bot.id, bot);
    this.chats.set(bot.id, []);
    this.focusedId = bot.id;
    this.emit({ type: "bot", bot: { ...bot } });
    this.emit({ type: "focus", botId: bot.id });
    return { ...bot };
  }

  updateBot(input: { botId: string; name: string; job: string; instructions?: string }): Bot {
    const bot = this.requireBot(input.botId);
    bot.name = required(input.name, "Bot name is required");
    bot.job = required(input.job, "Bot job is required");
    bot.instructions = input.instructions?.trim() ?? "";
    this.emit({ type: "bot", bot: { ...bot } });
    return { ...bot };
  }

  focus(botId: string): Bot {
    const bot = this.requireBot(botId);
    this.focusedId = botId;
    this.emit({ type: "focus", botId });
    return { ...bot };
  }

  fire(botId: string): void {
    this.requireBot(botId);
    this.bots.delete(botId);
    this.chats.delete(botId);
    this.inboundHops.delete(botId);
    for (const [id, routine] of this.routines) {
      if (routine.botId === botId) this.routines.delete(id);
    }
    if (this.focusedId === botId) {
      const next = this.listBots()[0];
      this.focusedId = next?.id ?? null;
      this.emit({ type: "focus", botId: this.focusedId });
    }
    this.emit({ type: "bot_removed", botId });
  }

  pinBot(botId: string, pinned: boolean): Bot {
    const bot = this.requireBot(botId);
    bot.pinned = pinned;
    if (pinned) {
      const max = this.listBots().reduce((n, item) => Math.max(n, item.pinOrder ?? 0), 0);
      bot.pinOrder = max + 1;
    } else {
      bot.pinOrder = undefined;
    }
    this.emit({ type: "bot", bot: { ...bot } });
    return { ...bot };
  }

  createGroup(name: string): BotGroup {
    const group: BotGroup = {
      id: newId("grp"),
      name: required(name, "Group name is required"),
      createdAt: Date.now(),
    };
    this.groups.set(group.id, group);
    this.emit({ type: "group", group: { ...group } });
    return { ...group };
  }

  assignBotGroup(botId: string, groupId: string | null): Bot {
    const bot = this.requireBot(botId);
    if (groupId) {
      if (!this.groups.has(groupId)) throw new Error(`Unknown group: ${groupId}`);
      bot.groupId = groupId;
    } else {
      bot.groupId = undefined;
    }
    this.emit({ type: "bot", bot: { ...bot } });
    return { ...bot };
  }

  setGroupCollapsed(groupId: string, collapsed: boolean): BotGroup {
    const group = this.groups.get(groupId);
    if (!group) throw new Error(`Unknown group: ${groupId}`);
    group.collapsed = collapsed;
    this.emit({ type: "group", group: { ...group } });
    return { ...group };
  }

  deleteGroup(groupId: string): void {
    if (!this.groups.delete(groupId)) throw new Error(`Unknown group: ${groupId}`);
    for (const bot of this.bots.values()) {
      if (bot.groupId === groupId) {
        bot.groupId = undefined;
        this.emit({ type: "bot", bot: { ...bot } });
      }
    }
    this.emit({ type: "group_removed", groupId });
  }

  setStatus(botId: string, status: BotStatus, error?: string): Bot {
    const bot = this.requireBot(botId);
    bot.status = status;
    bot.error = error;
    this.emit({ type: "status", bot: { ...bot } });
    this.emit({ type: "bot", bot: { ...bot } });
    return { ...bot };
  }

  appendMessage(
    input: Omit<ChatMessage, "id" | "createdAt"> & { id?: string; createdAt?: number },
  ): ChatMessage {
    this.requireBot(input.botId);
    const message: ChatMessage = {
      ...input,
      id: input.id ?? newId("msg"),
      createdAt: input.createdAt ?? Date.now(),
      attachments: input.attachments ? [...input.attachments] : undefined,
    };
    const list = this.chats.get(input.botId) ?? [];
    list.push(message);
    this.chats.set(input.botId, list);
    this.emit({ type: "message", botId: message.botId, message: cloneMessage(message) });
    return cloneMessage(message);
  }

  updateMessage(botId: string, messageId: string, patch: Partial<ChatMessage>): ChatMessage {
    const list = this.chats.get(botId);
    const message = list?.find((item) => item.id === messageId);
    if (!message) throw new Error(`Unknown message: ${messageId}`);
    Object.assign(message, patch);
    this.emit({ type: "message", botId, message: cloneMessage(message) });
    return cloneMessage(message);
  }

  resolveBot(spec: string): Bot {
    const trimmed = required(spec, "Bot is required");
    const byId = this.bots.get(trimmed);
    if (byId) return { ...byId };
    const matches = this.listBots().filter(
      (bot) => bot.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (matches.length === 1) return { ...matches[0] };
    if (matches.length > 1) throw new Error(`Multiple bots named "${trimmed}"`);
    throw new Error(`Unknown bot: ${trimmed}`);
  }

  handoff(input: { fromBotId: string; toBotId: string; text: string }): ChatMessage {
    const text = required(input.text, "Message text is required");
    const from = this.requireBot(input.fromBotId);
    const to = this.requireBot(input.toBotId);
    if (from.id === to.id) throw new Error("Cannot message yourself");
    const hops = (this.inboundHops.get(from.id) ?? 0) + 1;
    if (hops > MAX_HANDOFF_HOPS) {
      throw new Error(`Handoff hop limit (${MAX_HANDOFF_HOPS}) reached`);
    }
    this.inboundHops.set(to.id, hops);
    const inbound = this.appendMessage({
      botId: to.id,
      role: "handoff",
      text,
      fromBotId: from.id,
      fromBotName: from.name,
      toBotId: to.id,
      toBotName: to.name,
      hops,
    });
    this.appendMessage({
      botId: from.id,
      role: "handoff",
      text,
      fromBotId: from.id,
      fromBotName: from.name,
      toBotId: to.id,
      toBotName: to.name,
      hops,
    });
    this.emit({ type: "handoff", fromBotId: from.id, toBotId: to.id, message: inbound });
    return inbound;
  }

  resetHops(botId: string): void {
    this.inboundHops.delete(botId);
  }

  createRoutine(input: {
    botId: string;
    name: string;
    instruction: string;
    schedule?: string;
  }): Routine {
    this.requireBot(input.botId);
    const name = required(input.name, "Routine name is required");
    const instruction = required(input.instruction, "Routine instruction is required");
    const routine: Routine = {
      id: newId("rtn"),
      botId: input.botId,
      name,
      instruction,
      createdAt: Date.now(),
      schedule: normalizeOptionalSchedule(input.schedule),
    };
    this.routines.set(routine.id, routine);
    this.emit({ type: "routine", routine: { ...routine } });
    return { ...routine };
  }

  updateRoutine(input: { routineId: string; schedule?: string }): Routine {
    const routine = this.routines.get(input.routineId);
    if (!routine) throw new Error(`Unknown routine: ${input.routineId}`);
    routine.schedule = normalizeOptionalSchedule(input.schedule);
    this.emit({ type: "routine", routine: { ...routine } });
    return { ...routine };
  }

  getRoutine(routineId: string): Routine {
    const routine = this.routines.get(routineId);
    if (!routine) throw new Error(`Unknown routine: ${routineId}`);
    return { ...routine };
  }

  runRoutine(routineId: string): { routine: Routine; message: ChatMessage } {
    const routine = this.routines.get(routineId);
    if (!routine) throw new Error(`Unknown routine: ${routineId}`);
    this.requireBot(routine.botId);
    routine.lastRunAt = Date.now();
    const message = this.appendMessage({
      botId: routine.botId,
      role: "user",
      text: routine.instruction,
    });
    this.emit({ type: "routine", routine: { ...routine } });
    return { routine: { ...routine }, message };
  }

  deleteRoutine(routineId: string): void {
    if (!this.routines.delete(routineId)) throw new Error(`Unknown routine: ${routineId}`);
    this.emit({ type: "routine_removed", routineId });
  }

  restore(snapshot: TeamSnapshot): void {
    this.bots.clear();
    this.chats.clear();
    this.routines.clear();
    this.groups.clear();
    this.inboundHops.clear();
    for (const bot of snapshot.bots) {
      this.bots.set(bot.id, { ...bot, status: bot.status === "working" ? "idle" : bot.status });
      this.chats.set(
        bot.id,
        (snapshot.chats[bot.id] ?? []).map((message) => ({ ...message, streaming: false })),
      );
    }
    for (const routine of snapshot.routines) this.routines.set(routine.id, { ...routine });
    for (const group of snapshot.groups ?? []) this.groups.set(group.id, { ...group });
    this.focusedId =
      snapshot.focusedBotId && this.bots.has(snapshot.focusedBotId)
        ? snapshot.focusedBotId
        : (this.listBots()[0]?.id ?? null);
  }

  private emit(event: TeamEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

function required(value: string | undefined, message: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) throw new Error(message);
  return trimmed;
}

function normalizeOptionalSchedule(value: string | undefined): string | undefined {
  return normalizeSchedule(value);
}

function cloneMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    attachments: message.attachments ? [...message.attachments] : undefined,
  };
}
