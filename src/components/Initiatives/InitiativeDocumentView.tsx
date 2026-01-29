/**
 * InitiativeDocumentView
 *
 * Canonical full initiative "document" view rendered inside ModuleHub (DynamicTabs).
 * This is intended to replace legacy full views (InitiativeFullView / InitiativeDetailCard).
 */

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  History,
  Scale,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';
import { getStatusActions, getStatusMeta, StatusAction } from '@/services/initiativeLifecycle';

import { InitiativeStatus } from '../../types';
import { InitiativeFinancialIntegration } from '../Economics/InitiativeFinancialIntegration';
import { InitiativeTasksTab } from '../InitiativeTasksTab';

type DocumentTab =
  | 'overview'
  | 'tasks'
  | 'governance'
  | 'economics'
  | 'raid'
  | 'stakeholders'
  | 'history';

interface Milestone {
  id: string;
  name: string;
  targetDate?: string;
  actualDate?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
  isGate: boolean;
}

interface Decision {
  id: string;
  type: string;
  title: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  dueDate?: string;
  ownerName?: string;
  pmoDomain?: string;
}

interface RaidItem {
  id: string;
  type: 'risk' | 'issue' | 'assumption' | 'dependency';
  title: string;
  description?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status?: string;
  dueDate?: string;
}

interface Stakeholder {
  id: string;
  userId: string;
  role: 'R' | 'A' | 'C' | 'I';
  name?: string;
  email?: string;
}

interface Watcher {
  id: string;
  userId: string;
  name?: string;
  email?: string;
}

interface HistoryEvent {
  id: string;
  eventType: string;
  createdAt: string;
  actorId?: string;
  payload?: any;
}

interface InitiativeDocumentViewProps {
  initiativeId: string;
}

const GATE_DEFINITIONS = [
  {
    id: 'GO_NO_GO',
    label: 'Go/No-Go',
    forStatus: 'REVIEW',
    targetStatus: 'PROMOTED',
    pmoDomain: 'GOVERNANCE_DECISION_MAKING',
  },
  {
    id: 'RESOURCES_COMMIT',
    label: 'Resources Commit',
    forStatus: 'PROMOTED',
    targetStatus: 'PLANNING',
    pmoDomain: 'RESOURCE_RESPONSIBILITY',
  },
  {
    id: 'SCHEDULE_LOCK',
    label: 'Schedule Lock',
    forStatus: 'APPROVED',
    targetStatus: 'SCHEDULED',
    pmoDomain: 'SCHEDULE_MILESTONES',
  },
] as const;

export const InitiativeDocumentView: React.FC<InitiativeDocumentViewProps> = ({ initiativeId }) => {
  const [activeTab, setActiveTab] = useState<DocumentTab>('overview');
  const [initiative, setInitiative] = useState<any | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [raidItems, setRaidItems] = useState<RaidItem[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!initiativeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await Api.getInitiativeById(initiativeId);
      setInitiative(data);

      // Milestones (optional)
      try {
        const ms = await Api.get(`/initiatives/${initiativeId}/milestones`);
        setMilestones(ms?.milestones || []);
      } catch {
        setMilestones([]);
      }

      // Decisions (optional)
      try {
        const ds = await Api.get(
          `/decisions?relatedObjectId=${initiativeId}&relatedObjectType=initiative`
        );
        setDecisions(Array.isArray(ds) ? ds : ds?.decisions || []);
      } catch {
        setDecisions([]);
      }

      // RAID / Stakeholders / Watchers / History (P0 backend extensions; may be unavailable yet)
      try {
        const r = await Api.get(`/initiatives/${initiativeId}/raid`);
        setRaidItems(r?.items || r?.raid || (Array.isArray(r) ? r : []));
      } catch {
        setRaidItems([]);
      }
      try {
        const s = await Api.get(`/initiatives/${initiativeId}/stakeholders`);
        setStakeholders(s?.stakeholders || (Array.isArray(s) ? s : []));
      } catch {
        setStakeholders([]);
      }
      try {
        const w = await Api.get(`/initiatives/${initiativeId}/watchers`);
        setWatchers(w?.watchers || (Array.isArray(w) ? w : []));
      } catch {
        setWatchers([]);
      }
      try {
        const h = await Api.get(`/initiatives/${initiativeId}/history`);
        setHistory(h?.events || h?.history || (Array.isArray(h) ? h : []));
      } catch {
        setHistory([]);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load initiative');
    } finally {
      setIsLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    setActiveTab('overview');
    fetchAll();
  }, [fetchAll]);

  const status = (initiative?.status || 'DRAFT') as InitiativeStatus;
  const statusMeta = getStatusMeta(status);
  const statusActions = getStatusActions(status);
  const primaryActions = statusActions.filter((a) => a.variant === 'primary').slice(0, 2);

  const requiredGates = useMemo(() => {
    return GATE_DEFINITIONS.filter((g) => g.forStatus === status);
  }, [status]);

  const getGateStatus = useCallback(
    (pmoDomain: string) => {
      const match = decisions.find(
        (d) => d.type === pmoDomain || (d as any).pmoDomain === pmoDomain
      );
      if (!match) return 'MISSING';
      return match.status;
    },
    [decisions]
  );

  const nextMilestone = useMemo(() => {
    return milestones
      .filter((m) => m.status !== 'COMPLETED' && !!m.targetDate)
      .sort(
        (a, b) =>
          new Date(a.targetDate as string).getTime() - new Date(b.targetDate as string).getTime()
      )[0];
  }, [milestones]);

  const handleStatusAction = useCallback(
    async (action: StatusAction) => {
      setIsMutating(true);
      try {
        await Api.patch(`/initiatives/${initiativeId}/status`, { status: action.targetStatus });
        toast.success(`Status changed to ${action.targetStatus}`);
        fetchAll();
      } catch (err: any) {
        toast.error(err?.response?.data?.error || 'Failed to change status');
      } finally {
        setIsMutating(false);
      }
    },
    [fetchAll, initiativeId]
  );

  const tabs: {
    id: DocumentTab;
    label: string;
    icon: React.ReactNode;
    show: boolean;
    count?: number;
  }[] = [
    { id: 'overview', label: 'Overview', icon: <FileText size={14} />, show: true },
    { id: 'tasks', label: 'Tasks', icon: <CheckCircle2 size={14} />, show: true },
    {
      id: 'governance',
      label: 'Governance',
      icon: <Scale size={14} />,
      show: true,
      count: decisions.length,
    },
    { id: 'economics', label: 'Economics', icon: <ExternalLink size={14} />, show: true },
    {
      id: 'raid',
      label: 'RAID',
      icon: <AlertTriangle size={14} />,
      show: raidItems.length > 0,
      count: raidItems.length,
    },
    {
      id: 'stakeholders',
      label: 'Stakeholders',
      icon: <Users size={14} />,
      show: stakeholders.length > 0 || watchers.length > 0,
      count: stakeholders.length + watchers.length,
    },
    {
      id: 'history',
      label: 'History',
      icon: <History size={14} />,
      show: history.length > 0,
      count: history.length,
    },
  ].filter((t) => t.show);

  if (isLoading) {
    return <div className="p-6 text-slate-400">Loading initiative…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-900/10 text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!initiative) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-navy-700 bg-navy-900/40">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded ${statusMeta?.bgColor} ${statusMeta?.color}`}
              >
                {statusMeta?.label || status}
              </span>
              <span className="text-xs text-slate-400">{initiative.axis || 'initiative'}</span>
            </div>
            <div className="text-xl font-bold text-white truncate">{initiative.name}</div>
            <div className="text-sm text-slate-400 mt-1 line-clamp-2">
              {initiative.summary || initiative.description || 'No summary provided.'}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {primaryActions.map((a) => (
              <button
                key={a.targetStatus}
                disabled={isMutating}
                onClick={() => handleStatusAction(a)}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-2 border-b border-navy-700 bg-navy-900/20">
        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-navy-800 text-slate-300">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-navy-700 bg-navy-900/40">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                Gate readiness
              </div>
              {requiredGates.length === 0 ? (
                <div className="text-sm text-slate-400">No gate required for current status.</div>
              ) : (
                <div className="space-y-2">
                  {requiredGates.map((g) => {
                    const gs = getGateStatus(g.pmoDomain);
                    const ok = gs === 'APPROVED';
                    return (
                      <div key={g.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-200">{g.label}</span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                            ok
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : gs === 'PENDING'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-500/20 text-slate-400'
                          }`}
                        >
                          {gs === 'MISSING' ? 'Not requested' : gs}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-navy-700 bg-navy-900/40">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                Next milestone
              </div>
              <div className="text-sm text-slate-200">
                {nextMilestone ? `${nextMilestone.name} (${nextMilestone.targetDate})` : '-'}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && <InitiativeTasksTab initiativeId={initiativeId} />}

        {activeTab === 'governance' && (
          <div className="space-y-3">
            {decisions.length === 0 ? (
              <div className="text-sm text-slate-500">No decisions linked to this initiative.</div>
            ) : (
              decisions.map((d) => (
                <div key={d.id} className="p-3 rounded-lg border border-navy-700 bg-navy-900/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{d.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{d.type}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                        d.status === 'APPROVED'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : d.status === 'REJECTED'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'economics' && (
          <InitiativeFinancialIntegration
            initiative={{
              id: initiative.id,
              name: initiative.name,
              costCapex: initiative.costCapex ?? initiative.cost_capex,
              costOpex: initiative.costOpex ?? initiative.cost_opex,
              annualBenefit: initiative.annualBenefit ?? initiative.annual_benefit,
              expectedRoi: initiative.expectedRoi ?? initiative.expected_roi,
              valueDriver: initiative.valueDriver ?? initiative.value_driver,
            }}
          />
        )}

        {activeTab === 'raid' && (
          <div className="space-y-2">
            {raidItems.map((r) => (
              <div key={r.id} className="p-3 rounded-lg border border-navy-700 bg-navy-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{r.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5 uppercase">{r.type}</div>
                  </div>
                  {r.severity && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-navy-800 text-slate-300">
                      {r.severity}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {raidItems.length === 0 && (
              <div className="text-sm text-slate-500">No RAID items yet.</div>
            )}
          </div>
        )}

        {activeTab === 'stakeholders' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-navy-700 bg-navy-900/40">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">RACI</div>
              {stakeholders.length === 0 ? (
                <div className="text-sm text-slate-500">No stakeholders yet.</div>
              ) : (
                <div className="space-y-2">
                  {stakeholders.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-200">{s.name || s.email || s.userId}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-navy-800 text-slate-300">
                        {s.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-navy-700 bg-navy-900/40">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Watchers</div>
              {watchers.length === 0 ? (
                <div className="text-sm text-slate-500">No watchers yet.</div>
              ) : (
                <div className="space-y-2">
                  {watchers.map((w) => (
                    <div key={w.id} className="text-sm text-slate-200">
                      {w.name || w.email || w.userId}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="text-sm text-slate-500">No history yet.</div>
            ) : (
              history.map((e) => (
                <div key={e.id} className="p-3 rounded-lg border border-navy-700 bg-navy-900/40">
                  <div className="text-sm text-white">{e.eventType}</div>
                  <div className="text-xs text-slate-400 mt-1">{e.createdAt}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InitiativeDocumentView;
