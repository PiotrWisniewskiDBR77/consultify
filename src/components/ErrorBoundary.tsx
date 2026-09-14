import React, { Component, ErrorInfo, ReactNode } from 'react';

// Komponent KLASOWY — bez dostepu do `useTranslation`; ekran awarii nie
// przerysowuje sie po zmianie jezyka, wiec instancja i18n wystarczy.
import i18n from '@/i18n';
import {
  announceChunkUpdateAvailable,
  attemptChunkReload,
  hasAlreadyAttemptedChunkReload,
  isChunkLoadError,
} from '@/utils/chunkLoadRecovery';

import { addFeedbackBreadcrumb } from '../services/feedbackCollector';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  telemetryDelivery: 'idle' | 'sent' | 'failed' | 'unavailable';
  // Z-11 (2026-09-14): `ErrorBoundary` jest ta powłoka, w której ląduje błąd
  // ładowania chunku `MainLayout` (lazy-loaded WYŻEJ niż `RouteErrorBoundary`,
  // patrz routes/AppRoutes.tsx) — karta otwarta przed wdrożeniem prosi o plik
  // usunięty przez nowy build. `chunkReloadPending` = trwa jednorazowe
  // auto-przeładowanie (nie pokazujemy strasznego ekranu awarii na te ~50ms);
  // `chunkReloadExhausted` = już próbowaliśmy raz w tej sesji i nadal się
  // wywala → pokazujemy baner "nowa wersja", nie "Reset Application Data".
  chunkReloadPending: boolean;
  chunkReloadExhausted: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    componentStack: null,
    telemetryDelivery: 'idle',
    chunkReloadPending: false,
    chunkReloadExhausted: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      componentStack: null,
      telemetryDelivery: 'idle',
      chunkReloadPending: false,
      chunkReloadExhausted: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    console.error('[ErrorBoundary] Error stack:', error.stack);

    this.setState({ componentStack: errorInfo.componentStack || null });

    if (isChunkLoadError(error)) {
      if (!hasAlreadyAttemptedChunkReload()) {
        this.setState({ chunkReloadPending: true });
        // Slight delay so telemetry below has a chance to fire before we
        // navigate away — same reasoning as RouteErrorBoundary.
        setTimeout(() => {
          attemptChunkReload();
        }, 50);
      } else {
        this.setState({ chunkReloadExhausted: true });
        announceChunkUpdateAvailable();
      }
    }

    try {
      addFeedbackBreadcrumb({
        kind: 'custom',
        label: `ErrorBoundary: ${error.message}`.slice(0, 120),
      });
      if (typeof window !== 'undefined') {
        (window as any).__LAST_BOUNDARY_ERROR__ = {
          at: new Date().toISOString(),
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        };
      }
    } catch {
      // telemetry errors must never mask the original error
    }

    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      window
        .fetch('/api/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            url: window.location?.href,
            userAgent: window.navigator?.userAgent,
          }),
        })
        .then((res) => {
          // fetch resolves on 4xx/5xx too — only a real ack counts as delivered.
          this.setState({ telemetryDelivery: res.ok ? 'sent' : 'failed' });
        })
        .catch(() => {
          this.setState({ telemetryDelivery: 'failed' });
        });
    } else {
      this.setState({ telemetryDelivery: 'unavailable' });
    }
  }

  private handleReport = () => {
    if (typeof window === 'undefined') return;
    try {
      (window as any).__FEEDBACK_PREFILL__ = {
        type: 'BUG',
        title: `Crash: ${this.state.error?.message?.slice(0, 80) || 'unknown error'}`,
        message: this.state.error?.message || 'Aplikacja uległa awarii.',
        severity: 'CRITICAL',
        error: {
          message: this.state.error?.message,
          stack: this.state.error?.stack,
          componentStack: this.state.componentStack,
        },
        openSource: 'error-boundary',
      };
      window.dispatchEvent(
        new CustomEvent('feedback:open', { detail: { source: 'error-boundary' } })
      );
    } catch {
      // ignore
    }
  };

  private handleReset = () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.clear();
      } catch {}
      try {
        window.sessionStorage.clear();
      } catch {}
      try {
        // Some test environments may not route through window.localStorage reference
        (globalThis as any).localStorage?.clear?.();
      } catch {}
      window.location.href = '/';
    }
  };

  public render() {
    // Z-11: chunk missing after a deploy, first attempt in this session —
    // reload is already scheduled (componentDidCatch), don't flash the
    // scary crash screen for the ~50ms until it fires.
    if (this.state.hasError && this.state.chunkReloadPending) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-c-bg text-c-text p-6">
          <p data-testid="error-boundary-chunk-reload-pending" className="text-sm text-c-text-secondary">
            {i18n.t('errors.chunkUpdate.message', 'A new version of the app is available — refresh the page.')}
          </p>
        </div>
      );
    }

    // Z-11: already tried the one automatic reload this session and the
    // chunk is STILL missing (stale CDN/edge cache) — show the same
    // "new version, refresh" banner instead of the generic crash UI, with
    // an explicit action button (in case the persistent top banner didn't
    // mount, e.g. this boundary caught before ChunkUpdateBanner rendered).
    if (this.state.hasError && this.state.chunkReloadExhausted) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-c-bg text-c-text p-6">
          <div
            role="alert"
            aria-live="assertive"
            data-testid="error-boundary-chunk-update-banner"
            className="max-w-md w-full bg-c-surface border border-c-border rounded-xl p-8 shadow-2xl text-center"
          >
            <p className="mb-4 text-c-text">
              {i18n.t('errors.chunkUpdate.message', 'A new version of the app is available — refresh the page.')}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-c-text text-c-surface rounded-lg font-bold hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-c-focus"
            >
              {i18n.t('errors.chunkUpdate.action', 'Refresh')}
            </button>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
          <div className="max-w-md w-full bg-slate-800 p-8 rounded-xl border border-red-500/30 shadow-2xl">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong</h1>
            <p className="text-slate-600 mb-6">
              The application encountered an unexpected error. This usually happens due to corrupted
              local data or a temporary glitch.
            </p>
            <div
              className="bg-slate-950 p-4 rounded-lg mb-2 text-sm text-red-300"
              role="alert"
              aria-live="assertive"
            >
              Runtime details are hidden for safety. You can retry, reset app data, or report this
              incident with context.
            </div>
            <div className="mb-6 text-xs text-slate-600">
              Technical diagnostics are captured in telemetry and available through the report
              action.
            </div>
            {this.state.telemetryDelivery === 'sent' && (
              <p
                data-testid="error-boundary-telemetry-sent"
                className="mb-3 text-xs text-emerald-300"
              >
                Crash diagnostics were sent to the observability pipeline.
              </p>
            )}
            {this.state.telemetryDelivery === 'failed' && (
              <p
                data-testid="error-boundary-telemetry-failed"
                className="mb-3 text-xs text-amber-300"
              >
                Crash diagnostics could not be delivered. Retry or report manually.
              </p>
            )}
            {this.state.telemetryDelivery === 'unavailable' && (
              <p
                data-testid="error-boundary-telemetry-unavailable"
                className="mb-3 text-xs text-amber-300"
              >
                Crash diagnostics were not sent in this environment.
              </p>
            )}
            <div className="space-y-2">
              <button
                onClick={this.handleReport}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 rounded-lg font-bold transition-colors"
              >
                {i18n.t('errors.boundary.reportWithContext', 'Report this error with full context')}
              </button>
              <button
                onClick={this.handleReset}
                className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors"
              >
                Reset Application Data (Fix)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
