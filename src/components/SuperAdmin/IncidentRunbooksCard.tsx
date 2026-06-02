/**
 * IncidentRunbooksCard
 *
 * Compact SuperAdmin panel that classifies the current Operations Health
 * report against the four canonical incident runbooks (RB-01..RB-04) and
 * surfaces a copy-paste-ready path to the matching Markdown runbook.
 *
 * Authoritative rule set lives server-side in
 * `server/src/services/presentationIncidentClassificationService.ts`. The
 * FE tsconfig explicitly excludes `server/`, so the classification logic
 * is inlined here as a pure mirror (same precedent as
 * `src/components/MyWork/mindmap/mindmapCanonHelpers.ts`). Both copies
 * stay deterministic; tweaks must be made in lockstep.
 *
 * The card NEVER throws — any malformed input collapses to "No active
 * incident" so the parent Operations Health view keeps rendering.
 */

import { AlertTriangle, CheckCircle2, ExternalLink, ShieldAlert } from 'lucide-react';
import React, { useMemo } from 'react';

import type { OperationsHealthReport } from '../../services/presentationOperationsHealth';

// ---------------------------------------------------------------------------
// Types — kept structurally identical to the server-side service so the two
// can be unified into a shared package later without a behavior change.
// ---------------------------------------------------------------------------

type RunbookId = 'RB-01' | 'RB-02' | 'RB-03' | 'RB-04' | null;
type IncidentSeverity = 'P0' | 'P1' | 'P2';

interface IncidentAnomalySignal {
  sloId: string;
  severity: 'minor' | 'major';
}

interface IncidentSignals {
  exportBlockedRate: number | null;
  exportSuccessRate: number | null;
  p95GenerationLatencyMs: number | null;
  blockedP0DecksCount: number;
  blockedP0SharedTemplateId: string | null;
  anomalies: IncidentAnomalySignal[];
}

interface IncidentClassification {
  runbook: RunbookId;
  reason: string;
  severity: IncidentSeverity | null;
  recommendedActions: string[];
}

// ---------------------------------------------------------------------------
// Tuning constants — keep aligned with the server-side service.
// ---------------------------------------------------------------------------

const MIN_TEMPLATE_CLUSTER_SIZE = 3;
const EXPORT_SUCCESS_RATE_BREACH = 0.9;
const LATENCY_BREACH_MS = 90_000;
const EXPORT_BLOCKED_RATE_BREACH = 0.2;

const RB01_ACTIONS: readonly string[] = [
  'Pause auto-publish / auto-export jobs (run-presentation-alert-worker.ts --pause-once).',
  'Suppress further alerts: UPDATE presentation_governance_alert_subscriptions SET active = FALSE for the affected org.',
  'Snapshot affected decks via npm run drive:snapshot before any recovery action.',
];

const RB02_ACTIONS: readonly string[] = [
  'Group last-hour failures by error_reason in presentation_export_records.',
  'Health-check the Playwright PDF renderer endpoint (/api/presentations/health/pdf-renderer).',
  'Roll back the most recent export-pipeline deploy if a regression is suspected.',
];

const RB03_ACTIONS: readonly string[] = [
  "Find stuck jobs: SELECT id, deck_id FROM presentation_ai_operations WHERE status='in_progress' AND started_at < NOW() - INTERVAL '5 minutes'.",
  "Mark them failed with error_reason='timed_out_by_runbook' to free the queue.",
  'Pause new generation submissions if the queue depth exceeds 200.',
];

const RB04_ACTIONS: readonly string[] = [
  'Deprecate the corrupted template via POST /templates/:id/governance/deprecate.',
  'Identify the last-known-good template version through the lineage_root_id chain.',
  'Block new decks from using the corrupted template (verify picker no longer lists it).',
];

const RB_PATH: Record<Exclude<RunbookId, null>, string> = {
  'RB-01': 'docs/operations/incident-runbooks/RB-01-export-blocked-spike.md',
  'RB-02': 'docs/operations/incident-runbooks/RB-02-failed-exports.md',
  'RB-03': 'docs/operations/incident-runbooks/RB-03-stuck-generation.md',
  'RB-04': 'docs/operations/incident-runbooks/RB-04-template-corruption.md',
};

const RB_TITLE: Record<Exclude<RunbookId, null>, string> = {
  'RB-01': 'Export Blocked Spike',
  'RB-02': 'Failed Exports',
  'RB-03': 'Stuck Generation',
  'RB-04': 'Template Corruption',
};

const INDEX_PATH = 'docs/operations/incident-runbooks/INCIDENT_INDEX.md';

// ---------------------------------------------------------------------------
// Pure classifier — mirrors `presentationIncidentClassificationService.ts`.
// ---------------------------------------------------------------------------

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonNegativeInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  return Math.floor(value);
}

function safeAnomalies(input: unknown): IncidentAnomalySignal[] {
  if (!Array.isArray(input)) return [];
  const out: IncidentAnomalySignal[] = [];
  for (const a of input) {
    if (!a || typeof a !== 'object') continue;
    const sloId = (a as { sloId?: unknown }).sloId;
    const severity = (a as { severity?: unknown }).severity;
    if (typeof sloId !== 'string' || sloId.length === 0) continue;
    if (severity !== 'minor' && severity !== 'major') continue;
    out.push({ sloId, severity });
  }
  return out;
}

function hasMajorAnomaly(anomalies: IncidentAnomalySignal[], sloId: string): boolean {
  for (const a of anomalies) {
    if (a.sloId === sloId && a.severity === 'major') return true;
  }
  return false;
}

function hasAnyMajorAnomaly(anomalies: IncidentAnomalySignal[]): boolean {
  for (const a of anomalies) {
    if (a.severity === 'major') return true;
  }
  return false;
}

function copyActions(actions: readonly string[]): string[] {
  return actions.slice(0, 3);
}

function noIncident(): IncidentClassification {
  return {
    runbook: null,
    severity: null,
    reason: 'No incident detected',
    recommendedActions: [],
  };
}

export function classifyIncident(
  input: IncidentSignals | null | undefined
): IncidentClassification {
  try {
    if (!input || typeof input !== 'object') return noIncident();

    const exportBlockedRate = isFiniteNumber(input.exportBlockedRate)
      ? input.exportBlockedRate
      : null;
    const exportSuccessRate = isFiniteNumber(input.exportSuccessRate)
      ? input.exportSuccessRate
      : null;
    const p95GenerationLatencyMs = isFiniteNumber(input.p95GenerationLatencyMs)
      ? input.p95GenerationLatencyMs
      : null;
    const blockedP0DecksCount = nonNegativeInt(input.blockedP0DecksCount);
    const blockedP0SharedTemplateId =
      typeof input.blockedP0SharedTemplateId === 'string' &&
      input.blockedP0SharedTemplateId.length > 0
        ? input.blockedP0SharedTemplateId
        : null;
    const anomalies = safeAnomalies(input.anomalies);

    if (blockedP0SharedTemplateId !== null && blockedP0DecksCount >= MIN_TEMPLATE_CLUSTER_SIZE) {
      return {
        runbook: 'RB-04',
        severity: 'P0',
        reason: `Detected ${blockedP0DecksCount} BLOCKED_P0 decks sharing template_id=${blockedP0SharedTemplateId} (threshold ${MIN_TEMPLATE_CLUSTER_SIZE}). Treat as template corruption.`,
        recommendedActions: copyActions(RB04_ACTIONS),
      };
    }

    const exportSuccessBreach =
      exportSuccessRate !== null && exportSuccessRate < EXPORT_SUCCESS_RATE_BREACH;
    if (exportSuccessBreach || hasMajorAnomaly(anomalies, 'export_success_rate')) {
      const reason = exportSuccessBreach
        ? `export_success_rate=${(exportSuccessRate as number).toFixed(3)} is below the ${EXPORT_SUCCESS_RATE_BREACH} runbook threshold.`
        : 'Major anomaly detected on export_success_rate (current << baseline).';
      return {
        runbook: 'RB-02',
        severity: 'P1',
        reason,
        recommendedActions: copyActions(RB02_ACTIONS),
      };
    }

    const latencyBreach =
      p95GenerationLatencyMs !== null && p95GenerationLatencyMs > LATENCY_BREACH_MS;
    if (latencyBreach || hasMajorAnomaly(anomalies, 'p95_generation_latency_ms')) {
      const reason = latencyBreach
        ? `p95_generation_latency_ms=${Math.round(p95GenerationLatencyMs as number)} ms is above the ${LATENCY_BREACH_MS} ms runbook threshold.`
        : 'Major anomaly detected on p95_generation_latency_ms (current >> baseline).';
      return {
        runbook: 'RB-03',
        severity: 'P1',
        reason,
        recommendedActions: copyActions(RB03_ACTIONS),
      };
    }

    const blockedBreach =
      exportBlockedRate !== null && exportBlockedRate > EXPORT_BLOCKED_RATE_BREACH;
    if (blockedBreach || hasMajorAnomaly(anomalies, 'export_blocked_rate')) {
      const reason = blockedBreach
        ? `export_blocked_rate=${(exportBlockedRate as number).toFixed(3)} is above the ${EXPORT_BLOCKED_RATE_BREACH} runbook threshold.`
        : 'Major anomaly detected on export_blocked_rate (current >> baseline).';
      return {
        runbook: 'RB-01',
        severity: 'P1',
        reason,
        recommendedActions: copyActions(RB01_ACTIONS),
      };
    }

    if (hasAnyMajorAnomaly(anomalies)) {
      const sloIds = anomalies
        .filter((a) => a.severity === 'major')
        .map((a) => a.sloId)
        .join(', ');
      return {
        runbook: null,
        severity: null,
        reason: `Major anomaly without a specific runbook mapping (sloIds: ${sloIds}). Investigate manually.`,
        recommendedActions: [],
      };
    }

    return noIncident();
  } catch {
    return noIncident();
  }
}

// ---------------------------------------------------------------------------
// Signal extraction from the live Operations Health report.
// ---------------------------------------------------------------------------

/**
 * Map an `OperationsHealthReport` snapshot into the `IncidentSignals`
 * shape consumed by the classifier. Percentages on the report are
 * 0..100 floats; the classifier expects 0..1 fractions, so we convert.
 *
 * The report does NOT carry a `blockedP0SharedTemplateId` today (that
 * would require a watchlist join the FE doesn't perform). The card
 * therefore leaves it `null`, which means RB-04 will only fire when a
 * future revision plumbs that signal through. This keeps the
 * classification honest in the meantime.
 */
export function extractIncidentSignalsFromReport(
  report: OperationsHealthReport | null | undefined
): IncidentSignals {
  if (!report) {
    return {
      exportBlockedRate: null,
      exportSuccessRate: null,
      p95GenerationLatencyMs: null,
      blockedP0DecksCount: 0,
      blockedP0SharedTemplateId: null,
      anomalies: [],
    };
  }

  const exportSuccessRate = numericPctToFraction(
    report.slos.find((s) => s.id === 'export_success_rate')?.observedNumeric ?? null
  );
  const exportBlockedRate = numericPctToFraction(
    report.slos.find((s) => s.id === 'export_blocked_rate')?.observedNumeric ?? null
  );
  const p95GenerationLatencyMs =
    report.slos.find((s) => s.id === 'p95_generation_latency_ms')?.observedNumeric ?? null;

  const anomalies = (report.anomalies || [])
    .filter((a) => a.status === 'detected' && !!a.severity)
    .map((a) => ({
      sloId: a.sloId,
      severity: a.severity as 'minor' | 'major',
    }));

  return {
    exportBlockedRate,
    exportSuccessRate,
    p95GenerationLatencyMs,
    blockedP0DecksCount: 0,
    blockedP0SharedTemplateId: null,
    anomalies,
  };
}

function numericPctToFraction(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  // Operations health reports rates as 0..100 percent; convert to 0..1.
  return value / 100;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SEVERITY_TONE: Record<IncidentSeverity, string> = {
  P0: 'bg-rose-600 text-white',
  P1: 'bg-amber-500 text-white',
  P2: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

interface IncidentRunbooksCardProps {
  report: OperationsHealthReport | null;
}

const IncidentRunbooksCard: React.FC<IncidentRunbooksCardProps> = ({ report }) => {
  const classification = useMemo<IncidentClassification>(() => {
    try {
      const signals = extractIncidentSignalsFromReport(report);
      return classifyIncident(signals);
    } catch {
      return {
        runbook: null,
        severity: null,
        reason: 'No incident detected',
        recommendedActions: [],
      };
    }
  }, [report]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert size={14} className="text-slate-500 dark:text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Incident Runbooks
        </h3>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {classification.runbook === null ? (
          <HealthyState reason={classification.reason} />
        ) : (
          <ActiveIncident classification={classification} />
        )}

        <div className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Browse the full incident runbook index:{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {INDEX_PATH}
          </code>
        </div>
      </div>
    </div>
  );
};

const HealthyState: React.FC<{ reason: string }> = ({ reason }) => (
  <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
    <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" />
    <span className="font-medium">No active incident</span>
    <span className="text-[11px] text-slate-500 dark:text-slate-400">({reason})</span>
  </div>
);

const ActiveIncident: React.FC<{
  classification: IncidentClassification;
}> = ({ classification }) => {
  const runbookId = classification.runbook;
  if (runbookId === null) {
    // Major-anomaly-without-mapping branch.
    return (
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            <AlertTriangle size={10} />
            Manual triage
          </span>
          <span className="text-slate-700 dark:text-slate-200">
            No runbook matched the current signal pattern.
          </span>
        </div>
        <p className="text-[12px] text-slate-600 dark:text-slate-300">{classification.reason}</p>
      </div>
    );
  }

  const path = RB_PATH[runbookId];
  const title = RB_TITLE[runbookId];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {classification.severity && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${SEVERITY_TONE[classification.severity]}`}
            title={`Severity ${classification.severity}`}
          >
            {classification.severity}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
          {runbookId} · {title}
        </span>
      </div>
      <p className="text-[12px] text-slate-700 dark:text-slate-300">{classification.reason}</p>
      {classification.recommendedActions.length > 0 && (
        <ol className="list-decimal space-y-1 pl-5 text-[12px] text-slate-700 dark:text-slate-300">
          {classification.recommendedActions.map((action, i) => (
            <li key={`${runbookId}-action-${i}`}>{action}</li>
          ))}
        </ol>
      )}
      <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
        <ExternalLink size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <div className="font-semibold">Open the runbook</div>
          <code className="break-all font-mono text-[10px] text-slate-600 dark:text-slate-300">
            {path}
          </code>
          <div className="mt-1 text-slate-500 dark:text-slate-400">
            Copy the path and open it in your editor or via{' '}
            <span className="font-mono">cursor</span> / <span className="font-mono">code</span>.
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentRunbooksCard;
