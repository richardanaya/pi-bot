import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { Bot, Routine } from "../../shared/types.js";

@customElement("routine-list")
export class RoutineList extends LitElement {
  @property({ attribute: false }) bot: Bot | null = null;
  @property({ attribute: false }) routines: Routine[] = [];
  @state() private name = "";
  @state() private instruction = "";

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }
    header {
      padding: 16px 16px 8px;
    }
    h1 {
      margin: 0;
      font-size: 15px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }
    form {
      display: grid;
      gap: 8px;
      padding: 8px 16px 16px;
      border-bottom: 1px solid var(--line);
    }
    input,
    textarea {
      width: 100%;
      background: var(--bg);
      color: inherit;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 8px 10px;
    }
    button {
      border: 0;
      border-radius: 10px;
      padding: 8px 10px;
      cursor: pointer;
    }
    button.create {
      background: var(--panel-2);
      color: var(--text);
      font-weight: 650;
    }
    .list {
      overflow: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .card {
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
    }
    .card h3 {
      margin: 0 0 6px;
      font-size: 14px;
    }
    .card p {
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 13px;
      white-space: pre-wrap;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    button.run {
      background: var(--accent);
      color: #0b1220;
      font-weight: 650;
    }
    button.delete {
      background: transparent;
      color: var(--danger);
    }
    .empty {
      color: var(--muted);
      font-size: 13px;
      padding: 16px;
    }
  `;

  render() {
    return html`
      <header>
        <h1>Routines</h1>
      </header>
      <form @submit=${this.onCreate}>
        <input
          data-testid="routine-name"
          placeholder="Routine name"
          .value=${this.name}
          ?disabled=${!this.bot}
          @input=${this.onName}
        />
        <textarea
          data-testid="routine-instruction"
          rows="3"
          placeholder="Instruction to run later"
          .value=${this.instruction}
          ?disabled=${!this.bot}
          @input=${this.onInstruction}
        ></textarea>
        <button class="create" data-testid="routine-create" ?disabled=${!this.bot}>
          Save routine
        </button>
      </form>
      <div class="list" data-testid="routines-pane">
        ${
          !this.bot
            ? html`<div class="empty">Focus a bot to bind routines to it.</div>`
            : this.routines.length === 0
              ? html`<div class="empty">No routines for ${this.bot.name} yet.</div>`
              : this.routines.map((routine) => this.card(routine))
        }
      </div>
    `;
  }

  private card(routine: Routine) {
    return html`
      <div class="card" data-testid="routine-row">
        <h3>${routine.name}</h3>
        <p>${routine.instruction}</p>
        <div class="actions">
          <button class="run" data-testid="routine-run" @click=${() => this.onRun(routine.id)}>
            Run
          </button>
          <button class="delete" @click=${() => this.onDelete(routine.id)}>Delete</button>
        </div>
      </div>
    `;
  }

  private onName(event: Event) {
    this.name = (event.target as HTMLInputElement).value;
  }
  private onInstruction(event: Event) {
    this.instruction = (event.target as HTMLTextAreaElement).value;
  }
  private onCreate(event: Event) {
    event.preventDefault();
    if (!this.bot) return;
    this.dispatchEvent(
      new CustomEvent("create-routine", {
        detail: { botId: this.bot.id, name: this.name, instruction: this.instruction },
        bubbles: true,
        composed: true,
      }),
    );
    this.name = "";
    this.instruction = "";
  }
  private onRun(routineId: string) {
    this.dispatchEvent(
      new CustomEvent("run-routine", { detail: { routineId }, bubbles: true, composed: true }),
    );
  }
  private onDelete(routineId: string) {
    this.dispatchEvent(
      new CustomEvent("delete-routine", { detail: { routineId }, bubbles: true, composed: true }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "routine-list": RoutineList;
  }
}
