import type { ChatMessage } from "./types.js";

const MAX_CHARS = 32_000;

export interface ToolPresentation {
  name: string;
  input: string;
  output: string;
  pending: boolean;
  isError: boolean;
}

export function formatToolPayload(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return clip(value);
  try {
    return clip(JSON.stringify(value, null, 2));
  } catch {
    return clip(String(value));
  }
}

export function presentToolUse(message: ChatMessage): ToolPresentation {
  const output =
    message.toolOutput !== undefined
      ? formatToolPayload(message.toolOutput)
      : message.toolError
        ? "Error"
        : "";
  return {
    name: message.toolName?.trim() || "tool",
    input: formatToolPayload(message.toolInput),
    output,
    pending: message.toolOutput === undefined && !message.toolError,
    isError: Boolean(message.toolError),
  };
}

function clip(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  return `${text.slice(0, MAX_CHARS)}\n…truncated`;
}
