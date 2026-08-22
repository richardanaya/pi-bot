import type { Attachment } from "../shared/types.js";
import { formatHandoffPrompt } from "./prompt.js";
import type { BotRuntime, RuntimeFactory } from "./runtime.js";
import type { Team } from "./team.js";

export class SessionPool {
  private readonly runtimes = new Map<string, BotRuntime>();
  private readonly pending = new Map<string, Promise<BotRuntime>>();
  private unsubscribe?: () => void;

  constructor(
    private readonly team: Team,
    private readonly factory: RuntimeFactory,
  ) {
    this.unsubscribe = team.subscribe((event) => {
      if (event.type === "bot") {
        if (this.runtimes.has(event.bot.id) || this.pending.has(event.bot.id)) return;
        if (event.bot.status === "error") return;
        void this.ensure(event.bot.id).catch((error: unknown) => {
          this.team.setStatus(event.bot.id, "error", errorMessage(error));
        });
      }
      if (event.type === "bot_removed") {
        this.disposeOne(event.botId);
      }
      if (event.type === "handoff") {
        const fromName = event.message.fromBotName ?? "teammate";
        void this.prompt(event.toBotId, formatHandoffPrompt(fromName, event.message.text)).catch(
          (error: unknown) => {
            this.team.setStatus(event.toBotId, "error", errorMessage(error));
          },
        );
      }
    });
  }

  async ensure(botId: string): Promise<BotRuntime> {
    const existing = this.runtimes.get(botId);
    if (existing) return existing;
    const inflight = this.pending.get(botId);
    if (inflight) return inflight;
    const created = this.factory.create(botId).then((runtime) => {
      this.runtimes.set(botId, runtime);
      this.pending.delete(botId);
      return runtime;
    });
    this.pending.set(
      botId,
      created.catch((error) => {
        this.pending.delete(botId);
        throw error;
      }),
    );
    return created;
  }

  async prompt(botId: string, text: string, attachments?: Attachment[]): Promise<void> {
    const runtime = await this.ensure(botId);
    await runtime.prompt({ text, attachments });
  }

  async abort(botId: string): Promise<void> {
    await this.runtimes.get(botId)?.abort();
  }

  dispose(): void {
    this.unsubscribe?.();
    for (const runtime of this.runtimes.values()) runtime.dispose();
    this.runtimes.clear();
  }

  private disposeOne(botId: string): void {
    const runtime = this.runtimes.get(botId);
    runtime?.dispose();
    this.runtimes.delete(botId);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
