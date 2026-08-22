import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { filterMentionRoster, mentionQueryAt, type MentionQuery } from "../../shared/mentions.js";
import type { Attachment, Bot } from "../../shared/types.js";
import { uploadMedia } from "../client.js";

@customElement("chat-composer")
export class ChatComposer extends LitElement {
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) busy = false;
  @property({ attribute: false }) bots: Bot[] = [];
  @property({ attribute: false }) selfId: string | null = null;
  @state() private text = "";
  @state() private attachments: Attachment[] = [];
  @state() private mention: MentionQuery | null = null;
  @state() private mentionIndex = 0;
  @state() private caret = 0;

  private readonly onDocPointer = (event: PointerEvent) => {
    if (!this.mention) return;
    if (event.composedPath().includes(this)) return;
    this.closeMention();
  };

  static styles = css`
    :host {
      display: block;
      padding: 12px 16px 16px;
      min-height: 0;
    }
    .box {
      position: relative;
      border: 1px solid var(--line);
      background: var(--panel-2);
      border-radius: 16px;
      padding: 8px 8px 8px 12px;
    }
    .mentions {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: calc(100% + 6px);
      z-index: 20;
      max-height: 220px;
      overflow: auto;
      padding: 4px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      box-shadow: var(--shadow);
    }
    .mentions button {
      display: grid;
      gap: 2px;
      width: 100%;
      text-align: left;
      border: 0;
      background: transparent;
      color: inherit;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
    }
    .mentions button.active,
    .mentions button:hover {
      background: var(--panel-2);
    }
    .mentions .opt-name {
      color: var(--accent);
      font-weight: 650;
      font-size: 13px;
    }
    .mentions .opt-job {
      color: var(--muted);
      font-size: 12px;
    }
    textarea {
      width: 100%;
      resize: none;
      min-height: 44px;
      max-height: 160px;
      border: 0;
      background: transparent;
      color: inherit;
      outline: none;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      font-size: 12px;
      background: var(--bg);
      border-radius: 999px;
      padding: 4px 8px;
      color: var(--muted);
    }
    button,
    label.attach {
      border: 0;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      padding: 6px 8px;
      border-radius: 10px;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    button.send {
      background: var(--accent);
      color: #0b1220;
      font-weight: 700;
    }
    button.send:disabled {
      opacity: 0.5;
      cursor: default;
    }
    button.stop {
      border: 1px solid var(--danger);
      background: transparent;
      color: var(--danger);
      font-weight: 650;
    }
    button.stop:hover {
      background: #3a1f1f;
    }
    input[type="file"] {
      display: none;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("pointerdown", this.onDocPointer, true);
  }

  disconnectedCallback(): void {
    document.removeEventListener("pointerdown", this.onDocPointer, true);
    super.disconnectedCallback();
  }

  protected updated(): void {
    const active = this.renderRoot.querySelector(".mentions .active");
    if (active instanceof HTMLElement) active.scrollIntoView({ block: "nearest" });
  }

  render() {
    const matches = this.matches();
    const index = matches.length === 0 ? 0 : Math.min(this.mentionIndex, matches.length - 1);
    return html`
      <div class="box">
        ${
          this.mention && matches.length > 0
            ? html`<div class="mentions" role="listbox" data-testid="mention-menu">
                ${matches.map(
                  (bot, i) => html`
                    <button
                      type="button"
                      role="option"
                      class=${classMap({ active: i === index })}
                      aria-selected=${i === index ? "true" : "false"}
                      data-testid="mention-option"
                      data-bot-name=${bot.name}
                      @mousedown=${(event: Event) => {
                        event.preventDefault();
                        this.applyMention(bot);
                      }}
                    >
                      <span class="opt-name">@${bot.name}</span>
                      <span class="opt-job">${bot.job}</span>
                    </button>
                  `,
                )}
              </div>`
            : null
        }
        <textarea
          data-testid="composer-input"
          placeholder="Message this bot · @Name to hand off"
          .value=${this.text}
          ?disabled=${this.disabled}
          @input=${this.onInput}
          @keydown=${this.onKey}
          @keyup=${this.onCaret}
          @click=${this.onCaret}
          @paste=${this.onPaste}
        ></textarea>
        <div class="chips">
          ${this.attachments.map((item) => html`<span class="chip">${item.name}</span>`)}
        </div>
        <div class="row">
          <label class="attach">
            Attach
            <input
              data-testid="file-input"
              type="file"
              accept="image/*,video/*"
              multiple
              @change=${this.onFiles}
            />
          </label>
          <div class="actions">
            ${
              this.busy
                ? html`<button
                    class="stop"
                    type="button"
                    data-testid="stop-bot"
                    title="Stop"
                    @click=${this.onStop}
                  >
                    Stop
                  </button>`
                : null
            }
            <button
              class="send"
              data-testid="send-button"
              ?disabled=${this.disabled || (!this.text.trim() && this.attachments.length === 0)}
              @click=${this.onSend}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private matches() {
    if (!this.mention) return [];
    return filterMentionRoster(this.bots, this.mention.query, this.selfId);
  }

  private onInput(event: Event) {
    const area = event.target as HTMLTextAreaElement;
    this.text = area.value;
    this.syncMention(area);
  }

  private onCaret(event: Event) {
    this.syncMention(event.target as HTMLTextAreaElement);
  }

  private syncMention(area: HTMLTextAreaElement) {
    this.caret = area.selectionStart ?? area.value.length;
    const next = this.disabled ? null : mentionQueryAt(this.text, this.caret);
    const changed =
      (this.mention?.start ?? null) !== (next?.start ?? null) ||
      (this.mention?.query ?? null) !== (next?.query ?? null);
    this.mention = next;
    if (changed) this.mentionIndex = 0;
    this.emitMentionQuery();
  }

  private emitMentionQuery() {
    this.dispatchEvent(
      new CustomEvent("mention-query", {
        detail: { query: this.mention ? this.mention.query : null },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private closeMention() {
    if (!this.mention) return;
    this.mention = null;
    this.mentionIndex = 0;
    this.emitMentionQuery();
  }

  private applyMention(bot: Bot) {
    const mention = this.mention;
    if (!mention) return;
    const inserted = `@${bot.name} `;
    const caret = mention.start + inserted.length;
    this.text = `${this.text.slice(0, mention.start)}${inserted}${this.text.slice(this.caret)}`;
    this.caret = caret;
    this.closeMention();
    void this.updateComplete.then(() => {
      const area = this.renderRoot.querySelector("textarea");
      if (!area) return;
      area.focus();
      area.setSelectionRange(caret, caret);
    });
  }

  private onKey(event: KeyboardEvent) {
    const matches = this.matches();
    if (this.mention && matches.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.mentionIndex = (this.mentionIndex + 1) % matches.length;
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        this.mentionIndex = (this.mentionIndex - 1 + matches.length) % matches.length;
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const index = Math.min(this.mentionIndex, matches.length - 1);
        this.applyMention(matches[index]!);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.closeMention();
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  private async onPaste(event: ClipboardEvent) {
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.length) {
      event.preventDefault();
      await this.addFiles(files);
    }
  }

  private async onFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    await this.addFiles([...(input.files ?? [])]);
    input.value = "";
  }

  private async addFiles(files: File[]) {
    for (const file of files) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) continue;
      this.attachments = [...this.attachments, await uploadMedia(file)];
    }
  }

  private onStop() {
    this.dispatchEvent(new CustomEvent("abort", { bubbles: true, composed: true }));
  }

  private onSend() {
    this.closeMention();
    const text = this.text.trim();
    const attachments = this.attachments;
    if (this.disabled || (!text && attachments.length === 0)) return;
    this.dispatchEvent(
      new CustomEvent("send", {
        detail: { text, attachments },
        bubbles: true,
        composed: true,
      }),
    );
    this.text = "";
    this.attachments = [];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-composer": ChatComposer;
  }
}
