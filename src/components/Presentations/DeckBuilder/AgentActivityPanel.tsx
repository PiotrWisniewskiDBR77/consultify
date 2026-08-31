import React from 'react';

import type { PresentationRuntimeEvent } from '@/services/presentationRuntimeEvents';

interface AgentActivityPanelProps {
  events: PresentationRuntimeEvent[];
  degraded?: boolean;
  reason?: string;
}

const STATUS_DOT_CLASS: Record<string, string> = {
  proposal: 'bg-amber-500',
  applied: 'bg-emerald-500',
  rejected: 'bg-danger-500',
};

function statusDotClass(status: string | null): string {
  if (status && STATUS_DOT_CLASS[status]) return STATUS_DOT_CLASS[status];
  return 'bg-c-text-muted';
}

function formatTimestamp(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

const PanelShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <aside
    aria-label="Aktywność AI"
    className="w-72 flex-shrink-0 border-l border-c-border-subtle bg-c-surface flex flex-col"
  >
    <div className="m-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-sm flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-c-border-subtle">
        <h3 className="text-sm font-semibold text-c-text">Aktywność AI</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">{children}</div>
    </div>
  </aside>
);

export const AgentActivityPanel: React.FC<AgentActivityPanelProps> = ({
  events,
  degraded = false,
  reason,
}) => {
  if (degraded) {
    return (
      <PanelShell>
        <div className="rounded-lg border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <p className="font-medium">Nie można wyświetlić pełnej historii aktywności</p>
          {reason ? (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300/90">
              Reason: <span className="font-mono">{reason}</span>
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300/90">
            Telemetry is unavailable.
          </p>
        </div>
      </PanelShell>
    );
  }

  if (!events || events.length === 0) {
    return (
      <PanelShell>
        <p className="text-xs text-c-text-secondary italic">Nie ma jeszcze aktywności AI.</p>
      </PanelShell>
    );
  }

  const recent = events.slice(0, 10);

  return (
    <PanelShell>
      <ul className="divide-y divide-c-border-subtle">
        {recent.map((evt) => (
          <li key={evt.id} className="py-2 first:pt-0 last:pb-0 flex items-start gap-2">
            <span
              aria-hidden="true"
              className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${statusDotClass(evt.status)}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-mono font-medium text-c-text truncate">
                  {evt.eventType}
                </span>
                {evt.scope ? (
                  <span className="italic text-[10px] text-c-text-secondary px-1.5 py-0.5 rounded-md bg-c-surface-raised">
                    {evt.scope}
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-[11px] text-c-text-secondary">
                {formatTimestamp(evt.createdAt)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
};

export default AgentActivityPanel;
