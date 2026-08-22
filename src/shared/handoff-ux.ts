import type { ChatMessage } from "./types.js";

export interface HandoffPresentation {
  collapsedLabel: string;
  body: string;
  expanded: boolean;
}

export function presentHandoff(
  message: ChatMessage,
  options?: { expanded?: boolean },
): HandoffPresentation {
  const from = message.fromBotName?.trim() || "teammate";
  const to = message.toBotName?.trim();
  const collapsedLabel = to ? `${from} → ${to}` : `From ${from}`;
  return {
    collapsedLabel,
    body: message.text,
    expanded: Boolean(options?.expanded),
  };
}

export function isHandoffMessage(message: ChatMessage): boolean {
  return message.role === "handoff";
}
