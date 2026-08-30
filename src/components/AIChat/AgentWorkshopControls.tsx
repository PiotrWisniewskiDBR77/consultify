/**
 * AgentWorkshopControls — LEWA kolumna warsztatu agenta: sterowanie i przebieg.
 *
 * Odpowiada na jedno pytanie właściciela: „gdzie ten agent teraz jest?".
 * Sekcje (accordion `ArtifactRightPanel`, ta sama powłoka co paleta po prawej —
 * tylko ramka przeniesiona na prawą krawędź, bo panel stoi po lewej):
 *
 *   ① Sterowanie — Uruchom / Stop / Zamknij (Stop = jedyna czerwień, semantyka
 *      krytyczna; Uruchom neutralno-pozytywny, nigdy crimson).
 *   ② Postęp — status planu, pasek, licznik kroków ORAZ wyróżniony blok
 *      „TERAZ: <czytelna nazwa etapu>". Ten sam etap jest jednocześnie
 *      obwiedziony w schemacie (AgentPlanCanvas `execution.currentBlockId`) —
 *      dwa wskazania tego samego faktu, panel i canvas nie mogą się rozjechać,
 *      bo oba czytają `currentStepIndex` z jednego planu.
 *   ③ Zgody — kroki w `awaiting_approval` z akcją „Zatwierdź krok"
 *      (POST /:id/approve-step).
 *   ④ Przebieg — log kroków: status + czytelna nazwa + nazwa techniczna
 *      narzędzia + czas trwania + komunikat błędu.
 *   ⑤ Raport — podsumowanie/błąd planu.
 *
 * Komponent jest CZYSTO PREZENTACYJNY: całe pobieranie/polling/wysyłka siedzi
 * w `AgentPlanPanel.tsx`. Dzięki temu ten plik da się wyrenderować w harnessie
 * z samym obiektem planu.
 */
import { CalendarClock, CheckCircle2, OctagonX, Play, X } from 'lucide-react';
import React, { useState } from 'react';

import { PreviewActionButton } from '@/components/shared/PreviewPane';
import { ArtifactRightPanel } from '@/components/standard/ArtifactRightPanel';
import { EntityStatusChip } from '@/components/ui/primitives/chips/EntityStatusChip';
import type { AgentPlan, AgentPlanStep } from '@/services/api/agentPlan.api';

import { toolLabel } from './agentWorkshopCatalog';

/** Czytelna nazwa etapu — generator wstrzykuje ją w `toolInput.phase`. */
export function readablePhaseName(
  toolInput: Record<string, unknown> | undefined
): string | undefined {
  const phase = toolInput?.phase;
  if (typeof phase === 'string' && phase.trim().length > 0) return phase;
  const name = toolInput?.name;
  if (typeof name === 'string' && name.trim().length > 0) return name;
  return undefined;
}

export function stepDisplayName(step: AgentPlanStep): string {
  return readablePhaseName(step.toolInput) ?? toolLabel(step.toolName) ?? step.toolName;
}

const PLAN_STATUS_LABEL: Record<AgentPlan['status'], string> = {
  planning: 'Schemat w edycji',
  scheduled: 'Zaplanowany',
  awaiting_approval: 'Czeka na zgodę',
  executing: 'W trakcie wykonania',
  paused: 'Wstrzymany',
  completed: 'Zakończony',
  completed_with_errors: 'Zakończony z błędami',
  failed: 'Nieudany',
  cancelled: 'Zatrzymany',
};

const STEP_STATUS_CHIP: Record<AgentPlanStep['status'], { raw: string; label: string }> = {
  pending: { raw: 'not_started', label: 'Oczekuje' },
  awaiting_approval: { raw: 'awaiting_approval', label: 'Czeka na zgodę' },
  running: { raw: 'executing', label: 'W toku' },
  completed: { raw: 'completed', label: 'Gotowe' },
  failed: { raw: 'failed', label: 'Błąd' },
  skipped: { raw: 'archived', label: 'Pominięty' },
};

export interface AgentWorkshopControlsProps {
  plan: AgentPlan;
  /** Krok wykonywany teraz (lub czekający na zgodę) — źródło plakietki „TERAZ". */
  currentStep?: AgentPlanStep;
  /** Liczba klocków w edytowanym schemacie (gdy plan jest jeszcze w 'planning'). */
  draftBlockCount?: number;
  canRun: boolean;
  canCancel: boolean;
  busy: boolean;
  onRun: () => void;
  /** Harmonogram (Fala 1, 2026-07-26) — brak prop = przycisk "Zaplanuj" się nie pokazuje. */
  onSchedule?: (scheduledAt: string) => void;
  onCancel: () => void;
  onApprove: (step: AgentPlanStep) => void;
  onClose?: () => void;
  /** Komunikat błędu operacji (zapis/uruchomienie/zgoda). */
  errorMessage?: string | null;
  width?: number;
}

export const AgentWorkshopControls: React.FC<AgentWorkshopControlsProps> = ({
  plan,
  currentStep,
  draftBlockCount,
  canRun,
  canCancel,
  busy,
  onRun,
  onSchedule,
  onCancel,
  onApprove,
  onClose,
  errorMessage,
  width = 300,
}) => {
  const awaitingSteps = plan.steps.filter((s) => s.status === 'awaiting_approval');
  const progressPct =
    plan.totalSteps > 0 ? Math.round((plan.completedSteps / plan.totalSteps) * 100) : 0;
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleValue, setScheduleValue] = useState('');

  return (
    <ArtifactRightPanel
      ariaLabel="Sterowanie agentem"
      width={width}
      className="border-l-0 border-r border-c-border-subtle"
      statusBar={
        <div className="space-y-1.5" data-testid="agent-controls-header">
          <div className="truncate text-sm font-semibold text-c-text" title={plan.title}>
            {plan.title}
          </div>
          <EntityStatusChip status={plan.status} label={PLAN_STATUS_LABEL[plan.status]} size="sm" />
        </div>
      }
      sections={[
        {
          id: 'sterowanie',
          label: 'Sterowanie',
          children: (
            <div className="space-y-2">
              {canRun ? (
                <PreviewActionButton
                  variant="positive"
                  icon={Play}
                  label="Uruchom proces"
                  onClick={onRun}
                  disabled={busy || (draftBlockCount ?? 0) === 0}
                />
              ) : null}
              {canRun && onSchedule ? (
                <div className="space-y-1.5">
                  <PreviewActionButton
                    variant="neutral"
                    icon={CalendarClock}
                    label="Zaplanuj na termin"
                    onClick={() => setShowSchedulePicker((v) => !v)}
                    disabled={busy || (draftBlockCount ?? 0) === 0}
                  />
                  {showSchedulePicker ? (
                    <div className="flex items-center gap-1.5 pl-1">
                      <input
                        type="datetime-local"
                        value={scheduleValue}
                        onChange={(e) => setScheduleValue(e.target.value)}
                        aria-label="Data i godzina uruchomienia"
                        className="h-9 flex-1 rounded-lg border border-c-border-subtle bg-c-surface px-2 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!scheduleValue) return;
                          onSchedule(new Date(scheduleValue).toISOString());
                          setShowSchedulePicker(false);
                        }}
                        disabled={busy || !scheduleValue}
                        className="h-9 shrink-0 rounded-lg bg-c-surface-raised px-3 text-xs font-medium text-c-text hover:bg-c-surface-raised/70 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      >
                        Zapisz
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {canCancel ? (
                <PreviewActionButton
                  variant="destructive"
                  icon={OctagonX}
                  label="Zatrzymaj"
                  onClick={onCancel}
                  disabled={busy}
                />
              ) : null}
              {onClose ? (
                <PreviewActionButton
                  variant="neutral"
                  icon={X}
                  label="Zamknij"
                  onClick={onClose}
                  disabled={busy}
                />
              ) : null}
              {plan.status === 'planning' ? (
                <p className="text-[11px] text-c-text-muted">
                  Schemat jest edytowalny. „Uruchom proces" zapisuje go w backendzie i startuje
                  wykonanie.
                </p>
              ) : null}
              {errorMessage ? (
                <p className="text-xs text-c-danger" role="alert">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          ),
        },
        {
          id: 'postep',
          label: 'Postęp',
          children: (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-c-text-muted">{PLAN_STATUS_LABEL[plan.status]}</span>
                <span className="tabular-nums text-c-text-muted">
                  {plan.completedSteps}/{plan.totalSteps} · {progressPct}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-c-border-subtle">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    plan.status === 'completed_with_errors' || plan.status === 'failed'
                      ? 'bg-c-warning'
                      : 'bg-c-success'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {currentStep ? (
                <div
                  data-testid="agent-controls-current"
                  className="rounded-lg border border-c-info bg-[color-mix(in_srgb,var(--c-info)_8%,transparent)] px-3 py-2.5"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-c-info">
                    Teraz — krok {currentStep.stepIndex + 1} z {plan.totalSteps}
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-c-text">
                    {stepDisplayName(currentStep)}
                  </div>
                  <div className="truncate text-[11px] text-c-text-muted">
                    {toolLabel(currentStep.toolName)}
                  </div>
                </div>
              ) : (
                <p className="text-xs italic text-c-text-muted">
                  {plan.status === 'planning'
                    ? 'Proces jeszcze nie wystartował.'
                    : 'Brak kroku w toku.'}
                </p>
              )}
            </div>
          ),
        },
        {
          id: 'zgody',
          label: 'Zgody',
          badge: awaitingSteps.length,
          isEmpty: awaitingSteps.length === 0,
          emptyLabel: 'Żaden krok nie czeka na zgodę.',
          defaultOpen: awaitingSteps.length > 0,
          children: (
            <div className="space-y-2">
              {awaitingSteps.map((step) => (
                <div key={step.id} className="rounded-lg border border-c-warning/40 p-2.5">
                  <div className="mb-1 text-sm font-semibold text-c-text">
                    {stepDisplayName(step)}
                  </div>
                  <div className="mb-2 text-[11px] text-c-text-muted">
                    Krok {step.stepIndex + 1} · {toolLabel(step.toolName)}
                  </div>
                  <PreviewActionButton
                    variant="positive"
                    icon={CheckCircle2}
                    label="Zatwierdź krok"
                    onClick={() => onApprove(step)}
                    disabled={busy}
                  />
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'przebieg',
          label: 'Przebieg',
          badge: plan.steps.length,
          defaultOpen: plan.status !== 'planning',
          isEmpty: plan.steps.length === 0,
          emptyLabel: 'Brak kroków — schemat jest pusty.',
          children: (
            <ol className="space-y-2" data-testid="agent-controls-log">
              {plan.steps.map((step) => {
                const chip = STEP_STATUS_CHIP[step.status];
                return (
                  <li key={step.id} className="flex items-start gap-2">
                    <span className="mt-0.5 w-4 shrink-0 text-center text-[11px] tabular-nums text-c-text-muted">
                      {step.stepIndex + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-c-text">{stepDisplayName(step)}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <EntityStatusChip status={chip.raw} label={chip.label} size="sm" />
                        {typeof step.durationMs === 'number' ? (
                          <span className="text-[11px] tabular-nums text-c-text-muted">
                            {(step.durationMs / 1000).toFixed(1)}s
                          </span>
                        ) : null}
                      </div>
                      {step.errorMessage ? (
                        <div className="mt-1 text-[11px] text-c-danger">{step.errorMessage}</div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          ),
        },
        {
          id: 'raport',
          label: 'Raport',
          defaultOpen: Boolean(plan.resultSummary || plan.errorMessage),
          isEmpty: !plan.resultSummary && !plan.errorMessage,
          emptyLabel: 'Raport pojawi się po zakończeniu.',
          children: (
            <div className="space-y-1 text-xs text-c-text">
              {plan.resultSummary ? <p>{plan.resultSummary}</p> : null}
              {plan.errorMessage ? <p className="text-c-danger">{plan.errorMessage}</p> : null}
            </div>
          ),
        },
      ]}
    />
  );
};

export default AgentWorkshopControls;
