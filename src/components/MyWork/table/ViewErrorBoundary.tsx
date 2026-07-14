import React from 'react';

export interface ViewErrorBoundaryProps {
  viewName: string;
  onSwitchToGrid: () => void;
  children: React.ReactNode;
  locale?: string;
}

interface ViewErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render errors in table view renderers and offers retry or grid fallback.
 */
export class ViewErrorBoundary extends React.Component<
  ViewErrorBoundaryProps,
  ViewErrorBoundaryState
> {
  constructor(props: ViewErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ViewErrorBoundary]', this.props.viewName, error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  override render(): React.ReactNode {
    const { children, viewName, onSwitchToGrid, locale } = this.props;
    const { hasError } = this.state;

    if (!hasError) {
      return children;
    }

    const isPl = locale?.startsWith('pl');
    const title = isPl ? 'Coś poszło nie tak w tym widoku' : 'Something went wrong in this view';
    const retryLabel = isPl ? 'Ponów' : 'Retry';
    const switchLabel = isPl ? 'Przełącz na siatkę' : 'Switch to Grid';

    return (
      <div
        role="alert"
        className="flex flex-1 min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-6 py-10 text-center"
      >
        <div className="max-w-md space-y-2">
          <h3 className="text-sm font-semibold text-c-text">{title}</h3>
          <p className="text-xs text-c-text-muted">
            The <span className="font-medium text-c-text-secondary">{viewName}</span> layout hit an
            unexpected error. Runtime details are hidden for safety.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-xl border border-c-border-subtle bg-c-surface px-4 py-2 text-xs font-semibold text-c-text shadow-sm transition hover:bg-c-surface-raised"
          >
            {retryLabel}
          </button>
          <button
            type="button"
            onClick={onSwitchToGrid}
            className="rounded-xl bg-c-text px-4 py-2 text-xs font-semibold text-c-surface shadow-sm transition hover:brightness-95"
          >
            {switchLabel}
          </button>
        </div>
      </div>
    );
  }
}

export default ViewErrorBoundary;
