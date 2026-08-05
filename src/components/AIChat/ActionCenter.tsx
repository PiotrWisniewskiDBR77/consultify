import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileSearch,
  PlayCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import React from 'react';
import { useSearchParams } from 'react-router-dom';

import { Api } from '../../services/api';

type ActionCenterAction = {
  id: string;
  actionId?: string;
  runId?: string | null;
  title?: string;
  description?: string;
  actionType?: string;
  type?: string;
  status?: string;
  severity?: string;
  trigger?: string;
  proposedAt?: string;
  updatedAt?: string;
  events?: Array<{ eventType?: string; status?: string; createdAt?: string; actorUserId?: string }>;
  audit?: Record<string, unknown>;
  outputRefs?: unknown[];
};

const STATUS_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  pending_review: Clock3,
  approved: ShieldCheck,
  executing: PlayCircle,
  executed: CheckCircle2,
  audited: FileSearch,
  failed: AlertTriangle,
  rejected: X,
};

function statusLabel(status: string | undefined): string {
  return String(status || 'proposed').replace(/_/g, ' ');
}

export const ActionCenter: React.FC = () => {
  const [searchParams] = useSearchParams();
  const selectedActionId = searchParams.get('actionId');
  const [actions, setActions] = React.useState<ActionCenterAction[]>([]);
  const [runs, setRuns] = React.useState<ActionCenterAction[]>([]);
  const [selectedAudit, setSelectedAudit] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [ledgerWarning, setLedgerWarning] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setLedgerWarning(null);
    try {
      const mineCenter = await Api.getAIActionCenter({ scope: 'mine', limit: 100 });
      let center = mineCenter;
      if (!Array.isArray(mineCenter?.actions) || mineCenter.actions.length === 0) {
        const orgCenter = await Api.getAIActionCenter({ scope: 'org', limit: 100 });
        if (Array.isArray(orgCenter?.actions) && orgCenter.actions.length > 0) {
          center = orgCenter;
        }
      }
      setActions(Array.isArray(center?.actions) ? center.actions : []);
      const actionId = selectedActionId || center?.actions?.[0]?.id || null;
      if (actionId) {
        const audit = await Api.getAIActionAuditTrail(actionId);
        setSelectedAudit(audit?.audit || null);
      }
    } catch (err: any) {
      setError(err?.message || 'Action Center failed to load');
    }

    try {
      const mineLedger = await Api.getAIRunLedger({ scope: 'mine', limit: 100 });
      let ledger = mineLedger;
      if (!Array.isArray(mineLedger?.runs) || mineLedger.runs.length === 0) {
        const orgLedger = await Api.getAIRunLedger({ scope: 'org', limit: 100 });
        if (Array.isArray(orgLedger?.runs) && orgLedger.runs.length > 0) {
          ledger = orgLedger;
        }
      }
      setRuns(Array.isArray(ledger?.runs) ? ledger.runs : []);
      if (ledger?.success === false && ledger?.error) {
        setLedgerWarning(ledger.error);
      }
    } catch (err: any) {
      setRuns([]);
      setLedgerWarning(err?.message || 'Run ledger is not available for this view');
    } finally {
      setLoading(false);
    }
  }, [selectedActionId]);

  React.useEffect(() => {
    load();
  }, [load]);

  // FIX (M01-P07A — consistent error states): approve/reject/execute here
  // had NO try/catch at all — a thrown rejection (409 already-decided, 403
  // missing capability, network error, ...) became an unhandled promise
  // rejection with zero user-facing feedback. The `error` banner already
  // exists and is wired for `load()`'s own failures; reuse it here so a
  // failed decision is visible instead of silently doing nothing.
  const approve = async (actionId: string) => {
    try {
      await Api.approveAIAction(actionId);
      setError(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to approve action');
    }
  };

  const reject = async (actionId: string) => {
    try {
      await Api.rejectAIAction(actionId, 'Rejected from Action Center');
      setError(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to reject action');
    }
  };

  const execute = async (actionId: string) => {
    try {
      await Api.executeAIAction(actionId, {});
      setError(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to execute action');
    }
  };

  const inspect = async (actionId: string) => {
    const audit = await Api.getAIActionAuditTrail(actionId);
    setSelectedAudit(audit?.audit || null);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-primary-600 dark:text-primary-300 font-semibold">
          Consultify AI OS
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Action Center</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Review execution proposals, approve separately from execution, and inspect AIRun audit
          trails.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
        <section className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Proposals and Executions
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No mutation is executed until it has an approved AIRun.
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              className="text-xs rounded-md border border-slate-300 dark:border-navy-600 px-3 py-1.5 text-slate-700 dark:text-slate-200"
            >
              Refresh
            </button>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-navy-800">
            {loading ? (
              <div className="p-6 text-sm text-slate-500">Loading AI actions...</div>
            ) : actions.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No AI actions found.</div>
            ) : (
              actions.map((action) => {
                const status = action.status || 'proposed';
                const Icon = STATUS_ICON[status] || Clock3;
                const canApprove = status === 'pending_review' || status === 'proposed';
                const canExecute = status === 'approved';
                return (
                  <article key={action.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-navy-700 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                            <Icon size={12} />
                            {statusLabel(status)}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            AIRun: {action.runId || 'pending ledger sync'}
                          </span>
                        </div>
                        <h3 className="mt-2 font-medium text-slate-900 dark:text-white">
                          {action.title || action.actionType || action.type}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {action.description || action.trigger}
                        </p>
                      </div>
                      <span className="text-[11px] rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5">
                        {action.severity || 'medium'} risk
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canApprove && (
                        <button
                          type="button"
                          onClick={() => approve(action.id)}
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Approve
                        </button>
                      )}
                      {canExecute && (
                        <button
                          type="button"
                          onClick={() => execute(action.id)}
                          className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Execute
                        </button>
                      )}
                      {canApprove && (
                        <button
                          type="button"
                          onClick={() => reject(action.id)}
                          className="rounded-md border border-slate-300 dark:border-navy-600 px-3 py-1.5 text-xs"
                        >
                          Reject
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => inspect(action.id)}
                        className="rounded-md border border-slate-300 dark:border-navy-600 px-3 py-1.5 text-xs"
                      >
                        View Audit
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">Run Ledger</h2>
            {ledgerWarning && (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Ledger read-only view unavailable: {ledgerWarning}
              </p>
            )}
            <div className="mt-3 space-y-2 max-h-64 overflow-auto">
              {runs.length === 0 ? (
                <p className="text-sm text-slate-500">No AIRuns visible.</p>
              ) : (
                runs.slice(0, 20).map((run) => (
                  <button
                    key={run.runId || run.id}
                    type="button"
                    onClick={() => inspect(run.id)}
                    className="w-full text-left rounded-lg border border-slate-200 dark:border-navy-800 px-3 py-2"
                  >
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-100">
                      {run.runId || run.id}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {statusLabel(run.status)} · {run.actionType || run.type}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">Audit Viewer</h2>
            {!selectedAudit ? (
              <p className="mt-3 text-sm text-slate-500">
                Select an action to inspect who, what, when and why.
              </p>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Run</div>
                  <div className="font-mono text-xs text-slate-700 dark:text-slate-200">
                    {selectedAudit.runId || selectedAudit.id}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Decision and Output</div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    Rollback:{' '}
                    {String(selectedAudit.audit?.rollbackStatus || 'rollback_unavailable').replace(
                      /_/g,
                      ' '
                    )}
                  </div>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-slate-50 dark:bg-navy-950 p-3 text-[11px] text-slate-700 dark:text-slate-200">
                    {JSON.stringify(
                      {
                        status: selectedAudit.status,
                        audit: selectedAudit.audit,
                        outputRefs: selectedAudit.outputRefs,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Events</div>
                  <ul className="mt-1 space-y-1">
                    {(selectedAudit.events || []).map((event: any) => (
                      <li
                        key={event.id}
                        className="rounded-md bg-slate-50 dark:bg-navy-950 px-2 py-1 text-xs"
                      >
                        {event.createdAt}: {event.eventType} by {event.actorUserId || 'system'}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default ActionCenter;
