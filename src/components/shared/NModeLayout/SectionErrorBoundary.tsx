/**
 * SectionErrorBoundary — isolates a single artifact section's render.
 *
 * Without it, a crash inside one section (e.g. a null access in Insight's
 * Signals/Traceability render) bubbles all the way to the app-level
 * ErrorBoundary, which shows a FULL-SCREEN "Coś poszło nie tak" page and takes
 * down the whole detail view (#24). This boundary catches the failure locally
 * and renders a compact, recoverable inline message, keeping the rest of the
 * artifact usable. Reusable across every NModeShell consumer.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import i18n from '@/i18n';

interface Props {
  children: ReactNode;
  /** Section label, shown in the fallback + logged. */
  sectionLabel?: string;
  isPolish?: boolean;
}

interface State {
  hasError: boolean;
}

export class SectionErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    // Local log only — does not escalate to the app-level boundary.
    console.error(
      `[SectionErrorBoundary] Section "${this.props.sectionLabel || 'unknown'}" failed:`,
      error,
      info.componentStack
    );
  }

  private reset = () => this.setState({ hasError: false });

  public render() {
    if (!this.state.hasError) return this.props.children;
    const { isPolish, sectionLabel } = this.props;
    const t = i18n.getFixedT(isPolish ? 'pl' : 'en');
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-50/50 px-6 py-10 text-center dark:border-amber-500/20 dark:bg-amber-500/[0.06]">
        <AlertTriangle size={22} className="text-amber-500" />
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {sectionLabel
            ? t('sharedComponents.sectionErrorBoundary.failedNamed', { label: sectionLabel })
            : t('sharedComponents.sectionErrorBoundary.failed')}
        </div>
        <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">
          {t('sharedComponents.sectionErrorBoundary.restFine')}
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text-secondary transition-colors hover:bg-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
        >
          <RefreshCw size={13} />
          {t('sharedComponents.sectionErrorBoundary.tryAgain')}
        </button>
      </div>
    );
  }
}

export default SectionErrorBoundary;
