import { CheckCircle2, CircleDot, LockKeyhole, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { StandardTable, type TableColumn, type TableRow } from '@/components/standard';
import { Api } from '@/services/api';

import {
  buildProjectStageGateRows,
  type ProjectStageGateEvaluation,
  type ProjectStageGateHistoryItem,
  type ProjectStageGateRow,
  type ProjectStageGateType,
} from './projectStageGateModel';

interface CurrentStageGateResponse extends Partial<ProjectStageGateEvaluation> {
  currentPhase: string;
  nextGate: ProjectStageGateType | null;
  nextPhase?: string;
  message?: string;
}

const gateLabelKey: Record<ProjectStageGateType, string> = {
  READINESS_GATE: 'readiness',
  DESIGN_GATE: 'design',
  PLANNING_GATE: 'planning',
  EXECUTION_GATE: 'execution',
  CLOSURE_GATE: 'closure',
};

export const ProjectStageGatesPanel: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<CurrentStageGateResponse | null>(null);
  const [history, setHistory] = useState<ProjectStageGateHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passing, setPassing] = useState<ProjectStageGateType | null>(null);
  const criterionLabel = useCallback(
    (criterionKey: string) =>
      t(`myWork.projects.stageGates.criteria.${criterionKey}`, { defaultValue: criterionKey }),
    [t]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [next, previous] = await Promise.all([
        Api.getProjectCurrentStageGate(projectId),
        Api.getProjectStageGateHistory(projectId),
      ]);
      setCurrent(next as CurrentStageGateResponse);
      setHistory(previous as ProjectStageGateHistoryItem[]);
    } catch (cause: any) {
      setError(
        String(
          cause?.message ||
            t('myWork.projects.stageGates.loadError', 'Failed to load project stage gates')
        )
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const nextGate = useMemo<ProjectStageGateEvaluation | null>(() => {
    if (!current?.gateType || !current.status) return null;
    return {
      gateType: current.gateType,
      status: current.status,
      completionCriteria: current.completionCriteria || [],
      missingElements: current.missingElements || [],
    };
  }, [current]);

  const rows = useMemo(
    () =>
      buildProjectStageGateRows({
        currentPhase: current?.currentPhase || 'Context',
        nextGate,
        history,
      }),
    [current?.currentPhase, history, nextGate]
  );

  const passGate = useCallback(
    async (gateType: ProjectStageGateType) => {
      setPassing(gateType);
      try {
        await Api.passProjectStageGate(projectId, gateType);
        toast.success(t('myWork.projects.stageGates.passed', 'Stage gate passed'));
        await load();
      } catch (cause: any) {
        toast.error(
          String(cause?.message || t('myWork.projects.stageGates.passError', 'Stage gate was not passed'))
        );
      } finally {
        setPassing(null);
      }
    },
    [load, projectId, t]
  );

  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'gateType',
        label: t('myWork.projects.stageGates.gate', 'Gate'),
        primary: true,
        width: '230px',
        dataType: 'text',
        render: (tableRow: TableRow) => {
          const row = tableRow as unknown as ProjectStageGateRow;
          return (
            <span className="flex flex-col gap-0.5">
              <span>{t(`myWork.projects.stageGates.names.${gateLabelKey[row.gateType]}`)}</span>
              <span className="text-[10px] font-normal text-c-text-muted">
                {row.fromPhase} → {row.toPhase}
              </span>
            </span>
          );
        },
      },
      {
        id: 'state',
        label: t('myWork.projects.stageGates.status', 'Status'),
        width: '170px',
        dataType: 'status',
        render: (tableRow: TableRow) => {
          const row = tableRow as unknown as ProjectStageGateRow;
          const className =
            row.state === 'PASSED'
              ? 'text-[var(--c-success)]'
              : row.state === 'NOT_READY'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-c-text-secondary';
          return (
            <span className="flex flex-col items-start gap-1">
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}>
                {row.state === 'PASSED' ? <CheckCircle2 size={13} /> : <CircleDot size={13} />}
                {t(`myWork.projects.stageGates.states.${row.state.toLowerCase()}`)}
              </span>
              <button
                type="button"
                disabled={!row.actionable || passing !== null}
                onClick={() => void passGate(row.gateType)}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-c-border px-2 text-[10px] font-medium text-c-text disabled:opacity-40"
                title={row.missingElements.map(criterionLabel).join(', ') || undefined}
              >
                <LockKeyhole size={11} />
                {passing === row.gateType
                  ? t('common.saving', 'Saving…')
                  : t('myWork.projects.stageGates.pass', 'Pass gate')}
              </button>
            </span>
          );
        },
      },
    ],
    [criterionLabel, passGate, passing, t]
  );

  return (
    <div className="mt-2.5 rounded-xl border border-c-border-subtle bg-c-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <LockKeyhole size={14} className="text-c-text-secondary" />
        <h4 className="text-xs font-bold uppercase tracking-wide text-c-text-secondary">
          {t('myWork.projects.stageGates.title', 'PMBOK-lite stage gates')}
        </h4>
        <span className="ml-auto text-[10px] text-c-text-muted">
          {t('myWork.projects.stageGates.weeklyRhythm', 'Weekly review rhythm')}
        </span>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-c-border p-1 text-c-text-secondary"
          aria-label={t('common.refresh', 'Refresh')}
        >
          <RefreshCw size={13} />
        </button>
      </div>
      {error ? <p className="mb-2 text-xs text-danger-500">{error}</p> : null}
      <StandardTable
        columns={columns}
        data={rows as unknown as TableRow[]}
        loading={loading}
        persistKey="mywork.projects.stage-gates"
        minTableWidth="auto"
      />
      {nextGate?.missingElements.length ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          {t('myWork.projects.stageGates.missing', 'Missing before the next gate')}: {' '}
          {nextGate.missingElements.map(criterionLabel).join(', ')}
        </p>
      ) : null}
    </div>
  );
};
