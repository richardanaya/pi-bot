import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { arrangeRoster } from "../../shared/roster.js";
import type { Bot, BotGroup } from "../../shared/types.js";

@customElement("bot-list")
export class BotList extends LitElement {
  @property({ attribute: false }) bots: Bot[] = [];
  @property({ attribute: false }) groups: BotGroup[] = [];
  @property({ type: String }) focusedId: string | null = null;
  @property({ type: Boolean }) ready = false;
  @property({ attribute: false }) mentionQuery: string | null = null;
  @state() private menuBotId: string | null = null;
  @state() private newGroupBotId: string | null = null;
  @state() private groupDraft = "";
  @state() private menuX = 0;
  @state() private menuY = 0;
  @state() private pendingDelete:
    { kind: "group"; group: BotGroup } | { kind: "bot"; bot: Bot } | null = null;

  private readonly onDocPointer = (event: PointerEvent) => {
    if (!this.menuBotId) return;
    const path = event.composedPath();
    const menu = this.renderRoot.querySelector("[data-testid='bot-menu']");
    const gear = this.renderRoot.querySelector(".gear.open");
    if (menu && path.includes(menu)) return;
    if (gear && path.includes(gear)) return;
    this.closeMenu();
  };

  private readonly onDocKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (this.pendingDelete) {
      this.pendingDelete = null;
      return;
    }
    if (this.menuBotId) this.closeMenu();
  };

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("pointerdown", this.onDocPointer, true);
    document.addEventListener("keydown", this.onDocKey);
  }

  disconnectedCallback(): void {
    document.removeEventListener("pointerdown", this.onDocPointer, true);
    document.removeEventListener("keydown", this.onDocKey);
    super.disconnectedCallback();
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      overflow: hidden;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 16px 16px 12px;
      flex-shrink: 0;
    }
    h1 {
      margin: 0;
      font-size: 15px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 650;
    }
    .title {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 28px;
    }
    button.hire {
      opacity: 0;
      border: 0;
      background: transparent;
      color: var(--muted);
      font-size: 18px;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    }
    header:hover button.hire,
    button.hire:focus-visible {
      opacity: 1;
    }
    button.hire:hover {
      color: var(--text);
      background: var(--panel-2);
    }
    .list {
      flex: 1 1 auto;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      padding: 0 8px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      margin: 10px 4px 4px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--muted);
      font-size: 11px;
      font-weight: 650;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      text-align: left;
    }
    .section-title .grow {
      flex: 1;
    }
    .section-title .ghost {
      opacity: 0;
      border: 0;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      padding: 0 2px;
      font-size: 14px;
      line-height: 1;
      border-radius: 4px;
    }
    .section-title:hover .ghost,
    .section-title:focus-within .ghost {
      opacity: 1;
    }
    .section-title .ghost:hover {
      color: var(--danger);
    }
    .row {
      position: relative;
      display: grid;
      grid-template-columns: 8px 36px minmax(0, 1fr);
      gap: 10px;
      padding: 10px;
      border-radius: 12px;
      border: 1px solid transparent;
      cursor: pointer;
      text-align: left;
      background: transparent;
      color: inherit;
      width: 100%;
      align-items: center;
      box-sizing: border-box;
    }
    .row:hover {
      background: var(--panel-2);
    }
    .row.active {
      background: var(--panel-2);
      border-color: var(--line);
    }
    .row.mention-hit {
      box-shadow: inset 0 0 0 1px var(--accent);
    }
    .pip {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--muted);
      justify-self: center;
    }
    .pip.idle {
      background: var(--ok);
    }
    .pip.working {
      background: var(--accent-2);
      animation: pip-pulse 1.6s ease-out infinite;
    }
    .pip.error {
      background: var(--danger);
    }
    @keyframes pip-pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(212, 160, 23, 0.55);
      }
      100% {
        box-shadow: 0 0 0 6px transparent;
      }
    }
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: #262833;
      font-weight: 700;
    }
    .name-line {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
    }
    .name {
      font-weight: 650;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .job {
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gear {
      opacity: 0;
      flex-shrink: 0;
      border: 0;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      padding: 0 3px;
      font-size: 13px;
      line-height: 1;
      border-radius: 4px;
    }
    .name-line:hover .gear,
    .gear.open,
    .gear:focus-visible {
      opacity: 1;
    }
    .gear:hover,
    .gear.open {
      color: var(--text);
      background: var(--bg);
    }
    .menu {
      position: fixed;
      z-index: 40;
      min-width: 168px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 4px;
      box-shadow: var(--shadow);
    }
    .menu button {
      display: block;
      width: 100%;
      text-align: left;
      border: 0;
      background: transparent;
      color: var(--text);
      padding: 7px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
    }
    .menu button:hover {
      background: var(--panel-2);
    }
    .menu button.danger {
      color: var(--danger);
    }
    .menu .draft {
      padding: 6px;
    }
    .menu .draft input {
      width: 100%;
      background: var(--bg);
      color: inherit;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 7px 8px;
      font-size: 13px;
    }
    .empty {
      color: var(--muted);
      padding: 24px 16px;
      font-size: 13px;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      display: grid;
      place-items: center;
      z-index: 50;
    }
    .confirm {
      width: min(360px, calc(100vw - 48px));
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 20px;
      box-shadow: var(--shadow);
    }
    .confirm p {
      margin: 0 0 16px;
      color: var(--text);
      font-size: 14px;
      line-height: 1.45;
    }
    .confirm .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .confirm button {
      border: 0;
      border-radius: 10px;
      padding: 8px 12px;
      cursor: pointer;
    }
    .confirm .cancel {
      background: transparent;
      color: var(--muted);
    }
    .confirm .destroy {
      background: var(--danger);
      color: #fff;
      font-weight: 650;
    }
  `;

  render() {
    const sections = arrangeRoster(this.bots, this.groups);
    return html`
      <header data-testid="bots-header">
        <div class="title">
          <h1>Pi Bot</h1>
          <button
            class="hire"
            data-testid="hire-button"
            title="Hire"
            aria-label="Hire"
            @click=${this.onHire}
          >
            +
          </button>
        </div>
      </header>
      <div class="list" data-testid="bots-pane" @scroll=${this.closeMenu}>
        ${
          !this.ready
            ? html`<div class="empty" data-testid="roster-loading">Loading…</div>`
            : this.bots.length === 0 && sections.length === 0
              ? html`<div class="empty" data-testid="roster-empty">
                  No bots yet. Hire a teammate to start a thread.
                </div>`
              : sections.map((section) => this.section(section))
        }
      </div>
      ${this.renderMenu()} ${this.renderConfirm()}
    `;
  }

  private section(section: ReturnType<typeof arrangeRoster>[number]) {
    return html`
      <div data-testid="roster-section" data-section=${section.key}>
        ${
          section.title
            ? html`<button
                class="section-title"
                data-testid="section-title"
                @click=${() => section.groupId && this.onCollapse(section.groupId, !section.collapsed)}
              >
                <span>${section.kind === "group" ? (section.collapsed ? "▸" : "▾") : ""}</span>
                <span class="grow">${section.title}</span>
                ${
                  section.kind === "group"
                    ? html`<button
                        class="ghost"
                        type="button"
                        data-testid="delete-group"
                        title="Delete group"
                        aria-label="Delete group"
                        @click=${(event: Event) => {
                          event.stopPropagation();
                          this.askDeleteGroup(section.groupId!);
                        }}
                      >
                        ×
                      </button>`
                    : null
                }
              </button>`
            : null
        }
        ${section.collapsed ? null : section.bots.map((bot) => this.row(bot))}
      </div>
    `;
  }

  private row(bot: Bot) {
    return html`
      <div
        class=${classMap({
          row: true,
          active: bot.id === this.focusedId,
          pinned: Boolean(bot.pinned),
          "mention-hit": this.isMentionHit(bot),
        })}
        role="button"
        tabindex="0"
        data-testid="bot-row"
        data-bot-id=${bot.id}
        data-bot-name=${bot.name}
        data-pinned=${bot.pinned ? "true" : "false"}
        data-status=${bot.status}
        data-mention=${this.isMentionHit(bot) ? "true" : "false"}
        @click=${() => this.onFocus(bot.id)}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            this.onFocus(bot.id);
          }
        }}
      >
        <span
          class="pip ${bot.status}"
          data-testid="bot-status"
          data-status=${bot.status}
          title=${bot.status}
          aria-label=${bot.status}
        ></span>
        <div class="avatar">${initials(bot.name)}</div>
        <div>
          <div class="name-line" data-testid="bot-name-line">
            <div class="name">${bot.name}</div>
            <button
              class=${classMap({ gear: true, open: this.menuBotId === bot.id })}
              data-testid="bot-gear"
              title="Bot settings"
              aria-label="Bot settings"
              @click=${(event: Event) => this.onGear(event, bot.id)}
            >
              ⚙
            </button>
          </div>
          <div class="job">${bot.job}</div>
        </div>
      </div>
    `;
  }

  private isMentionHit(bot: Bot): boolean {
    if (!this.mentionQuery) return false;
    if (bot.id === this.focusedId) return false;
    return bot.name.toLowerCase().includes(this.mentionQuery.toLowerCase());
  }

  private onHire() {
    this.dispatchEvent(new CustomEvent("hire-click", { bubbles: true, composed: true }));
  }

  private onFocus(botId: string) {
    this.closeMenu();
    this.dispatchEvent(
      new CustomEvent("focus-bot", { detail: { botId }, bubbles: true, composed: true }),
    );
  }

  private onGear(event: Event, botId: string) {
    event.stopPropagation();
    if (this.menuBotId === botId) {
      this.closeMenu();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const width = 180;
    const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));
    const below = rect.bottom + 4;
    const top = below + 240 > window.innerHeight ? Math.max(8, rect.top - 240) : below;
    this.menuX = left;
    this.menuY = top;
    this.menuBotId = botId;
    this.newGroupBotId = null;
    this.groupDraft = "";
  }

  private closeMenu() {
    this.menuBotId = null;
    this.newGroupBotId = null;
    this.groupDraft = "";
  }

  private renderMenu() {
    const bot = this.bots.find((item) => item.id === this.menuBotId);
    if (!bot) return null;
    return html`
      <div
        class="menu"
        data-testid="bot-menu"
        style="top:${this.menuY}px;left:${this.menuX}px"
        @click=${stop}
      >
        <button data-testid="menu-edit" @click=${() => this.onEdit(bot.id)}>Edit…</button>
        <button data-testid="menu-pin" @click=${() => this.onPin(bot.id, !bot.pinned)}>
          ${bot.pinned ? "Unpin" : "Pin"}
        </button>
        ${this.groups.map((group) =>
          bot.groupId === group.id
            ? html`<button data-testid="menu-ungroup" @click=${() => this.onAssign(bot.id, null)}>
                Remove from ${group.name}
              </button>`
            : html`<button
                data-testid="menu-add-group"
                @click=${() => this.onAssign(bot.id, group.id)}
              >
                Add to ${group.name}
              </button>`,
        )}
        ${
          this.newGroupBotId === bot.id
            ? html`<form
                class="draft"
                @submit=${(event: Event) => this.onCreateGroup(event, bot.id)}
              >
                <input
                  data-testid="group-name-input"
                  placeholder="New group name"
                  .value=${this.groupDraft}
                  @input=${this.onDraft}
                  @keydown=${(event: KeyboardEvent) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      this.submitNewGroup(bot.id, (event.target as HTMLInputElement).value);
                    }
                  }}
                />
              </form>`
            : html`<button
                data-testid="menu-new-group"
                @click=${() => this.onStartNewGroup(bot.id)}
              >
                Add to new group…
              </button>`
        }
        <button class="danger" data-testid="menu-delete-bot" @click=${() => this.askDeleteBot(bot)}>
          Delete…
        </button>
      </div>
    `;
  }

  private onEdit(botId: string) {
    this.closeMenu();
    this.dispatchEvent(
      new CustomEvent("edit-bot", { detail: { botId }, bubbles: true, composed: true }),
    );
  }

  private onPin(botId: string, pinned: boolean) {
    this.closeMenu();
    this.dispatchEvent(
      new CustomEvent("pin-bot", { detail: { botId, pinned }, bubbles: true, composed: true }),
    );
  }

  private onStartNewGroup(botId: string) {
    this.newGroupBotId = botId;
    this.groupDraft = "";
  }

  private onDraft(event: Event) {
    this.groupDraft = (event.target as HTMLInputElement).value;
  }

  private onCreateGroup(event: Event, botId: string) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const typed = form.querySelector("input")?.value ?? this.groupDraft;
    this.submitNewGroup(botId, typed);
  }

  private submitNewGroup(botId: string, rawName: string) {
    const name = rawName.trim();
    if (!name) return;
    this.dispatchEvent(
      new CustomEvent("create-group", {
        detail: { name, botId },
        bubbles: true,
        composed: true,
      }),
    );
    this.closeMenu();
  }

  private onAssign(botId: string, groupId: string | null) {
    this.closeMenu();
    this.dispatchEvent(
      new CustomEvent("assign-bot-group", {
        detail: { botId, groupId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onCollapse(groupId: string, collapsed: boolean) {
    this.dispatchEvent(
      new CustomEvent("collapse-group", {
        detail: { groupId, collapsed },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private askDeleteGroup(groupId: string) {
    this.closeMenu();
    const group = this.groups.find((item) => item.id === groupId);
    this.pendingDelete = group ? { kind: "group", group } : null;
  }

  private askDeleteBot(bot: Bot) {
    this.closeMenu();
    this.pendingDelete = { kind: "bot", bot };
  }

  private renderConfirm() {
    const pending = this.pendingDelete;
    if (!pending) return null;
    const copy =
      pending.kind === "group"
        ? `Delete group “${pending.group.name}”? Bots stay on the roster.`
        : `Delete “${pending.bot.name}”? Their chat and routines will be removed.`;
    return html`
      <div
        class="backdrop"
        data-testid="delete-confirm-dialog"
        @click=${(event: Event) => {
          if (event.target === event.currentTarget) this.pendingDelete = null;
        }}
      >
        <div class="confirm" @click=${stop}>
          <p>${copy}</p>
          <div class="actions">
            <button
              class="cancel"
              type="button"
              data-testid="cancel-delete"
              @click=${() => (this.pendingDelete = null)}
            >
              Cancel
            </button>
            <button
              class="destroy"
              type="button"
              data-testid="confirm-delete"
              @click=${() => this.confirmDelete()}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private confirmDelete() {
    const pending = this.pendingDelete;
    this.pendingDelete = null;
    if (!pending) return;
    if (pending.kind === "group") {
      this.dispatchEvent(
        new CustomEvent("delete-group", {
          detail: { groupId: pending.group.id },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }
    this.dispatchEvent(
      new CustomEvent("fire-bot", {
        detail: { botId: pending.bot.id },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

function stop(event: Event) {
  event.stopPropagation();
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

declare global {
  interface HTMLElementTagNameMap {
    "bot-list": BotList;
  }
}
