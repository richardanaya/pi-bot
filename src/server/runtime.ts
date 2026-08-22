import type { Attachment } from "../shared/types.js";

export interface PromptInput {
  text: string;
  attachments?: Attachment[];
}

export interface BotRuntime {
  prompt(input: PromptInput): Promise<void>;
  abort(): Promise<void>;
  dispose(): void;
}

export interface RuntimeFactory {
  create(botId: string): Promise<BotRuntime>;
}
