import { expect, test, type Page } from "@playwright/test";

test("three panes, hire, markdown media, and routines", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByTestId("bots-pane")).toBeVisible();
  await expect(page.getByTestId("chat-pane")).toBeVisible();
  await expect(page.getByTestId("routines-pane")).toBeVisible();

  const botName = "Playwright Scout";
  const job = "Find UI regressions";
  await page.getByTestId("hire-button").click();
  await page.getByTestId("hire-name").fill(botName);
  await page.getByTestId("hire-job").fill(job);
  await page.getByTestId("hire-submit").click();
  await expect(page.locator(`[data-bot-name="${botName}"]`)).toHaveCount(1);
  await expect(page.getByRole("heading", { name: botName })).toBeVisible();
  await expect(page.getByTestId("chat-pane")).toContainText(botName);

  const routineName = "UI sweep";
  const instruction = `Walk the ${botName} panes`;
  await page.getByTestId("routine-name").fill(routineName);
  await page.getByTestId("routine-instruction").fill(instruction);
  await page.getByTestId("routine-create").click();
  await expect(page.getByTestId("routine-row").filter({ hasText: routineName })).toBeVisible();
  await expect(page.getByTestId("routine-row")).toContainText(instruction);

  await page.getByTestId("composer-input").fill(`Hello from ${botName}`);
  await page.getByTestId("send-button").click();
  await expect(page.locator("chat-message img, chat-message video")).toHaveCount(2, {
    timeout: 15_000,
  });
  await expect(page.locator("chat-message video")).toBeVisible();
  await expect(page.locator("chat-message img")).toBeVisible();

  await page.screenshot({ path: "test-results/ui.png", fullPage: true });
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});

test("cross-bot handoff appears on the receiving chat", async ({ page }) => {
  await page.goto("/");
  await hire(page, "Chief", "Coordinate the team");
  await hire(page, "Researcher", "Look things up");
  await page.locator('[data-bot-name="Chief"]').click();
  await page.getByTestId("composer-input").fill("message Researcher: please summarize the repo");
  await page.getByTestId("send-button").click();
  await page.locator('[data-bot-name="Researcher"]').click();
  await expect(page.getByTestId("chat-pane")).toContainText("please summarize the repo");
  await expect(page.getByTestId("chat-pane")).toContainText("Chief");
});

async function hire(page: Page, name: string, job: string): Promise<void> {
  await page.getByTestId("hire-button").click();
  await page.getByTestId("hire-name").fill(name);
  await page.getByTestId("hire-job").fill(job);
  await page.getByTestId("hire-submit").click();
  await expect(page.locator(`[data-bot-name="${name}"]`)).toHaveCount(1);
}
