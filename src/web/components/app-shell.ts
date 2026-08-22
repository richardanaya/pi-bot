import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { Attachment } from "../../shared/types.js";
import { PiBotClient } from "../client.js";
import "./bot-list.js";
import "./chat-area.js";
import "./hire-dialog.js";
import "./routine-list.js";

@customElement("app-shell")
export class AppShell extends LitElement {
  private readonly client = new PiBotClient();
  @state() private hireOpen = false;

  static styles = css`
    :host {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr) 280px;
      grid-template-rows: minmax(0, 1fr);
      width: 100%;
      height: 100%;
      max-height: 100%;
      overflow: hidden;
      background: var(--bg);
    }
    .pane {
      min-width: 0;
      min-height: 0;
      height: 100%;
      overflow: hidden;
    }
    .left,
    .right {
      background: var(--panel);
      border-right: 1px solid var(--line);
    }
    .right {
      border-right: 0;
      border-left: 1px solid var(--line);
    }
    .banner {
      position: fixed;
      left: 50%;
      bottom: 16px;
      transform: translateX(-50%);
      background: #3a1f1f;
      color: #ffd7d7;
      border-radius: 999px;
      padding: 8px 14px;
      font-size: 12px;
    }
    @media (max-width: 900px) {
      :host {
        grid-template-columns: 1fr;
        grid-template-rows: 220px minmax(0, 1fr) 240px;
      }
      .left,
      .right {
        border: 0;
        border-bottom: 1px solid var(--line);
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.client.subscribe(() => {
      this.requestUpdate();
    });
    this.client.connect();
  }

  render() {
    const focused = this.client.focusedBot();
    return html`
      <section class="pane left">
        <bot-list
          .bots=${this.client.snapshot.bots}
          .focusedId=${this.client.snapshot.focusedBotId}
          @hire-click=${() => {
            this.hireOpen = true;
          }}
          @focus-bot=${this.onFocus}
        ></bot-list>
      </section>
      <section class="pane">
        <chat-area
          .bot=${focused}
          .messages=${this.client.messagesFor(this.client.snapshot.focusedBotId)}
          @prompt=${this.onPrompt}
        ></chat-area>
      </section>
      <section class="pane right">
        <routine-list
          .bot=${focused}
          .routines=${this.client.routinesFor(this.client.snapshot.focusedBotId)}
          @create-routine=${this.onCreateRoutine}
          @run-routine=${this.onRunRoutine}
          @delete-routine=${this.onDeleteRoutine}
        ></routine-list>
      </section>
      <hire-dialog
        .open=${this.hireOpen}
        @close=${() => {
          this.hireOpen = false;
        }}
        @hire=${this.onHire}
      ></hire-dialog>
      ${this.client.lastError ? html`<div class="banner">${this.client.lastError}</div>` : null}
    `;
  }

  private onHire(event: CustomEvent<{ name: string; job: string; instructions: string }>) {
    this.hireOpen = false;
    this.client.send({
      type: "hire",
      name: event.detail.name,
      job: event.detail.job,
      instructions: event.detail.instructions,
    });
  }

  private onFocus(event: CustomEvent<{ botId: string }>) {
    this.client.send({ type: "focus", botId: event.detail.botId });
  }

  private onPrompt(event: CustomEvent<{ text: string; attachments: Attachment[] }>) {
    const botId = this.client.snapshot.focusedBotId;
    if (!botId) return;
    this.client.send({
      type: "prompt",
      botId,
      text: event.detail.text,
      attachments: event.detail.attachments,
    });
  }

  private onCreateRoutine(
    event: CustomEvent<{ botId: string; name: string; instruction: string }>,
  ) {
    this.client.send({
      type: "create_routine",
      botId: event.detail.botId,
      name: event.detail.name,
      instruction: event.detail.instruction,
    });
  }

  private onRunRoutine(event: CustomEvent<{ routineId: string }>) {
    this.client.send({ type: "run_routine", routineId: event.detail.routineId });
  }

  private onDeleteRoutine(event: CustomEvent<{ routineId: string }>) {
    this.client.send({ type: "delete_routine", routineId: event.detail.routineId });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "app-shell": AppShell;
  }
}
