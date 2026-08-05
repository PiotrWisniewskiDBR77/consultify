/**
 * InitiativeSuggestionBadge — F2 CANDIDATE INBOX (D5/D8): contextual badge
 * "AI suggests an initiative →" next to recognition artifacts (insight / assessment / audit).
 *
 * Goal: when AI has generated an initiative candidate from THIS artifact (and it waits as
 * `pending` in the inbox), show a discreet button next to the artifact that lets you
 * accept the suggestion with one click (→ generator F1) without entering the hub.
 *
 * Behavior:
 *   - reads pending candidates (GET /api/initiatives/candidates?status=pending),
 *   - renders ONLY when a candidate matches (sourceType, sourceId),
 *   - click → if `onCreate` provided → calls it with the candidate (host decides what next,
 *     e.g. opens generator F1); otherwise → POST /candidates/:id/accept
 *     and disappears on success.
 *
 * Self-contained: reuses API_URL/getHeaders from baseClient (zero edits to shared
 * APIs), i18n PL/EN via t() with EN fallbacks, dark-mode-aware (dark: classes). Fail-soft —
 * fetch error = badge hidden (does not break the host view).
 */
import { Loader2, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { API_URL, getHeaders } from '@/services/api/baseClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Type of recognition artifact the badge is pinned to. */
export type SuggestionSourceType = 'interview_insight' | 'assessment' | 'audit' | string;

export interface InitiativeCandidateLite {
  id: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  rationale: string;
  fitScore: number;
  status: string;
}

export interface InitiativeSuggestionBadgeProps {
  /** Type of the source artifact (e.g. 'audit'). */
  sourceType: SuggestionSourceType;
  /** Id of the source artifact. */
  sourceId: string;
  /**
   * Optional click handler. When provided — called with the matched candidate
   * INSTEAD of the default POST accept (host takes over the action, e.g. opens generator F1).
   * May be async; the badge shows a busy state for its duration.
   */
  onCreate?: (candidate: InitiativeCandidateLite) => void | Promise<void>;
  /** Extra container classes (host layout). */
  className?: string;
}

const CANDIDATES_BASE = `${API_URL}/initiatives/candidates`;

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InitiativeSuggestionBadge({
  sourceType,
  sourceId,
  onCreate,
  className,
}: InitiativeSuggestionBadgeProps): React.ReactElement | null {
  const { t } = useTranslation();
  const [candidate, setCandidate] = useState<InitiativeCandidateLite | null>(null);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Fetch pending candidates and find a match for this artifact.
  useEffect(() => {
    let cancelled = false;
    if (!sourceType || !sourceId) {
      setCandidate(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${CANDIDATES_BASE}?status=pending`, {
          headers: getHeaders(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await readJson(res);
        const list: InitiativeCandidateLite[] = Array.isArray(data?.candidates)
          ? data.candidates
          : [];
        const match =
          list.find(
            (c) =>
              String(c.sourceType) === String(sourceType) &&
              c.sourceId != null &&
              String(c.sourceId) === String(sourceId)
          ) ?? null;
        if (!cancelled && mounted.current) setCandidate(match);
      } catch {
        // fail-soft — no match = badge hidden, host untouched
        if (!cancelled && mounted.current) setCandidate(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceType, sourceId]);

  const handleClick = useCallback(async () => {
    if (!candidate || busy) return;
    setBusy(true);
    try {
      if (onCreate) {
        await onCreate(candidate);
        if (mounted.current) setAccepted(true);
        return;
      }
      const res = await fetch(`${CANDIDATES_BASE}/${encodeURIComponent(candidate.id)}/accept`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await readJson(res);
      if (data?.accepted !== true || data?.receiptPersisted !== true) {
        throw new Error('Acceptance receipt was not persisted');
      }
      if (mounted.current) setAccepted(true);
    } catch {
      // fail-soft — keep the badge visible so it can be retried
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [candidate, busy, onCreate]);

  // No matched candidate or already accepted → render nothing.
  if (!candidate || accepted) return null;

  const label = t('initiatives.suggestionBadge.label', 'AI suggests an initiative');

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={t(
        'initiatives.suggestionBadge.aria',
        'Accept the suggested initiative from this artifact'
      )}
      title={candidate.rationale || label}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-xs font-medium transition-colors',
        'border-indigo-200 bg-indigo-50 text-indigo-700',
        'hover:bg-indigo-100 hover:border-indigo-300',
        'dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300',
        'dark:hover:bg-indigo-500/20',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className || '',
      ].join(' ')}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" data-testid="suggestion-badge-spinner" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" data-testid="suggestion-badge-icon" />
      )}
      <span>{label}</span>
      <span aria-hidden="true">→</span>
    </button>
  );
}

export default InitiativeSuggestionBadge;
