/**
 * whiteboardReactions — B4: minimal emoji reactions for whiteboard nodes.
 *
 * Activates the previously-dead `reactionsEnabled` flag on the facilitation
 * session (WhiteboardSessionState). Reactions are stored INSIDE the node's
 * `data.reactions` array, so they persist through the existing per-node
 * autosave path (setNodes → onGraphChange → /map PUT) — no new endpoint.
 *
 * Data model: a flat list of `{ emoji, userId }` entries. One entry per
 * (user, emoji) pair. Toggle semantics: clicking an emoji you have NOT yet
 * reacted with adds your entry; clicking one you HAVE already reacted with
 * removes it (a user can hold multiple different emoji on the same node, but
 * only one of each). This keeps counts = number of distinct users per emoji.
 */

/** Fixed, intentionally-small reaction set. No emoji-picker dependency. */
export const WHITEBOARD_REACTION_EMOJIS = ['👍', '❤️', '💡', '❓'] as const;

export type WhiteboardReactionEmoji = (typeof WHITEBOARD_REACTION_EMOJIS)[number];

export interface WhiteboardReactionEntry {
  emoji: string;
  userId: string;
}

/** Narrow an unknown `data.reactions` field into a clean entry array. */
export function normalizeReactions(raw: unknown): WhiteboardReactionEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: WhiteboardReactionEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const emoji = (item as { emoji?: unknown }).emoji;
    const userId = (item as { userId?: unknown }).userId;
    if (typeof emoji === 'string' && emoji && typeof userId === 'string' && userId) {
      // De-dupe (emoji,user) — defensive against double-writes.
      if (!out.some((e) => e.emoji === emoji && e.userId === userId)) {
        out.push({ emoji, userId });
      }
    }
  }
  return out;
}

/**
 * Toggle `userId`'s reaction with `emoji`. Returns a NEW array (never mutates).
 * - If the user already reacted with that emoji → remove it.
 * - Otherwise → add it.
 */
export function toggleReaction(
  reactions: unknown,
  emoji: string,
  userId: string
): WhiteboardReactionEntry[] {
  const list = normalizeReactions(reactions);
  const existingIdx = list.findIndex((e) => e.emoji === emoji && e.userId === userId);
  if (existingIdx >= 0) {
    return list.filter((_, i) => i !== existingIdx);
  }
  return [...list, { emoji, userId }];
}

export interface WhiteboardReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

/**
 * Roll reactions up into per-emoji pills, preserving the canonical emoji order
 * and dropping any emoji with a zero count. `currentUserId` marks own pills.
 */
export function summarizeReactions(
  reactions: unknown,
  currentUserId: string
): WhiteboardReactionSummary[] {
  const list = normalizeReactions(reactions);
  const order: string[] = [...WHITEBOARD_REACTION_EMOJIS];
  const seen = new Map<string, WhiteboardReactionSummary>();
  for (const emoji of order) {
    seen.set(emoji, { emoji, count: 0, reactedByMe: false });
  }
  for (const entry of list) {
    let summary = seen.get(entry.emoji);
    if (!summary) {
      // Unknown emoji (legacy / future set) — append after the canonical ones.
      summary = { emoji: entry.emoji, count: 0, reactedByMe: false };
      seen.set(entry.emoji, summary);
      order.push(entry.emoji);
    }
    summary.count += 1;
    if (entry.userId === currentUserId) summary.reactedByMe = true;
  }
  return order
    .map((emoji) => seen.get(emoji)!)
    .filter((s) => s.count > 0);
}
