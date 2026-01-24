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
  ExternalLink,
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
import { getStatusMeta, getStatusActions, StatusAction } from '@/services/initiativeLifecycle';

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
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  dueDate?: string;
  ownerName?: string;
}

const TABS: { id: DrawerTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <FileText size={14} /> },
  { id: 'timeline', label: 'Timeline', icon: <Calendar size={14} /> },
  { id: 'resources', label: 'Resources', icon: <Users size={14} /> },
  { id: 'decisions', label: 'Decisions', icon: <Scale size={14} /> },
];

/**
 * Gate Decisions for Initiatives module
 * Flow: REVIEW -> APPROVED -> PLANNING
 * - Go/No-Go: Required to move from REVIEW to APPROVED
 * - Resources Commit: Required to move from APPROVED to PLANNING
 * - Schedule Lock: Required to move from APPROVED to PLANNING
 */
const GATE_DEFINITIONS = [
  { id: 'GO_NO_GO', label: 'Go/No-Go', forStatus: 'REVIEW', targetStatus: 'APPROVED', pmoDomain: 'GOVERNANCE_DECISION_MAKING' },
  { id: 'RESOURCES_COMMIT', label: 'Resources Commit', forStatus: 'APPROVED', targetStatus: 'PLANNING', pmoDomain: 'RESOURCE_RESPONSIBILITY' },
  { id: 'SCHEDULE_LOCK', label: 'Schedule Lock', forStatus: 'APPROVED', targetStatus: 'PLANNING', pmoDomain: 'SCHEDULE_MILESTONES' },
];

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
  const [isLoading, setIsLoading] = useState(false);

  // Fetch additional data when initiative changes
  useEffect(() => {
    if (!initiative?.id || !isOpen) return;
    setActiveTab('overview');
    fetchMilestones();
    fetchDecisions();
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
      setDecisions(Array.isArray(response) ? response : response?.decisions || []);
    } catch {
      setDecisions([]);
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
        toast.success(`Status changed to ${action.targetStatus}`);
      } catch (error: any) {
        toast.error(error?.response?.data?.error || 'Failed to change status');
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
    const match = decisions.find(
      (d) => d.type === pmoDomain || (d as any).pmoDomain === pmoDomain
    );
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

    return (
      <div className="space-y-5">
        {/* Workflow Progress */}
        <div className="p-4 bg-navy-900/50 rounded-xl border border-navy-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase">
              Workflow Progress
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusMeta?.bgColor} ${statusMeta?.color}`}>
              {statusMeta?.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {['REVIEW', 'APPROVED', 'PLANNING'].map((status, idx) => (
              <React.Fragment key={status}>
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                    initiative.status === status
                      ? 'bg-purple-500 text-white ring-2 ring-purple-300'
                      : workflowProgress > idx * 33
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-navy-800 text-slate-500'
                  }`}
                >
                  {workflowProgress > idx * 33 && initiative.status !== status ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    idx + 1
                  )}
                </div>
                {idx < 2 && (
                  <div
                    className={`flex-1 h-1 rounded ${
                      workflowProgress > (idx + 1) * 33 ? 'bg-green-500/30' : 'bg-navy-700'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-2">
            <span>Review</span>
            <span>Approved</span>
            <span>Planning</span>
          </div>
        </div>

        {/* Summary */}
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Summary</h4>
          <p className="text-sm text-slate-300 leading-relaxed">
            {initiative.summary || initiative.description || 'No summary provided.'}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-navy-900/50 rounded-lg border border-navy-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Target size={12} />
              Progress
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${initiative.progress || 0}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-white">
                {initiative.progress || 0}%
              </span>
            </div>
          </div>

          <div className="p-3 bg-navy-900/50 rounded-lg border border-navy-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <TrendingUp size={12} />
              ROI
            </div>
            <div className="text-lg font-semibold text-green-400">
              {initiative.expectedRoi ? `${initiative.expectedRoi.toFixed(1)}x` : '-'}
            </div>
          </div>

          <div className="p-3 bg-navy-900/50 rounded-lg border border-navy-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <DollarSign size={12} />
              Budget
            </div>
            <div className="text-sm font-semibold text-white">
              {formatCurrency(initiative.budget || (initiative as any).costCapex)}
            </div>
          </div>

          <div className="p-3 bg-navy-900/50 rounded-lg border border-navy-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Flag size={12} />
              Priority
            </div>
            <div className={`text-sm font-semibold ${
              initiative.priority === 'CRITICAL' ? 'text-red-400' :
              initiative.priority === 'HIGH' ? 'text-orange-400' :
              initiative.priority === 'MEDIUM' ? 'text-amber-400' : 'text-slate-400'
            }`}>
              {initiative.priority || 'Medium'}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-3 bg-navy-900/50 rounded-lg border border-navy-700">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
            <Calendar size={12} />
            Timeline
          </div>
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-slate-500">Start: </span>
              <span className="text-white">{formatDate(initiative.plannedStartDate)}</span>
            </div>
            <ChevronRight size={14} className="text-slate-600" />
            <div>
              <span className="text-slate-500">End: </span>
              <span className="text-white">{formatDate(initiative.plannedEndDate)}</span>
            </div>
          </div>
        </div>

        {/* Required Gate Decisions */}
        {requiredGates.length > 0 && (
          <div className="p-4 bg-amber-900/10 rounded-xl border border-amber-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Scale size={14} className="text-amber-400" />
              <span className="text-xs font-semibold text-amber-400 uppercase">
                Required Gate Decisions
              </span>
            </div>
            <div className="space-y-2">
              {requiredGates.map((gate) => {
                const status = getGateStatus(gate.pmoDomain);
                return (
                  <div key={gate.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{gate.label}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                        status === 'APPROVED'
                          ? 'bg-green-500/20 text-green-400'
                          : status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-500/20 text-slate-400'
                      }`}
                    >
                      {status === 'MISSING' ? 'Not Requested' : status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-navy-800 hover:bg-navy-700 text-slate-300'
                } disabled:opacity-50`}
              >
                {action.label}
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
          <h4 className="text-xs font-semibold text-slate-400 uppercase">Milestones</h4>
          <button className="text-xs text-purple-400 hover:text-purple-300">
            + Add Milestone
          </button>
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
                  idx < milestones.length - 1 ? 'border-l-2 border-navy-700' : ''
                }`}
              >
                <div
                  className={`absolute left-0 top-0 w-3 h-3 rounded-full -translate-x-[7px] ${
                    milestone.status === 'COMPLETED'
                      ? 'bg-green-500'
                      : milestone.status === 'IN_PROGRESS'
                        ? 'bg-blue-500 animate-pulse'
                        : milestone.status === 'DELAYED'
                          ? 'bg-red-500'
                          : 'bg-navy-600'
                  }`}
                />
                <div className="bg-navy-900/50 rounded-lg p-3 border border-navy-700">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="text-sm font-medium text-white">{milestone.name}</h5>
                    {milestone.isGate && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">
                        Gate
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
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
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-slate-500/20 text-slate-400'
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

        {/* Dependencies */}
        {(initiative as any).dependencies?.length > 0 && (
          <div className="pt-4 border-t border-navy-700">
            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Dependencies</h4>
            <div className="space-y-2">
              {(initiative as any).dependencies.map((dep: any) => (
                <div
                  key={dep.initiativeId || dep.id}
                  className="flex items-center gap-2 p-2 bg-navy-900/50 rounded-lg text-sm text-slate-300"
                >
                  <ChevronRight size={14} className="text-slate-500" />
                  <span>Depends on: {dep.name || dep.initiativeId}</span>
                </div>
              ))}
            </div>
          </div>
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
          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Ownership</h4>
          <div className="space-y-3">
            {/* Business Owner */}
            <div className="flex items-center gap-3 p-3 bg-navy-900/50 rounded-lg border border-navy-700">
              {initiative.ownerBusiness ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-medium text-purple-300">
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
                    <div className="text-sm font-medium text-white">
                      {initiative.ownerBusiness.firstName} {initiative.ownerBusiness.lastName}
                    </div>
                    <div className="text-xs text-slate-400">Business Owner</div>
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
            <div className="flex items-center gap-3 p-3 bg-navy-900/50 rounded-lg border border-navy-700">
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
                    <div className="text-sm font-medium text-white">
                      {initiative.ownerExecution.firstName} {initiative.ownerExecution.lastName}
                    </div>
                    <div className="text-xs text-slate-400">Execution Owner</div>
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
        <div className="p-4 bg-navy-900/50 rounded-xl border border-navy-700">
          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Resource Capacity</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Required FTE</span>
              <span className="text-white font-medium">
                {(initiative as any).required_capacity_fte || '0'} FTE
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Allocated FTE</span>
              <span className="text-white font-medium">
                {(initiative as any).allocated_capacity_fte || '0'} FTE
              </span>
            </div>
          </div>
        </div>

        {/* Team placeholder */}
        <div className="text-center py-6 text-slate-500">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Team management coming soon</p>
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
            <h4 className="text-xs font-semibold text-slate-400 uppercase">Gate Decisions</h4>
            <button className="text-xs text-purple-400 hover:text-purple-300">
              + Request Decision
            </button>
          </div>

          {decisions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Scale className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No decisions linked to this initiative</p>
            </div>
          ) : (
            <div className="space-y-2">
              {decisions.map((decision) => (
                <div
                  key={decision.id}
                  className="p-3 bg-navy-900/50 rounded-lg border border-navy-700 hover:border-purple-500/30 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="text-sm font-medium text-white">{decision.title}</h5>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                        decision.status === 'APPROVED'
                          ? 'bg-green-500/20 text-green-400'
                          : decision.status === 'REJECTED'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {decision.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="capitalize">{decision.type?.toLowerCase().replace(/_/g, ' ')}</span>
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
        <div className="p-4 bg-slate-800/30 rounded-xl border border-navy-700">
          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">
            Gate Requirements
          </h4>
          <div className="space-y-2 text-xs text-slate-400">
            <p>
              <strong className="text-slate-300">REVIEW → APPROVED:</strong> Requires Go/No-Go decision
            </p>
            <p>
              <strong className="text-slate-300">APPROVED → EXECUTING:</strong> Requires Resources Commit and Schedule Lock decisions
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
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer Panel - 50% width */}
      <div
        className={`fixed top-0 right-0 h-full w-1/2 max-w-3xl min-w-[480px] bg-navy-950 shadow-2xl z-50 transform transition-transform duration-300 ease-out border-l border-navy-700 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="shrink-0 px-6 py-4 border-b border-navy-700 bg-navy-900/50">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wide">
                    {initiative.axis?.replace(/([A-Z])/g, ' $1').trim() || 'Initiative'}
                  </span>
                  {initiative.targetQuarter && (
                    <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-300 rounded">
                      {initiative.targetQuarter}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white line-clamp-2">
                  {initiative.name}
                </h2>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onOpenWider(initiative)}
                  className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                  title="Open wider"
                >
                  <Maximize2 size={18} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="shrink-0 px-6 py-2 border-b border-navy-700 bg-navy-900/30">
            <div className="flex items-center gap-1">
              {TABS.map((tab) => (
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
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">{renderTabContent()}</div>

          {/* Footer - Open wider button */}
          <div className="shrink-0 px-6 py-4 border-t border-navy-700 bg-navy-900/30">
            <button
              onClick={() => onOpenWider(initiative)}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors"
            >
              <ExternalLink size={16} />
              Open Wider - Full Initiative View
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default InitiativeDrawer;
