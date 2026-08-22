import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { newId } from "../shared/ids.js";
import type { MediaStore } from "./media-store.js";
import type { BotRuntime, PromptInput, RuntimeFactory } from "./runtime.js";
import type { Team } from "./team.js";

export function createDemoFactory(
  team: Team,
  media: { chartUrl: string; clipUrl: string },
): RuntimeFactory {
  return {
    async create(botId: string): Promise<BotRuntime> {
      let aborted = false;
      return {
        async prompt(input: PromptInput) {
          aborted = false;
          team.setStatus(botId, "working");
          const bot = team.requireBot(botId);
          const reply = demoReply(bot.name, input, media);
          const message = team.appendMessage({
            botId,
            role: "assistant",
            text: "",
            streaming: true,
            attachments: input.attachments,
          });
          const instant = process.env.PI_BOT_DEMO_INSTANT === "1";
          if (instant) {
            if (!aborted) team.updateMessage(botId, message.id, { text: reply, streaming: false });
          } else {
            let text = "";
            for (const word of reply.split(/(\s+)/)) {
              if (aborted) break;
              text += word;
              team.updateMessage(botId, message.id, { text, streaming: true });
              await delay(12);
            }
            if (!aborted) team.updateMessage(botId, message.id, { text, streaming: false });
          }
          maybeHandoff(team, botId, input.text);
          team.setStatus(botId, aborted ? "idle" : "idle");
        },
        async abort() {
          aborted = true;
          team.setStatus(botId, "idle");
        },
        dispose() {
          aborted = true;
        },
      };
    },
  };
}

export function seedDemoMedia(store: MediaStore): { chartUrl: string; clipUrl: string } {
  const dir = store.dir;
  const chart = join(dir, "demo-chart.png");
  const clip = join(dir, "demo-clip.mp4");
  if (!existsSync(chart)) {
    const made = spawnSync(
      "ffmpeg",
      ["-y", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=1", "-frames:v", "1", chart],
      { encoding: "utf8" },
    );
    if (made.status !== 0) writeFileSync(chart, pngPixel());
  }
  if (!existsSync(clip)) {
    spawnSync(
      "ffmpeg",
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc=size=320x240:rate=10:duration=1",
        "-pix_fmt",
        "yuv420p",
        clip,
      ],
      { encoding: "utf8" },
    );
  }
  return {
    chartUrl: "/media/demo-chart.png",
    clipUrl: "/media/demo-clip.mp4",
  };
}

function maybeHandoff(team: Team, fromBotId: string, text: string): void {
  const match = text.match(/\b(?:message|ask|tell)\s+([^:]+):\s*([\s\S]+)/i);
  if (!match) return;
  const spec = match[1]?.trim();
  const body = match[2]?.trim();
  if (!spec || !body) return;
  try {
    const target = team.resolveBot(spec);
    team.handoff({ fromBotId, toBotId: target.id, text: body });
  } catch {
    // ignore unresolved demo handoff
  }
}

function demoReply(
  name: string,
  input: PromptInput,
  media: { chartUrl: string; clipUrl: string },
): string {
  const attachments = (input.attachments ?? [])
    .map((item) => `- ${item.kind}: [${item.name}](${item.url})`)
    .join("\n");
  return [
    `Hi — ${name} here. I have the note: **${escapeMd(input.text.trim() || "(empty)")}**.`,
    "",
    "## Next steps",
    "",
    "1. Keep this thread as the source of truth",
    "2. Hire a specialist with the left-pane **Hire** control when the work splits",
    "3. Hand off with `message OtherBot: please take this`",
    "",
    "```ts",
    `console.log(${JSON.stringify(input.text.slice(0, 40))});`,
    "```",
    "",
    `![Demo chart](${media.chartUrl})`,
    "",
    `Watch this clip:`,
    "",
    `![Demo clip](${media.clipUrl})`,
    attachments ? `\nAttached:\n${attachments}` : "",
    "",
    `_id ${newId("demo")}_`,
  ].join("\n");
}

function escapeMd(value: string): string {
  return value.replaceAll("*", "\\*").replaceAll("`", "\\`");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pngPixel(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}
