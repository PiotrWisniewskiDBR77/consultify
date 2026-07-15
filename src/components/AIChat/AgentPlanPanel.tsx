/**
 * AgentPlanPanel — szkielet paneli planu agenta (HP-4 fundament).
 *
 * SSOT koncepcyjne: Harvard/wdrozenie-100/_KONCEPT_HP4_AGENT_W_TERESIE.md
 * §2 "UI — panel planu PO PRAWEJ" + §4 zadanie F4. Doktryna
 * panel-Teresy-zawsze-po-prawej (#56) — reużywa powłokę wspólną
 * `ArtifactRightPanel` (accordion, tokeny c-*, fokus c-focus) zamiast
 * budować nowy kontener od zera.
 *
 * Za flagą `ff_agentPlan` (src/utils/agentPlanFlag.ts, default OFF — reguła
 * #7 CLAUDE.md: brak jeszcze akceptu Piotra na zrzutach). Ten komponent NIE
 * jest jeszcze zamontowany w żadnym realnym wejściu (czat/kebab/toolbar) —
 * to celowe: integracja czat→plan to osobne zadanie konceptu (§2 "Minimalna
 * zmiana w czacie", 1 miejsce w ai.routes.ts + UnifiedChatPanel.tsx). Ten
 * plik jest wywoływalny z osobnego testowego wejścia (dev harness / Storybook
 * / przyszły trigger) przekazując `planId`.
 *
 * Sekcje (kolejność z konceptu): Plan (kroki) · Postęp (pasek + status) ·
 * Aprobaty (checkpointy awaiting_approval) · Raport (podsumowanie/błąd).
 *
 * Serwis: server/src/routes/ai/agent-plan.routes.ts (cienki router) ->
 * agentPlannerService (kręgosłup istniejący, migracja 672). Ten panel NIE
 * zawiera żadnej logiki wykonania — tylko odczyt stanu + approve/cancel.
 */
import {
  CheckCircle2,
  Circle,
  Loader2,
  OctagonX,
  PlayCircle,
  SkipForward,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type AgentPlan,
  type AgentPlanStep,
  approveAgentPlanStep,
  cancelAgentPlan,
  getAgentPlan,
} from '@/services/api/agentPlan.api';
import { ArtifactRightPanel } from '@/components/standard/ArtifactRightPanel';
import { PreviewActionButton } from '@/components/shared/PreviewPane';

export interface AgentPlanPanelProps {
  planId: string;
  /** Odświeżanie w tle (ms) dopóki plan nie osiągnie stanu końcowego. Default 3000. */
  pollIntervalMs?: number;
  onClose?: () => void;
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

const STEP_ICON: Record<AgentPlanStep['status'], React.ReactNode> = {
  pending: <Circle size={14} className="text-c-text-muted" />,
  awaiting_approval: <PlayCircle size={14} className="text-c-warning" />,
  running: <Loader2 size={14} className="text-c-info animate-spin" />,
  completed: <CheckCircle2 size={14} className="text-c-success" />,
  failed: <XCircle size={14} className="text-c-danger" />,
  skipped: <SkipForward size={14} className="text-c-text-muted" />,
};

const STATUS_LABEL_KEY: Record<AgentPlan['status'], string> = {
  planning: 'agentPlan.status.planning',
  awaiting_approval: 'agentPlan.status.awaitingApproval',
  executing: 'agentPlan.status.executing',
  paused: 'agentPlan.status.paused',
  completed: 'agentPlan.status.completed',
  failed: 'agentPlan.status.failed',
  cancelled: 'agentPlan.status.cancelled',
};

const STATUS_FALLBACK: Record<AgentPlan['status'], string> = {
  planning: 'Planning…',
  awaiting_approval: 'Awaiting approval',
  executing: 'Executing…',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const AgentPlanPanel: React.FC<AgentPlanPanelProps> = ({
  planId,
  pollIntervalMs = 3000,
  onClose,
}) => {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // stepId | 'cancel' | null
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const { plan: fetched } = await getAgentPlan(planId);
      setPlan(fetched);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load plan');
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (!plan || TERMINAL_STATUSES.has(plan.status)) return;
    pollRef.current = setInterval(() => {
      void load();
    }, pollIntervalMs);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [plan, load, pollIntervalMs]);

  const handleApprove = useCallback(
    async (step: AgentPlanStep) => {
      setBusy(step.id);
      try {
        const { plan: updated } = await approveAgentPlanStep(planId, step.stepIndex);
        setPlan(updated);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to approve step');
      } finally {
        setBusy(null);
      }
    },
    [planId]
  );

  const handleCancel = useCallback(async () => {
    setBusy('cancel');
    try {
      const { plan: updated } = await cancelAgentPlan(planId);
      setPlan(updated);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to cancel plan');
    } finally {
      setBusy(null);
    }
  }, [planId]);

  if (!plan) {
    return (
      <ArtifactRightPanel
        ariaLabel="Agent plan"
        sections={[
          {
            id: 'loading',
            label: t('agentPlan.loading', 'Loading plan'),
            collapsible: false,
            children: (
              <p className="text-xs text-c-text-muted py-1.5">
                {loadError ?? t('agentPlan.loadingBody', 'Loading plan…')}
              </p>
            ),
          },
        ]}
      />
    );
  }

  const awaitingSteps = plan.steps.filter((s) => s.status === 'awaiting_approval');
  const canCancel = !TERMINAL_STATUSES.has(plan.status);
  const progressPct =
    plan.totalSteps > 0 ? Math.round((plan.completedSteps / plan.totalSteps) * 100) : 0;

  return (
    <ArtifactRightPanel
      ariaLabel="Agent plan"
      sections={[
        {
          id: 'plan',
          label: t('agentPlan.section.plan', 'Plan'),
          badge: plan.totalSteps,
          children: (
            <ol className="space-y-2">
              {plan.steps.map((step) => (
                <li key={step.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 shrink-0">{STEP_ICON[step.status]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-c-text truncate">{step.toolName}</div>
                    {step.errorMessage ? (
                      <div className="text-c-danger mt-0.5">{step.errorMessage}</div>
                    ) : null}
                  </div>
                  {step.requiresApproval ? (
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-c-text-muted">
                      {t('agentPlan.step.requiresApproval', 'approval')}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ),
        },
        {
          id: 'progress',
          label: t('agentPlan.section.progress', 'Postęp'),
          children: (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-c-text-muted">
                  {t(STATUS_LABEL_KEY[plan.status], STATUS_FALLBACK[plan.status])}
                </span>
                <span className="tabular-nums text-c-text-muted">
                  {plan.completedSteps}/{plan.totalSteps}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-c-border-subtle overflow-hidden">
                <div
                  className="h-full rounded-full bg-c-success transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {canCancel ? (
                <PreviewActionButton
                  variant="destructive"
                  icon={OctagonX}
                  label={t('agentPlan.action.cancel', 'Stop')}
                  onClick={() => void handleCancel()}
                  disabled={busy !== null}
                />
              ) : null}
              {onClose ? (
                <PreviewActionButton
                  variant="neutral"
                  label={t('agentPlan.action.close', 'Close')}
                  onClick={onClose}
                  disabled={busy !== null}
                />
              ) : null}
            </div>
          ),
        },
        {
          id: 'approvals',
          label: t('agentPlan.section.approvals', 'Aprobaty'),
          badge: awaitingSteps.length,
          isEmpty: awaitingSteps.length === 0,
          emptyLabel: t('agentPlan.approvals.empty', 'No steps awaiting approval'),
          children: (
            <div className="space-y-2">
              {awaitingSteps.map((step) => (
                <div key={step.id} className="rounded-lg border border-c-border-subtle p-2">
                  <div className="text-xs font-medium text-c-text mb-1.5">{step.toolName}</div>
                  <PreviewActionButton
                    variant="positive"
                    icon={CheckCircle2}
                    label={t('agentPlan.action.approveStep', 'Approve step')}
                    onClick={() => void handleApprove(step)}
                    disabled={busy !== null}
                  />
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'report',
          label: t('agentPlan.section.report', 'Raport'),
          isEmpty: !plan.resultSummary && !plan.errorMessage,
          emptyLabel: t('agentPlan.report.empty', 'Report available after completion'),
          children: (
            <div className="text-xs text-c-text space-y-1">
              {plan.resultSummary ? <p>{plan.resultSummary}</p> : null}
              {plan.errorMessage ? <p className="text-c-danger">{plan.errorMessage}</p> : null}
            </div>
          ),
        },
      ]}
    />
  );
};

export default AgentPlanPanel;
