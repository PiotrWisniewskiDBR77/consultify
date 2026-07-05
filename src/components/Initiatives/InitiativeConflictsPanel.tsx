/**
 * InitiativeConflictsPanel
 *
 * Renders timeline/resource/dependency conflicts in a structured way.
 * Used in InitiativesTimelineView (Roadmap timeline).
 */

import { AlertTriangle, Link2, Users } from 'lucide-react';
import React, { useMemo } from 'react';

export type ConflictSeverity = 'low' | 'medium' | 'high';
export type ConflictType = 'resource' | 'dependency' | 'timeline';

export interface InitiativeConflict {
  source: 'local' | 'ai';
  type: ConflictType;
  severity: ConflictSeverity;
  initiatives: Array<{ id?: string; name: string }>;
  description: string;
  recommendation?: string;
}

function severityStyles(severity: ConflictSeverity) {
  switch (severity) {
    case 'high':
      return {
        pill: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
        dot: 'bg-rose-400',
      };
    case 'medium':
      return {
        pill: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
        dot: 'bg-amber-400',
      };
    case 'low':
    default:
      return {
        pill: 'bg-c-surface-raised text-c-text-secondary border border-c-border',
        dot: 'bg-c-text-muted',
      };
  }
}

function typeMeta(type: ConflictType) {
  switch (type) {
    case 'dependency':
      return { label: 'Dependency', icon: <Link2 size={14} className="text-c-text-secondary" /> };
    case 'resource':
      return { label: 'Resource', icon: <Users size={14} className="text-c-text-secondary" /> };
    case 'timeline':
    default:
      return { label: 'Timeline', icon: <AlertTriangle size={14} className="text-c-text-secondary" /> };
  }
}

export interface InitiativeConflictsPanelProps {
  conflicts: InitiativeConflict[];
  title?: string;
}

export const InitiativeConflictsPanel: React.FC<InitiativeConflictsPanelProps> = ({
  conflicts,
  title = 'Conflicts',
}) => {
  const grouped = useMemo(() => {
    const bySeverity: Record<ConflictSeverity, InitiativeConflict[]> = {
      high: [],
      medium: [],
      low: [],
    };
    for (const c of conflicts) {
      bySeverity[c.severity || 'low'].push(c);
    }
    return bySeverity;
  }, [conflicts]);

  if (!conflicts.length) return null;

  const total = conflicts.length;
  const highCount = grouped.high.length;

  return (
    <div className="mt-3 rounded-xl border border-c-border bg-c-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-c-text-secondary">{title}</span>
          <span className="text-xs text-c-text-muted">
            {total} total{highCount ? ` • ${highCount} high` : ''}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {(['high', 'medium', 'low'] as const).map((sev) => {
          const list = grouped[sev];
          if (!list.length) return null;
          const sevStyle = severityStyles(sev);
          return (
            <div key={sev} className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg text-xs ${sevStyle.pill}`}
                >
                  <span className={`w-2 h-2 rounded-full ${sevStyle.dot}`} />
                  {sev.toUpperCase()}
                </span>
                <span className="text-xs text-c-text-muted">{list.length}</span>
              </div>

              <div className="space-y-2">
                {list.map((c, idx) => {
                  const meta = typeMeta(c.type);
                  const names = c.initiatives.map((i) => i.name).join(' • ');
                  return (
                    <div
                      key={`${c.source}-${c.type}-${sev}-${idx}`}
                      className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {meta.icon}
                            <span className="text-xs font-semibold text-c-text">
                              {meta.label}
                            </span>
                            <span className="text-[10px] text-c-text-muted">
                              {c.source === 'ai' ? 'AI' : 'Local'}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-c-text-secondary truncate" title={names}>
                            {names}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-c-text-muted whitespace-pre-wrap">
                        {c.description}
                      </div>
                      {c.recommendation && (
                        <div className="mt-2 text-xs text-c-text-secondary">
                          <span className="text-c-text-muted">Recommendation:</span> {c.recommendation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
