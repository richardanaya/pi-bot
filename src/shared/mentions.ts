export interface MentionRosterBot {
  id: string;
  name: string;
}

export interface MentionHit {
  bot: MentionRosterBot;
  mention: string;
  ask: string;
  index: number;
}

export interface MentionQuery {
  start: number;
  query: string;
}

export function resolveComposerMention(
  text: string,
  roster: ReadonlyArray<MentionRosterBot>,
): MentionHit | null {
  if (!text || roster.length === 0) return null;
  const names = [...roster].sort((a, b) => b.name.length - a.name.length);
  let from = 0;
  while (from < text.length) {
    const at = text.indexOf("@", from);
    if (at < 0) return null;
    const after = text.slice(at + 1);
    for (const bot of names) {
      if (!bot.name || after.length < bot.name.length) continue;
      const slice = after.slice(0, bot.name.length);
      if (slice.toLowerCase() !== bot.name.toLowerCase()) continue;
      const next = after[bot.name.length];
      if (next && /[A-Za-z0-9_]/.test(next)) continue;
      const rest = after
        .slice(bot.name.length)
        .replace(/^[\s,;:\-–—]+/, "")
        .trim();
      return {
        bot: { id: bot.id, name: bot.name },
        mention: `@${bot.name}`,
        ask: rest || text.trim(),
        index: at,
      };
    }
    from = at + 1;
  }
  return null;
}

export function mentionQueryAt(text: string, caret: number): MentionQuery | null {
  if (caret < 0 || caret > text.length) return null;
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  const prev = at > 0 ? before[at - 1]! : " ";
  if (/[A-Za-z0-9_]/.test(prev)) return null;
  const query = before.slice(at + 1);
  if (/[\s]/.test(query)) return null;
  return { start: at, query };
}

export function filterMentionRoster<T extends MentionRosterBot>(
  roster: ReadonlyArray<T>,
  query: string,
  excludeId?: string | null,
): T[] {
  const needle = query.toLowerCase();
  return roster
    .filter((bot) => {
      if (!bot.name) return false;
      if (excludeId && bot.id === excludeId) return false;
      return !needle || bot.name.toLowerCase().includes(needle);
    })
    .sort((a, b) => {
      const left = a.name.toLowerCase();
      const right = b.name.toLowerCase();
      const leftPrefix = left.startsWith(needle);
      const rightPrefix = right.startsWith(needle);
      if (leftPrefix !== rightPrefix) return leftPrefix ? -1 : 1;
      return left.localeCompare(right);
    });
}
