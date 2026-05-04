import React, { Component, ErrorInfo, ReactNode } from 'react';

import { addFeedbackBreadcrumb } from '../services/feedbackCollector';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    componentStack: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    console.error('[ErrorBoundary] Error stack:', error.stack);

    this.setState({ componentStack: errorInfo.componentStack || null });

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
          }),
        })
        .catch(() => {
          // Ignore fetch errors
        });
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
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
          <div className="max-w-md w-full bg-slate-800 p-8 rounded-xl border border-rose-500/30 shadow-2xl">
            <h1 className="text-2xl font-bold text-rose-500 mb-4">Something went wrong</h1>
            <p className="text-slate-300 mb-6">
              The application encountered an unexpected error. This usually happens due to corrupted
              local data or a temporary glitch.
            </p>
            <div className="bg-slate-950 p-4 rounded-lg mb-6 overflow-auto max-h-40 text-xs font-mono text-rose-400">
              {this.state.error?.message}
            </div>
            <div className="space-y-2">
              <button
                onClick={this.handleReport}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 rounded-lg font-bold transition-colors"
              >
                Zgłoś ten błąd z pełnym kontekstem
              </button>
              <button
                onClick={this.handleReset}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 rounded-lg font-bold transition-colors"
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
