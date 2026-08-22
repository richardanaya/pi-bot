import type { Bot, BotGroup } from "./types.js";

export interface RosterSection {
  key: string;
  title: string;
  kind: "pinned" | "group" | "ungrouped";
  groupId?: string;
  collapsed: boolean;
  bots: Bot[];
}

export function arrangeRoster(bots: Bot[], groups: BotGroup[]): RosterSection[] {
  const pinned = bots
    .filter((bot) => bot.pinned)
    .sort((a, b) => (a.pinOrder ?? 0) - (b.pinOrder ?? 0) || a.createdAt - b.createdAt);
  const rest = bots.filter((bot) => !bot.pinned);
  const sections: RosterSection[] = [];
  if (pinned.length > 0) {
    sections.push({
      key: "pinned",
      title: "Pinned",
      kind: "pinned",
      collapsed: false,
      bots: pinned,
    });
  }
  const known = new Set(groups.map((group) => group.id));
  for (const group of [...groups].sort((a, b) => a.createdAt - b.createdAt)) {
    sections.push({
      key: group.id,
      title: group.name,
      kind: "group",
      groupId: group.id,
      collapsed: Boolean(group.collapsed),
      bots: rest
        .filter((bot) => bot.groupId === group.id)
        .sort((a, b) => a.createdAt - b.createdAt),
    });
  }
  const ungrouped = rest
    .filter((bot) => !bot.groupId || !known.has(bot.groupId))
    .sort((a, b) => a.createdAt - b.createdAt);
  if (ungrouped.length > 0) {
    sections.push({
      key: "ungrouped",
      title: groups.length > 0 || pinned.length > 0 ? "Other" : "",
      kind: "ungrouped",
      collapsed: false,
      bots: ungrouped,
    });
  }
  return sections;
}
