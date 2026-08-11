/**
 * `FinanceErrorBoundary` — lokalny error boundary dla dokumentów Finance
 * (Pakiet C, OWN-FIN-002).
 *
 * Zgłoszenie właściciela: „błąd jednej wyceny wywalał cały moduł". Ten
 * komponent owija TYLKO treść jednego dokumentu (workspace szczegółu) —
 * NIGDY całą powłokę Finance (Menu 1, FinanceWorkspaceBar zostają żywe poza
 * granicą tego boundary, więc `Ponów`/`Wróć do listy` mają gdzie wylądować).
 *
 * Wzorzec zaczerpnięty z istniejącego, zaakceptowanego w repo
 * `src/components/MyWork/table/ViewErrorBoundary.tsx` (class component —
 * `componentDidCatch`/`getDerivedStateFromError` to jedyny sposób złapania
 * błędu renderu w React < 19 bez zewnętrznej biblioteki), rozszerzony o:
 *   - correlation ID: ten sam `X-Correlation-ID`, którego już używa każde
 *     żądanie sieciowe (`src/services/api/baseClient.ts:16-20`,
 *     `sessionStorage['correlationId']`) — jeśli błąd wystąpił w trakcie
 *     wywołania API, ID w UI odpowiada ID w logach serwera. Do tego doklejamy
 *     krótki, per-błąd sufiks, żeby dwa różne błędy w tej samej sesji miały
 *     różne, ale powiązane ID.
 *   - zachowanie wybranego artefaktu i draftu: ten komponent NIE resetuje
 *     żadnego stanu callera — `onRetry`/`onBackToList` to callbacki, które
 *     rodzic dostarcza; boundary sam nie wie nic o artefakcie/drafcie, więc
 *     nie ma jak ich skasować (to jest właśnie dowód „artefakt i draft
 *     zachowane" — patrz test negatywnej kontroli).
 */

import React from 'react';

function readSessionCorrelationId(): string {
  try {
    return sessionStorage.getItem('correlationId') || 'no-session-correlation-id';
  } catch {
    return 'no-session-correlation-id';
  }
}

function makeErrorCorrelationId(): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${readSessionCorrelationId()}-${suffix}`;
}

export interface FinanceErrorBoundaryProps {
  /** Nazwa dokumentu/widoku w komunikacie (np. „Wycena DBR77 FY2026"). */
  documentLabel: string;
  onRetry: () => void;
  onBackToList: () => void;
  children: React.ReactNode;
}

interface FinanceErrorBoundaryState {
  hasError: boolean;
  correlationId: string | null;
  errorMessage: string | null;
}

export class FinanceErrorBoundary extends React.Component<FinanceErrorBoundaryProps, FinanceErrorBoundaryState> {
  constructor(props: FinanceErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, correlationId: null, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): Partial<FinanceErrorBoundaryState> {
    return {
      hasError: true,
      correlationId: makeErrorCorrelationId(),
      // Honest UI (CANON.md §4.1): NIE pokazujemy stack trace/surowego błędu
      // backendu jako jedynego komunikatu — tylko `error.message`, skrócone,
      // jako pomoc diagnostyczna obok correlation ID, nigdy jako całość UI.
      errorMessage: error?.message ? String(error.message).slice(0, 200) : null,
    };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[FinanceErrorBoundary]', this.props.documentLabel, this.state.correlationId, error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, correlationId: null, errorMessage: null });
    this.props.onRetry();
  };

  override render(): React.ReactNode {
    const { children, documentLabel, onBackToList } = this.props;
    const { hasError, correlationId, errorMessage } = this.state;

    if (!hasError) {
      return children;
    }

    return (
      <div
        role="alert"
        data-testid="finance-error-boundary"
        className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-c-border-subtle bg-c-surface px-6 py-10 text-center"
      >
        <div className="max-w-md space-y-2">
          <p className="text-sm font-semibold text-c-text">Nie udało się wyświetlić: {documentLabel}</p>
          <p className="text-xs text-c-text-muted">
            Wystąpił nieoczekiwany błąd w tym dokumencie. Reszta obszaru roboczego (lista, pasek, inne dokumenty)
            działa dalej — Twój wybrany artefakt i niezapisane zmiany są zachowane.
          </p>
          {errorMessage && (
            <p className="text-xs text-c-text-muted">
              Szczegół: <span className="font-mono">{errorMessage}</span>
            </p>
          )}
          {correlationId && (
            <p className="text-xs text-c-text-muted" data-testid="finance-error-boundary-correlation-id">
              ID zgłoszenia: <span className="font-mono select-all">{correlationId}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex min-h-[2.75rem] items-center rounded-xl border border-c-border-subtle bg-c-surface px-4 text-xs font-semibold text-c-text shadow-sm transition hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            Ponów
          </button>
          <button
            type="button"
            onClick={onBackToList}
            className="inline-flex min-h-[2.75rem] items-center rounded-xl bg-c-text px-4 text-xs font-semibold text-c-surface shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            Wróć do listy
          </button>
        </div>
      </div>
    );
  }
}

export default FinanceErrorBoundary;
