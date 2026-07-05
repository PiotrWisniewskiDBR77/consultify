import { AlertTriangle, Home, MessageSquareWarning, RefreshCw } from 'lucide-react';
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  didAutoReload: boolean;
  telemetryDelivery: 'idle' | 'sent' | 'failed' | 'unavailable';
}

/**
 * RouteErrorBoundary - Error boundary for route-level error handling
 *
 * Catches errors in route components and displays a user-friendly error page.
 * Prevents entire app crash when a single route fails.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      didAutoReload: false,
      telemetryDelivery: 'idle',
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      didAutoReload: false,
      telemetryDelivery: 'idle',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RouteErrorBoundary] Caught error:', error, errorInfo);

    this.setState({ error });

    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      window
        .fetch('/api/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            url: window.location.href,
          }),
          keepalive: true,
        })
        .then((response) => {
          this.setState({ telemetryDelivery: response?.ok ? 'sent' : 'failed' });
        })
        .catch(() => {
          this.setState({ telemetryDelivery: 'failed' });
        });
    } else {
      this.setState({ telemetryDelivery: 'unavailable' });
    }

    // System recovery: dynamic-import/module-script failures are typically fixed by a hard reload,
    // but users shouldn't have to click anything. Guard against infinite reload loops by allowing
    // only one auto-reload per path per session.
    if (this.shouldHardReload(error) && !this.state.didAutoReload) {
      try {
        const path = typeof window !== 'undefined' ? window.location.pathname : 'unknown';
        const key = `__route_error_boundary_hard_reload__:${path}`;
        const already = typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : '1';
        if (!already && typeof window !== 'undefined') {
          window.sessionStorage.setItem(key, String(Date.now()));
          this.setState({ didAutoReload: true }, () => {
            // Slight delay so logs/state flush before reload.
            setTimeout(() => window.location.reload(), 50);
          });
        }
      } catch {
        // ignore - don't make error handling worse
      }
    }

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // trackError(error, errorInfo);
  }

  private shouldHardReload(error: Error | null): boolean {
    const msg = `${String(error || '')}\n${String((error as any)?.message || '')}`;
    // Common cases:
    // - Vite dev: "Outdated Optimize Dep" / 504
    // - Vite/Prod: dynamic import chunk missing / stale bundle after deploy
    return (
      msg.includes('Outdated Optimize Dep') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('module script failed')
    );
  }

  handleReset = () => {
    // For module/chunk import failures, a full reload is the only reliable recovery.
    if (this.shouldHardReload(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({
      hasError: false,
      error: null,
      telemetryDelivery: 'idle',
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  // Let the user hand this crash straight into the feedback pipeline, prefilled
  // with the error + full page context — same mechanism the global ErrorBoundary
  // uses. Works wherever the FeedbackSidePanel is mounted (the authenticated app
  // shell); a no-op elsewhere, so it never throws from an already-broken screen.
  handleReportError = () => {
    try {
      const err = this.state.error;
      (window as unknown as { __FEEDBACK_PREFILL__?: unknown }).__FEEDBACK_PREFILL__ = {
        type: 'BUG',
        title: err?.message ? `Crash: ${String(err.message).slice(0, 100)}` : 'Awaria strony',
        message: 'Strona uległa awarii. Szczegóły techniczne dołączone automatycznie.',
        severity: 'HIGH',
        error: err ? { message: err.message, stack: err.stack } : undefined,
      };
      window.dispatchEvent(new Event('feedback:open'));
    } catch {
      // never make an already-broken screen worse
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>

            <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
              Coś poszło nie tak
            </h1>

            <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
              Wystąpił nieoczekiwany błąd podczas ładowania tej strony.
            </p>

            <div
              className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg"
              role="alert"
              aria-live="assertive"
            >
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                Strona napotkała problem i została bezpiecznie zatrzymana.
              </p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                Szczegóły techniczne nie są wyświetlane. Spróbuj ponownie lub wróć do strony
                głównej.
              </p>
            </div>
            {this.state.telemetryDelivery === 'sent' && (
              <p
                data-testid="route-error-boundary-telemetry-sent"
                className="mb-4 text-xs text-emerald-700 dark:text-emerald-300"
              >
                Crash diagnostics were sent successfully.
              </p>
            )}
            {this.state.telemetryDelivery === 'failed' && (
              <p
                data-testid="route-error-boundary-telemetry-failed"
                className="mb-4 text-xs text-amber-700 dark:text-amber-300"
              >
                Crash diagnostics could not be delivered. You can retry or report manually.
              </p>
            )}
            {this.state.telemetryDelivery === 'unavailable' && (
              <p
                data-testid="route-error-boundary-telemetry-unavailable"
                className="mb-4 text-xs text-amber-700 dark:text-amber-300"
              >
                Crash diagnostics were not sent in this environment.
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Spróbuj ponownie
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] transition-colors"
              >
                <Home className="w-4 h-4" />
                Strona główna
              </button>
            </div>

            <button
              onClick={this.handleReportError}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
            >
              <MessageSquareWarning className="w-4 h-4" />
              Zgłoś ten błąd
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
