/**
 * ID BRIDGE (Gate E) — client-side hook for `FinanceHub.tsx`'s AP_MOUNT §B v3
 * mount branches. Translates the legacy `/api/v8/finance/*` row id the OLD
 * list still uses into the canonical `{artifactId, businessVersionId}` pair
 * the four v3 detail workspaces (Baseline/Prediction/Analysis/Valuation)
 * need, via `resolveLegacyFinanceArtifact` (`financeV2.api.ts`).
 *
 * ★ Anti-cicha-pustka (CLAUDE.md — "cicha pustka jest gorsza niż widoczny
 * błąd"): this hook resolves to exactly FOUR states, and the caller
 * (`FinanceLegacyBridgeGate.tsx`) renders a DIFFERENT, honest UI for each —
 * never a blank/empty shell standing in for "we don't actually know yet":
 *
 *   - `loading`    — request in flight.
 *   - `resolved`   — a canonical artifact exists; safe to mount the real v3
 *                    workspace with REAL ids.
 *   - `unresolved` — the legacy row has no canonical counterpart yet, EITHER
 *                    because it was never migrated (`NOT_MIGRATED`) or
 *                    because the backfill looked at it and deliberately
 *                    excluded it (`QUARANTINED`, reason surfaced when known).
 *                    Both fold into the same UI treatment ("nothing to open
 *                    here yet") but the underlying `code` stays distinct for
 *                    logging/tests — see `financeV2.types.ts`'s own comment
 *                    on why folding the UI copy is fine but folding the
 *                    MACHINE state would not be.
 *   - `error`      — the resolve request itself failed (network/5xx) — a
 *                    DIFFERENT situation from `unresolved` (we don't know
 *                    whether a canonical artifact exists, vs. we asked and
 *                    got a definite "no").
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { resolveLegacyFinanceArtifact } from '@/services/api/financeV2.api';
import {
  describeFinanceV2Error,
  type FinanceArtifactType,
  type LegacyFinanceTable,
} from '@/services/api/financeV2.types';

export interface FinanceLegacyBridgeResolved {
  kind: 'resolved';
  artifactId: string;
  businessVersionId: string | null;
  artifactType: FinanceArtifactType;
}

export interface FinanceLegacyBridgeUnresolved {
  kind: 'unresolved';
  /** `NOT_MIGRATED` or `QUARANTINED` — kept distinct for callers/tests that need it (e.g. logging), even though the default UI treatment is the same for both. */
  code: 'NOT_MIGRATED' | 'QUARANTINED';
  /** Only ever set for `QUARANTINED`, and only when the backfill recorded one. */
  reason: string | null;
}

export type FinanceLegacyBridgeState =
  | { kind: 'loading' }
  | FinanceLegacyBridgeResolved
  | FinanceLegacyBridgeUnresolved
  | { kind: 'error'; message: string };

export interface UseFinanceLegacyBridgeResult {
  state: FinanceLegacyBridgeState;
  retry: () => void;
}

export function useFinanceLegacyBridge(
  legacyTable: LegacyFinanceTable,
  legacyId: string
): UseFinanceLegacyBridgeResult {
  const [state, setState] = useState<FinanceLegacyBridgeState>({ kind: 'loading' });
  // Bumped by `retry()` to re-trigger the effect below without adding
  // `legacyTable`/`legacyId` identity churn as a dependency-array footgun.
  const [attempt, setAttempt] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setState({ kind: 'loading' });

    resolveLegacyFinanceArtifact(legacyTable, legacyId)
      .then((dto) => {
        if (cancelledRef.current) return;
        if (dto.status === 'RESOLVED') {
          setState({
            kind: 'resolved',
            artifactId: dto.artifactId,
            businessVersionId: dto.businessVersionId,
            artifactType: dto.artifactType,
          });
          return;
        }
        if (dto.status === 'QUARANTINED') {
          setState({ kind: 'unresolved', code: 'QUARANTINED', reason: dto.reason });
          return;
        }
        setState({ kind: 'unresolved', code: 'NOT_MIGRATED', reason: null });
      })
      .catch((err) => {
        if (cancelledRef.current) return;
        setState({ kind: 'error', message: describeFinanceV2Error(err).detail });
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [legacyTable, legacyId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, retry };
}
