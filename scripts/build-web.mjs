import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = join(root, "dist", "web");

mkdirSync(outdir, { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [join(root, "src", "web", "main.ts")],
  bundle: true,
  format: "esm",
  sourcemap: true,
  outdir,
  platform: "browser",
  target: "es2022",
  logLevel: "info",
});

cpSync(join(root, "src", "web", "index.html"), join(outdir, "index.html"));
cpSync(join(root, "src", "web", "styles.css"), join(outdir, "styles.css"));
