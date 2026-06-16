/**
 * InitiativeStatusPipeline — read-only happy-path status pipeline (L-03, epic #14)
 *
 * MINIMAL PREVIEW (decision D-02 = "minimal preview", NOT a new engine).
 *
 * Reveals the canonical status × gate matrix
 * (`docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`) as a single, glanceable,
 * READ-ONLY stepper:
 *   - the ordered happy-path stages
 *     DRAFT → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED → EXECUTING → DONE → TRACKING
 *   - the initiative's current position
 *   - a "next gate" indicator with its readiness, sourced ENTIRELY from the
 *     EXISTING backend `gate-readiness-check` payload already present in context
 *     (`gateReadiness`). No readiness is invented here.
 *
 * This component performs NO transitions and calls NO endpoints. The actual
 * workflow CTAs (submit-review / approve / reject, gated by
 * `availableTransitions[].canCurrentUserExecute`) continue to live in the
 * Properties Strip Status field + the gate workflow table, both wired to the
 * existing endpoints. This strip is the "you are here + what's next" overview.
 *
 * @see docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md (SSOT)
 * @see Harvard/wdrozenie-100/M13-inicjatywy.md §B, L-03
 */

import { AlertTriangle, Check, CircleDot, Flag, Lock } from 'lucide-react';
import React, { useMemo } from 'react';

import { getLifecycleOrder, getStatusMeta } from '@/services/initiativeLifecycle';
import { InitiativeStatus } from '@/types';

import { useInitiativeContext } from './InitiativeContext';
import { GATE_CONFIG, getNextGateForStatus, getRoleLabel } from './types';

/** Canonical happy-path order (per matrix + teczka §C). Off-path statuses
 *  (PENDING_REVIEW / BLOCKED / CANCELLED / ARCHIVED) are surfaced separately. */
const HAPPY_PATH: InitiativeStatus[] = [
  InitiativeStatus.DRAFT,
  InitiativeStatus.REVIEW,
  InitiativeStatus.PROMOTED,
  InitiativeStatus.PLANNING,
  InitiativeStatus.APPROVED,
  InitiativeStatus.SCHEDULED,
  InitiativeStatus.EXECUTING,
  InitiativeStatus.DONE,
  InitiativeStatus.TRACKING,
];

type ReadinessVerdict = 'ready' | 'warning' | 'blocking' | 'unknown';

export const InitiativeStatusPipeline: React.FC = () => {
  const { status: statusRaw, isPolish, gateReadiness } = useInitiativeContext();

  const status = (statusRaw || 'DRAFT') as InitiativeStatus;

  // Lifecycle ordering is the single source for "done vs upcoming". We project
  // the current status onto the happy path; if the initiative sits on an
  // off-path status we keep the path purely informational and flag it.
  const lifecycle = useMemo(() => getLifecycleOrder(), []);
  const currentLifecycleIdx = lifecycle.indexOf(status);
  const isOnHappyPath = HAPPY_PATH.includes(status);

  // Next gate (display only) — reuse existing helper + config; no new logic.
  const nextGateKey = getNextGateForStatus(status);
  const nextGateConfig = nextGateKey ? GATE_CONFIG[nextGateKey] : null;

  // Readiness verdict for the next gate — STRICTLY from backend payload.
  const readinessVerdict: ReadinessVerdict = useMemo(() => {
    const items = gateReadiness?.readiness;
    if (!items || items.length === 0) return 'unknown';
    const anyBlocking = items.some((r) => !r.pass && String(r.severity) === 'blocking');
    if (anyBlocking) return 'blocking';
    const anyWarning = items.some((r) => !r.pass && String(r.severity) === 'warning');
    if (anyWarning) return 'warning';
    return 'ready';
  }, [gateReadiness]);

  // Whether ANY transition is executable by the current user (display hint only,
  // not a gate — the real gating lives in the Status strip / workflow table).
  const userCanAdvance = useMemo(
    () => (gateReadiness?.availableTransitions || []).some((t) => t.canCurrentUserExecute),
    [gateReadiness]
  );

  const offPathLabel = (() => {
    switch (status) {
      case InitiativeStatus.PENDING_REVIEW:
        return isPolish ? 'Oczekuje na przegląd' : 'Pending review';
      case InitiativeStatus.BLOCKED:
        return isPolish ? 'Zablokowana' : 'Blocked';
      case InitiativeStatus.CANCELLED:
        return isPolish ? 'Anulowana' : 'Cancelled';
      case InitiativeStatus.ARCHIVED:
        return isPolish ? 'Zarchiwizowana' : 'Archived';
      default:
        return null;
    }
  })();

  const readinessChip = (() => {
    switch (readinessVerdict) {
      case 'ready':
        return {
          icon: Check,
          text: isPolish ? 'Gotowa' : 'Ready',
          cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          text: isPolish ? 'Ostrzeżenia' : 'Warnings',
          cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
        };
      case 'blocking':
        return {
          icon: Lock,
          text: isPolish ? 'Braki blokujące' : 'Blocking gaps',
          cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        };
      default:
        return {
          icon: CircleDot,
          text: isPolish ? 'Brak danych' : 'No data',
          cls: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
        };
    }
  })();

  return (
    <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl p-4">
      {/* Header: title + read-only marker */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isPolish ? 'Cykl życia (status)' : 'Lifecycle (status)'}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-slate-200/70 dark:bg-navy-800 text-slate-500 dark:text-slate-400">
            {isPolish ? 'podgląd' : 'preview'}
          </span>
        </div>
        {/* Next-gate readiness chip (backend-sourced) */}
        {nextGateConfig && (
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold ${readinessChip.cls}`}
            title={
              isPolish
                ? 'Gotowość następnej bramki — wg systemu (gate-readiness-check)'
                : 'Next-gate readiness — from system (gate-readiness-check)'
            }
          >
            <readinessChip.icon size={12} />
            <span>{readinessChip.text}</span>
          </div>
        )}
      </div>

      {/* Stepper */}
      <div className="flex items-stretch overflow-x-auto pb-1">
        {HAPPY_PATH.map((stage, idx) => {
          const meta = getStatusMeta(stage);
          const stageLifecycleIdx = lifecycle.indexOf(stage);
          const isCurrent = isOnHappyPath && stage === status;
          const isDone =
            isOnHappyPath &&
            currentLifecycleIdx >= 0 &&
            stageLifecycleIdx >= 0 &&
            stageLifecycleIdx < currentLifecycleIdx;
          const isUpcoming = !isCurrent && !isDone;
          const isLast = idx === HAPPY_PATH.length - 1;

          return (
            <React.Fragment key={stage}>
              <div className="flex flex-col items-center min-w-[64px] flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                    isDone
                      ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : isCurrent
                        ? 'bg-primary-500 text-white ring-2 ring-primary-500/30'
                        : 'bg-slate-200/70 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isDone ? <Check size={14} /> : idx + 1}
                </div>
                <span
                  className={`mt-1.5 text-[10px] text-center leading-tight ${
                    isCurrent
                      ? 'font-semibold text-primary-700 dark:text-primary-300'
                      : isUpcoming
                        ? 'text-slate-500 dark:text-slate-500'
                        : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {meta.label}
                </span>
                {isCurrent && (
                  <span className="mt-0.5 px-1 py-0.5 text-[8px] font-bold rounded bg-primary-500 text-white uppercase tracking-wider">
                    {isPolish ? 'teraz' : 'now'}
                  </span>
                )}
              </div>
              {!isLast && (
                <div className="flex items-center pt-3.5">
                  <div
                    className={`h-0.5 w-4 sm:w-6 rounded-full ${
                      isDone ? 'bg-emerald-400/60' : 'bg-slate-200 dark:bg-navy-700'
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Off-path banner (status not on the happy path) */}
      {!isOnHappyPath && offPathLabel && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400">
          <AlertTriangle size={13} className="shrink-0" />
          <span>
            {isPolish
              ? `Status poza ścieżką główną: ${offPathLabel}. Powyższa oś pokazuje docelowy przebieg.`
              : `Status is off the happy path: ${offPathLabel}. The track above shows the target flow.`}
          </span>
        </div>
      )}

      {/* Next-gate footer (read-only) */}
      {nextGateConfig && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-xl bg-slate-50/60 dark:bg-navy-800/40 border border-slate-200/60 dark:border-navy-700/60">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            <Flag size={12} className="text-primary-500" />
            {isPolish ? 'Następna bramka' : 'Next gate'}:{' '}
            {isPolish ? nextGateConfig.namePl : nextGateConfig.name}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {isPolish ? 'Decydent' : 'Approver'}:{' '}
            {getRoleLabel(nextGateConfig.requiredRole, isPolish)}
          </span>
          <span
            className={`text-[11px] ${
              userCanAdvance
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
            title={
              isPolish
                ? 'Czy Twoja rola może wykonać przejście (z gate-readiness-check)'
                : 'Whether your role can execute the transition (from gate-readiness-check)'
            }
          >
            {userCanAdvance
              ? isPolish
                ? 'Twoja rola może przejść dalej'
                : 'Your role can advance'
              : isPolish
                ? 'Tylko podgląd dla Twojej roli'
                : 'View-only for your role'}
          </span>
        </div>
      )}
    </div>
  );
};

export default InitiativeStatusPipeline;
