/**
 * Command Center — "Agent trace" (HP-12, Harvey-Parity).
 *
 * Read-only decision trail of AI/agent actions: WHO ran WHAT, the AI
 * suggestion, and the human decision on it. Sourced from `ai_audit_logs`
 * via `GET .../audit-trail/agent-decisions` (AIAuditLogger) — the same store
 * every AI suggestion writes to. Org-scoped by token, admin-gated by backend.
 *
 * Distinct from the "SOC2 audit" tab (that shows request/response hashes,
 * cost, latency from `ai_soc2_audit_trail`); this tab is the AGENT DECISION
 * angle — action, role, suggestion, accept/reject. StandardTable, no kebab.
 */
import { Bot, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type AgentDecisionEntry,
  type AgentDecisionResult,
  getAgentDecisionTrace,
} from '../../../services/enterpriseComplianceApi';
import { formatListDateTime } from '../../../utils/listDateFormat';
import { StandardTable, type TableColumn, type TableRow } from '../../standard';

const inputClass =
  'rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text focus:border-c-focus focus:outline-none focus:ring-1 focus:ring-c-focus';

const defaultTo = () => new Date().toISOString().slice(0, 10);
const defaultFrom = () =>
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const decisionTone = (decision: string | null): string => {
  const d = (decision || '').toUpperCase();
  if (d === 'ACCEPTED' || d === 'APPROVED') return 'text-c-success';
  if (d === 'REJECTED') return 'text-c-danger';
  if (d === 'MODIFIED') return 'text-c-warning';
  return 'text-c-text-muted';
};

export const CommandCenterAgentTraceTab: React.FC = () => {
  const { t } = useTranslation();
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [userId, setUserId] = useState('');
  const [actionType, setActionType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentDecisionResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAgentDecisionTrace({
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
        userId: userId.trim() || undefined,
        actionType: actionType.trim() || undefined,
        limit: 300,
      });
      setResult(data);
    } catch (err: any) {
      setError(
        err?.message ||
          t('commandCenter.agentTrace.toasts.loadError', 'Failed to load agent decision trace')
      );
    } finally {
      setLoading(false);
    }
  }, [from, to, userId, actionType, t]);

  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo<TableRow[]>(
    () =>
      (result?.entries || []).map((entry: AgentDecisionEntry) => ({
        ...entry,
        id: entry.id,
      })),
    [result]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'createdAt',
        label: t('commandCenter.agentTrace.columns.createdAt', 'When'),
        width: '170px',
        sortable: true,
        render: (row: TableRow) => formatListDateTime(row.createdAt as string),
      },
      {
        id: 'userName',
        label: t('commandCenter.agentTrace.columns.user', 'User'),
        width: '160px',
        filterable: true,
        render: (row: TableRow) => (row.userName as string) || '—',
      },
      {
        id: 'actionType',
        label: t('commandCenter.agentTrace.columns.action', 'Action'),
        width: '150px',
        filterable: true,
        sortable: true,
        render: (row: TableRow) => (row.actionType as string) || '—',
      },
      {
        id: 'aiRole',
        label: t('commandCenter.agentTrace.columns.role', 'AI role'),
        width: '130px',
        render: (row: TableRow) => (row.aiRole as string) || '—',
      },
      {
        id: 'actionDescription',
        label: t('commandCenter.agentTrace.columns.description', 'Decision / artifact'),
        render: (row: TableRow) => (
          <span className="text-c-text-secondary">
            {(row.actionDescription as string) || (row.aiSuggestion as string) || '—'}
          </span>
        ),
      },
      {
        id: 'userDecision',
        label: t('commandCenter.agentTrace.columns.outcome', 'Outcome'),
        width: '120px',
        render: (row: TableRow) => {
          const decision = row.userDecision as string | null;
          return (
            <span className={`text-sm font-medium ${decisionTone(decision)}`}>
              {decision || t('commandCenter.agentTrace.pending', 'Pending')}
            </span>
          );
        },
      },
    ],
    [t]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-c-border bg-c-surface p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-c-text">
              {t('commandCenter.agentTrace.title', 'Agent decision trace')}
            </h3>
            <p className="mt-1 text-sm text-c-text-secondary">
              {t(
                'commandCenter.agentTrace.description',
                'Every AI/agent action — who triggered it, what the AI proposed, and whether it was accepted. Org-scoped by token.'
              )}
            </p>
            {result && (
              <p className="mt-2 text-xs text-c-text-muted">
                {t('commandCenter.agentTrace.summary', '{{count}} actions — as of {{time}}', {
                  count: result.totalCount,
                  time: formatListDateTime(result.exportedAt),
                })}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('commandCenter.agentTrace.filters.from', 'From')}
              </label>
              <input
                type="date"
                className={inputClass}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('commandCenter.agentTrace.filters.to', 'To')}
              </label>
              <input
                type="date"
                className={inputClass}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('commandCenter.agentTrace.filters.userId', 'User ID')}
              </label>
              <input
                className={inputClass}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('commandCenter.agentTrace.filters.actionType', 'Action type')}
              </label>
              <input
                className={inputClass}
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                placeholder="SUGGESTION"
              />
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              {t('commandCenter.agentTrace.filters.apply', 'Apply filters')}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-c-border bg-c-surface p-2">
        <StandardTable
          columns={columns}
          data={rows}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          empty={{
            icon: Bot,
            title: t('commandCenter.agentTrace.empty.title', 'No agent actions in this range'),
            description: t(
              'commandCenter.agentTrace.empty.description',
              'Widen the date range or clear the filters. AI suggestions and agent runs appear here as they happen.'
            ),
          }}
          persistKey="commandCenter.agentTrace"
        />
      </div>
    </div>
  );
};

export default CommandCenterAgentTraceTab;
