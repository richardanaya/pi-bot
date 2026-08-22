import { resolveComposerMention } from "../shared/mentions.js";
import type { Attachment, ChatMessage } from "../shared/types.js";
import type { Team } from "./team.js";

export type DispatchResult =
  | {
      kind: "mention";
      targetId: string;
      targetName: string;
      ask: string;
      inbound: ChatMessage;
    }
  | {
      kind: "prompt";
      botId: string;
      text: string;
      attachments?: Attachment[];
    };

export function dispatchComposerSend(
  team: Team,
  input: { fromBotId: string; text: string; attachments?: Attachment[] },
): DispatchResult {
  const hit = resolveComposerMention(input.text, team.listBots());
  if (hit && hit.bot.id !== input.fromBotId) {
    const inbound = team.handoff({
      fromBotId: input.fromBotId,
      toBotId: hit.bot.id,
      text: hit.ask,
    });
    return {
      kind: "mention",
      targetId: hit.bot.id,
      targetName: hit.bot.name,
      ask: hit.ask,
      inbound,
    };
  }
  team.resetHops(input.fromBotId);
  team.appendMessage({
    botId: input.fromBotId,
    role: "user",
    text: input.text,
    attachments: input.attachments,
  });
  return {
    kind: "prompt",
    botId: input.fromBotId,
    text: input.text,
    attachments: input.attachments,
  };
}
