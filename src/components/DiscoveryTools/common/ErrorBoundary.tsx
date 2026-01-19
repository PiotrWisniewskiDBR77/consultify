/**
 * ErrorBoundary - Error handling for Strategic Tools
 *
 * Catches errors in child components and displays a fallback UI.
 * Provides retry functionality and error reporting.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
  isPolish?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ToolErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error
    console.error('[ToolErrorBoundary] Error caught:', error);
    console.error('[ToolErrorBoundary] Error info:', errorInfo);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: Props): void {
    // Reset error state if resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const hasKeyChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasKeyChanged) {
        this.resetError();
      }
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, isPolish } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-slate-50 dark:bg-navy-950">
          <div className="max-w-md w-full text-center">
            {/* Error Icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>

            {/* Error Message */}
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              {isPolish ? 'Coś poszło nie tak' : 'Something went wrong'}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {isPolish
                ? 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie lub wróć do strony głównej.'
                : 'An unexpected error occurred. Please try again or return to the home page.'}
            </p>

            {/* Error Details (Development only) */}
            {process.env.NODE_ENV === 'development' && error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  <Bug className="w-4 h-4 inline mr-1" />
                  {isPolish ? 'Szczegóły błędu' : 'Error details'}
                </summary>
                <div className="mt-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 overflow-auto max-h-40">
                  <p className="font-mono text-xs text-red-700 dark:text-red-300">
                    {error.message}
                  </p>
                  {errorInfo && (
                    <pre className="mt-2 font-mono text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.resetError}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {isPolish ? 'Spróbuj ponownie' : 'Try again'}
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              >
                <Home className="w-4 h-4" />
                {isPolish ? 'Strona główna' : 'Go home'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Higher-order component for wrapping functional components with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ToolErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ToolErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

export default ToolErrorBoundary;
