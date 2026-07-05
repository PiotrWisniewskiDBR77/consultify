/**
 * mentionAutocomplete — shared @mention teammate autocomplete + highlight
 * helpers for Idea node comment composers (B2: NodeCommentThread /
 * B2b: IdeaNodeDetailDrawer). Extracted so both comment surfaces share ONE
 * consistent behavior: caret-based "@" detection, org-member dropdown,
 * resolved user-id mentions, and @Name highlight rendering.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { OrganizationApi } from '@/services/api/organizations.api';
import { useAppStore } from '@/store/useAppStore';

export interface MentionMember {
  id: string;
  name: string;
}

/**
 * Render comment text with @mentions highlighted as distinct tokens. Known
 * member names (which may contain spaces, e.g. "@Anna Kowalska") are matched
 * first against the supplied pool; anything else falls back to a single-word
 * "@handle" token.
 */
export function renderMentionText(text: string, pool: MentionMember[]): React.ReactNode[] {
  const names = pool
    .map((p) => p.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length); // longest-first so full names win
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameAlt = names.map(escape).join('|');
  const pattern = nameAlt ? `@(?:${nameAlt}|\\w+)` : '@\\w+';
  const re = new RegExp(`(${pattern})`, 'g');
  return text.split(re).map((part, idx) =>
    part.startsWith('@') ? (
      <span key={idx} className="text-c-info font-medium">
        {part}
      </span>
    ) : (
      <span key={idx}>{part}</span>
    )
  );
}

/**
 * Hook powering the "@" autocomplete affordance on a comment composer
 * textarea: fetches org members while `active`, tracks caret-driven mention
 * query state, exposes filtered suggestions, and resolves free-text @tokens
 * to org-member user ids for the create-comment call.
 */
export function useMentionAutocomplete(active: boolean) {
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPool, setMentionPool] = useState<MentionMember[]>([]);

  useEffect(() => {
    if (!active || !currentOrganization?.id) return;
    let cancelled = false;
    OrganizationApi.getOrganizationMembers(currentOrganization.id)
      .then((rows) => {
        if (cancelled) return;
        setMentionPool(
          rows.map((r) => ({
            id: r.userId,
            name: (r.name && r.name.trim()) || r.email || r.userId,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setMentionPool([]);
      });
    return () => {
      cancelled = true;
    };
  }, [active, currentOrganization?.id]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionPool
      .filter(
        (u) => !q || u.name.toLowerCase().includes(q) || String(u.id).toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [mentionQuery, mentionPool]);

  /**
   * Resolve the @tokens in the composed text to org-member user ids (so the
   * backend notifies the right people). Falls back to the raw name token when
   * a mention doesn't match a known member — the server resolver is tolerant
   * and org-scopes anyway, so an unmatched token is simply ignored server-side.
   */
  const resolveMentionIds = useCallback(
    (body: string): string[] => {
      const rawTokens = body.match(/@([^\s@]{1,80})/g)?.map((m) => m.slice(1)) || [];
      const out: string[] = [];
      const seen = new Set<string>();
      for (const tok of rawTokens) {
        const t = tok.toLowerCase();
        const hit = mentionPool.find(
          (u) => u.name.toLowerCase() === t || String(u.id).toLowerCase() === t
        );
        const val = hit ? hit.id : tok;
        if (seen.has(val)) continue;
        seen.add(val);
        out.push(val);
      }
      return out;
    },
    [mentionPool]
  );

  /** Change handler for the composer textarea: detects an in-progress "@token". */
  const handleMentionInput = useCallback((val: string, caret: number) => {
    const beforeCaret = val.slice(0, caret);
    const lastAtIdx = beforeCaret.lastIndexOf('@');
    if (lastAtIdx < 0) {
      setMentionQuery(null);
      return;
    }
    // "@" must be at start or follow whitespace (so email@host doesn't trigger).
    const charBefore = lastAtIdx > 0 ? beforeCaret[lastAtIdx - 1] : ' ';
    const afterAt = beforeCaret.slice(lastAtIdx + 1);
    if (!/\s/.test(charBefore) || afterAt.includes(' ') || afterAt.includes('\n')) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(afterAt);
  }, []);

  const closeMentionMenu = useCallback(() => setMentionQuery(null), []);

  return {
    mentionPool,
    mentionQuery,
    mentionSuggestions,
    resolveMentionIds,
    handleMentionInput,
    closeMentionMenu,
  };
}

/**
 * Insert `@Name ` at the last "@token" before the caret in `body`, returning
 * the new text and the caret position to restore focus to.
 */
export function insertMentionIntoText(
  body: string,
  caretPos: number,
  user: MentionMember
): { text: string; caret: number } | null {
  const beforeCaret = body.slice(0, caretPos);
  const lastAt = beforeCaret.lastIndexOf('@');
  if (lastAt < 0) return null;
  const newText = body.slice(0, lastAt) + `@${user.name} ` + body.slice(caretPos);
  return { text: newText, caret: lastAt + user.name.length + 2 };
}
