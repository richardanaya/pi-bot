import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { Bot, Routine } from "../../shared/types.js";

@customElement("routine-list")
export class RoutineList extends LitElement {
  @property({ attribute: false }) bot: Bot | null = null;
  @property({ attribute: false }) routines: Routine[] = [];
  @property({ type: Boolean }) ready = false;
  @state() private scheduleId: string | null = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
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
    .list {
      overflow: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .card {
      position: relative;
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
    }
    .card-head {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
      min-height: 22px;
    }
    .card h3 {
      margin: 0;
      font-size: 14px;
      flex: 1;
      min-width: 0;
    }
    .card p {
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 13px;
      white-space: pre-wrap;
    }
    .actions {
      display: flex;
      gap: 2px;
      opacity: 0;
    }
    .card:hover .actions,
    .card:focus-within .actions,
    .card.editing .actions {
      opacity: 1;
    }
    button.run,
    button.delete,
    button.clock {
      border: 0;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 6px;
      font-size: 13px;
      line-height: 1;
    }
    button.clock.open,
    button.clock:hover,
    button.run:hover {
      color: var(--text);
      background: var(--bg);
    }
    button.delete:hover {
      color: var(--danger);
      background: var(--bg);
    }
    .schedule-pop {
      margin-top: 8px;
      display: grid;
      gap: 4px;
    }
    .schedule-pop span {
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .schedule-pop input {
      width: 100%;
      background: var(--bg);
      color: inherit;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 13px;
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
      <div class="list" data-testid="routines-pane">
        ${
          !this.ready
            ? html`<div class="empty">Loading…</div>`
            : !this.bot
              ? html`<div class="empty">Focus a bot to see its routines.</div>`
              : this.routines.length === 0
                ? html`<div class="empty">No routines for ${this.bot.name} yet.</div>`
                : this.routines.map((routine) => this.card(routine))
        }
      </div>
    `;
  }

  private card(routine: Routine) {
    return html`
      <div
        class="card ${this.scheduleId === routine.id ? "editing" : ""}"
        data-testid="routine-row"
      >
        <div class="card-head">
          <h3>${routine.name}</h3>
          <div class="actions">
            <button
              class="clock ${this.scheduleId === routine.id ? "open" : ""}"
              data-testid="routine-clock"
              title="Schedule"
              aria-label="Schedule"
              @click=${() => this.onToggleSchedule(routine.id)}
            >
              ⏱
            </button>
            <button
              class="run"
              data-testid="routine-run"
              title="Run"
              aria-label="Run"
              @click=${() => this.onRun(routine.id)}
            >
              ▶
            </button>
            <button
              class="delete"
              data-testid="routine-delete"
              title="Delete"
              aria-label="Delete"
              @click=${() => this.onDelete(routine.id)}
            >
              ×
            </button>
          </div>
        </div>
        <p>${routine.instruction}</p>
        ${
          this.scheduleId === routine.id
            ? html`<label class="schedule-pop">
                <span>Cron</span>
                <input
                  data-testid="routine-schedule"
                  placeholder="0 9 * * * · blank = manual"
                  .value=${routine.schedule ?? ""}
                  @change=${(event: Event) => this.onSchedule(routine.id, event)}
                />
              </label>`
            : null
        }
      </div>
    `;
  }

  private onToggleSchedule(routineId: string) {
    this.scheduleId = this.scheduleId === routineId ? null : routineId;
  }

  private onSchedule(routineId: string, event: Event) {
    const schedule = (event.target as HTMLInputElement).value;
    this.dispatchEvent(
      new CustomEvent("update-routine", {
        detail: { routineId, schedule },
        bubbles: true,
        composed: true,
      }),
    );
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
