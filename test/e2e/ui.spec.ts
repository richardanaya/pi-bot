import { expect, test, type Page } from "@playwright/test";
import { WebSocket } from "ws";

test("the app shell fits the window without document scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("bots-pane")).toBeVisible();
  const metrics = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const shell = document.querySelector("app-shell");
    return {
      htmlScroll: html.scrollHeight,
      htmlClient: html.clientHeight,
      bodyScroll: body.scrollHeight,
      bodyClient: body.clientHeight,
      shellHeight: shell?.getBoundingClientRect().height ?? 0,
      innerHeight: window.innerHeight,
    };
  });
  expect(metrics.htmlScroll, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.htmlClient);
  expect(metrics.bodyScroll, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.bodyClient);
  expect(metrics.shellHeight, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.innerHeight);
});

test("three panes, hire, markdown media, and routines", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByTestId("bots-pane")).toBeVisible();
  await expect(page.getByTestId("chat-pane")).toBeVisible();
  await expect(page.getByTestId("routines-pane")).toBeVisible();

  const botName = "Playwright Scout";
  const job = "Find UI regressions";
  await page.getByTestId("bots-header").hover();
  await page.getByTestId("hire-button").click();
  await page.getByTestId("hire-name").fill(botName);
  await page.getByTestId("hire-job").fill(job);
  await page.getByTestId("hire-submit").click();
  await expect(page.locator(`[data-bot-name="${botName}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-bot-name="${botName}"]`)).toHaveAttribute("data-status", "idle");
  await expect(
    page.locator(`[data-bot-name="${botName}"]`).getByTestId("bot-status"),
  ).toHaveAttribute("data-status", "idle");
  await expect(page.getByTestId("stop-bot")).toHaveCount(0);
  await expect(page.getByTestId("chat-pane")).toContainText(botName);

  await expect(page.getByTestId("routines-pane")).toBeVisible();
  await expect(page.locator("[data-testid='routine-name']")).toHaveCount(0);

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

test("tool chip expands to show input and output", async ({ page }) => {
  await page.goto("/");
  await hire(page, "Mechanic", "Inspect tools");
  const note = "inspect the valve seating";
  await page.getByTestId("composer-input").fill(note);
  await page.getByTestId("send-button").click();
  const chip = page.getByTestId("tool-summary").first();
  await expect(chip).toContainText("read");
  await expect(chip).not.toContainText("notes.md");
  await chip.click();
  await expect(page.getByTestId("tool-input").first()).toContainText("notes.md");
  await expect(page.getByTestId("tool-output").first()).toContainText(note);
});

test("cross-bot handoff appears on the receiving chat", async ({ page }) => {
  await page.goto("/");
  await hire(page, "Chief", "Coordinate the team");
  await hire(page, "Researcher", "Look things up");
  await page.locator('[data-bot-name="Chief"]').click();
  await page.getByTestId("composer-input").fill("message Researcher: please summarize the repo");
  await page.getByTestId("send-button").click();
  await page.locator('[data-bot-name="Researcher"]').click();
  const chrome = page.getByTestId("handoff-chrome").first();
  await expect(chrome).toBeVisible();
  await expect(page.getByTestId("handoff-summary").first()).toContainText("Chief");
  await expect(page.getByTestId("handoff-summary").first()).not.toContainText(
    "please summarize the repo",
  );
  await page.getByTestId("handoff-summary").first().click();
  await expect(page.getByTestId("handoff-body").first()).toContainText("please summarize the repo");
});

test("@mention autocomplete lists roster bots", async ({ page }) => {
  await page.goto("/");
  await hire(page, "MentionPicker Lead", "Route work");
  await hire(page, "MentionPicker Poet", "Write poems");
  const poet = page.locator('[data-testid="bot-row"][data-bot-name="MentionPicker Poet"]');
  await page.locator('[data-testid="bot-row"][data-bot-name="MentionPicker Lead"]').click();
  const input = page.getByTestId("composer-input");
  await input.click();
  await page.keyboard.type("@");
  const menu = page.getByTestId("mention-menu");
  await expect(menu).toBeVisible();
  await expect(
    menu.getByTestId("mention-option").filter({ hasText: "@MentionPicker Poet" }),
  ).toBeVisible();
  await page.keyboard.type("Poet");
  await expect(poet).toHaveAttribute("data-mention", "true");
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue("@MentionPicker Poet ");
  await expect(menu).toHaveCount(0);
});

test("@mention sends to the named bot as compact expandable chrome", async ({ page }) => {
  await page.goto("/");
  await hire(page, "Coordinator", "Route work");
  await hire(page, "PoemMaker", "Write poems");
  await page.locator('[data-testid="bot-row"][data-bot-name="Coordinator"]').click();
  const ask = "Hey @PoemMaker, make a poem";
  await page.getByTestId("composer-input").fill(ask);
  await page.getByTestId("send-button").click();

  const summary = page.getByTestId("handoff-summary").first();
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("PoemMaker");
  await expect(summary).not.toContainText("make a poem");
  await expect(page.locator("[data-role='user']")).toHaveCount(0);

  await summary.click();
  await expect(page.getByTestId("handoff-body").first()).toContainText("make a poem");

  await page.locator('[data-testid="bot-row"][data-bot-name="PoemMaker"]').click();
  const inbound = page.getByTestId("handoff-summary").first();
  await expect(inbound).toBeVisible();
  await expect(inbound).not.toContainText("make a poem");
  await inbound.click();
  await expect(page.getByTestId("handoff-body").first()).toContainText("make a poem");
  await page.screenshot({ path: "test-results/mention-ui.png", fullPage: true });
});

test("routine schedule is editable in the sidebar", async ({ page }) => {
  await page.goto("/");
  await hire(page, "Ops", "Keep the lights on");
  const botId = await page.locator('[data-bot-name="Ops"]').getAttribute("data-bot-id");
  expect(botId).toBeTruthy();
  const host = new URL(page.url()).host;
  const ws = await openAppSocket(host);
  try {
    ws.send(
      JSON.stringify({
        type: "create_routine",
        botId,
        name: "Morning briefing",
        instruction: "Summarize overnight mail",
      }),
    );
    const row = page.getByTestId("routine-row").filter({ hasText: "Morning briefing" });
    await expect(row).toBeVisible();
    await row.hover();
    await row.getByTestId("routine-clock").click();
    const schedule = page.getByTestId("routine-schedule");
    await expect(schedule).toBeVisible();
    await expect(schedule).toHaveValue("");
    await schedule.fill("0 9 * * *");
    await schedule.dispatchEvent("change");
    await expect(schedule).toHaveValue("0 9 * * *");
  } finally {
    ws.close();
  }
});

test("pins a bot to the top and groups another", async ({ page }) => {
  await page.goto("/");
  await hire(page, "PinTop Inbox", "Mail");
  await hire(page, "PinTop Chief", "Coordinate");
  const chief = page.locator('[data-bot-name="PinTop Chief"]');
  await chief.getByTestId("bot-name-line").hover();
  await chief.getByTestId("bot-gear").click();
  await page.getByTestId("menu-pin").click();
  await expect(chief).toHaveAttribute("data-pinned", "true");
  const pinned = page.locator('[data-section="pinned"]');
  await expect(pinned.getByTestId("section-title")).toContainText("Pinned");
  await expect(pinned.locator('[data-bot-name="PinTop Chief"]')).toBeVisible();

  const inbox = page.locator('[data-bot-name="PinTop Inbox"]');
  await inbox.getByTestId("bot-name-line").hover();
  await inbox.getByTestId("bot-gear").click();
  await page.getByTestId("menu-new-group").click();
  const nameInput = page.getByTestId("group-name-input");
  await expect(nameInput).toBeVisible();
  await nameInput.fill("Field Ops");
  await nameInput.press("Enter");
  await expect(page.getByTestId("section-title").filter({ hasText: "Field Ops" })).toBeVisible();
  const groupId = await page.locator("[data-section^='grp_']").last().getAttribute("data-section");
  expect(groupId).toMatch(/^grp_/);
  await expect(
    page.locator(`[data-section="${groupId}"] [data-bot-name="PinTop Inbox"]`),
  ).toBeVisible();
});

test("edit bot details from the gear menu", async ({ page }) => {
  await page.goto("/");
  await hire(page, "Draft Bot", "Old job");
  const row = page.locator('[data-bot-name="Draft Bot"]');
  await row.getByTestId("bot-name-line").hover();
  await row.getByTestId("bot-gear").click();
  await page.getByTestId("menu-edit").click();
  const dialog = page.getByTestId("hire-dialog");
  await expect(dialog).toContainText("Edit bot");
  await expect(page.getByTestId("hire-name")).toHaveValue("Draft Bot");
  await page.getByTestId("hire-name").fill("Final Bot");
  await page.getByTestId("hire-job").fill("New job");
  await page.getByTestId("hire-instructions").fill("Be thorough");
  await page.getByTestId("hire-submit").click();
  await expect(page.locator('[data-bot-name="Final Bot"]')).toHaveCount(1);
  await expect(page.locator('[data-bot-name="Draft Bot"]')).toHaveCount(0);
  await expect(page.locator('[data-bot-name="Final Bot"]')).toContainText("New job");
});

test("delete bot from the gear menu after confirm", async ({ page }) => {
  await page.goto("/");
  await hire(page, "Stay Put", "Remain");
  await hire(page, "Temp Hire", "Leave");
  const row = page.locator('[data-bot-name="Temp Hire"]');
  await row.getByTestId("bot-name-line").hover();
  await row.getByTestId("bot-gear").click();
  await page.getByTestId("menu-delete-bot").click();
  const dialog = page.getByTestId("delete-confirm-dialog");
  await expect(dialog).toContainText("Temp Hire");
  await expect(dialog).toContainText("chat and routines will be removed");
  await page.getByTestId("cancel-delete").click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeVisible();

  await row.getByTestId("bot-name-line").hover();
  await row.getByTestId("bot-gear").click();
  await page.getByTestId("menu-delete-bot").click();
  await page.getByTestId("confirm-delete").click();
  await expect(page.locator('[data-bot-name="Temp Hire"]')).toHaveCount(0);
  await expect(page.locator('[data-bot-name="Stay Put"]')).toHaveCount(1);
});

async function openAppSocket(host: string): Promise<WebSocket> {
  const ws = new WebSocket(`ws://${host}/ws`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  return ws;
}

async function hire(page: Page, name: string, job: string): Promise<void> {
  await page.getByTestId("bots-header").hover();
  await page.getByTestId("hire-button").click();
  await page.getByTestId("hire-name").fill(name);
  await page.getByTestId("hire-job").fill(job);
  await page.getByTestId("hire-submit").click();
  await expect(page.locator(`[data-bot-name="${name}"]`)).toHaveCount(1);
}
