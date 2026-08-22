import { createReadStream, existsSync, statSync, type Stats } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import type { MediaStore } from "./media-store.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".mov": "video/quicktime",
};

export interface HttpContext {
  webRoot: string;
  mediaDir: string;
  media: MediaStore;
  health: () => Record<string, unknown>;
}

export async function handleHttp(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: HttpContext,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, ctx.health());
      return;
    }
    if (req.method === "POST" && url.pathname === "/media") {
      await handleUpload(req, res, ctx.media);
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/media/")) {
      sendSafeFile(req, res, ctx.mediaDir, url.pathname.slice("/media/".length));
      return;
    }
    if (req.method === "GET") {
      const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      sendSafeFile(req, res, ctx.webRoot, file, join(ctx.webRoot, "index.html"));
      return;
    }
    res.writeHead(405).end("Method not allowed");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!res.headersSent) json(res, 400, { error: message });
  }
}

async function handleUpload(
  req: IncomingMessage,
  res: ServerResponse,
  media: MediaStore,
): Promise<void> {
  const raw = await readBody(req, 25 * 1024 * 1024);
  const body = JSON.parse(raw) as { name?: string; mimeType?: string; data?: string };
  if (!body.name || !body.mimeType || !body.data) {
    throw new Error("Expected { name, mimeType, data }");
  }
  const bytes = Buffer.from(body.data, "base64");
  const attachment = media.save({ name: body.name, mimeType: body.mimeType, bytes });
  json(res, 200, attachment);
}

function sendSafeFile(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  requested: string,
  fallback?: string,
): void {
  const target = safeJoin(root, requested);
  const file = target && existsSync(target) && statSync(target).isFile() ? target : fallback;
  if (!file || !existsSync(file)) {
    res.writeHead(404).end("Not found");
    return;
  }
  const stats = statSync(file);
  streamFile(
    req,
    res,
    file,
    stats,
    MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
  );
}

function safeJoin(root: string, requested: string): string | null {
  const resolved = resolve(root, normalize(requested));
  const rel = relative(root, resolved);
  if (rel.startsWith("..") || rel.startsWith(sep) || rel.includes(`..${sep}`)) return null;
  return resolved;
}

function streamFile(
  req: IncomingMessage,
  res: ServerResponse,
  file: string,
  stats: Stats,
  contentType: string,
): void {
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Accept-Ranges": "bytes",
    });
    createReadStream(file).pipe(res);
    return;
  }
  const match = range.match(/bytes=(\d*)-(\d*)/);
  if (!match) {
    res.writeHead(416).end();
    return;
  }
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : stats.size - 1;
  if (start > end || start >= stats.size) {
    res.writeHead(416, { "Content-Range": `bytes */${stats.size}` }).end();
    return;
  }
  res.writeHead(206, {
    "Content-Type": contentType,
    "Content-Length": end - start + 1,
    "Content-Range": `bytes ${start}-${end}/${stats.size}`,
    "Accept-Ranges": "bytes",
  });
  createReadStream(file, { start, end }).pipe(res);
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

function readBody(req: IncomingMessage, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > max) {
        reject(new Error("Upload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
