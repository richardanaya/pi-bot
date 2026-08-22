import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import type { Bot, ChatMessage } from "../../shared/types.js";
import "./chat-message.js";
import "./composer.js";

@customElement("chat-area")
export class ChatArea extends LitElement {
  @property({ attribute: false }) bot: Bot | null = null;
  @property({ attribute: false }) bots: Bot[] = [];
  @property({ attribute: false }) messages: ChatMessage[] = [];
  @property({ type: Boolean }) ready = false;

  static styles = css`
    :host {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      min-width: 0;
      min-height: 0;
      height: 100%;
      overflow: hidden;
      background: var(--bg);
    }
    .log {
      min-height: 0;
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
      <div class="log" data-testid="chat-pane">
        ${
          !this.ready
            ? html`<div class="empty">Loading…</div>`
            : !bot
              ? html`<div class="empty">Hire a bot to open a conversation.</div>`
              : this.messages.length === 0
                ? html`<div class="empty">
                    Message ${bot.name} like a teammate. They can hire others and pass work across
                    the team.
                  </div>`
                : repeat(
                    this.messages,
                    (message) => message.id,
                    (message) => html`<chat-message .message=${message}></chat-message>`,
                  )
        }
      </div>
      <chat-composer
        ?disabled=${!bot}
        ?busy=${Boolean(bot && bot.status !== "idle")}
        .bots=${this.bots}
        .selfId=${bot?.id ?? null}
        @send=${this.onSend}
        @abort=${this.onStop}
      ></chat-composer>
    `;
  }

  private onSend(event: CustomEvent<{ text: string; attachments: unknown[] }>) {
    this.dispatchEvent(
      new CustomEvent("prompt", { detail: event.detail, bubbles: true, composed: true }),
    );
  }

  private onStop() {
    const botId = this.bot?.id;
    if (!botId) return;
    this.dispatchEvent(
      new CustomEvent("abort-bot", { detail: { botId }, bubbles: true, composed: true }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-area": ChatArea;
  }
}
