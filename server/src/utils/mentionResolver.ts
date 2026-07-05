/**
 * mentionResolver — org-scoped @mention parsing + resolution.
 *
 * Shared, pure helpers used when a comment (whiteboard / idea node, and reusable
 * elsewhere) carries @mentions. Given the raw comment text and/or an explicit
 * mention-token array plus the caller's org member roster, resolve the set of
 * mentioned **org member user ids**. Tokens that do not match any org member are
 * dropped — this is the security boundary that prevents notifying users outside
 * the caller's organization.
 *
 * No DB access here (kept pure for unit-testability); callers pass the roster in.
 */

/** A minimal org-member shape. Matches organizationService.getMembers() rows. */
export interface OrgMemberLike {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

/**
 * Extract raw @mention tokens from free comment text.
 *
 * A token starts at "@" that follows whitespace or the string start (so
 * "email@host" does NOT trigger) and runs to the next whitespace. The leading
 * "@" is stripped. Duplicates are preserved here (resolution dedupes later).
 */
export function extractMentionTokens(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /(?:^|\s)@([^\s@]{1,80})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const token = m[1].trim();
    if (token) out.push(token);
  }
  return out;
}

/** Full display name for a member, falling back to email then user id. */
function memberDisplayName(m: OrgMemberLike): string {
  const full = `${m.first_name || ''} ${m.last_name || ''}`.trim();
  return full || m.email || m.user_id;
}

/** Normalize a token/name for tolerant matching (case-insensitive, no @, trimmed). */
function norm(s: string): string {
  return String(s || '')
    .replace(/^@+/, '')
    .trim()
    .toLowerCase();
}

/**
 * Resolve mention tokens to org-member user ids, strictly org-scoped.
 *
 * A token matches a member when it equals (case-insensitively) any of:
 *   - the member's user_id
 *   - the member's email (or its local-part before "@")
 *   - the member's full display name
 *   - the member's first name (so "@Anna" resolves when unambiguous within the org)
 *
 * Tokens matching no member are ignored (cannot escape the org). Self-mentions
 * are excluded when `excludeUserId` is supplied. The result is de-duplicated and
 * order-stable by first appearance.
 */
export function resolveMentionedUserIds(
  tokens: string[],
  members: OrgMemberLike[],
  excludeUserId?: string
): string[] {
  if (!Array.isArray(tokens) || tokens.length === 0) return [];
  if (!Array.isArray(members) || members.length === 0) return [];

  // Build lookup indexes once.
  const byId = new Map<string, string>();
  const byEmail = new Map<string, string>();
  const byLocalPart = new Map<string, string>();
  const byFullName = new Map<string, string>();
  const byFirstName = new Map<string, string>();
  const firstNameCollisions = new Set<string>();

  for (const m of members) {
    if (!m?.user_id) continue;
    byId.set(norm(m.user_id), m.user_id);
    if (m.email) {
      const e = norm(m.email);
      byEmail.set(e, m.user_id);
      const local = e.split('@')[0];
      if (local) byLocalPart.set(local, m.user_id);
    }
    byFullName.set(norm(memberDisplayName(m)), m.user_id);
    if (m.first_name) {
      const fn = norm(m.first_name);
      if (byFirstName.has(fn) && byFirstName.get(fn) !== m.user_id) {
        firstNameCollisions.add(fn); // ambiguous first name → don't guess
      } else {
        byFirstName.set(fn, m.user_id);
      }
    }
  }

  const resolved: string[] = [];
  const seen = new Set<string>();
  for (const raw of tokens) {
    const t = norm(raw);
    if (!t) continue;
    const uid =
      byId.get(t) ||
      byEmail.get(t) ||
      byLocalPart.get(t) ||
      byFullName.get(t) ||
      (firstNameCollisions.has(t) ? undefined : byFirstName.get(t));
    if (!uid) continue;
    if (excludeUserId && uid === excludeUserId) continue;
    if (seen.has(uid)) continue;
    seen.add(uid);
    resolved.push(uid);
  }
  return resolved;
}

/**
 * Convenience: parse text + explicit token array together, then resolve.
 * Explicit tokens (e.g. from the composer) and text-extracted tokens are merged.
 */
export function resolveMentionsFromComment(
  text: string,
  explicitTokens: string[] | undefined,
  members: OrgMemberLike[],
  excludeUserId?: string
): string[] {
  const tokens = [
    ...(Array.isArray(explicitTokens) ? explicitTokens : []),
    ...extractMentionTokens(text || ''),
  ];
  return resolveMentionedUserIds(tokens, members, excludeUserId);
}
