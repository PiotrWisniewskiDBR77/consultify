/**
 * useProposeCards — pure data hook for the "AI-proposed initiative cards" feature.
 *
 * Calls the live backend `POST /api/initiatives/propose-cards` and stores the
 * deterministic proposal it returns:
 *   - `core`     → the 6 mandatory core card componentKeys (always present)
 *   - `proposed` → optional extra card componentKeys suggested for the type
 *   - `type`     → the resolved type bucket the proposal was derived from
 *
 * Design contract:
 *   - Pure data hook (NO JSX) so it is trivially unit-testable with a mocked
 *     `@/services/api`.
 *   - DEFENSIVE: tolerates missing/garbled response fields (defaults to []), and
 *     NEVER throws to the caller — a rejected request sets `error` instead.
 *   - Guards against overlapping calls: a stale in-flight response is ignored if
 *     a newer `fetchProposal` started after it.
 *
 * Additive: this file does not modify any existing module.
 */
import { useCallback, useRef, useState } from 'react';

import { Api } from '@/services/api';

export interface ProposeCardsArgs {
  type?: string;
  sourceType?: string;
  brief?: string;
}

export interface UseProposeCardsResult {
  core: string[];
  proposed: string[];
  type: string;
  loading: boolean;
  error: string | null;
  fetchProposal: (args: ProposeCardsArgs) => Promise<void>;
}

/** Coerce an unknown value into a string[] of non-empty strings. */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

export function useProposeCards(): UseProposeCardsResult {
  const [core, setCore] = useState<string[]>([]);
  const [proposed, setProposed] = useState<string[]>([]);
  const [type, setType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Monotonic request id — only the latest in-flight request is allowed to
  // commit its result, so overlapping calls can't clobber each other.
  const requestSeq = useRef(0);

  const fetchProposal = useCallback(async (args: ProposeCardsArgs): Promise<void> => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const body: ProposeCardsArgs = {};
      if (args?.type != null) body.type = args.type;
      if (args?.sourceType != null) body.sourceType = args.sourceType;
      if (args?.brief != null) body.brief = args.brief;

      const res = await Api.post('/initiatives/propose-cards', body);
      // Api.post returns an axios-like response; `res.data` resolves to the
      // payload. Read defensively so both axios-style and raw shapes work.
      const data = (res && (res as any).data != null ? (res as any).data : res) as
        | { core?: unknown; proposed?: unknown; type?: unknown }
        | null
        | undefined;

      // Ignore a stale response if a newer request has since started.
      if (seq !== requestSeq.current) return;

      setCore(toStringArray(data?.core));
      setProposed(toStringArray(data?.proposed));
      setType(typeof data?.type === 'string' ? data.type : '');
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const message =
        (err as { message?: string })?.message ||
        (typeof err === 'string' ? err : 'Failed to load proposed cards');
      setError(message);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  return { core, proposed, type, loading, error, fetchProposal };
}

export default useProposeCards;
