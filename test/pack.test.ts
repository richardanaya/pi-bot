import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("npm pack", () => {
  it("ships the executable CLI and UI, not tests or source maps", () => {
    expect(existsSync("dist/cli.js")).toBe(true);
    const shebang = readFileSync("dist/cli.js", "utf8").split("\n")[0];
    expect(shebang).toBe("#!/usr/bin/env node");

    const raw = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      encoding: "utf8",
    });
    const listing = JSON.parse(raw) as Array<{ files: Array<{ path: string; mode: number }> }>;
    const files = listing[0]?.files ?? [];
    const paths = files.map((file) => file.path);

    expect(paths).toContain("package.json");
    expect(paths).toContain("LICENSE");
    expect(paths).toContain("README.md");
    expect(paths).toContain("dist/cli.js");
    expect(paths).toContain("dist/web/index.html");
    expect(paths).toContain("dist/web/main.js");
    expect(paths).toContain("dist/web/styles.css");

    const cli = files.find((file) => file.path === "dist/cli.js");
    expect(cli?.mode & 0o111).toBeTruthy();

    expect(paths.some((path) => path.startsWith("src/"))).toBe(false);
    expect(paths.some((path) => path.startsWith("test/"))).toBe(false);
    expect(paths.some((path) => path.endsWith(".map"))).toBe(false);
    expect(paths.some((path) => path.endsWith(".d.ts"))).toBe(false);
  });
});
