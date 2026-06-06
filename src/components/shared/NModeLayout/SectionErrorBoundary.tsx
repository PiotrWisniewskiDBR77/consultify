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
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-50/50 px-6 py-10 text-center dark:border-amber-500/20 dark:bg-amber-500/[0.06]">
        <AlertTriangle size={22} className="text-amber-500" />
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {isPolish
            ? `Nie udało się wyświetlić sekcji${sectionLabel ? ` „${sectionLabel}"` : ''}.`
            : `This section${sectionLabel ? ` ("${sectionLabel}")` : ''} couldn't be displayed.`}
        </div>
        <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Reszta dokumentu działa. Możesz spróbować ponownie albo przejść do innej sekcji.'
            : 'The rest of the document is fine. Try again or switch to another section.'}
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.07]"
        >
          <RefreshCw size={13} />
          {isPolish ? 'Spróbuj ponownie' : 'Try again'}
        </button>
      </div>
    );
  }
}

export default SectionErrorBoundary;
