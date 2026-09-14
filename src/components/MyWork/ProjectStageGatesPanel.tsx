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
import { PROJECT_GATE_LABEL_KEYS, projectPhaseLabel } from './projectStageGateLabels';

interface CurrentStageGateResponse extends Partial<ProjectStageGateEvaluation> {
  currentPhase: string;
  nextGate: ProjectStageGateType | null;
  nextPhase?: string;
  message?: string;
  actorDuty?: 'EXECUTOR' | 'REVIEWER' | null;
  pendingRequest?: { id: string; requestedBy: string } | null;
}

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
        actorDuty: current?.actorDuty,
        pendingRequest: current?.pendingRequest,
      }),
    [current?.actorDuty, current?.currentPhase, current?.pendingRequest, history, nextGate]
  );

  const passGate = useCallback(
    async (gateType: ProjectStageGateType) => {
      setPassing(gateType);
      try {
        const result = await Api.passProjectStageGate(projectId, gateType);
        toast.success(
          result?.status === 'PENDING'
            ? t('myWork.projects.stageGates.requested', 'Stage-gate review requested')
            : t('myWork.projects.stageGates.passed', 'Stage gate passed')
        );
        await load();
      } catch (cause: any) {
        toast.error(
          String(
            cause?.message || t('myWork.projects.stageGates.passError', 'Stage gate was not passed')
          )
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
        // ── SZEROKOŚĆ (Z-43, 14.09): 230+170=400px > 285px dostępne w panelu
        // podglądu (zmierzone Playwright na `min-width` 340px kanonu preview:
        // `.overflow-x-auto` viewport = 285.19px). Tabela była SZERSZA niż
        // kontener, więc `overflow-x-auto` bez przewinięcia obcinał prawą
        // krawędź kolumny „Status" w połowie znaku ("Passed"→"Pas",
        // "Not ready"→"Not", "Upcoming"→"Upc") — to była OKLUZJA przez
        // przepełnienie, nie zawijanie tekstu.
        //
        // ŚWIADOMIE BEZ `primary: true`. Ta mini-tabela ma tylko DWIE
        // kolumny wewnątrz wąskiego panelu podglądu (nie jest rejestrem
        // encji z resize/sortem jak 94 ekrany listowe) — deklaracja
        // `primary` daje kolumnie twardą podłogę 200px w `<th>` (`cfg.minWidth`
        // z `getColumnTypeFloor`, FilterableTable.tsx:337 — ta podłoga jest
        // egzekwowana przez CSS `min-width` NIEZALEŻNIE od `columnFit`,
        // więc żadna wartość `width` poniżej 200px nie miała żadnego efektu
        // — zmierzone: `width:'120px'` i `width:'150px'` dawały identyczny
        // renderowany nagłówek 200px). Bez `primary` kolumna dostaje zwykłą
        // podłogę typu `text` (140px), a 140+130=270px < 285px dostępne —
        // tabela mieści się bez przewijania na całym zakresie panelu
        // (`clamp(340px, 28%, 480px)`).
        id: 'gateType',
        label: t('myWork.projects.stageGates.gate', 'Gate'),
        width: '140px',
        dataType: 'text',
        render: (tableRow: TableRow) => {
          const row = tableRow as unknown as ProjectStageGateRow;
          return (
            <span className="flex flex-col gap-0.5">
              <span>
                {t(`myWork.projects.stageGates.names.${PROJECT_GATE_LABEL_KEYS[row.gateType]}`)}
              </span>
              <span className="text-[10px] font-normal text-c-text-muted">
                {projectPhaseLabel(t, row.fromPhase)} → {projectPhaseLabel(t, row.toPhase)}
              </span>
            </span>
          );
        },
      },
      {
        id: 'state',
        label: t('myWork.projects.stageGates.status', 'Status'),
        width: '130px',
        dataType: 'status',
        render: (tableRow: TableRow) => {
          const row = tableRow as unknown as ProjectStageGateRow;
          const scheme =
            row.state === 'PASSED'
              ? 'text-[var(--c-success)]'
              : row.state === 'NOT_READY'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-c-text-secondary';
          return (
            // Plakietka (ikona+tekst) na WŁASNEJ linii z `whitespace-nowrap` —
            // przy wąskiej kolumnie (120px) etykieta stanu ("Not ready",
            // PL "Nadchodząca") nie może się złamać w połowie wyrazu.
            // Przycisk „Pass gate"/„Zatwierdź bramkę" idzie na DRUGĄ linię
            // (bez nowrap — najdłuższa etykieta PL ma prawo zawinąć się na
            // dwa wiersze zamiast uciąć).
            <span className="flex flex-col items-start gap-1 min-w-0">
              <span
                className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${scheme}`}
              >
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
                <LockKeyhole size={11} className="shrink-0" />
                <span className="text-left leading-tight">
                  {passing === row.gateType
                    ? t('common.saving', 'Saving…')
                    : row.action === 'APPROVE'
                      ? t('myWork.projects.stageGates.approve', 'Approve gate')
                      : t('myWork.projects.stageGates.request', 'Request review')}
                </span>
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
          {t('myWork.projects.stageGates.missing', 'Missing before the next gate')}:{' '}
          {nextGate.missingElements.map(criterionLabel).join(', ')}
        </p>
      ) : null}
    </div>
  );
};
