/**
 * AssessmentReportView — data container for `AssessmentReportDocument`.
 *
 * Owns exactly three GET calls (`reportApi.ts`) and renders one of four
 * honest states: loading / not-frozen / error / loaded. Never performs a
 * write — generating or persisting a Report *snapshot*
 * (`POST /api/method/outputs/:id/report`) is a distinct, user-initiated
 * action belonging to a different surface; simply viewing this screen must
 * never create a database row.
 *
 * `outputId === null` means "this session has not been frozen yet" — the
 * caller (e.g. an Assessment session screen) knows this from the session's
 * own state and should pass `null` rather than omit the prop, so the
 * "wynik nie został jeszcze zamrożony" message is reachable without a
 * failed fetch first.
 */
import { AlertTriangle, FileText, Lock } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { EmptyState } from '../../shared/states';
import { AssessmentReportDocument } from './AssessmentReportDocument';
import {
  fetchApprovalsForReport,
  fetchOutputForReport,
  fetchSessionForReport,
  isAuthError,
} from './reportApi';
import type { AssessmentReportData } from './types';

export interface AssessmentReportViewProps {
  /** Frozen Output id, or `null` when the source session is known not to be
   * frozen yet (draft/active/in_review) — skips the fetch entirely. */
  outputId: string | null;
  className?: string;
}

type LoadState =
  | { kind: 'not-frozen' }
  | { kind: 'loading' }
  | { kind: 'forbidden' }
  | { kind: 'error' }
  | { kind: 'not-found' }
  | { kind: 'loaded'; data: AssessmentReportData };

export const AssessmentReportView: React.FC<AssessmentReportViewProps> = ({ outputId, className }) => {
  const [state, setState] = useState<LoadState>(outputId ? { kind: 'loading' } : { kind: 'not-frozen' });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!outputId) {
      setState({ kind: 'not-frozen' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });

    (async () => {
      try {
        const outputResult = await fetchOutputForReport(outputId);
        if (cancelled) return;
        if (!outputResult) {
          setState({ kind: 'not-found' });
          return;
        }
        const [session, approvals] = await Promise.all([
          fetchSessionForReport(outputResult.output.sessionId),
          fetchApprovalsForReport(outputResult.output.sessionId),
        ]);
        if (cancelled) return;
        setState({
          kind: 'loaded',
          data: {
            output: outputResult.output,
            superseded: outputResult.superseded,
            supersededByOutputId: outputResult.supersededByOutputId,
            session,
            approvals,
          },
        });
      } catch (err) {
        if (cancelled) return;
        setState({ kind: isAuthError(err) ? 'forbidden' : 'error' });
        // eslint-disable-next-line no-console -- fixed diagnostic only, no raw message in UI.
        console.error('[AssessmentReportView] failed to load report data', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [outputId, reloadToken]);

  return (
    <div className={`h-full overflow-auto px-4 py-6 sm:px-8 ${className ?? ''}`}>
      {state.kind === 'not-frozen' ? (
        <EmptyState
          variant="new"
          icon={Lock}
          title="Wynik nie został jeszcze zamrożony"
          description="Ten raport renderuje wyłącznie zamrożony, niezmienny Output sesji assessmentu. Sesja jest wciąż w toku (draft/active/in_review) — raport pojawi się dokładnie w momencie zamrożenia wyniku, nie wcześniej."
          compact
        />
      ) : state.kind === 'loading' ? (
        <div className="mx-auto flex max-w-[880px] flex-col gap-4" aria-busy="true" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-c-border-subtle bg-c-surface-raised" />
          ))}
        </div>
      ) : state.kind === 'not-found' ? (
        <EmptyState
          variant="error"
          icon={FileText}
          title="Nie znaleziono zamrożonego Outputu"
          description="Ten identyfikator Outputu nie istnieje albo nie należy do tej organizacji."
        />
      ) : state.kind === 'forbidden' ? (
        <EmptyState
          variant="forbidden"
          title="Brak dostępu do tego wyniku"
          description="To konto nie ma uprawnień do wyświetlenia tego Outputu."
        />
      ) : state.kind === 'error' ? (
        <EmptyState
          variant="error"
          icon={AlertTriangle}
          title="Nie udało się wczytać raportu"
          description="Spróbuj ponownie za chwilę."
          onRetry={() => setReloadToken((n) => n + 1)}
        />
      ) : (
        <AssessmentReportDocument data={state.data} />
      )}
    </div>
  );
};

export default AssessmentReportView;
