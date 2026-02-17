import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  didAutoReload: boolean;
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
      errorInfo: null,
      didAutoReload: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      didAutoReload: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    console.error('[RouteErrorBoundary] Caught error:', error, errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // System recovery: dynamic-import/module-script failures are typically fixed by a hard reload,
    // but users shouldn't have to click anything. Guard against infinite reload loops by allowing
    // only one auto-reload per path per session.
    if (this.shouldHardReload(error) && !this.state.didAutoReload) {
      try {
        const path = typeof window !== 'undefined' ? window.location.pathname : 'unknown';
        const key = `__route_error_boundary_hard_reload__:${path}`;
        const already =
          typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : '1';
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
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
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

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <p className="text-sm font-mono text-red-600 dark:text-red-400 mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="text-xs text-gray-600 dark:text-gray-400">
                    <summary className="cursor-pointer">Stack trace</summary>
                    <pre className="mt-2 overflow-auto">{this.state.errorInfo.componentStack}</pre>
                  </details>
                )}
              </div>
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
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Home className="w-4 h-4" />
                Strona główna
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
