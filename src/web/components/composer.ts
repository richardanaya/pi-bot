import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { Attachment } from "../../shared/types.js";
import { uploadMedia } from "../client.js";

@customElement("chat-composer")
export class ChatComposer extends LitElement {
  @property({ type: Boolean }) disabled = false;
  @state() private text = "";
  @state() private attachments: Attachment[] = [];

  static styles = css`
    :host {
      display: block;
      padding: 12px 16px 16px;
      min-height: 0;
    }
    .box {
      border: 1px solid var(--line);
      background: var(--panel-2);
      border-radius: 16px;
      padding: 8px 8px 8px 12px;
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
    button.send {
      background: var(--accent);
      color: #0b1220;
      font-weight: 700;
    }
    button.send:disabled {
      opacity: 0.5;
      cursor: default;
    }
    input[type="file"] {
      display: none;
    }
  `;

  render() {
    return html`
      <div class="box">
        <textarea
          data-testid="composer-input"
          placeholder="Message this bot"
          .value=${this.text}
          ?disabled=${this.disabled}
          @input=${this.onInput}
          @keydown=${this.onKey}
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
    `;
  }

  private onInput(event: Event) {
    this.text = (event.target as HTMLTextAreaElement).value;
  }

  private onKey(event: KeyboardEvent) {
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

  private onSend() {
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
