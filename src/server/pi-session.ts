import { homedir } from "node:os";
import { join } from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  getAgentDir,
  SessionManager,
  type AgentSession,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import type { Bot } from "../shared/types.js";
import { teammatePrompt } from "./prompt.js";
import type { Team } from "./team.js";
import { createPiBotTools } from "./tools.js";

export interface StartedPiSession {
  session: AgentSession;
  agentDir: string;
  toolNames: () => string[];
  dispose: () => void;
}

export function resolveAgentDir(explicit?: string): string {
  if (explicit) return explicit;
  try {
    return getAgentDir();
  } catch {
    return join(homedir(), ".pi", "agent");
  }
}

export async function startPiBotSession(options: {
  bot: Bot;
  team: Team;
  cwd?: string;
  agentDir?: string;
}): Promise<StartedPiSession> {
  const cwd = options.cwd ?? process.cwd();
  const agentDir = resolveAgentDir(options.agentDir);
  const specs = createPiBotTools(options.team, options.bot.id);
  const customTools: ToolDefinition[] = specs.map((spec) =>
    defineTool({
      name: spec.name,
      label: spec.label,
      description: spec.description,
      promptSnippet: spec.promptSnippet,
      parameters: spec.parameters,
      execute: async (_toolCallId, params) => {
        const result = await spec.execute(params as Record<string, unknown>);
        return { content: [{ type: "text", text: result.text }], details: {} };
      },
    }),
  );

  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    appendSystemPromptOverride: (base) => [...base, teammatePrompt(options.bot)],
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd,
    agentDir,
    resourceLoader,
    customTools,
    tools: ["read", "bash", "edit", "write", ...specs.map((spec) => spec.name)],
    sessionManager: SessionManager.inMemory(cwd),
  });

  return {
    session,
    agentDir,
    toolNames: () => session.getActiveToolNames(),
    dispose: () => session.dispose(),
  };
}
