import type { IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { encodeFrame, parseClientFrame, type ServerFrame } from "../shared/protocol.js";
import type { SessionPool } from "./pool.js";
import type { Team } from "./team.js";

export interface WsContext {
  team: Team;
  pool: SessionPool;
  demo: boolean;
  cwd: string;
  agentDir: string;
}

export function attachWebsocket(
  server: import("node:http").Server,
  ctx: WsContext,
): { close: () => Promise<void> } {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Set<WebSocket>();

  const send = (socket: WebSocket, frame: ServerFrame) => {
    if (socket.readyState === socket.OPEN) socket.send(encodeFrame(frame));
  };

  const broadcast = (frame: ServerFrame) => {
    const payload = encodeFrame(frame);
    for (const client of clients) {
      if (client.readyState === client.OPEN) client.send(payload);
    }
  };

  ctx.team.subscribe((event) => {
    switch (event.type) {
      case "bot":
      case "status":
        broadcast({ type: "bot", bot: event.bot });
        break;
      case "bot_removed":
        broadcast({ type: "bot_removed", botId: event.botId });
        break;
      case "focus":
        broadcast({ type: "focus", botId: event.botId });
        break;
      case "message":
        broadcast({ type: "message", botId: event.botId, message: event.message });
        break;
      case "routine":
        broadcast({ type: "routine", routine: event.routine });
        break;
      case "routine_removed":
        broadcast({ type: "routine_removed", routineId: event.routineId });
        break;
      default:
        break;
    }
  });

  wss.on("connection", (socket: WebSocket, _req: IncomingMessage) => {
    clients.add(socket);
    send(socket, {
      type: "hello",
      demo: ctx.demo,
      cwd: ctx.cwd,
      agentDir: ctx.agentDir,
    });
    send(socket, { type: "snapshot", snapshot: ctx.team.snapshot() });

    socket.on("message", (data) => {
      void (async () => {
        try {
          const frame = parseClientFrame(String(data));
          await handleFrame(frame, ctx);
        } catch (error) {
          send(socket, {
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      })();
    });
    socket.on("close", () => clients.delete(socket));
  });

  return {
    close: () =>
      new Promise((resolve) => {
        for (const client of wss.clients) client.terminate();
        for (const client of clients) client.terminate();
        wss.close(() => resolve());
      }),
  };
}

async function handleFrame(
  frame: import("../shared/protocol.js").ClientFrame,
  ctx: WsContext,
): Promise<void> {
  const { team, pool } = ctx;
  switch (frame.type) {
    case "hire": {
      const bot = team.hire({
        name: frame.name,
        job: frame.job,
        instructions: frame.instructions,
      });
      try {
        await pool.ensure(bot.id);
      } catch (error) {
        team.setStatus(bot.id, "error", error instanceof Error ? error.message : String(error));
      }
      return;
    }
    case "fire":
      team.fire(frame.botId);
      return;
    case "focus":
      team.focus(frame.botId);
      try {
        await pool.ensure(frame.botId);
      } catch (error) {
        team.setStatus(
          frame.botId,
          "error",
          error instanceof Error ? error.message : String(error),
        );
      }
      return;
    case "prompt": {
      team.resetHops(frame.botId);
      team.appendMessage({
        botId: frame.botId,
        role: "user",
        text: frame.text,
        attachments: frame.attachments,
      });
      await pool.prompt(frame.botId, frame.text, frame.attachments);
      return;
    }
    case "abort":
      await pool.abort(frame.botId);
      return;
    case "create_routine":
      team.createRoutine({
        botId: frame.botId,
        name: frame.name,
        instruction: frame.instruction,
      });
      return;
    case "run_routine": {
      const { routine } = team.runRoutine(frame.routineId);
      await pool.prompt(routine.botId, routine.instruction);
      return;
    }
    case "delete_routine":
      team.deleteRoutine(frame.routineId);
      return;
    default:
      throw new Error("Unknown client frame");
  }
}
