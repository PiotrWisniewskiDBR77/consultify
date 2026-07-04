/**
 * ArtifactHeaderBar — canon Menu 1 of an ARTIFACT (ARTIFACT_ANATOMY_STANDARD
 * §2 "Menu 1 artefaktu", §9.2 ⑫, §18.1 DoD). The thin identity bar at the top
 * of any opened artifact (Tool, Report, Initiative, Deck…). The element ORDER
 * is fixed by the component, left → right:
 *
 *   ← back · [type icon] · Title (inline) · StatusChip · SaveIndicator · [n of N] · PRIMARY
 *
 * Callers supply slots by role, never by position — they cannot reorder these.
 * The save indicator is a SEPARATE slot from the lifecycle status (§18.1: two
 * distinct concerns) and is rendered via the canon <SaveIndicator/>.
 *
 * Exactly ONE primary CTA (state transition / export / generate). No prop for
 * a second right-side button — secondary actions belong in the right panel.
 *
 * @example
 *   <ArtifactHeaderBar
 *     onBack={goBack}
 *     typeIcon={<Wrench className="h-4 w-4" />}
 *     title={<InlineTitle value={name} onChange={rename} />}
 *     status="draft"
 *     saveState="saved"
 *     index={{ current: 3, total: 12 }}
 *     primaryAction={<button>Start session</button>}
 *   />
 */

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { StatusPill } from '../StatusPill';
import { SaveIndicator, type SaveState } from './SaveIndicator';

export interface ArtifactHeaderIndex {
  /** 1-based position in the surrounding collection. */
  current: number;
  /** Total items in the collection. */
  total: number;
}

export interface ArtifactHeaderBarProps {
  /** Back / breadcrumb handler. Renders a leading ← button when provided. */
  onBack?: () => void;
  /** Accessible label for the back button. */
  backLabel?: string;
  /** Small type icon (16px) identifying the artifact archetype. */
  typeIcon?: React.ReactNode;
  /**
   * The inline-editable title slot. Pass a rendered title/inline-edit element;
   * it sits in the fixed title position.
   */
  title: React.ReactNode;
  /**
   * Lifecycle status string (draft/approved/…). Rendered as the canon
   * StatusPill. Separate concern from `saveState`.
   */
  status?: string;
  /** Optional label override for the status pill. */
  statusLabel?: string;
  /** Save-state (saved/saving/error/idle) — rendered via SaveIndicator. */
  saveState?: SaveState;
  /** Optional "n of N" index within the collection (link-to-index affordance). */
  index?: ArtifactHeaderIndex;
  /**
   * The single primary CTA (state transition, export, generate…). No second
   * right-side action slot exists by design.
   */
  primaryAction?: React.ReactNode;
  /** Extra classes on the bar root. */
  className?: string;
}

/**
 * The artifact-level identity bar. Slot order is baked in; see file header.
 */
export const ArtifactHeaderBar: React.FC<ArtifactHeaderBarProps> = ({
  onBack,
  backLabel = 'Back',
  typeIcon,
  title,
  status,
  statusLabel,
  saveState = 'idle',
  index,
  primaryAction,
  className = '',
}) => {
  return (
    <div
      className={`flex h-12 items-center gap-3 border-b border-c-border-subtle bg-c-surface px-3 ${className}`.trim()}
    >
      {/* left: back → type icon → title → status → save → index */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        {typeIcon && (
          <span className="shrink-0 text-c-text-secondary" aria-hidden="true">
            {typeIcon}
          </span>
        )}
        <div className="min-w-0 truncate text-[13px] font-semibold text-c-text">
          {title}
        </div>
        {status && (
          <span className="shrink-0">
            <StatusPill status={status} label={statusLabel} />
          </span>
        )}
        {saveState !== 'idle' && (
          <SaveIndicator state={saveState} className="shrink-0" />
        )}
        {index && (
          <span className="shrink-0 text-[11px] tabular-nums text-c-text-muted">
            {index.current} / {index.total}
          </span>
        )}
      </div>

      {/* right: exactly one primary */}
      {primaryAction && <div className="shrink-0">{primaryAction}</div>}
    </div>
  );
};

export default ArtifactHeaderBar;
