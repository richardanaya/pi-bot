import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Attachment } from "../shared/types.js";
import { startPiBotSession } from "./pi-session.js";
import type { BotRuntime, PromptInput, RuntimeFactory } from "./runtime.js";
import type { Team } from "./team.js";

export function createPiRuntimeFactory(
  team: Team,
  options: { cwd: string; agentDir: string; mediaDir: string },
): RuntimeFactory {
  return {
    async create(botId: string): Promise<BotRuntime> {
      const bot = team.requireBot(botId);
      const started = await startPiBotSession({
        bot,
        team,
        cwd: options.cwd,
        agentDir: options.agentDir,
      });
      const session = started.session;
      const streaming = new Map<string, string>();

      const unsubscribe = session.subscribe((event) => {
        if (event.type === "agent_start") {
          team.setStatus(bot.id, "working");
        }
        if (event.type === "agent_settled") {
          team.setStatus(bot.id, "idle");
        }
        if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
          const delta = event.assistantMessageEvent.delta;
          let messageId = streaming.get(bot.id);
          if (!messageId) {
            const message = team.appendMessage({
              botId: bot.id,
              role: "assistant",
              text: delta,
              streaming: true,
            });
            streaming.set(bot.id, message.id);
          } else {
            const current = team.chat(bot.id).find((item) => item.id === messageId);
            team.updateMessage(bot.id, messageId, {
              text: (current?.text ?? "") + delta,
              streaming: true,
            });
          }
        }
        if (event.type === "tool_execution_start") {
          team.appendMessage({
            botId: bot.id,
            role: "tool",
            text: `Using ${event.toolName}`,
            toolName: event.toolName,
          });
        }
        if (event.type === "agent_end" || event.type === "agent_settled") {
          const messageId = streaming.get(bot.id);
          if (messageId) {
            team.updateMessage(bot.id, messageId, { streaming: false });
            streaming.delete(bot.id);
          }
        }
      });

      return {
        async prompt(input: PromptInput) {
          const images = await loadImages(options.mediaDir, input.attachments ?? []);
          const text = composePrompt(input);
          await session.prompt(text, images.length > 0 ? { images } : undefined);
        },
        async abort() {
          await session.abort();
        },
        dispose() {
          unsubscribe();
          started.dispose();
        },
      };
    },
  };
}

function composePrompt(input: PromptInput): string {
  const mediaLines = (input.attachments ?? [])
    .filter((item) => item.kind === "video")
    .map((item) => `Attached video: ${item.url} (${item.name})`);
  return [input.text, ...mediaLines].filter(Boolean).join("\n\n");
}

async function loadImages(
  mediaDir: string,
  attachments: Attachment[],
): Promise<Array<{ type: "image"; data: string; mimeType: string }>> {
  const images: Array<{ type: "image"; data: string; mimeType: string }> = [];
  for (const item of attachments) {
    if (item.kind !== "image") continue;
    const filename = item.url.replace(/^\/media\//, "");
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) continue;
    const bytes = await readFile(join(mediaDir, filename));
    images.push({
      type: "image",
      data: bytes.toString("base64"),
      mimeType: item.mimeType || mimeFromName(filename),
    });
  }
  return images;
}

function mimeFromName(name: string): string {
  switch (extname(name).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "image/png";
  }
}
