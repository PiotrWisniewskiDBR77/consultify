/**
 * M14/5.4 — Cutover runbook panel (go-live plan + rollback steps).
 *
 * Surfaces the cutover runbook for an initiative, bound to /api/rollout-ext/cutover.
 * Shows the runbook status and its ordered steps (sequence + title + status, with a
 * ROLLBACK badge on rollback steps). Lets the user create the runbook when missing
 * and append regular or rollback steps. Behind the rollout-write gate. Fails soft.
 */
import React, { useCallback, useEffect, useState } from 'react';

import { Api } from '@/services/api';

type RunbookStatus = 'planned' | 'in_progress' | 'completed' | 'aborted';
type GoNoGo = 'go' | 'no_go' | 'pending';
type StepStatus = 'pending' | 'in_progress' | 'done' | 'skipped' | 'failed';

interface Step {
  id: string;
  sequence: number;
  title: string;
  status: StepStatus;
  isRollback: boolean;
}

interface Runbook {
  id: string;
  name: string;
  status: RunbookStatus;
  goNoGo: GoNoGo | null;
  steps?: Step[];
}

const RUNBOOK_STATUS_STYLE: Record<RunbookStatus, string> = {
  planned: 'bg-gray-100 text-gray-500 border-gray-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  aborted: 'bg-red-100 text-red-700 border-red-200',
};

const RUNBOOK_STATUS_LABEL: Record<RunbookStatus, string> = {
  planned: 'zaplanowany',
  in_progress: 'w toku',
  completed: 'zakończony',
  aborted: 'przerwany',
};

const STEP_STATUS_STYLE: Record<StepStatus, string> = {
  pending: 'bg-gray-100 text-gray-500 border-gray-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  done: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  skipped: 'bg-amber-100 text-amber-700 border-amber-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
};

const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  pending: 'oczekuje',
  in_progress: 'w toku',
  done: 'gotowe',
  skipped: 'pominięte',
  failed: 'nieudane',
};

interface Props {
  initiativeId?: string | null;
}

export const CutoverRunbookPanel: React.FC<Props> = ({ initiativeId }) => {
  const [runbook, setRunbook] = useState<Runbook | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!initiativeId) {
      setRunbook(null);
      return;
    }
    setLoading(true);
    try {
      const res = (await Api.get(
        `/rollout-ext/cutover/${encodeURIComponent(initiativeId)}`
      )) as { runbook?: Runbook };
      setRunbook(res?.runbook ?? null);
      setFailed(false);
    } catch (e: any) {
      // 404 = no runbook yet (expected state → offer to create). Other errors fail soft.
      if (e?.status === 404) {
        setRunbook(null);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } finally {
      setLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createRunbook = async () => {
    if (!initiativeId) return;
    setBusy('create');
    try {
      await Api.post('/rollout-ext/cutover', {
        initiativeId,
        name: `Cutover ${initiativeId}`,
      });
      await load();
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  const addStep = async (isRollback: boolean) => {
    if (!runbook) return;
    setBusy(isRollback ? 'rollback' : 'step');
    try {
      await Api.post(`/rollout-ext/cutover/${runbook.id}/steps`, {
        title: isRollback ? 'Rollback-krok' : 'Krok cutover',
        isRollback,
      });
      await load();
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  const steps = runbook?.steps ?? [];

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-4"
      data-testid="cutover-panel"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Cutover runbook + rollback</h3>
        {runbook && <span className="text-xs text-gray-400">{steps.length} kroków</span>}
      </div>

      {failed && (
        <p className="mb-2 text-xs text-amber-600">
          Nie udało się załadować/zmienić runbooka (sprawdź uprawnienia MANAGE_ROLLOUT).
        </p>
      )}
      {loading && <p className="text-sm text-gray-400">Ładowanie…</p>}

      {!initiativeId ? (
        <p className="text-sm text-gray-400">Wybierz inicjatywę, aby zobaczyć runbook cutover.</p>
      ) : !runbook ? (
        !loading && (
          <button
            type="button"
            data-testid="cutover-create-btn"
            disabled={busy === 'create'}
            onClick={() => void createRunbook()}
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {busy === 'create' ? '…' : 'Utwórz runbook cutover'}
          </button>
        )
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${RUNBOOK_STATUS_STYLE[runbook.status]}`}
            >
              {RUNBOOK_STATUS_LABEL[runbook.status]}
            </span>
            <span className="truncate text-xs text-gray-500">{runbook.name}</span>
          </div>

          <ul className="mb-3 flex flex-col gap-1" data-testid="cutover-steps">
            {steps.length === 0 ? (
              <li className="text-sm text-gray-400">Brak kroków — dodaj pierwszy.</li>
            ) : (
              steps.map((step) => (
                <li
                  key={step.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 px-2 py-1"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-500">
                    {step.sequence}
                  </span>
                  <span className="flex-1 truncate text-xs font-medium text-gray-800">
                    {step.title}
                  </span>
                  {step.isRollback && (
                    <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                      ROLLBACK
                    </span>
                  )}
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STEP_STATUS_STYLE[step.status]}`}
                  >
                    {STEP_STATUS_LABEL[step.status]}
                  </span>
                </li>
              ))
            )}
          </ul>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="cutover-addstep-btn"
              disabled={busy === 'step'}
              onClick={() => void addStep(false)}
              className="rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === 'step' ? '…' : '+ Dodaj krok'}
            </button>
            <button
              type="button"
              disabled={busy === 'rollback'}
              onClick={() => void addStep(true)}
              className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {busy === 'rollback' ? '…' : '+ Dodaj rollback-krok'}
            </button>
          </div>
        </>
      )}
    </section>
  );
};

export default CutoverRunbookPanel;
