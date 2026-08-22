import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:13141",
    headless: true,
    trace: "off",
    viewport: { width: 1400, height: 900 },
  },
  webServer: {
    command:
      "rm -rf .pi-bot-e2e && node dist/cli.js --demo --host 127.0.0.1 --port 13141 --data-dir .pi-bot-e2e",
    url: "http://127.0.0.1:13141/health",
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PI_BOT_DEMO_INSTANT: "1",
    },
  },
});
