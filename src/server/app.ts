import { createServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultAgentDir, defaultDataDir, DEFAULT_HOST, DEFAULT_PORT } from "../paths.js";
import { createDemoFactory, seedDemoMedia } from "./demo.js";
import { handleHttp } from "./http.js";
import { MediaStore } from "./media-store.js";
import { createPiRuntimeFactory } from "./pi-runtime.js";
import { resolveAgentDir } from "./pi-session.js";
import { SessionPool } from "./pool.js";
import { persistTeam } from "./store.js";
import { Team } from "./team.js";
import { attachWebsocket } from "./ws.js";

export interface StartOptions {
  host?: string;
  port?: number;
  demo?: boolean;
  cwd?: string;
  dataDir?: string;
  agentDir?: string;
}

export interface RunningServer {
  url: string;
  host: string;
  port: number;
  demo: boolean;
  agentDir: string;
  close: () => Promise<void>;
}

export async function startPiBot(options: StartOptions = {}): Promise<RunningServer> {
  const host = options.host ?? DEFAULT_HOST;
  const requestedPort = options.port ?? DEFAULT_PORT;
  const demo = options.demo ?? false;
  const cwd = options.cwd ?? process.cwd();
  const dataDir = options.dataDir ?? defaultDataDir();
  const agentDir = resolveAgentDir(options.agentDir ?? defaultAgentDir());
  const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "web");

  const team = new Team();
  persistTeam(dataDir, team);
  const media = new MediaStore(join(dataDir, "media"));
  const factory = demo
    ? createDemoFactory(team, seedDemoMedia(media))
    : createPiRuntimeFactory(team, { cwd, agentDir, mediaDir: media.dir });
  const pool = new SessionPool(team, factory);

  const server = createServer((req, res) => {
    void handleHttp(req, res, {
      webRoot,
      mediaDir: media.dir,
      media,
      health: () => ({
        ok: true,
        demo,
        cwd,
        agentDir,
        bots: team.listBots().length,
      }),
    });
  });

  attachWebsocket(server, { team, pool, demo, cwd, agentDir });
  const port = await listen(server, host, requestedPort);
  const url = `http://${host}:${port}`;

  return {
    url,
    host,
    port,
    demo,
    agentDir,
    close: () =>
      new Promise((resolve, reject) => {
        pool.dispose();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function listen(server: Server, host: string, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind HTTP server"));
        return;
      }
      resolve(address.port);
    });
    server.on("error", reject);
  });
}
