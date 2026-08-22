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
  @state() private editBotId: string | null = null;
  @state() private mentionQuery: string | null = null;

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
      display: flex;
      flex-direction: column;
      background: var(--panel);
      border-right: 1px solid var(--line);
    }
    .left > *,
    .right > * {
      flex: 1;
      min-height: 0;
      min-width: 0;
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
          .groups=${this.client.snapshot.groups}
          .focusedId=${this.client.snapshot.focusedBotId}
          .ready=${this.client.ready}
          .mentionQuery=${this.mentionQuery}
          @hire-click=${() => {
            this.editBotId = null;
            this.hireOpen = true;
          }}
          @edit-bot=${this.onEditBot}
          @focus-bot=${this.onFocus}
          @pin-bot=${this.onPin}
          @create-group=${this.onCreateGroup}
          @assign-bot-group=${this.onAssignGroup}
          @collapse-group=${this.onCollapseGroup}
          @delete-group=${this.onDeleteGroup}
          @fire-bot=${this.onFireBot}
        ></bot-list>
      </section>
      <section class="pane">
        <chat-area
          .bot=${focused}
          .bots=${this.client.snapshot.bots}
          .messages=${this.client.messagesFor(this.client.snapshot.focusedBotId)}
          .ready=${this.client.ready}
          @prompt=${this.onPrompt}
          @abort-bot=${this.onAbort}
          @mention-query=${this.onMentionQuery}
        ></chat-area>
      </section>
      <section class="pane right">
        <routine-list
          .bot=${focused}
          .routines=${this.client.routinesFor(this.client.snapshot.focusedBotId)}
          .ready=${this.client.ready}
          @update-routine=${this.onUpdateRoutine}
          @run-routine=${this.onRunRoutine}
          @delete-routine=${this.onDeleteRoutine}
        ></routine-list>
      </section>
      <hire-dialog
        .open=${this.hireOpen}
        .bot=${
          this.editBotId
            ? (this.client.snapshot.bots.find((bot) => bot.id === this.editBotId) ?? null)
            : null
        }
        @close=${() => {
          this.hireOpen = false;
          this.editBotId = null;
        }}
        @hire=${this.onHire}
        @save=${this.onSaveBot}
      ></hire-dialog>
      ${this.client.lastError ? html`<div class="banner">${this.client.lastError}</div>` : null}
    `;
  }

  private onHire(event: CustomEvent<{ name: string; job: string; instructions: string }>) {
    this.hireOpen = false;
    this.editBotId = null;
    this.client.send({
      type: "hire",
      name: event.detail.name,
      job: event.detail.job,
      instructions: event.detail.instructions,
    });
  }

  private onEditBot(event: CustomEvent<{ botId: string }>) {
    this.editBotId = event.detail.botId;
    this.hireOpen = true;
  }

  private onSaveBot(
    event: CustomEvent<{ botId: string; name: string; job: string; instructions: string }>,
  ) {
    this.hireOpen = false;
    this.editBotId = null;
    this.client.send({
      type: "update_bot",
      botId: event.detail.botId,
      name: event.detail.name,
      job: event.detail.job,
      instructions: event.detail.instructions,
    });
  }

  private onFocus(event: CustomEvent<{ botId: string }>) {
    this.client.send({ type: "focus", botId: event.detail.botId });
  }

  private onPin(event: CustomEvent<{ botId: string; pinned: boolean }>) {
    this.client.send({ type: "pin_bot", botId: event.detail.botId, pinned: event.detail.pinned });
  }

  private onCreateGroup(event: CustomEvent<{ name: string; botId?: string }>) {
    this.client.send({
      type: "create_group",
      name: event.detail.name,
      botId: event.detail.botId,
    });
  }

  private onAssignGroup(event: CustomEvent<{ botId: string; groupId: string | null }>) {
    this.client.send({
      type: "assign_bot_group",
      botId: event.detail.botId,
      groupId: event.detail.groupId,
    });
  }

  private onCollapseGroup(event: CustomEvent<{ groupId: string; collapsed: boolean }>) {
    this.client.send({
      type: "collapse_group",
      groupId: event.detail.groupId,
      collapsed: event.detail.collapsed,
    });
  }

  private onDeleteGroup(event: CustomEvent<{ groupId: string }>) {
    this.client.send({ type: "delete_group", groupId: event.detail.groupId });
  }

  private onFireBot(event: CustomEvent<{ botId: string }>) {
    this.client.send({ type: "fire", botId: event.detail.botId });
  }

  private onAbort(event: CustomEvent<{ botId: string }>) {
    this.client.send({ type: "abort", botId: event.detail.botId });
  }

  private onMentionQuery(event: CustomEvent<{ query: string | null }>) {
    if (this.mentionQuery === event.detail.query) return;
    this.mentionQuery = event.detail.query;
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

  private onUpdateRoutine(event: CustomEvent<{ routineId: string; schedule?: string }>) {
    this.client.send({
      type: "update_routine",
      routineId: event.detail.routineId,
      schedule: event.detail.schedule,
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
