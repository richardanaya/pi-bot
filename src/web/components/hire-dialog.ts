import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("hire-dialog")
export class HireDialog extends LitElement {
  @property({ type: Boolean }) open = false;
  @state() private name = "";
  @state() private job = "";
  @state() private instructions = "";

  static styles = css`
    :host {
      display: contents;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      display: grid;
      place-items: center;
      z-index: 20;
    }
    form {
      width: min(440px, calc(100vw - 32px));
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 20px;
      box-shadow: var(--shadow);
      display: grid;
      gap: 12px;
    }
    h2 {
      margin: 0;
      font-size: 18px;
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
    }
    label {
      display: grid;
      gap: 6px;
      font-size: 12px;
      color: var(--muted);
    }
    input,
    textarea {
      width: 100%;
      background: var(--bg);
      color: var(--text);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    button {
      border: 0;
      border-radius: 10px;
      padding: 8px 12px;
      cursor: pointer;
    }
    button.cancel {
      background: transparent;
      color: var(--muted);
    }
    button.submit {
      background: var(--accent);
      color: #0b1220;
      font-weight: 650;
    }
  `;

  render() {
    if (!this.open) return html``;
    return html`
      <div class="backdrop" @click=${this.onBackdrop}>
        <form data-testid="hire-dialog" @click=${stop} @submit=${this.onSubmit}>
          <h2>Hire a bot</h2>
          <p>
            Give it a name and a job. It gets its own pi session and can message the rest of the
            team.
          </p>
          <label>
            Name
            <input data-testid="hire-name" .value=${this.name} @input=${this.onName} required />
          </label>
          <label>
            Job
            <input data-testid="hire-job" .value=${this.job} @input=${this.onJob} required />
          </label>
          <label>
            Standing instructions
            <textarea
              data-testid="hire-instructions"
              rows="3"
              .value=${this.instructions}
              @input=${this.onInstructions}
            ></textarea>
          </label>
          <div class="actions">
            <button class="cancel" type="button" @click=${this.onCancel}>Cancel</button>
            <button class="submit" data-testid="hire-submit" type="submit">Hire</button>
          </div>
        </form>
      </div>
    `;
  }

  private onName(event: Event) {
    this.name = (event.target as HTMLInputElement).value;
  }
  private onJob(event: Event) {
    this.job = (event.target as HTMLInputElement).value;
  }
  private onInstructions(event: Event) {
    this.instructions = (event.target as HTMLTextAreaElement).value;
  }
  private onCancel() {
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
  }
  private onBackdrop(event: Event) {
    if (event.target === event.currentTarget) this.onCancel();
  }
  private onSubmit(event: Event) {
    event.preventDefault();
    this.dispatchEvent(
      new CustomEvent("hire", {
        detail: { name: this.name, job: this.job, instructions: this.instructions },
        bubbles: true,
        composed: true,
      }),
    );
    this.name = "";
    this.job = "";
    this.instructions = "";
  }
}

function stop(event: Event) {
  event.stopPropagation();
}

declare global {
  interface HTMLElementTagNameMap {
    "hire-dialog": HireDialog;
  }
}
