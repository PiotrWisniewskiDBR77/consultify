/**
 * RechartsWrapper - Safe wrapper for recharts components
 * Handles React 19 compatibility issues with recharts
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class RechartsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RechartsErrorBoundary] Chart rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center p-8 bg-slate-50 dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700">
            <div className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Chart failed to load. Please refresh the page.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <pre className="mt-2 text-xs text-danger-500">{this.state.error.message}</pre>
              )}
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

/**
 * Lazy load recharts to avoid blocking initial render
 */
let rechartsModule: any = null;
let rechartsLoadPromise: Promise<any> | null = null;

const loadRecharts = async () => {
  if (rechartsModule) {
    return rechartsModule;
  }

  if (!rechartsLoadPromise) {
    rechartsLoadPromise = import('recharts').catch((error) => {
      console.error('[RechartsWrapper] Failed to load recharts:', error);
      rechartsLoadPromise = null; // Reset on error to allow retry
      throw error;
    });
  }

  rechartsModule = await rechartsLoadPromise;
  return rechartsModule;
};

/**
 * Wrapper component that safely loads and renders recharts components
 */
export const RechartsWrapper: React.FC<{
  children: (recharts: any) => ReactNode;
  fallback?: ReactNode;
}> = ({ children, fallback }) => {
  const [recharts, setRecharts] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    loadRecharts()
      .then((module) => {
        if (mounted) {
          setRecharts(module);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      fallback || (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      )
    );
  }

  if (error || !recharts) {
    return (
      fallback || (
        <div className="flex items-center justify-center p-8 bg-slate-50 dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700">
          <div className="text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Chart failed to load. Please refresh the page.
            </p>
            {process.env.NODE_ENV === 'development' && error && (
              <pre className="mt-2 text-xs text-danger-500">{error.message}</pre>
            )}
          </div>
        </div>
      )
    );
  }

  return <RechartsErrorBoundary fallback={fallback}>{children(recharts)}</RechartsErrorBoundary>;
};

export default RechartsWrapper;
