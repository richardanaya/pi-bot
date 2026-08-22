import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import type { Bot } from "../../shared/types.js";

@customElement("bot-list")
export class BotList extends LitElement {
  @property({ attribute: false }) bots: Bot[] = [];
  @property({ type: String }) focusedId: string | null = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      overflow: hidden;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 16px 16px 12px;
    }
    h1 {
      margin: 0;
      font-size: 15px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 650;
    }
    button.hire {
      background: var(--accent);
      color: #0b1220;
      border: 0;
      border-radius: 999px;
      padding: 8px 12px;
      font-weight: 650;
      cursor: pointer;
    }
    .list {
      overflow: auto;
      padding: 0 8px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .row {
      display: grid;
      grid-template-columns: 36px 1fr;
      gap: 10px;
      padding: 10px;
      border-radius: 12px;
      border: 1px solid transparent;
      cursor: pointer;
      text-align: left;
      background: transparent;
      color: inherit;
      width: 100%;
    }
    .row:hover {
      background: var(--panel-2);
    }
    .row.active {
      background: var(--panel-2);
      border-color: var(--line);
    }
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: #262833;
      font-weight: 700;
      position: relative;
    }
    .dot {
      position: absolute;
      right: -2px;
      bottom: -2px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid var(--panel);
      background: var(--muted);
    }
    .dot.idle {
      background: var(--ok);
    }
    .dot.working {
      background: var(--accent-2);
    }
    .dot.error {
      background: var(--danger);
    }
    .name {
      font-weight: 650;
    }
    .job {
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .empty {
      color: var(--muted);
      padding: 24px 16px;
      font-size: 13px;
    }
  `;

  render() {
    return html`
      <header>
        <h1>Bots</h1>
        <button class="hire" data-testid="hire-button" @click=${this.onHire}>Hire</button>
      </header>
      <div class="list" data-testid="bots-pane">
        ${
          this.bots.length === 0
            ? html`<div class="empty">No bots yet. Hire a teammate to start a thread.</div>`
            : this.bots.map((bot) => this.row(bot))
        }
      </div>
    `;
  }

  private row(bot: Bot) {
    return html`
      <button
        class=${classMap({ row: true, active: bot.id === this.focusedId })}
        data-testid="bot-row"
        data-bot-id=${bot.id}
        data-bot-name=${bot.name}
        @click=${() => this.onFocus(bot.id)}
      >
        <div class="avatar">
          ${initials(bot.name)}
          <span class="dot ${bot.status}"></span>
        </div>
        <div>
          <div class="name">${bot.name}</div>
          <div class="job">${bot.job}</div>
        </div>
      </button>
    `;
  }

  private onHire() {
    this.dispatchEvent(new CustomEvent("hire-click", { bubbles: true, composed: true }));
  }

  private onFocus(botId: string) {
    this.dispatchEvent(
      new CustomEvent("focus-bot", { detail: { botId }, bubbles: true, composed: true }),
    );
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

declare global {
  interface HTMLElementTagNameMap {
    "bot-list": BotList;
  }
}
