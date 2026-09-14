/**
 * AssessmentSaveStateIndicator — the user-facing badge for
 * `useAssessmentSaveIndicator`'s eight states (S3, 2026-08-13).
 *
 * ★ Kanon UI (CLAUDE.md): `primary-*` is crimson, reserved for critical
 * semantics — never used here. OFFLINE and RECOVERY_DRAFT are warnings, not
 * errors (`c-warning`, not `c-danger`). CONFLICT needs a human decision but
 * is not a failure either — it uses `c-info` (violet-blue), never crimson or
 * danger-red, so it visually reads as "needs your input" rather than "broken".
 * Focus ring (when the badge is a button, e.g. `onAction`) is `c-focus` blue.
 *
 * This is deliberately separate from `DrdSourceIndicator` (three values:
 * SERVER / RECOVERY_DRAFT / DEMO_LOCAL — the P0C dev/telemetry badge for
 * "which store backed this paint"). This component answers a different,
 * user-facing question — "what is happening to MY unsaved work right now" —
 * across eight distinguishable states. Both can be shown side by side; ONE
 * of them is not a replacement for the other's rule.
 */
import { AlertTriangle, Check, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { AssessmentSaveIndicatorState } from '@/hooks/useAssessmentSaveIndicator';

/** English defaults used as the i18n fallback — real copy lives under
 * `assessment.drd.saveState.label.*` / `.description.*` (en + pl). */
const LABEL_DEFAULT: Record<AssessmentSaveIndicatorState, string> = {
  SERVER: 'Server',
  SAVING: 'Saving…',
  SAVED: 'Saved',
  OFFLINE: 'Offline',
  RECOVERY_DRAFT: 'Local draft',
  CONFLICT: 'Version conflict',
  RECONNECTING: 'Reconnecting…',
  RECOVERED: 'Recovered',
};

const DESCRIPTION_DEFAULT: Record<AssessmentSaveIndicatorState, string> = {
  SERVER: 'View matches the last confirmed server state.',
  SAVING: 'Saving to the server.',
  SAVED: 'The server just confirmed this save.',
  OFFLINE: 'No connection to the server. Work is not lost — it is queued locally.',
  RECOVERY_DRAFT: 'You have unsaved local changes, not yet confirmed by the server. This is NOT the source of truth.',
  CONFLICT: 'The session changed on the server. Nothing was overwritten automatically — choose how to continue.',
  RECONNECTING: 'Attempting to reconnect to the server.',
  RECOVERED: 'Connection and data have been restored and confirmed by the server.',
};

/** `c-warning` (not `c-danger`) for OFFLINE/RECOVERY_DRAFT — warning, not
 * error, per kanon. `c-info` (not `c-danger`/crimson) for CONFLICT — a
 * decision, not a failure. `c-success` for SAVED/RECOVERED. Neutral border
 * tokens for SERVER/SAVING/RECONNECTING (idle / in-progress, no judgment). */
const TONE: Record<AssessmentSaveIndicatorState, string> = {
  SERVER: 'border-c-border text-c-text-secondary',
  SAVING: 'border-c-border text-c-text-secondary',
  SAVED: 'border-c-success/40 bg-c-success/10 text-c-success',
  OFFLINE: 'border-c-warning/40 bg-c-warning/10 text-c-warning',
  RECOVERY_DRAFT: 'border-c-warning/40 bg-c-warning/10 text-c-warning',
  CONFLICT: 'border-c-info/40 bg-c-info/10 text-c-info',
  RECONNECTING: 'border-c-border text-c-text-secondary',
  RECOVERED: 'border-c-success/40 bg-c-success/10 text-c-success',
};

const ICON: Record<AssessmentSaveIndicatorState, React.ReactNode> = {
  SERVER: <Check size={11} />,
  SAVING: <Loader2 size={11} className="animate-spin" />,
  SAVED: <Check size={11} />,
  OFFLINE: <CloudOff size={11} />,
  RECOVERY_DRAFT: <CloudOff size={11} />,
  CONFLICT: <AlertTriangle size={11} />,
  RECONNECTING: <RefreshCw size={11} className="animate-spin" />,
  RECOVERED: <Check size={11} />,
};

export interface AssessmentSaveStateIndicatorProps {
  readonly state: AssessmentSaveIndicatorState;
  /** Overrides the default lastSavedAt-free description, e.g. "Zapisano o 14:03". */
  readonly detail?: string;
}

export const AssessmentSaveStateIndicator: React.FC<AssessmentSaveStateIndicatorProps> = ({ state, detail }) => {
  const { t } = useTranslation();
  const label = t(`assessment.drd.saveState.label.${state}`, LABEL_DEFAULT[state]);
  const description = t(`assessment.drd.saveState.description.${state}`, DESCRIPTION_DEFAULT[state]);
  return (
    <span
      data-testid="assessment-save-state-indicator"
      data-save-state={state}
      title={detail ?? description}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-c-focus ${TONE[state]}`}
    >
      {ICON[state]}
      {label}
    </span>
  );
};

export default AssessmentSaveStateIndicator;
