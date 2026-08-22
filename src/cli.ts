#!/usr/bin/env node
import { spawn } from "node:child_process";
import { defaultAgentDir, defaultDataDir, DEFAULT_HOST, DEFAULT_PORT } from "./paths.js";
import { startPiBot, type StartOptions } from "./server/app.js";

const help = `pi-bot — local Grok Bot-style team of pi coding agents

Usage:
  npx @richardanaya/pi-bot [options]

Options:
  --host <addr>       Bind address (default: ${DEFAULT_HOST}, local only)
  --port <n>          Port (default: ${DEFAULT_PORT}; 0 for ephemeral)
  --demo              Mock agents so you can exercise the UI without a model
  --cwd <dir>         Working directory for pi sessions (default: process cwd)
  --data-dir <dir>    Roster/media store (default: ${defaultDataDir()})
  --agent-dir <dir>   Pi config dir (default: ${defaultAgentDir()})
  --open              Open the UI in a browser
  -h, --help          Show this help

Pi sessions read models, auth, and settings from ~/.pi/agent.
Each bot gets extra tools prefixed pi_bot_ for hiring and cross-talk.
`;

async function main(argv: string[]): Promise<void> {
  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(help);
    return;
  }
  const options = parseArgs(argv);
  const running = await startPiBot(options);
  process.stdout.write(`pi-bot listening on ${running.url}\n`);
  process.stdout.write(`  demo      ${running.demo}\n`);
  process.stdout.write(`  agentDir  ${running.agentDir}\n`);
  if (options.open) openBrowser(running.url);

  installShutdown(running.close);
}

export function installShutdown(close: () => Promise<void>): void {
  let stopping = false;
  const stop = () => {
    if (stopping) {
      process.exit(1);
      return;
    }
    stopping = true;
    process.stdout.write("\npi-bot stopping\n");
    const force = setTimeout(() => process.exit(1), 1500);
    force.unref();
    void close()
      .catch((error: unknown) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      })
      .finally(() => {
        clearTimeout(force);
        process.exit(0);
      });
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

export function parseArgs(argv: string[]): StartOptions & { open?: boolean } {
  const options: StartOptions & { open?: boolean } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (!value) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return value;
    };
    switch (arg) {
      case "--host":
        options.host = next();
        break;
      case "--port":
        options.port = Number(next());
        break;
      case "--demo":
        options.demo = true;
        break;
      case "--cwd":
        options.cwd = next();
        break;
      case "--data-dir":
        options.dataDir = next();
        break;
      case "--agent-dir":
        options.agentDir = next();
        break;
      case "--open":
        options.open = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", url] : [url];
  spawn(command, args, { detached: true, stdio: "ignore" }).unref();
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
