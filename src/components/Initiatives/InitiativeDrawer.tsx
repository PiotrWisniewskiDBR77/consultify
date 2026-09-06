/**
 * InitiativeDrawer
 *
 * Drawer panel (50% viewport width) for initiative details.
 * Implements "Open wider" functionality to expand to full card view.
 * Part of Initiatives + Roadmap module.
 */

import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  Flag,
  Maximize2,
  Milestone,
  Scale,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { getStatusActions, getStatusMeta, StatusAction } from '@/services/initiativeLifecycle';
import { formatRoiDisplay } from '@/utils/safeFormat';

import { InitiativeStatus, PortfolioInitiative, User } from '../../types';

interface InitiativeDrawerProps {
  initiative: PortfolioInitiative | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: PortfolioInitiative) => void;
  onOpenWider: (initiative: PortfolioInitiative) => void;
  users?: User[];
}

type DrawerTab = 'overview' | 'timeline' | 'resources' | 'decisions';

interface Milestone {
  id: string;
  name: string;
  targetDate?: string;
  actualDate?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
  isGate: boolean;
}

interface GateDecision {
  id: string;
  type: string;
  title: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string;
  dueDate?: string;
  ownerName?: string;
}

interface RaidItem {
  id: string;
  type: 'risk' | 'issue' | 'assumption' | 'dependency';
  title: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status?: string;
  dueDate?: string;
}

// Tabs are built dynamically to include counts
const getTabLabel = (t: (key: string) => string, id: DrawerTab, count?: number) => {
  const keys: Record<DrawerTab, string> = {
    overview: 'initiatives.drawer.overview',
    timeline: 'initiatives.drawer.timeline',
    resources: 'initiatives.drawer.resources',
    decisions: 'initiatives.drawer.decisions',
  };
  const label = t(keys[id]);
  return count && count > 0 ? `${label} (${count})` : label;
};

const TAB_ICONS: Record<DrawerTab, React.ReactNode> = {
  overview: <FileText size={14} />,
  timeline: <Calendar size={14} />,
  resources: <Users size={14} />,
  decisions: <Scale size={14} />,
};

/**
 * Gate Decisions for Initiatives module
 * Canonical flow (PMO):
 * REVIEW -> PROMOTED -> PLANNING -> APPROVED -> SCHEDULED
 *
 * Gate enforcement lives in backend (`InitiativeController.updateInitiativeStatus`).
 * Drawer shows readiness based on required decision domains.
 */
const GATE_DEFINITIONS = [
  {
    id: 'GO_NO_GO',
    tKey: 'goNoGo' as const,
    forStatus: 'REVIEW',
    targetStatus: 'PENDING_APPROVAL',
    pmoDomain: 'GOVERNANCE_DECISION_MAKING',
  },
  {
    id: 'RESOURCES_COMMIT',
    tKey: 'resourcesCommit' as const,
    forStatus: 'PENDING_APPROVAL',
    targetStatus: 'PLANNING',
    pmoDomain: 'RESOURCE_RESPONSIBILITY',
  },
  {
    id: 'SCHEDULE_LOCK',
    tKey: 'scheduleLock' as const,
    forStatus: 'APPROVED',
    targetStatus: 'SCHEDULED',
    pmoDomain: 'SCHEDULE_MILESTONES',
  },
];

/**
 * B7.3: DrawerRaidList — truncated RAID items with "Show more" toggle.
 */
const DrawerRaidList: React.FC<{ items: RaidItem[]; maxVisible?: number }> = ({
  items,
  maxVisible = 3,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, maxVisible);
  const hasMore = items.length > maxVisible;

  return (
    <div className="space-y-2">
      {visible.map((item) => (
        <div key={item.id} className="flex items-center justify-between text-sm">
          <div className="text-slate-700 dark:text-slate-200 truncate pr-2">{item.title}</div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {item.severity && (
              <span
                className={`text-[9px] font-medium ${
                  item.severity === 'CRITICAL' || item.severity === 'HIGH'
                    ? 'text-danger-400'
                    : 'text-slate-500'
                }`}
              >
                {item.severity}
              </span>
            )}
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">
              {item.type}
            </span>
          </div>
        </div>
      ))}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-c-info hover:text-c-info transition-colors"
        >
          {expanded
            ? t('initiatives.drawer.showLess')
            : t('initiatives.drawer.showMore', { count: items.length - maxVisible })}
        </button>
      )}
    </div>
  );
};

/**
 * B7.3: DrawerDependenciesList — truncated dependencies with "Show more" toggle.
 */
const DrawerDependenciesList: React.FC<{ dependencies: any[]; maxVisible?: number }> = ({
  dependencies,
  maxVisible = 3,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? dependencies : dependencies.slice(0, maxVisible);
  const hasMore = dependencies.length > maxVisible;

  return (
    <div className="pt-4 border-t border-slate-200 dark:border-navy-700">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center justify-between">
        <span>Dependencies</span>
        <span className="text-slate-500 font-normal">{dependencies.length}</span>
      </h4>
      <div className="space-y-2">
        {visible.map((dep: any) => (
          <div
            key={dep.initiativeId || dep.id}
            className="flex items-center gap-2 p-2 bg-white/50 dark:bg-navy-900/50 rounded-lg text-sm text-slate-700 dark:text-slate-300"
          >
            <ChevronRight size={14} className="text-slate-500 flex-shrink-0" />
            <span className="truncate">Depends on: {dep.name || dep.initiativeId}</span>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-c-info hover:text-c-info transition-colors"
        >
          {expanded
            ? t('initiatives.drawer.showLess')
            : t('initiatives.drawer.showMore', { count: dependencies.length - maxVisible })}
        </button>
      )}
    </div>
  );
};

export const InitiativeDrawer: React.FC<InitiativeDrawerProps> = ({
  initiative,
  isOpen,
  onClose,
  onUpdate,
  onOpenWider,
  users = [],
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [decisions, setDecisions] = useState<GateDecision[]>([]);
  const [raidItems, setRaidItems] = useState<RaidItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch additional data when initiative changes
  useEffect(() => {
    if (!initiative?.id || !isOpen) return;
    setActiveTab('overview');
    fetchMilestones();
    fetchDecisions();
    fetchRaid();
  }, [initiative?.id, isOpen]);

  const fetchMilestones = async () => {
    if (!initiative?.id) return;
    try {
      const response = await Api.get(`/initiatives/${initiative.id}/milestones`);
      setMilestones(response.milestones || []);
    } catch {
      // Milestones might not exist yet
      setMilestones([]);
    }
  };

  const fetchDecisions = async () => {
    if (!initiative?.id) return;
    try {
      const response = await Api.get(
        `/decisions?relatedObjectId=${initiative.id}&relatedObjectType=initiative`
      );
      const raw = Array.isArray(response) ? response : response?.decisions || [];
      // Hide soft-deleted decisions (DELETE /api/decisions/:id sets status='cancelled').
      // No archive view here — cancelled just drops out of the active list.
      setDecisions(
        raw.filter((d: GateDecision) => String(d.status || '').toUpperCase() !== 'CANCELLED')
      );
    } catch {
      setDecisions([]);
    }
  };

  const fetchRaid = async () => {
    if (!initiative?.id) return;
    try {
      const response = await Api.get(`/initiatives/${initiative.id}/raid?limit=3`);
      setRaidItems(response?.items || response?.raid || (Array.isArray(response) ? response : []));
    } catch {
      setRaidItems([]);
    }
  };

  const handleStatusAction = useCallback(
    async (action: StatusAction) => {
      if (!initiative) return;

      try {
        setIsLoading(true);
        await Api.patch(`/initiatives/${initiative.id}/status`, {
          status: action.targetStatus,
        });

        onUpdate({ ...initiative, status: action.targetStatus });
        toast.success(
          t('initiatives.toast.statusChanged', 'Status zmieniony na {{status}}', {
            status: action.targetStatus,
          })
        );
      } catch (error: any) {
        // #74: Api.patch is fetch-based and throws a plain Error whose
        // `.message` already carries the backend's real reason (invalid
        // transition / permission denied / missing reason — see
        // InitiativeController.updateInitiativeStatus). `error.response.data`
        // is an axios shape this client never produces, so it was always
        // undefined and silently hid the real reason behind a generic toast.
        toast.error(
          error?.message || t('initiatives.toast.statusChangeError', 'Could not change status')
        );
      } finally {
        setIsLoading(false);
      }
    },
    [initiative, onUpdate]
  );

  const getStatusColor = (status: string) => {
    const meta = getStatusMeta(status as InitiativeStatus);
    return meta?.bgColor || 'bg-slate-500/10';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Get required gates for current status
  const requiredGates = initiative
    ? GATE_DEFINITIONS.filter((g) => g.forStatus === initiative.status)
    : [];

  const getGateStatus = (pmoDomain: string) => {
    const match = decisions.find((d) => d.type === pmoDomain || (d as any).pmoDomain === pmoDomain);
    if (!match) return 'MISSING';
    return match.status;
  };

  // Calculate progress through workflow (REVIEW -> APPROVED -> PLANNING)
  const workflowProgress = initiative
    ? initiative.status === 'REVIEW'
      ? 33
      : initiative.status === 'APPROVED'
        ? 66
        : initiative.status === 'PLANNING'
          ? 100
          : 0
    : 0;

  const renderOverview = () => {
    if (!initiative) return null;

    const statusMeta = getStatusMeta(initiative.status as InitiativeStatus);
    const actions = getStatusActions(initiative.status as InitiativeStatus);
    const primaryActions = actions.filter((a) => a.variant === 'primary').slice(0, 2);
    const blockingGates = requiredGates.filter((g) => getGateStatus(g.pmoDomain) !== 'APPROVED');
    const isGateReady = requiredGates.length === 0 || blockingGates.length === 0;

    const nextMilestone = milestones
      .filter((m) => m.status !== 'COMPLETED' && !!m.targetDate)
      .sort(
        (a, b) =>
          new Date(a.targetDate as string).getTime() - new Date(b.targetDate as string).getTime()
      )[0];

    return (
      <div className="space-y-5">
        {/* Gate readiness */}
        <div
          className={`p-4 rounded-xl border ${
            isGateReady
              ? 'bg-white/50 dark:bg-navy-900/50 border-slate-200 dark:border-navy-700'
              : 'bg-amber-900/10 border-amber-500/20'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              {t('initiatives.drawer.quickReview')}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${statusMeta?.bgColor} ${statusMeta?.color}`}
            >
              {t(statusMeta?.labelKey ?? 'initiatives.status.unknown')}
            </span>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                {t('initiatives.drawer.gateReadiness')}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {requiredGates.length === 0
                  ? 'No gate required for current status.'
                  : isGateReady
                    ? 'All required gate decisions are approved.'
                    : 'Blocked by missing / pending gate decisions.'}
              </div>
            </div>
            {requiredGates.length > 0 && (
              <button
                onClick={() => setActiveTab('decisions')}
                className="text-xs text-c-info hover:text-c-info"
              >
                {t('initiatives.drawer.viewDecisions')}
              </button>
            )}
          </div>

          {requiredGates.length > 0 && (
            <div className="mt-3 space-y-2">
              {requiredGates.map((gate) => {
                const status = getGateStatus(gate.pmoDomain);
                const ok = status === 'APPROVED';
                return (
                  <div key={gate.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <Scale size={14} className={ok ? 'text-emerald-400' : 'text-amber-400'} />
                      <span>{t(`initiatives.drawer.${gate.tKey}`)}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                        ok
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-500/20 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {status === 'MISSING' ? t('initiatives.drawer.notRequested') : status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
            {t('initiatives.drawer.summary')}
          </h4>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {initiative.summary || initiative.description || t('initiatives.drawer.noSummary')}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white/50 dark:bg-navy-900/50 rounded-lg border border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <Target size={12} />
              {t('initiatives.drawer.progress')}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-navy-900 rounded-full"
                  style={{ width: `${initiative.progress || 0}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {initiative.progress || 0}%
              </span>
            </div>
          </div>

          <div className="p-3 bg-white/50 dark:bg-navy-900/50 rounded-lg border border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <TrendingUp size={12} />
              {t('initiatives.drawer.roi')}
            </div>
            <div className="text-lg font-semibold text-green-400">
              {formatRoiDisplay(initiative.expectedRoi)}
            </div>
          </div>

          <div className="p-3 bg-white/50 dark:bg-navy-900/50 rounded-lg border border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <DollarSign size={12} />
              {t('initiatives.drawer.budget')}
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {formatCurrency(initiative.budget || (initiative as any).costCapex)}
            </div>
          </div>

          <div className="p-3 bg-white/50 dark:bg-navy-900/50 rounded-lg border border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <Flag size={12} />
              {t('initiatives.drawer.priority')}
            </div>
            <div
              className={`text-sm font-semibold ${
                initiative.priority === 'CRITICAL'
                  ? 'text-danger-400'
                  : initiative.priority === 'HIGH'
                    ? 'text-amber-400'
                    : initiative.priority === 'MEDIUM'
                      ? 'text-amber-400'
                      : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {initiative.priority || 'Medium'}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-3 bg-white/50 dark:bg-navy-900/50 rounded-lg border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-2">
            <Calendar size={12} />
            {t('initiatives.drawer.timeline')}
          </div>
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-slate-500">{t('initiatives.drawer.start')} </span>
              <span className="text-slate-900 dark:text-white">
                {formatDate(initiative.plannedStartDate)}
              </span>
            </div>
            <ChevronRight size={14} className="text-slate-600" />
            <div>
              <span className="text-slate-500">{t('initiatives.drawer.end')} </span>
              <span className="text-slate-900 dark:text-white">
                {formatDate(initiative.plannedEndDate)}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
            <span className="flex items-center gap-1.5">
              <Milestone size={12} />
              {t('initiatives.drawer.nextMilestone')}
            </span>
            <span className="text-slate-700 dark:text-slate-200">
              {nextMilestone
                ? `${nextMilestone.name} · ${formatDate(nextMilestone.targetDate)}`
                : '-'}
            </span>
          </div>
        </div>

        {/* Top RAID — B7.3: truncated with Show more */}
        <div className="p-3 bg-white/50 dark:bg-navy-900/50 rounded-lg border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={12} />
              {t('initiatives.drawer.topRisks')}
            </span>
            {raidItems.length > 0 && (
              <span className="text-[10px] text-slate-500">{raidItems.length}</span>
            )}
          </div>
          {raidItems.length === 0 ? (
            <div className="text-sm text-slate-500">{t('initiatives.drawer.noRaidItems')}</div>
          ) : (
            <DrawerRaidList items={raidItems} maxVisible={3} />
          )}
        </div>

        {/* Actions */}
        {primaryActions.length > 0 && (
          <div className="flex gap-2 pt-2">
            {primaryActions.map((action) => (
              <button
                key={action.targetStatus}
                onClick={() => handleStatusAction(action)}
                disabled={isLoading}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  action.variant === 'primary'
                    ? 'bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]'
                    : 'bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300'
                } disabled:opacity-50`}
              >
                {t(action.labelKey)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTimeline = () => {
    if (!initiative) return null;

    return (
      <div className="space-y-5">
        {/* Timeline Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
            Milestones
          </h4>
          {milestones.length > 0 && (
            <button
              onClick={() => onOpenWider(initiative)}
              className="text-xs text-c-info hover:text-c-info"
            >
              Manage in full view
            </button>
          )}
        </div>

        {/* Milestones List */}
        {milestones.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Milestone className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No milestones defined yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {milestones.map((milestone, idx) => (
              <div
                key={milestone.id}
                className={`relative pl-6 pb-4 ${
                  idx < milestones.length - 1
                    ? 'border-l-2 border-slate-200 dark:border-navy-700'
                    : ''
                }`}
              >
                <div
                  className={`absolute left-0 top-0 w-3 h-3 rounded-full -translate-x-[7px] ${
                    milestone.status === 'COMPLETED'
                      ? 'bg-green-500'
                      : milestone.status === 'IN_PROGRESS'
                        ? 'bg-blue-500 animate-pulse'
                        : milestone.status === 'DELAYED'
                          ? 'bg-danger-500'
                          : 'bg-navy-600'
                  }`}
                />
                <div className="bg-white/50 dark:bg-navy-900/50 rounded-lg p-3 border border-slate-200 dark:border-navy-700">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="text-sm font-medium text-slate-900 dark:text-white">
                      {milestone.name}
                    </h5>
                    {milestone.isGate && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">
                        Gate
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {formatDate(milestone.targetDate)}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        milestone.status === 'COMPLETED'
                          ? 'bg-green-500/20 text-green-400'
                          : milestone.status === 'IN_PROGRESS'
                            ? 'bg-blue-500/20 text-blue-400'
                            : milestone.status === 'DELAYED'
                              ? 'bg-danger-500/20 text-danger-400'
                              : 'bg-slate-500/20 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {milestone.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dependencies — B7.3: truncated */}
        {(initiative as any).dependencies?.length > 0 && (
          <DrawerDependenciesList dependencies={(initiative as any).dependencies} maxVisible={3} />
        )}
      </div>
    );
  };

  const renderResources = () => {
    if (!initiative) return null;

    return (
      <div className="space-y-5">
        {/* Owners */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
            Ownership
          </h4>
          <div className="space-y-3">
            {/* Business Owner */}
            <div className="flex items-center gap-3 p-3 bg-white/50 dark:bg-navy-900/50 rounded-lg border border-slate-200 dark:border-navy-700">
              {initiative.ownerBusiness ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-c-info/20 flex items-center justify-center text-sm font-medium text-c-info">
                    {initiative.ownerBusiness.avatarUrl ? (
                      <img
                        src={initiative.ownerBusiness.avatarUrl}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      `${initiative.ownerBusiness.firstName?.[0] || ''}${initiative.ownerBusiness.lastName?.[0] || ''}`
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {initiative.ownerBusiness.firstName} {initiative.ownerBusiness.lastName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Business Owner</div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Users size={16} />
                  <span>No business owner assigned</span>
                </div>
              )}
            </div>

            {/* Execution Owner */}
            <div className="flex items-center gap-3 p-3 bg-white/50 dark:bg-navy-900/50 rounded-lg border border-slate-200 dark:border-navy-700">
              {initiative.ownerExecution ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-medium text-blue-300">
                    {initiative.ownerExecution.avatarUrl ? (
                      <img
                        src={initiative.ownerExecution.avatarUrl}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      `${initiative.ownerExecution.firstName?.[0] || ''}${initiative.ownerExecution.lastName?.[0] || ''}`
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {initiative.ownerExecution.firstName} {initiative.ownerExecution.lastName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Execution Owner
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Users size={16} />
                  <span>No execution owner assigned</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Capacity */}
        <div className="p-4 bg-white/50 dark:bg-navy-900/50 rounded-xl border border-slate-200 dark:border-navy-700">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
            Resource Capacity
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Required FTE</span>
              <span className="text-slate-900 dark:text-white font-medium">
                {(initiative as any).required_capacity_fte || '0'} FTE
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Allocated FTE</span>
              <span className="text-slate-900 dark:text-white font-medium">
                {(initiative as any).allocated_capacity_fte || '0'} FTE
              </span>
            </div>
          </div>
        </div>

        <div className="text-center py-6 text-slate-500">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('initiatives.drawer.manageTeam')}</p>
        </div>
      </div>
    );
  };

  const renderDecisions = () => {
    if (!initiative) return null;

    return (
      <div className="space-y-5">
        {/* Gate Decisions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              {t('initiatives.drawer.gateDecisions')}
            </h4>
            <button
              onClick={() => onOpenWider(initiative)}
              className="text-xs text-c-info hover:text-c-info"
            >
              {t('initiatives.drawer.requestDecision')}
            </button>
          </div>

          {decisions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Scale className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('initiatives.drawer.noDecisions')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {decisions.map((decision) => (
                <div
                  key={decision.id}
                  className="p-3 bg-white/50 dark:bg-navy-900/50 rounded-lg border border-slate-200 dark:border-navy-700 hover:border-c-info/30 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="text-sm font-medium text-slate-900 dark:text-white">
                      {decision.title}
                    </h5>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                        decision.status === 'APPROVED'
                          ? 'bg-green-500/20 text-green-400'
                          : decision.status === 'REJECTED'
                            ? 'bg-danger-500/20 text-danger-400'
                            : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {decision.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="capitalize">
                      {decision.type?.toLowerCase().replace(/_/g, ' ')}
                    </span>
                    {decision.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(decision.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gate Requirements Info */}
        <div className="p-4 bg-slate-200/30 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-navy-700">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
            Gate Requirements
          </h4>
          <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
            <p>
              <strong className="text-slate-700 dark:text-slate-300">REVIEW → PROMOTED:</strong>{' '}
              Requires Go/No-Go decision
            </p>
            <p>
              <strong className="text-slate-700 dark:text-slate-300">PROMOTED → PLANNING:</strong>{' '}
              Requires Resources Commit decision
            </p>
            <p>
              <strong className="text-slate-700 dark:text-slate-300">APPROVED → SCHEDULED:</strong>{' '}
              Requires Schedule Lock decision + planned dates
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'timeline':
        return renderTimeline();
      case 'resources':
        return renderResources();
      case 'decisions':
        return renderDecisions();
      default:
        return null;
    }
  };

  if (!initiative) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-dropdown transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer Panel - 50% width */}
      <div
        className={`fixed top-0 right-0 h-full w-1/2 max-w-3xl min-w-[480px] bg-slate-50 dark:bg-navy-950 shadow-2xl z-overlay transform transition-transform duration-300 ease-out border-l border-slate-200 dark:border-navy-700 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-navy-700 bg-white/50 dark:bg-navy-900/50">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {initiative.axis?.replace(/([A-Z])/g, ' $1').trim() ||
                      t('initiatives.drawer.initiative')}
                  </span>
                  {initiative.targetQuarter && (
                    <span className="px-2 py-0.5 text-[10px] font-medium bg-c-info/20 text-c-info rounded">
                      {initiative.targetQuarter}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white line-clamp-2">
                  {initiative.name}
                </h2>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onOpenWider(initiative)}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-c-info hover:bg-c-info/10 rounded-lg transition-colors"
                  title="Open wider"
                >
                  <Maximize2 size={18} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="shrink-0 px-6 py-2 border-b border-slate-200 dark:border-navy-700 bg-white/30 dark:bg-navy-900/30">
            <div className="flex items-center gap-1">
              {(['overview', 'timeline', 'resources', 'decisions'] as DrawerTab[]).map((tabId) => {
                const count =
                  tabId === 'timeline'
                    ? milestones.length
                    : tabId === 'decisions'
                      ? decisions.length
                      : undefined;
                return (
                  <button
                    key={tabId}
                    onClick={() => setActiveTab(tabId)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === tabId
                        ? 'bg-c-info/20 text-c-info'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    {TAB_ICONS[tabId]}
                    {getTabLabel(t, tabId, count)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">{renderTabContent()}</div>
        </div>
      </div>
    </>
  );
};

export default InitiativeDrawer;
