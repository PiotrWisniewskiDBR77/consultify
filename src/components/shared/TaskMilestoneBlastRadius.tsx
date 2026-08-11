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
  days === null ? 'UNKNOWN' : `${days > 0 ? '+' : ''}${days} days`;

export const TaskMilestoneBlastRadius: React.FC<Props> = ({ task }) => {
  const refs = task.blastRadius ?? [];
  if (!(task.milestoneIds?.length || refs.length)) return null;
  return (
    <section
      aria-label="Task milestone blast radius"
      className="mt-3 rounded border border-c-border p-3"
    >
      <h4 className="text-sm font-semibold">Milestone blast radius</h4>
      {refs.length === 0 ? (
        <p role="status" className="mt-1 text-xs text-c-text-muted">
          Linked Milestones: {task.milestoneIds?.join(', ')} · exact versions UNKNOWN
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {refs.map((ref) => (
            <li
              key={`${ref.milestoneId}:${ref.version}`}
              className="rounded bg-c-surface p-2 text-xs"
            >
              <strong>{ref.milestoneId}</strong> v{ref.version} · {ref.status} · {ref.readiness}
              <div>Forecast variance: {variance(ref.forecastVarianceDays)}</div>
              <div className="text-c-text-muted">
                Case v{ref.sourceVersions.executionCaseVersion} · baseline v
                {ref.sourceVersions.baselineVersion}
              </div>
            </li>
          ))}
        </ul>
      )}
      {task.status === 'BLOCKED' && (
        <p role="alert" className="mt-2 text-xs text-c-danger">
          Blocked Task affects {refs.length || task.milestoneIds?.length || 0} Milestone(s).
        </p>
      )}
    </section>
  );
};
