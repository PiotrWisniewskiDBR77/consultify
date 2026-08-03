/**
 * StreamingState — Skeleton-to-content transition for AI generation (Teresa)
 *
 * Purpose-built for Teresa's streamed artifact/message generation: while
 * generation is in flight and no tokens have arrived yet, show a content-
 * shaped `SkeletonState` (reserves layout, kills the "blank void" moment);
 * the instant partial content exists, swap to rendering it incrementally via
 * `children` (the caller re-renders `children` as new chunks arrive — this
 * component does not buffer/parse the stream itself). A "Stop" affordance is
 * always available while streaming; when the caller flips `isStreaming` to
 * false after a stop, the last partial `children` stays exactly as rendered
 * — this component NEVER clears content on stop, only removes the status
 * bar/spinner.
 *
 * Colors use the app CSS token layer (var(--c-*)); light/dark are automatic.
 * NEVER the brand crimson accent token for the Stop control — neutral only.
 *
 * @example
 * <StreamingState
 *   isStreaming={isGenerating}
 *   hasContent={partialText.length > 0}
 *   label={t('teresa.generating', 'Teresa is writing…')}
 *   onStop={abortGeneration}
 *   skeletonVariant="record"
 * >
 *   <MarkdownRenderer content={partialText} />
 * </StreamingState>
 */

import { Loader2, Square } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SkeletonState, type SkeletonVariant } from './SkeletonState';

export interface StreamingStateProps {
  /** True while generation is actively in flight. */
  isStreaming: boolean;
  /** Whether any partial content has arrived yet (drives skeleton→content swap). */
  hasContent?: boolean;
  /** Named status label, e.g. "Teresa is writing…". Never a bare "Loading…". */
  label?: string;
  /** Stop the in-flight generation. Renders the Stop button when provided. */
  onStop?: () => void;
  /** Archetype skeleton to show before the first chunk arrives. */
  skeletonVariant?: SkeletonVariant;
  /** Incremental/partial (or final, once stopped/done) content. */
  children?: React.ReactNode;
  className?: string;
}

export const StreamingState: React.FC<StreamingStateProps> = ({
  isStreaming,
  hasContent = false,
  label,
  onStop,
  skeletonVariant = 'record',
  children,
  className = '',
}) => {
  const { t } = useTranslation();
  const streamingLabel = label ?? t('common.generating', { defaultValue: 'Generating…' });

  // Nothing has streamed in yet → reserve the layout with a content-shaped
  // skeleton instead of a blank pane.
  if (isStreaming && !hasContent) {
    return <SkeletonState variant={skeletonVariant} label={streamingLabel} className={className} />;
  }

  return (
    <div className={className}>
      {isStreaming && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex items-center gap-3 rounded-token-md border border-[var(--c-border-subtle)] bg-[var(--c-surface-raised)] px-3 py-2"
        >
          <Loader2 size={16} className="animate-spin text-[var(--c-text-muted)]" aria-hidden />
          <span className="flex-1 text-left text-sm text-[var(--c-text-secondary)]">
            {streamingLabel}
          </span>
          {onStop && (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-token-md border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1 text-xs font-medium text-[var(--c-text)] transition-colors hover:bg-[var(--c-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
            >
              <Square size={14} aria-hidden />
              {t('common.stop', { defaultValue: 'Stop' })}
            </button>
          )}
        </div>
      )}

      {/* Partial content: rendered as-is, never cleared here on stop. */}
      {children}
    </div>
  );
};

StreamingState.displayName = 'StreamingState';

export default StreamingState;
