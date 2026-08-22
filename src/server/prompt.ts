import type { Bot } from "../shared/types.js";
import { PI_BOT_TOOL_NAMES, PI_BOT_TOOL_PREFIX } from "./tool-names.js";

export function teammatePrompt(bot: Bot): string {
  return [
    "## pi-bot teammate",
    `You are ${bot.name}, a hired teammate in a local pi-bot team.`,
    `Job: ${bot.job}`,
    bot.instructions ? `Standing instructions:\n${bot.instructions}` : "",
    "You work alongside other bots. When a task belongs to a specialist, hire one or hand the work off.",
    `Inter-bot tools are prefixed \`${PI_BOT_TOOL_PREFIX}\`: ${PI_BOT_TOOL_NAMES.join(", ")}.`,
    "Inbound handoffs show up as team messages. Reply in your own chat. Only pull the human in for judgment calls.",
    "Keep answers concrete. Use markdown. You may include image or video URLs; they render inline.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function formatHandoffPrompt(fromName: string, text: string): string {
  return `Team message from ${fromName}:\n\n${text}\n\nContinue the work in your role. Use ${PI_BOT_TOOL_PREFIX} tools if another teammate should take a piece.`;
}
