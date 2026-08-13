/**
 * AssessmentPresentationView — top-level container for the assessment
 * presentation screen. Fetches ONE frozen Output (`GET /api/method/
 * outputs/:id`, read-only — never POSTs, never creates a Presentation
 * Snapshot just because this screen was opened), adapts it, builds the
 * 9-slide deck model, and renders `PresentationDeck`. Every non-happy path
 * is an explicit, honest state — "Brak Outputu → jasny komunikat, nie
 * podstawione liczby" (worker brief): no fixture data is ever substituted
 * when the fetch fails or the id is missing.
 */
import { AlertTriangle, Loader2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import {
  getOutput,
  isAuthError,
  isOfflineError,
  MethodCoreApiError,
} from '@/method-core/api/methodCoreApi';

import {
  buildPresentationDeck,
  type PresentationDeckModel,
  type PresentationNarrativeInput,
} from './buildPresentationDeck';
import { extractUnknownReasonBreakdown, isPlausibleRawOutput, toAssessmentOutput } from './outputAdapter';
import { PresentationDeck } from './PresentationDeck';
import type { RawAssessmentOutputRecord } from './rawOutputTypes';

export type PresentationFetchResult = { readonly output: RawAssessmentOutputRecord };

export interface AssessmentPresentationViewProps {
  /** The frozen Output to present. `null`/`''` renders the "no Output"
   * state — the screen never falls back to sample data. */
  readonly outputId: string | null;
  readonly narrative?: PresentationNarrativeInput;
  readonly locale?: string;
  /** Injectable for tests/harness; defaults to the real `getOutput` HTTP
   * client (`@/method-core/api/methodCoreApi`), which reuses this repo's
   * shared fetch plumbing (auth headers, retry, timeout) rather than a
   * bespoke fetch call in this package. */
  readonly fetchOutput?: (outputId: string) => Promise<PresentationFetchResult>;
}

type ViewState =
  | { readonly kind: 'no-output' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'unrecognized-shape' }
  | { readonly kind: 'ready'; readonly model: PresentationDeckModel };

async function defaultFetchOutput(outputId: string): Promise<PresentationFetchResult> {
  const res = await getOutput(outputId);
  // `getOutput`'s declared return type (`MethodOutputSummary`) is a
  // NARROWER client type than the real server payload — see
  // `rawOutputTypes.ts`'s module doc comment. The runtime object still has
  // every field `RawAssessmentOutputRecord` needs; `isPlausibleRawOutput`
  // (called by the caller of this function) is what actually decides
  // whether to trust it, not this cast.
  return { output: res.output as unknown as RawAssessmentOutputRecord };
}

function StateScreen({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex h-full min-h-[420px] w-full flex-col items-center justify-center gap-3 bg-c-bg px-8 text-center text-c-text">
      {children}
    </div>
  );
}

export const AssessmentPresentationView: React.FC<AssessmentPresentationViewProps> = ({
  outputId,
  narrative,
  locale = 'pl',
  fetchOutput = defaultFetchOutput,
}) => {
  const [state, setState] = useState<ViewState>(() => (outputId ? { kind: 'loading' } : { kind: 'no-output' }));

  const stableNarrative = useMemo<PresentationNarrativeInput>(() => narrative ?? {}, [narrative]);

  useEffect(() => {
    if (!outputId) {
      setState({ kind: 'no-output' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });

    fetchOutput(outputId)
      .then((res) => {
        if (cancelled) return;
        if (!isPlausibleRawOutput(res.output)) {
          setState({ kind: 'unrecognized-shape' });
          return;
        }
        const output = toAssessmentOutput(res.output);
        const breakdown = extractUnknownReasonBreakdown(res.output);
        const model = buildPresentationDeck(output, stableNarrative, breakdown);
        setState({ kind: 'ready', model });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof MethodCoreApiError && err.status === 404) {
          setState({ kind: 'not-found' });
          return;
        }
        if (isAuthError(err)) {
          setState({ kind: 'forbidden' });
          return;
        }
        if (isOfflineError(err)) {
          setState({ kind: 'offline' });
          return;
        }
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Nieznany błąd pobierania Outputu.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [outputId, fetchOutput, stableNarrative]);

  switch (state.kind) {
    case 'no-output':
      return (
        <StateScreen>
          <AlertTriangle size={28} className="text-c-text-muted" />
          <p className="max-w-md text-sm text-c-text-secondary">
            Brak zamrożonego Outputu do zaprezentowania. Ten ekran nie pokazuje przykładowych liczb — wskaż
            konkretny Output.
          </p>
        </StateScreen>
      );
    case 'loading':
      return (
        <StateScreen>
          <Loader2 size={24} className="animate-spin text-c-text-muted" />
          <p className="text-sm text-c-text-muted">Wczytywanie zamrożonego Outputu…</p>
        </StateScreen>
      );
    case 'not-found':
      return (
        <StateScreen>
          <AlertTriangle size={28} className="text-c-danger" />
          <p className="max-w-md text-sm text-c-text-secondary">
            Nie znaleziono Outputu o podanym identyfikatorze — mógł zostać usunięty lub identyfikator jest
            nieprawidłowy.
          </p>
        </StateScreen>
      );
    case 'forbidden':
      return (
        <StateScreen>
          <AlertTriangle size={28} className="text-c-danger" />
          <p className="max-w-md text-sm text-c-text-secondary">
            Brak dostępu do tego Outputu w bieżącej organizacji.
          </p>
        </StateScreen>
      );
    case 'offline':
      return (
        <StateScreen>
          <AlertTriangle size={28} className="text-c-warning" />
          <p className="max-w-md text-sm text-c-text-secondary">
            Brak połączenia z serwerem — nie udało się pobrać Outputu. Spróbuj ponownie po odzyskaniu
            połączenia.
          </p>
        </StateScreen>
      );
    case 'unrecognized-shape':
      return (
        <StateScreen>
          <AlertTriangle size={28} className="text-c-danger" />
          <p className="max-w-md text-sm text-c-text-secondary">
            Odpowiedź serwera nie ma oczekiwanego kształtu zamrożonego Outputu — prezentacja nie może
            wyświetlić niezweryfikowanych danych.
          </p>
        </StateScreen>
      );
    case 'error':
      return (
        <StateScreen>
          <AlertTriangle size={28} className="text-c-danger" />
          <p className="max-w-md text-sm text-c-text-secondary">{state.message}</p>
        </StateScreen>
      );
    case 'ready':
      return <PresentationDeck model={state.model} locale={locale} />;
    default:
      return null;
  }
};

export default AssessmentPresentationView;
