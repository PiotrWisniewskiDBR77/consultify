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

import type { AssessmentSaveIndicatorState } from '@/hooks/useAssessmentSaveIndicator';

const LABEL: Record<AssessmentSaveIndicatorState, string> = {
  SERVER: 'Serwer',
  SAVING: 'Zapisywanie…',
  SAVED: 'Zapisano',
  OFFLINE: 'Offline',
  RECOVERY_DRAFT: 'Lokalny szkic',
  CONFLICT: 'Konflikt wersji',
  RECONNECTING: 'Łączenie…',
  RECOVERED: 'Przywrócono',
};

const DESCRIPTION: Record<AssessmentSaveIndicatorState, string> = {
  SERVER: 'Widok zgodny z ostatnim potwierdzonym stanem serwera.',
  SAVING: 'Trwa zapis na serwerze.',
  SAVED: 'Serwer właśnie potwierdził ten zapis.',
  OFFLINE: 'Brak połączenia z serwerem. Praca nie ginie — jest kolejkowana lokalnie.',
  RECOVERY_DRAFT: 'Masz niezapisane lokalne zmiany, jeszcze niepotwierdzone przez serwer. To NIE jest źródło prawdy.',
  CONFLICT: 'Sesja zmieniła się na serwerze. Nic nie zostało nadpisane automatycznie — wybierz, jak kontynuować.',
  RECONNECTING: 'Próba ponownego połączenia z serwerem w toku.',
  RECOVERED: 'Połączenie i dane zostały przywrócone i potwierdzone przez serwer.',
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

export const AssessmentSaveStateIndicator: React.FC<AssessmentSaveStateIndicatorProps> = ({ state, detail }) => (
  <span
    data-testid="assessment-save-state-indicator"
    data-save-state={state}
    title={detail ?? DESCRIPTION[state]}
    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-c-focus ${TONE[state]}`}
  >
    {ICON[state]}
    {LABEL[state]}
  </span>
);

export default AssessmentSaveStateIndicator;
