/**
 * DrdSourceIndicator — dev/telemetry badge answering "what is this screen's
 * data actually backed by right now" (P0C, 2026-08-13; extended to the full
 * offline/recovery state machine, S3 2026-08-13).
 *
 * ★ CEL 4 brief (offline i recovery): eight visible states, one badge:
 *  - SERVER          — data just confirmed fresh from the HTTP source of
 *                       truth (`DrdHttpSessionRuntime`, status 'ready').
 *  - SAVING          — a write is in flight right now (online).
 *  - SAVED           — a write was just confirmed by the server (transient,
 *                       between 'saving' and the next 'ready').
 *  - OFFLINE         — no connection, and NOTHING unsaved is queued yet.
 *  - RECOVERY_DRAFT  — content on screen includes a local write the server
 *                       has never confirmed (queued, offline or awaiting
 *                       explicit reconciliation). ★ Hard rule: this value is
 *                       NEVER shown once the server is known to already have
 *                       the data — see `deriveDrdSourceKind` in
 *                       `drdHttpSessionRuntime.ts`, the single place that
 *                       decides this so no call site can drift from the rule.
 *  - CONFLICT        — a newer server revision exists than what a local
 *                       write assumed; nothing is auto-resolved, a diff is
 *                       shown, a human decides.
 *  - RECONNECTING    — connectivity just returned; checking the server
 *                       before offering the explicit reconciliation choice.
 *  - RECOVERED       — explicit reconciliation just completed successfully
 *                       (transient, then settles back to SERVER).
 *  - DEMO_LOCAL       — the legacy `DrdSessionRuntime` path (flag OFF):
 *                       localStorage IS the only store, by design, for that
 *                       code path — this is an honest label, not a bug.
 *
 * `data-testid="drd-source-indicator"` + `data-source="<value>"` so tests
 * and the dev-render screenshot harness can assert on it without depending
 * on the rendered Polish copy.
 *
 * ★ Kanon koloru (CLAUDE.md): czerwień TYLKO dla błędu/blockera. OFFLINE i
 * RECOVERY_DRAFT są bursztynowe (ostrzeżenie), NIE czerwone — brak
 * połączenia lub niezapisany draft to stan do naprawienia, nie błąd sam w
 * sobie. CONFLICT jest czerwony świadomie: to jedyny z ośmiu stanów, który
 * faktycznie BLOKUJE dalszą pracę do decyzji człowieka.
 */
import { AlertTriangle, CheckCircle2, CloudOff, FileClock, Loader2, RefreshCw, Server } from 'lucide-react';
import React from 'react';

export type DrdVisibleSourceState =
  | 'SERVER'
  | 'SAVING'
  | 'SAVED'
  | 'OFFLINE'
  | 'RECOVERY_DRAFT'
  | 'CONFLICT'
  | 'RECONNECTING'
  | 'RECOVERED';

export type DrdSourceKind = DrdVisibleSourceState | 'DEMO_LOCAL';

const LABEL: Record<DrdSourceKind, string> = {
  SERVER: 'SERVER',
  SAVING: 'SAVING',
  SAVED: 'SAVED',
  OFFLINE: 'OFFLINE',
  RECOVERY_DRAFT: 'RECOVERY_DRAFT',
  CONFLICT: 'CONFLICT',
  RECONNECTING: 'RECONNECTING',
  RECOVERED: 'RECOVERED',
  DEMO_LOCAL: 'DEMO_LOCAL',
};

const TONE: Record<DrdSourceKind, string> = {
  SERVER: 'border-c-success/40 bg-c-success/10 text-c-success',
  SAVING: 'border-c-info/40 bg-c-info/10 text-c-info',
  SAVED: 'border-c-success/40 bg-c-success/10 text-c-success',
  OFFLINE: 'border-c-warning/40 bg-c-warning/10 text-c-warning',
  RECOVERY_DRAFT: 'border-c-warning/40 bg-c-warning/10 text-c-warning',
  CONFLICT: 'border-c-danger/40 bg-c-danger/10 text-c-danger',
  RECONNECTING: 'border-c-info/40 bg-c-info/10 text-c-info',
  RECOVERED: 'border-c-success/40 bg-c-success/10 text-c-success',
  DEMO_LOCAL: 'border-c-border text-c-text-muted',
};

const ICON: Record<DrdSourceKind, React.ComponentType<{ size?: number; className?: string }> | null> = {
  SERVER: Server,
  SAVING: Loader2,
  SAVED: CheckCircle2,
  OFFLINE: CloudOff,
  RECOVERY_DRAFT: FileClock,
  CONFLICT: AlertTriangle,
  RECONNECTING: RefreshCw,
  RECOVERED: CheckCircle2,
  DEMO_LOCAL: null,
};

const SPINNING: Partial<Record<DrdSourceKind, boolean>> = {
  SAVING: true,
  RECONNECTING: true,
};

export const DrdSourceIndicator: React.FC<{ source: DrdSourceKind; title?: string }> = ({ source, title }) => {
  const Icon = ICON[source];
  return (
    <span
      data-testid="drd-source-indicator"
      data-source={source}
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE[source]}`}
    >
      {Icon && <Icon size={10} className={SPINNING[source] ? 'animate-spin' : undefined} />}
      {LABEL[source]}
    </span>
  );
};

export default DrdSourceIndicator;
