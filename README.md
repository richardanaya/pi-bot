# pi-bot

A local, ultra-MVP web app that treats [pi](https://github.com/badlogic/pi-mono) coding-agent sessions as a **team of bots**, in the spirit of [Grok Bot](https://x.ai/news/introducing-grok-bot).

You hire named teammates, talk to the one you are focused on, save routines for that bot, and let bots hand work to each other. Everything runs on your machine. There is no remote desktop in this MVP.

```
┌─────────────┬──────────────────────────────┬──────────────┐
│ Bots        │ Chat (focused bot)           │ Routines     │
│  Hire       │  markdown, images, video     │  save / run  │
│  roster     │  inbound handoffs            │  per bot     │
└─────────────┴──────────────────────────────┴──────────────┘
```

## Quick start

Requires Node 22+ and a working pi setup under `~/.pi` (auth, models, settings).

```bash
npx pi-bot
```

Then open `http://127.0.0.1:3141`. The process binds localhost only.

From a checkout:

```bash
git clone git@github.com:richardanaya/pi-bot.git
cd pi-bot
npm install
npm run build
npm start
```

### Demo UI (no model calls)

```bash
npx pi-bot --demo
```

Demo mode still uses the real hire/roster/routine/handoff backend. It only stubs the model so you can click around, attach media, and watch markdown render.

## What maps to Grok Bot

Grok Bot is a team of always-on agents: you **hire** specialists, message them like coworkers, save **routines**, and let them **talk to each other** instead of making you the middleman.

pi-bot keeps those essentials:

| Grok Bot                         | pi-bot MVP                                             |
| -------------------------------- | ------------------------------------------------------ |
| Hire a named bot with a job      | Left pane **Hire** (or `pi_bot_hire`)                  |
| Chat with the focused teammate   | Middle pane, one conversation per bot                  |
| Teach / reuse a workflow         | Right pane **routines** (named instruction, run later) |
| Bots message each other          | `pi_bot_message` handoff appears on the receiving chat |
| Shared computer / remote desktop | Out of scope for this MVP                              |

Each hired bot is a pi `createAgentSession()` using **`~/.pi/agent`** as `agentDir` (pi's config under `~/.pi`: `settings.json`, `auth.json`, `models.json`).

## Inter-bot tools (`pi_bot_`)

Every session is given extra tools whose names start with `pi_bot_`:

- `pi_bot_hire` — hire a specialist onto the shared roster
- `pi_bot_list` — list the team
- `pi_bot_message` — hand a task to another bot (shows up as an inbound handoff in their chat)
- `pi_bot_save_routine` / `pi_bot_run_routine` / `pi_bot_list_routines` — reusable instructions bound to a bot

Handoffs are hop-limited so bots cannot loop forever.

## Chat media

The focused chat is a Lit web component. It renders GitHub-flavored markdown, including:

- `![alt](image.png)` as an inline image
- `![alt](clip.mp4)` (or other video URLs) as an inline `<video>`
- paste / attach image and video files (stored under `~/.pi/pi-bot/media`)

## CLI

```
npx pi-bot [options]

  --host <addr>       default 127.0.0.1
  --port <n>          default 3141 (0 = ephemeral)
  --demo              mock model replies
  --cwd <dir>         working directory for pi tools
  --data-dir <dir>    roster/media (default ~/.pi/pi-bot)
  --agent-dir <dir>   pi config (default ~/.pi/agent)
  --open              open a browser
```

Frontend and backend talk over a **WebSocket** at `/ws` (hire, focus, prompt, routines, live events). HTTP is only used to serve the UI, `/health`, and media uploads.

## Develop

```bash
npm install
npm run build
npm test
npm run format
```

`npm test` runs unit tests, a double launch of the real `dist/cli.js` entry over WebSocket, and Playwright against the demo UI.

## Layout of the code

- `src/server/team.ts` — hire/roster/focus/chat/routines/handoffs (no SDK, no HTTP)
- `src/server/tools.ts` — `pi_bot_*` tools on that team
- `src/server/pi-session.ts` — `createAgentSession` with `~/.pi` + those tools
- `src/server/ws.ts` / `http.ts` — local server
- `src/web/components/` — Lit panes (bots, chat, routines)

## Publish

The package name `pi-bot` is public on npm. `prepack` builds `dist/` so a publish always ships the CLI and bundled UI.

```bash
npm login
npm publish
```

After that, `npx pi-bot` installs from the registry.

## License

MIT © Richard Anaya
