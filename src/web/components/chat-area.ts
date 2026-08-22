import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import type { Bot, ChatMessage } from "../../shared/types.js";
import "./chat-message.js";
import "./composer.js";

@customElement("chat-area")
export class ChatArea extends LitElement {
  @property({ attribute: false }) bot: Bot | null = null;
  @property({ attribute: false }) messages: ChatMessage[] = [];

  static styles = css`
    :host {
      display: grid;
      grid-template-rows: auto 1fr auto;
      min-width: 0;
      height: 100%;
      background: var(--bg);
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--line);
    }
    h2 {
      margin: 0;
      font-size: 18px;
    }
    .job {
      color: var(--muted);
      font-size: 13px;
    }
    .status {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .log {
      overflow: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .empty {
      margin: auto;
      text-align: center;
      color: var(--muted);
      max-width: 360px;
    }
  `;

  protected updated(): void {
    const log = this.renderRoot.querySelector(".log");
    if (log) log.scrollTop = log.scrollHeight;
  }

  render() {
    const bot = this.bot;
    return html`
      <header>
        <div>
          <h2>${bot?.name ?? "No bot focused"}</h2>
          <div class="job">${bot?.job ?? "Hire someone from the left pane."}</div>
        </div>
        <div class="status">${bot?.status ?? ""}</div>
      </header>
      <div class="log" data-testid="chat-pane">
        ${
          !bot
            ? html`<div class="empty">Hire a bot to open a conversation.</div>`
            : this.messages.length === 0
              ? html`<div class="empty">
                  Message ${bot.name} like a teammate. They can hire others and pass work across the
                  team.
                </div>`
              : repeat(
                  this.messages,
                  (message) => message.id,
                  (message) => html`<chat-message .message=${message}></chat-message>`,
                )
        }
      </div>
      <chat-composer ?disabled=${!bot} @send=${this.onSend}></chat-composer>
    `;
  }

  private onSend(event: CustomEvent<{ text: string; attachments: unknown[] }>) {
    this.dispatchEvent(
      new CustomEvent("prompt", { detail: event.detail, bubbles: true, composed: true }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-area": ChatArea;
  }
}
