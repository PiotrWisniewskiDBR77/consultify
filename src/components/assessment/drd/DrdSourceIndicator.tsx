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
 *  - DEMO_LOCAL      — a dedicated development harness backed by
 *                       `DrdSessionRuntime`; the product route never emits
 *                       this value after the J2 cutover.
 *
 * `data-testid="drd-source-indicator"` + `data-source="<value>"` so tests
 * and the dev-render screenshot harness can assert on it without depending
 * on the rendered copy — the labels below are translated (DEC-461,
 * 2026-09-14: this badge used to hardcode Polish literals, so an EN
 * workshop screen showed a Polish badge next to otherwise-English UI).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

export type DrdSourceKind = 'SERVER' | 'RECOVERY_DRAFT' | 'DEMO_LOCAL';

const LABEL_KEY: Record<DrdSourceKind, string> = {
  SERVER: 'assessment.drd.sourceIndicator.server',
  RECOVERY_DRAFT: 'assessment.drd.sourceIndicator.recoveryDraft',
  DEMO_LOCAL: 'assessment.drd.sourceIndicator.demoLocal',
};

const LABEL_DEFAULT: Record<DrdSourceKind, string> = {
  SERVER: 'SERVER DATA',
  RECOVERY_DRAFT: 'RECOVERY DRAFT',
  DEMO_LOCAL: 'LOCAL DATA',
};

const TONE: Record<DrdSourceKind, string> = {
  SERVER: 'border-c-success/40 bg-c-success/10 text-c-success',
  RECOVERY_DRAFT: 'border-c-warning/40 bg-c-warning/10 text-c-warning',
  DEMO_LOCAL: 'border-c-border text-c-text-muted',
};

export const DrdSourceIndicator: React.FC<{ source: DrdSourceKind; title?: string }> = ({ source, title }) => {
  const { t } = useTranslation();
  return (
    <span
      data-testid="drd-source-indicator"
      data-source={source}
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE[source]}`}
    >
      {t(LABEL_KEY[source], LABEL_DEFAULT[source])}
    </span>
  );
};

export default DrdSourceIndicator;
