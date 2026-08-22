import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { renderMarkdown } from "../../shared/markdown.js";
import type { ChatMessage } from "../../shared/types.js";

@customElement("chat-message")
export class ChatMessageView extends LitElement {
  @property({ attribute: false }) message!: ChatMessage;

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
    .row.handoff .bubble {
      border-color: #5a4a22;
      background: #241e14;
    }
    .row.system .bubble,
    .row.tool .bubble {
      background: transparent;
      color: var(--muted);
      border-style: dashed;
      font-size: 13px;
    }
    .meta {
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--accent-2);
      margin-bottom: 6px;
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
  `;

  render() {
    const message = this.message;
    const htmlBody = renderMarkdown(message.text || (message.streaming ? "…" : ""));
    return html`
      <div class="row ${message.role}" data-testid="chat-message" data-role=${message.role}>
        <div class="bubble">
          ${
            message.role === "handoff"
              ? html`<div class="meta">From ${message.fromBotName ?? "teammate"}</div>`
              : null
          }
          <div class="md">${unsafeHTML(htmlBody)}</div>
          ${this.media()}
        </div>
      </div>
    `;
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
