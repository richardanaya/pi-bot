import { mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { newId } from "../shared/ids.js";
import { kindFromMime } from "../shared/media.js";
import type { Attachment } from "../shared/types.js";

const EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  "video/quicktime": ".mov",
};

export class MediaStore {
  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  save(input: { name: string; mimeType: string; bytes: Buffer }): Attachment {
    const kind = kindFromMime(input.mimeType);
    if (!kind) throw new Error(`Unsupported media type: ${input.mimeType}`);
    const id = newId("media");
    const ext = EXT[input.mimeType] ?? extname(input.name) ?? (kind === "video" ? ".mp4" : ".bin");
    const filename = `${id}${ext}`;
    writeFileSync(join(this.dir, filename), input.bytes);
    return {
      id,
      kind,
      url: `/media/${filename}`,
      mimeType: input.mimeType,
      name: input.name,
    };
  }
}
