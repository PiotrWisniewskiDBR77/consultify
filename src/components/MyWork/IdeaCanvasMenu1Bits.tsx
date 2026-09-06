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

import { AlertTriangle, PanelRight, Sparkles } from 'lucide-react';
import React from 'react';

import { IDEA_TOOL_ICON } from './ideaCanvasMelsChips';
import { bucketIdeaStageForList, getIdeaStageBucketLabel } from './ideaEntryTypes';
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
      role="img"
      data-testid="idea-menu1-tool-icon"
    >
      <Icon size={16} aria-hidden="true" />
    </span>
  );
};

// ── Lifecycle stage chip ────────────────────────────────────────────────────
// Labels come from the SSOT dictionary (ideaEntryTypes.ts `IDEA_STAGE_BUCKET_LABELS`)
// — a local copy here had drifted on Polish diacritics ("Kształtuje" vs the
// canonical "Kształtuje się"). Don't re-add a per-file copy.
export const IdeaStageChip: React.FC<{ stage: string; isPolish: boolean }> = ({
  stage,
  isPolish,
}) => {
  const bucket = bucketIdeaStageForList(stage);
  const label = getIdeaStageBucketLabel(bucket, isPolish);
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
// Standard 04 §4: the workspace save machine (`IdeaMapSyncState`) emits 6 of the
// 7 target states — `saved`/`saving`/`queued`/`idle`(local draft)/`offline`/
// `conflict`. The 7th, `readonly` (lock icon, "Tylko odczyt"), is intentionally
// absent: there is NO permission model feeding it today (audit gap L7), so it is
// reported as backend-required rather than rendered as a phantom branch nothing
// can ever trigger.
export type IdeaSaveState = 'idle' | 'queued' | 'saving' | 'saved' | 'offline' | 'conflict';

function saveDotClass(state: IdeaSaveState): string {
  if (state === 'offline') return 'bg-c-warning';
  if (state === 'saving' || state === 'queued') return 'bg-c-text-muted animate-pulse';
  return 'bg-c-text-muted';
}

/**
 * Quiet, non-interactive save indicator. `label` is the host's ready-made
 * `graphRuntime.syncLabel` (e.g. "Zapisano 3s temu" / "Zapisuję…"). Hidden
 * entirely while idle with nothing to report.
 *
 * `conflict` is the one exception to "quiet": it is a data-integrity state (the
 * server rejected the write with a 409 — local edits and the server graph have
 * diverged, and after the bounded self-heal retries the pending payload is
 * dropped). Standard 04 §4.1 requires this to be an EXPLICIT, legible message,
 * not the same muted grey dot the benign states use — otherwise the divergence
 * reads as a silent loss. Crimson (`c-danger`) here is sanctioned: critical
 * semantics only. The label itself stays localized (host-supplied).
 */
export const IdeaSaveIndicator: React.FC<{ state: IdeaSaveState; label: string }> = ({
  state,
  label,
}) => {
  if (state === 'conflict') {
    return (
      <span
        className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-c-danger"
        data-testid="idea-menu1-save-indicator"
        data-save-state="conflict"
        role="alert"
        aria-live="assertive"
      >
        <AlertTriangle size={13} aria-hidden="true" />
        {label || 'Konflikt zmian'}
      </span>
    );
  }
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

// ── Róg warsztatu: DWA przyciski „Panel" i „AI" ─────────────────────────────
// ★ NAPRAWA (1.1-N2, DEC-409 — słowa właściciela 06.09 o prawym rogu warsztatu
// Pomysłów): „Zrobić przycisk panel i przycisk AI a nie teresa".
//
// Róg (`primaryActionSlot` powłoki) niósł wcześniej: chip statusu
// („● Kształtuje się · Zapisano przed chwilą"), pigułkę „Pokaż panel" i primary
// CTA „Konwertuj ▾". Po tej zmianie zostają WYŁĄCZNIE te dwa przyciski:
//   • „Panel" — otwiera/zamyka kanoniczny prawy panel (jedno wejście),
//   • „AI"    — otwiera ten sam panel na zakładce Teresa/AI (jedyne wejście AI
//               w rogu; pigułka „Teresa" zdjęta już w kroku 1, DEC-404c).
// Chip statusu zniknął w całości — stan zapisu żyje TYLKO w stanie krytycznym
// (konflikt = alert `handleGraphConflict`, błąd zapisu = toast `onSaveError`).
//
// CRIMSON-SAFE: neutralne tokeny `c-text*`/`c-surface-raised`, fokus `c-focus`.
// Zero `primary-*` (każdy numer tej rodziny to Harvard Crimson #85182F).
export const IdeaCornerActions: React.FC<{
  panelOpen: boolean;
  onTogglePanel: () => void;
  onOpenAi: () => void;
  panelLabel: string;
  aiLabel: string;
}> = ({ panelOpen, onTogglePanel, onOpenAi, panelLabel, aiLabel }) => {
  const cls =
    'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-c-border-subtle px-2.5 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]';
  return (
    <div className="flex flex-shrink-0 items-center gap-1.5" data-testid="idea-corner-actions">
      <button
        type="button"
        data-testid="idea-corner-panel"
        onClick={onTogglePanel}
        aria-pressed={panelOpen}
        aria-label={panelLabel}
        title={panelLabel}
        className={cls}
      >
        <PanelRight size={14} aria-hidden="true" />
        <span>{panelLabel}</span>
      </button>
      <button
        type="button"
        data-testid="idea-corner-ai"
        onClick={onOpenAi}
        aria-label={aiLabel}
        title={aiLabel}
        className={cls}
      >
        <Sparkles size={14} aria-hidden="true" />
        <span>{aiLabel}</span>
      </button>
    </div>
  );
};
