import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

// Known recoverable errors that can be fixed by retry
const RECOVERABLE_ERRORS = [
  'i18n.language is undefined',
  "can't access property",
  'Loading chunk',
  'Failed to fetch dynamically imported module',
  'ChunkLoadError',
];

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorCount = this.state.errorCount + 1;
    this.setState({ errorCount });

    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    console.error('[ErrorBoundary] Error count:', errorCount);

    // Auto-retry for known recoverable errors (max 2 times)
    const isRecoverable = RECOVERABLE_ERRORS.some(
      (msg) => error.message?.includes(msg) || error.name?.includes(msg)
    );

    if (isRecoverable && errorCount <= 2) {
      console.log('[ErrorBoundary] Attempting auto-recovery...');
      setTimeout(() => {
        this.setState({ hasError: false, error: null });
      }, 500);
      return;
    }

    // Try to send error to backend if available
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
            timestamp: new Date().toISOString(),
          }),
        })
        .catch(() => {
          // Ignore fetch errors
        });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    // Only clear app-specific data, not everything
    const keysToRemove = [
      'consultinity-storage',
      'consultinity_demo_session',
      'demo_events',
      'token',
      'user',
    ];
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    sessionStorage.clear();
    window.location.href = '/';
  };

  private handleFullReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Unknown error';
      const isRecoverable = RECOVERABLE_ERRORS.some((msg) => errorMessage.includes(msg));

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
          <div className="max-w-md w-full bg-slate-800 p-8 rounded-xl border border-red-500/30 shadow-2xl">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong</h1>
            <p className="text-slate-300 mb-6">
              The application encountered an unexpected error. This usually happens due to corrupted
              local data or a temporary glitch.
            </p>
            <div className="bg-slate-950 p-4 rounded-lg mb-6 overflow-auto max-h-40 text-xs font-mono text-red-400">
              {errorMessage}
            </div>

            <div className="space-y-3">
              {/* Try Again - for transient errors */}
              <button
                onClick={this.handleRetry}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors"
              >
                Try Again
              </button>

              {/* Reload Page */}
              <button
                onClick={this.handleReload}
                className="w-full py-3 bg-slate-600 hover:bg-slate-700 rounded-lg font-bold transition-colors"
              >
                Reload Page
              </button>

              {/* Soft Reset - clears app data but not everything */}
              <button
                onClick={this.handleReset}
                className="w-full py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold transition-colors"
              >
                Reset App Data
              </button>

              {/* Full Reset - nuclear option */}
              <button
                onClick={this.handleFullReset}
                className="w-full py-2 text-sm text-slate-400 hover:text-red-400 transition-colors"
              >
                Full Reset (Clear Everything)
              </button>
            </div>

            {isRecoverable && (
              <p className="mt-4 text-xs text-slate-500 text-center">
                This error is usually temporary. Try clicking "Try Again" first.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
