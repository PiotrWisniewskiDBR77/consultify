/**
 * DrdSourceIndicator — dev/telemetry badge answering "what is this screen's
 * data actually backed by right now" (P0C, 2026-08-13).
 *
 * Mandated by the P0C brief (rule ★4): exactly three values.
 *  - SERVER          — data just confirmed fresh from the HTTP source of
 *                       truth (`DrdHttpSessionRuntime`, status 'ready').
 *  - RECOVERY_DRAFT  — HTTP runtime is showing a cached/offline/queued/
 *                       conflicted snapshot; NOT yet reconciled with the
 *                       server. Never used for a frozen Output.
 *  - DEMO_LOCAL      — the legacy `DrdSessionRuntime` path (flag OFF):
 *                       localStorage IS the only store, by design, for that
 *                       code path — this is an honest label, not a bug.
 *
 * `data-testid="drd-source-indicator"` + `data-source="<value>"` so tests
 * and the dev-render screenshot harness can assert on it without depending
 * on the rendered Polish copy.
 */
import React from 'react';

export type DrdSourceKind = 'SERVER' | 'RECOVERY_DRAFT' | 'DEMO_LOCAL';

const LABEL: Record<DrdSourceKind, string> = {
  SERVER: 'SERVER',
  RECOVERY_DRAFT: 'RECOVERY_DRAFT',
  DEMO_LOCAL: 'DEMO_LOCAL',
};

const TONE: Record<DrdSourceKind, string> = {
  SERVER: 'border-c-success/40 bg-c-success/10 text-c-success',
  RECOVERY_DRAFT: 'border-c-warning/40 bg-c-warning/10 text-c-warning',
  DEMO_LOCAL: 'border-c-border text-c-text-muted',
};

export const DrdSourceIndicator: React.FC<{ source: DrdSourceKind; title?: string }> = ({ source, title }) => (
  <span
    data-testid="drd-source-indicator"
    data-source={source}
    title={title}
    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE[source]}`}
  >
    {LABEL[source]}
  </span>
);

export default DrdSourceIndicator;
