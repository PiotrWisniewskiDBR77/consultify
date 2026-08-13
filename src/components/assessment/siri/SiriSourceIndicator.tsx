/**
 * SiriSourceIndicator — dev/telemetry badge answering "what is this screen's
 * data actually backed by right now" (S5, 2026-08-13).
 *
 * Same three-value contract as `src/components/assessment/drd/DrdSourceIndicator.tsx`
 * (kept as an independent copy in the SIRI directory — S5's scope is
 * `src/components/assessment/siri/**` only, never the DRD directory):
 *  - SERVER          — data just confirmed fresh from `SiriHttpSessionRuntime`
 *                       (status 'ready').
 *  - RECOVERY_DRAFT  — cached/offline/queued/conflicted snapshot, NOT yet
 *                       reconciled with the server. Never used for a frozen
 *                       Output.
 *  - DEMO_LOCAL      — reserved for a future localStorage-only SIRI path;
 *                       unused by this HTTP-only slice but kept in the type
 *                       for parity with the DRD contract.
 *
 * `data-testid="siri-source-indicator"` + `data-source="<value>"`.
 */
import React from 'react';

export type SiriSourceKind = 'SERVER' | 'RECOVERY_DRAFT' | 'DEMO_LOCAL';

const LABEL: Record<SiriSourceKind, string> = {
  SERVER: 'SERVER',
  RECOVERY_DRAFT: 'RECOVERY_DRAFT',
  DEMO_LOCAL: 'DEMO_LOCAL',
};

const TONE: Record<SiriSourceKind, string> = {
  SERVER: 'border-c-success/40 bg-c-success/10 text-c-success',
  RECOVERY_DRAFT: 'border-c-warning/40 bg-c-warning/10 text-c-warning',
  DEMO_LOCAL: 'border-c-border text-c-text-muted',
};

export const SiriSourceIndicator: React.FC<{ source: SiriSourceKind; title?: string }> = ({ source, title }) => (
  <span
    data-testid="siri-source-indicator"
    data-source={source}
    title={title}
    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE[source]}`}
  >
    {LABEL[source]}
  </span>
);

export default SiriSourceIndicator;
