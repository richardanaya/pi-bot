import { Type, type TSchema } from "typebox";
import { PI_BOT_TOOL_PREFIX } from "./tool-names.js";
import type { Team } from "./team.js";

export { PI_BOT_TOOL_NAMES, PI_BOT_TOOL_PREFIX } from "./tool-names.js";

export interface PiBotTool {
  name: string;
  label: string;
  description: string;
  promptSnippet: string;
  parameters: TSchema;
  execute: (params: Record<string, unknown>) => Promise<{ text: string }>;
}

export function createPiBotTools(team: Team, fromBotId: string): PiBotTool[] {
  return [
    {
      name: `${PI_BOT_TOOL_PREFIX}hire`,
      label: "Hire bot",
      description:
        "Hire a new teammate bot onto the shared roster. Use this when work should be owned by a specialist.",
      promptSnippet: "Hire a named teammate bot with a job description",
      parameters: Type.Object({
        name: Type.String({ description: "Short display name for the new bot" }),
        job: Type.String({ description: "The job or role this bot is hired to do" }),
        instructions: Type.Optional(
          Type.String({ description: "Standing instructions for the new hire" }),
        ),
        brief: Type.Optional(
          Type.String({ description: "Optional first task to hand the new hire" }),
        ),
      }),
      execute: async (params) => {
        const result = executePiBotHire(team, fromBotId, {
          name: String(params.name ?? ""),
          job: String(params.job ?? ""),
          instructions: optionalString(params.instructions),
          brief: optionalString(params.brief),
        });
        return { text: JSON.stringify(result, null, 2) };
      },
    },
    {
      name: `${PI_BOT_TOOL_PREFIX}list`,
      label: "List bots",
      description: "List every bot currently on the team roster.",
      promptSnippet: "List hired teammate bots",
      parameters: Type.Object({}),
      execute: async () => {
        const bots = executePiBotList(team);
        return { text: JSON.stringify(bots, null, 2) };
      },
    },
    {
      name: `${PI_BOT_TOOL_PREFIX}message`,
      label: "Message bot",
      description:
        "Send a message to another hired bot. The inbound handoff appears in that bot's chat so they can continue the work.",
      promptSnippet: "Hand work to another bot by name or id",
      parameters: Type.Object({
        bot: Type.String({ description: "Target bot id or exact name" }),
        text: Type.String({ description: "Message or task to deliver" }),
      }),
      execute: async (params) => {
        const message = executePiBotMessage(team, fromBotId, {
          bot: String(params.bot ?? ""),
          text: String(params.text ?? ""),
        });
        return { text: JSON.stringify(message, null, 2) };
      },
    },
    {
      name: `${PI_BOT_TOOL_PREFIX}save_routine`,
      label: "Save routine",
      description:
        "Save a named instruction as a reusable routine for a bot (defaults to yourself). Optional 5-field cron schedule.",
      promptSnippet: "Save a reusable routine for a bot",
      parameters: Type.Object({
        name: Type.String({ description: "Routine name" }),
        instruction: Type.String({ description: "The prompt/instruction to run later" }),
        bot: Type.Optional(Type.String({ description: "Bot id or name; defaults to you" })),
        schedule: Type.Optional(
          Type.String({
            description: "5-field cron (minute hour day month weekday); omit for manual",
          }),
        ),
      }),
      execute: async (params) => {
        const routine = executePiBotSaveRoutine(team, fromBotId, {
          name: String(params.name ?? ""),
          instruction: String(params.instruction ?? ""),
          bot: optionalString(params.bot),
          schedule: optionalString(params.schedule),
        });
        return { text: JSON.stringify(routine, null, 2) };
      },
    },
    {
      name: `${PI_BOT_TOOL_PREFIX}run_routine`,
      label: "Run routine",
      description: "Run a saved routine by id. The instruction is posted into that bot's chat.",
      promptSnippet: "Run a saved routine",
      parameters: Type.Object({
        routineId: Type.String({ description: "Routine id" }),
      }),
      execute: async (params) => {
        const result = executePiBotRunRoutine(team, String(params.routineId ?? ""));
        return { text: JSON.stringify(result, null, 2) };
      },
    },
    {
      name: `${PI_BOT_TOOL_PREFIX}list_routines`,
      label: "List routines",
      description: "List saved routines, optionally for one bot.",
      promptSnippet: "List saved routines",
      parameters: Type.Object({
        bot: Type.Optional(Type.String({ description: "Bot id or name; omit for all" })),
      }),
      execute: async (params) => {
        const routines = executePiBotListRoutines(team, optionalString(params.bot));
        return { text: JSON.stringify(routines, null, 2) };
      },
    },
  ];
}

export function executePiBotHire(
  team: Team,
  fromBotId: string,
  params: { name: string; job: string; instructions?: string; brief?: string },
): { bot: { id: string; name: string; job: string }; briefed: boolean } {
  const bot = team.hire({
    name: params.name,
    job: params.job,
    instructions: params.instructions,
    hiredBy: fromBotId,
  });
  if (params.brief?.trim()) {
    team.handoff({ fromBotId, toBotId: bot.id, text: params.brief.trim() });
  }
  return {
    bot: { id: bot.id, name: bot.name, job: bot.job },
    briefed: Boolean(params.brief?.trim()),
  };
}

export function executePiBotList(
  team: Team,
): Array<{ id: string; name: string; job: string; status: string }> {
  return team.listBots().map((bot) => ({
    id: bot.id,
    name: bot.name,
    job: bot.job,
    status: bot.status,
  }));
}

export function executePiBotMessage(
  team: Team,
  fromBotId: string,
  params: { bot: string; text: string },
): { id: string; botId: string; text: string; fromBotId: string; fromBotName?: string } {
  const target = team.resolveBot(params.bot);
  const message = team.handoff({ fromBotId, toBotId: target.id, text: params.text });
  return {
    id: message.id,
    botId: message.botId,
    text: message.text,
    fromBotId: message.fromBotId ?? fromBotId,
    fromBotName: message.fromBotName,
  };
}

export function executePiBotSaveRoutine(
  team: Team,
  fromBotId: string,
  params: { name: string; instruction: string; bot?: string; schedule?: string },
) {
  const owner = params.bot ? team.resolveBot(params.bot) : team.requireBot(fromBotId);
  return team.createRoutine({
    botId: owner.id,
    name: params.name,
    instruction: params.instruction,
    schedule: params.schedule,
  });
}

export function executePiBotRunRoutine(team: Team, routineId: string) {
  return team.runRoutine(routineId);
}

export function executePiBotListRoutines(team: Team, botSpec?: string) {
  const botId = botSpec ? team.resolveBot(botSpec).id : undefined;
  return team.listRoutines(botId);
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
