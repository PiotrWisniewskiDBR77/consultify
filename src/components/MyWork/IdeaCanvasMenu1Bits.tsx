/**
 * IdeaCanvasMenu1Bits — small presentational fragments for the Ideas
 * EditorShell Menu 1 (Z7): the per-tool identity icon, the lifecycle stage
 * chip, and the quiet "Zapisano ·" save indicator. Rendered by
 * `IdeaMapWorkspace` into the shell's `titleIconSlot` / `titleTrailingSlot`.
 *
 * CRIMSON-SAFE: monochrome + `c-info` (stage dot) / `c-danger`+`c-warning`
 * (only for the semantic save states conflict/offline). The stage chip itself
 * is NEUTRAL — no per-stage colour, the dot is a single `c-info` tone.
 */

import React from 'react';

import { bucketIdeaStageForList, type IdeaStageListBucket } from './ideaEntryTypes';
import { IDEA_TOOL_ICON } from './ideaCanvasMelsChips';
import type { CanvasToolType } from './ideaSelectionTypes';

// ── Tool identity icon ──────────────────────────────────────────────────────
export const IdeaToolIcon: React.FC<{ tool: CanvasToolType; label: string }> = ({
  tool,
  label,
}) => {
  const Icon = IDEA_TOOL_ICON[tool];
  return (
    <span
      className="flex-shrink-0 inline-flex items-center text-c-text-muted"
      title={label}
      aria-label={label}
      data-testid="idea-menu1-tool-icon"
    >
      <Icon size={16} aria-hidden="true" />
    </span>
  );
};

// ── Lifecycle stage chip ────────────────────────────────────────────────────
const STAGE_BUCKET_LABEL: Record<IdeaStageListBucket, { en: string; pl: string }> = {
  spark: { en: 'Spark', pl: 'Iskra' },
  incubating: { en: 'Growing', pl: 'Rośnie' },
  shaping: { en: 'Shaping', pl: 'Kształtuje' },
  ready: { en: 'Ready', pl: 'Gotowy' },
  promoted: { en: 'Promoted', pl: 'Promowany' },
};

export const IdeaStageChip: React.FC<{ stage: string; isPolish: boolean }> = ({
  stage,
  isPolish,
}) => {
  const bucket = bucketIdeaStageForList(stage);
  const label = STAGE_BUCKET_LABEL[bucket][isPolish ? 'pl' : 'en'];
  return (
    <span
      className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border border-c-border-subtle bg-c-surface-raised px-2 py-0.5 text-xs font-medium text-c-text-secondary"
      title={isPolish ? `Etap: ${label}` : `Stage: ${label}`}
      data-testid="idea-menu1-stage-chip"
      data-stage-bucket={bucket}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-c-info" />
      {label}
    </span>
  );
};

// ── Quiet save indicator ────────────────────────────────────────────────────
export type IdeaSaveState = 'idle' | 'queued' | 'saving' | 'saved' | 'offline' | 'conflict';

function saveDotClass(state: IdeaSaveState): string {
  if (state === 'conflict') return 'bg-c-danger';
  if (state === 'offline') return 'bg-c-warning';
  if (state === 'saving' || state === 'queued') return 'bg-c-text-muted animate-pulse';
  return 'bg-c-text-muted';
}

/**
 * Quiet, non-interactive save indicator. `label` is the host's ready-made
 * `graphRuntime.syncLabel` (e.g. "Zapisano 3s temu" / "Zapisuję…"). Hidden
 * entirely while idle with nothing to report.
 */
export const IdeaSaveIndicator: React.FC<{ state: IdeaSaveState; label: string }> = ({
  state,
  label,
}) => {
  if (!label) return null;
  return (
    <span
      className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs text-c-text-muted"
      data-testid="idea-menu1-save-indicator"
      data-save-state={state}
      aria-live="polite"
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${saveDotClass(state)}`} />
      {label}
    </span>
  );
};
