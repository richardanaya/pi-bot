import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { isHandoffMessage, presentHandoff } from "../../shared/handoff-ux.js";
import { renderMarkdown } from "../../shared/markdown.js";
import { presentToolUse } from "../../shared/tool-ux.js";
import type { ChatMessage } from "../../shared/types.js";

@customElement("chat-message")
export class ChatMessageView extends LitElement {
  @property({ attribute: false }) message!: ChatMessage;
  @state() private expanded = false;

  static styles = css`
    :host {
      display: block;
    }
    .bubble {
      max-width: min(720px, 92%);
      border-radius: 16px;
      padding: 10px 14px;
      background: var(--panel-2);
      border: 1px solid var(--line);
    }
    .row {
      display: flex;
    }
    .row.user {
      justify-content: flex-end;
    }
    .row.user .bubble {
      background: var(--user);
    }
    .row.system .bubble {
      background: transparent;
      color: var(--muted);
      border-style: dashed;
      font-size: 13px;
    }
    .md :is(p, ul, ol, pre, h1, h2, h3) {
      margin: 0 0 0.7em;
    }
    .md :is(p, ul, ol, pre, h1, h2, h3):last-child {
      margin-bottom: 0;
    }
    .md pre {
      overflow: auto;
      background: #0b0c10;
      padding: 10px;
      border-radius: 10px;
    }
    .md code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.92em;
    }
    .md img,
    .md video,
    .md iframe {
      display: block;
      max-width: 100%;
      border-radius: 12px;
      margin: 8px 0;
    }
    .md video,
    .md iframe {
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
    }
    .md a {
      color: var(--accent);
    }
    .attachments {
      display: grid;
      gap: 8px;
      margin-top: 8px;
    }
    .attachments img,
    .attachments video {
      max-width: 100%;
      border-radius: 12px;
    }
    .handoff {
      align-self: stretch;
      font-size: 11px;
      color: var(--muted);
      opacity: 0.72;
    }
    .handoff summary {
      cursor: pointer;
      list-style: none;
      padding: 2px 0;
    }
    .handoff summary::-webkit-details-marker {
      display: none;
    }
    .handoff-body {
      margin-top: 6px;
      padding: 8px 10px;
      border-left: 1px solid var(--line);
      color: var(--text);
      opacity: 0.9;
      font-size: 13px;
      white-space: pre-wrap;
    }
    .tool {
      max-width: min(720px, 92%);
    }
    .tool-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      list-style: none;
      border: 1px solid var(--line);
      background: var(--panel-2);
      color: var(--muted);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 650;
    }
    .tool-chip::-webkit-details-marker {
      display: none;
    }
    .tool-chip:hover {
      color: var(--text);
    }
    .tool.error .tool-chip {
      border-color: var(--danger);
      color: var(--danger);
    }
    .tool-io {
      margin-top: 8px;
      display: grid;
      gap: 8px;
    }
    .tool-io h4 {
      margin: 0 0 4px;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .tool-io pre {
      margin: 0;
      max-height: 240px;
      overflow: auto;
      background: #0b0c10;
      border-radius: 10px;
      padding: 10px;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }
  `;

  render() {
    const message = this.message;
    if (isHandoffMessage(message)) return this.renderHandoff(message);
    if (message.role === "tool") return this.renderTool(message);
    const htmlBody = renderMarkdown(message.text || (message.streaming ? "…" : ""));
    return html`
      <div class="row ${message.role}" data-testid="chat-message" data-role=${message.role}>
        <div class="bubble">
          <div class="md">${unsafeHTML(htmlBody)}</div>
          ${this.media()}
        </div>
      </div>
    `;
  }

  private renderHandoff(message: ChatMessage) {
    const chrome = presentHandoff(message, { expanded: this.expanded });
    return html`
      <div class="row handoff" data-testid="chat-message" data-role="handoff">
        <details
          class="handoff"
          data-testid="handoff-chrome"
          ?open=${chrome.expanded}
          @toggle=${this.onToggle}
        >
          <summary data-testid="handoff-summary">${chrome.collapsedLabel}</summary>
          <div class="handoff-body" data-testid="handoff-body">${chrome.body}</div>
        </details>
      </div>
    `;
  }

  private renderTool(message: ChatMessage) {
    const tool = presentToolUse(message);
    return html`
      <div
        class="row tool ${tool.isError ? "error" : ""}"
        data-testid="chat-message"
        data-role="tool"
      >
        <details class="tool" data-testid="tool-chrome" @toggle=${this.onToggle}>
          <summary class="tool-chip" data-testid="tool-summary">${tool.name}</summary>
          <div class="tool-io" data-testid="tool-io">
            <div>
              <h4>Input</h4>
              <pre data-testid="tool-input">${tool.input || "—"}</pre>
            </div>
            <div>
              <h4>Output</h4>
              <pre data-testid="tool-output">${tool.pending ? "Running…" : tool.output || "—"}</pre>
            </div>
          </div>
        </details>
      </div>
    `;
  }

  private onToggle(event: Event) {
    const details = event.currentTarget as HTMLDetailsElement;
    this.expanded = details.open;
  }

  private media() {
    const attachments = this.message.attachments ?? [];
    if (attachments.length === 0) return null;
    return html`
      <div class="attachments">
        ${attachments.map((item) =>
          item.kind === "video"
            ? html`<video controls src=${item.url} data-testid="inline-video"></video>`
            : html`<img src=${item.url} alt=${item.name} data-testid="inline-image" />`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-message": ChatMessageView;
  }
}
