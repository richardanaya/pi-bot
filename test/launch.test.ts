import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { ClientFrame, ServerFrame } from "../src/shared/protocol.js";
import type { TeamSnapshot } from "../src/shared/types.js";

describe("npm entry websocket launch", () => {
  it("hires a bot and creates a routine twice on a fresh server", async () => {
    const first = await runLaunch("Launch One");
    const second = await runLaunch("Launch Two");
    expect(first.botName).toBe("Launch One");
    expect(second.botName).toBe("Launch Two");
    expect(first.routineName).toBe(routineNameFor("Launch One"));
    expect(second.routineName).toBe(routineNameFor("Launch Two"));
    expect(first.bots).toContain("Launch One");
    expect(second.bots).toContain("Launch Two");
    expect(first.routines).toContain(first.routineName);
    expect(second.routines).toContain(second.routineName);
  });
});

function routineNameFor(botName: string): string {
  return `${botName} standup`;
}

async function runLaunch(botName: string): Promise<{
  botName: string;
  routineName: string;
  bots: string[];
  routines: string[];
}> {
  const dataDir = mkdtempSync(join(tmpdir(), "pi-bot-launch-"));
  const port = await freePort();
  const child = spawn(
    process.execPath,
    ["dist/cli.js", "--demo", "--host", "127.0.0.1", "--port", String(port), "--data-dir", dataDir],
    { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
  );
  const logs: string[] = [];
  child.stdout?.on("data", (chunk) => logs.push(String(chunk)));
  child.stderr?.on("data", (chunk) => logs.push(String(chunk)));
  try {
    await waitForHealth(port);
    const ws = await openWs(port);
    try {
      await waitFor(ws, (frame) => frame.type === "hello");
      const hireJob = `Job for ${botName}`;
      send(ws, { type: "hire", name: botName, job: hireJob });
      const hired = await waitFor(
        ws,
        (frame) => frame.type === "bot" && frame.bot.name === botName,
      );
      if (hired.type !== "bot") throw new Error("expected bot");
      expect(hired.bot.job).toBe(hireJob);

      const routineName = routineNameFor(botName);
      const instruction = `Write notes for ${botName}`;
      send(ws, {
        type: "create_routine",
        botId: hired.bot.id,
        name: routineName,
        instruction,
      });
      const created = await waitFor(
        ws,
        (frame) => frame.type === "routine" && frame.routine.name === routineName,
      );
      if (created.type !== "routine") throw new Error("expected routine");
      expect(created.routine.instruction).toBe(instruction);
      expect(created.routine.botId).toBe(hired.bot.id);

      const snapshot = await fetchSnapshot(port);
      return {
        botName,
        routineName,
        bots: snapshot.bots.map((bot) => bot.name),
        routines: snapshot.routines.map((routine) => routine.name),
      };
    } finally {
      ws.close();
    }
  } catch (error) {
    throw new Error(`${String(error)}\n${logs.join("")}`);
  } finally {
    await stop(child);
  }
}

async function fetchSnapshot(port: number): Promise<TeamSnapshot> {
  const ws = await openWs(port);
  try {
    const helloOrSnap = await waitFor(ws, (frame) => frame.type === "snapshot");
    if (helloOrSnap.type !== "snapshot") throw new Error("expected snapshot");
    return helloOrSnap.snapshot;
  } finally {
    ws.close();
  }
}

function send(ws: WebSocket, frame: ClientFrame): void {
  ws.send(JSON.stringify(frame));
}

function openWs(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function waitFor(ws: WebSocket, match: (frame: ServerFrame) => boolean): Promise<ServerFrame> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("timed out waiting for websocket frame")),
      10_000,
    );
    const onMessage = (data: WebSocket.RawData) => {
      const frame = JSON.parse(String(data)) as ServerFrame;
      if (match(frame)) {
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve(frame);
      }
    };
    ws.on("message", onMessage);
  });
}

async function waitForHealth(port: number): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        const body = (await response.json()) as { ok?: boolean };
        if (body.ok) return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("server never became healthy");
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("no port"));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
    server.on("error", reject);
  });
}

function stop(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 1000).unref();
  });
}
