import React from 'react';

export interface MilestoneBlastRadiusRef {
  milestoneId: string;
  version: number;
  status: string;
  readiness: string;
  forecastVarianceDays: number | null;
  sourceVersions: { executionCaseVersion: number; baselineVersion: number };
}

interface Props {
  task: {
    status?: string;
    milestoneIds?: string[];
    blastRadius?: MilestoneBlastRadiusRef[];
  };
}

const variance = (days: number | null) =>
  days === null ? 'NIEZNANA' : `${days > 0 ? '+' : ''}${days} dni`;

const stateLabel = (value: string) =>
  ({
    OPEN: 'Otwarte',
    READY: 'Gotowy',
    BLOCKED: 'Zablokowany',
    AT_RISK: 'Zagrożony',
    ACHIEVED: 'Osiągnięty',
    UNKNOWN: 'Nieznany',
  })[value] ?? value.replaceAll('_', ' ');

export const TaskMilestoneBlastRadius: React.FC<Props> = ({ task }) => {
  const refs = task.blastRadius ?? [];
  if (!(task.milestoneIds?.length || refs.length)) return null;
  return (
    <section
      aria-label="Task milestone blast radius"
      className="mt-3 rounded border border-c-border p-3"
    >
      <h4 className="text-sm font-semibold">Wpływ na kamienie milowe</h4>
      {refs.length === 0 ? (
        <p role="status" className="mt-1 text-xs text-c-text-muted">
          Powiązane kamienie: {task.milestoneIds?.join(', ')} · dokładne wersje NIEZNANE
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {refs.map((ref) => (
            <li
              key={`${ref.milestoneId}:${ref.version}`}
              className="rounded bg-c-surface p-2 text-xs"
            >
              <strong title={ref.milestoneId}>Kamień · …{ref.milestoneId.slice(-8)}</strong> v
              {ref.version} · {stateLabel(ref.status)} · {stateLabel(ref.readiness)}
              <div>Odchylenie prognozy: {variance(ref.forecastVarianceDays)}</div>
              <div className="text-c-text-muted">
                Realizacja v{ref.sourceVersions.executionCaseVersion} · bazowa wersja v
                {ref.sourceVersions.baselineVersion}
              </div>
            </li>
          ))}
        </ul>
      )}
      {task.status === 'BLOCKED' && (
        <p role="alert" className="mt-2 text-xs text-c-danger">
          Zablokowane zadanie wpływa na {refs.length || task.milestoneIds?.length || 0}{' '}
          kamień/kamienie milowe.
        </p>
      )}
    </section>
  );
};
