/**
 * ResourcesAnalysis — Team workload management view
 * V3-F02b: Team-centric resource view with AI rebalancing
 *
 * Shows team members with their initiative assignments and workload.
 * AI button at top proposes reassignments to balance the load.
 */

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { PortfolioInitiative } from '@/types';

import type { OrgUser, QuickUpdatePayload, ResourceAllocation } from './types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AiReassignment {
  initiativeId: string;
  initiativeName: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  role: string;
  reason: string;
}

interface ResourcesAnalysisProps {
  allocations: ResourceAllocation[];
  issues: unknown[];
  onOpenInitiative: (id: string) => void;
  onQuickUpdate?: (initiativeId: string, updates: QuickUpdatePayload) => Promise<void>;
  users?: OrgUser[];
  initiatives?: PortfolioInitiative[];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const ResourcesAnalysis: React.FC<ResourcesAnalysisProps> = ({
  allocations,
  onOpenInitiative,
  onQuickUpdate,
  users = [],
  initiatives = [],
}) => {
  const { t } = useTranslation();
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(null);
  const [reassigningInitId, setReassigningInitId] = useState<string | null>(null);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>('');

  // AI rebalancing state
  const [aiProposals, setAiProposals] = useState<AiReassignment[] | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [applyingProposalIdx, setApplyingProposalIdx] = useState<number | null>(null);

  /* ---------- derived stats ---------- */

  const overallocatedCount = allocations.filter((a) => a.status === 'overallocated').length;
  const okCount = allocations.filter((a) => a.status === 'ok').length;
  const underutilizedCount = allocations.filter((a) => a.status === 'underutilized').length;
  const totalInitiatives = initiatives.length;

  const sortedAllocations = useMemo(
    () =>
      [...allocations].sort((a, b) => {
        const statusOrder: Record<string, number> = {
          overallocated: 0,
          ok: 1,
          underutilized: 2,
        };
        return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      }),
    [allocations]
  );

  /* ---------- helpers ---------- */

  const getInitiativeName = (id: string) => {
    return initiatives.find((i) => i.id === id)?.name ?? id;
  };

  const getUserLabel = (u: OrgUser) => `${u.firstName} ${u.lastName}`;

  /* ---------- handlers ---------- */

  const handleReassignOwner = useCallback(
    async (initiativeId: string, newOwnerId: string, role: string) => {
      if (!onQuickUpdate || !newOwnerId) return;
      try {
        const updates: QuickUpdatePayload =
          role === 'Business Owner'
            ? { ownerBusinessId: newOwnerId }
            : { ownerExecutionId: newOwnerId };
        await onQuickUpdate(initiativeId, updates);
        toast.success(t('initiatives.analysis.resources.ownerReassigned', 'Owner reassigned'));
        setReassigningInitId(null);
        setSelectedNewOwner('');
      } catch {
        toast.error(
          t('initiatives.analysis.resources.reassignFailed', 'Failed to reassign owner')
        );
      }
    },
    [onQuickUpdate, t]
  );

  /* ---------- AI rebalancing ---------- */

  const computeAiProposals = useCallback(() => {
    setAiRunning(true);

    // Simulate a short delay for "thinking"
    setTimeout(() => {
      const overloaded = allocations.filter((a) => a.status === 'overallocated');
      const available = allocations.filter(
        (a) => a.status === 'ok' || a.status === 'underutilized'
      );

      // Also consider users not yet assigned to any initiative
      const assignedUserIds = new Set(allocations.map((a) => a.resourceId));
      const unassignedUsers = users.filter((u) => !assignedUserIds.has(u.id));

      const proposals: AiReassignment[] = [];

      for (const overRes of overloaded) {
        const excessCount = overRes.allocatedInitiatives.length - 1;
        const candidateInits = overRes.allocatedInitiatives.slice(1, 1 + excessCount);

        for (const initId of candidateInits) {
          // Try to find a same-role person with capacity
          const sameRoleFree = available.find(
            (a) => a.role === overRes.role && a.utilizationPercent < 100
          );
          // Or an unassigned user
          const unassigned = unassignedUsers.shift();

          const target = sameRoleFree || (unassigned ? {
            resourceId: unassigned.id,
            resourceName: getUserLabel(unassigned),
          } : null);

          if (target) {
            proposals.push({
              initiativeId: initId,
              initiativeName: getInitiativeName(initId),
              fromUserId: overRes.resourceId,
              fromUserName: overRes.resourceName,
              toUserId: target.resourceId,
              toUserName: target.resourceName,
              role: overRes.role,
              reason: sameRoleFree
                ? `${target.resourceName} has capacity (${(sameRoleFree as ResourceAllocation).utilizationPercent}%)`
                : `${target.resourceName} is currently unassigned`,
            });

            // Update available capacity in-memory
            if (sameRoleFree) {
              (sameRoleFree as any).utilizationPercent += 100;
              if ((sameRoleFree as any).utilizationPercent >= 100) {
                const idx = available.indexOf(sameRoleFree);
                if (idx >= 0) available.splice(idx, 1);
              }
            }
          } else {
            // No one available — add a "no capacity" warning instead
            proposals.push({
              initiativeId: initId,
              initiativeName: getInitiativeName(initId),
              fromUserId: overRes.resourceId,
              fromUserName: overRes.resourceName,
              toUserId: '',
              toUserName: '',
              role: overRes.role,
              reason: t(
                'initiatives.analysis.resources.aiNoCapacity',
                'No available team member — consider hiring or postponing'
              ),
            });
          }
        }
      }

      setAiProposals(proposals.length > 0 ? proposals : []);
      setAiRunning(false);
    }, 800);
  }, [allocations, users, initiatives, t]);

  const handleApplyProposal = useCallback(
    async (proposal: AiReassignment, idx: number) => {
      if (!onQuickUpdate || !proposal.toUserId) return;
      setApplyingProposalIdx(idx);
      try {
        const updates: QuickUpdatePayload =
          proposal.role === 'Business Owner'
            ? { ownerBusinessId: proposal.toUserId }
            : { ownerExecutionId: proposal.toUserId };
        await onQuickUpdate(proposal.initiativeId, updates);
        toast.success(
          t('initiatives.analysis.resources.proposalApplied', 'Reassignment applied')
        );
        // Remove applied proposal
        setAiProposals((prev) => prev?.filter((_, i) => i !== idx) ?? null);
      } catch {
        toast.error(t('initiatives.analysis.resources.reassignFailed', 'Failed to reassign'));
      } finally {
        setApplyingProposalIdx(null);
      }
    },
    [onQuickUpdate, t]
  );

  const handleApplyAllProposals = useCallback(async () => {
    if (!onQuickUpdate || !aiProposals) return;
    const actionable = aiProposals.filter((p) => p.toUserId);
    if (actionable.length === 0) {
      toast.error(
        t(
          'initiatives.analysis.resources.noActionable',
          'No actionable proposals — all require manual resolution'
        )
      );
      return;
    }
    setAiRunning(true);
    let success = 0;
    let failed = 0;
    for (const proposal of actionable) {
      try {
        const updates: QuickUpdatePayload =
          proposal.role === 'Business Owner'
            ? { ownerBusinessId: proposal.toUserId }
            : { ownerExecutionId: proposal.toUserId };
        await onQuickUpdate(proposal.initiativeId, updates);
        success++;
      } catch {
        failed++;
      }
    }
    if (failed === 0) {
      toast.success(
        t('initiatives.analysis.resources.allApplied', {
          count: success,
          defaultValue: 'All {{count}} reassignments applied',
        })
      );
    } else {
      toast.error(
        t('initiatives.analysis.resources.partialApplied', {
          success,
          failed,
          defaultValue: '{{success}} applied, {{failed}} failed',
        })
      );
    }
    setAiProposals(null);
    setAiRunning(false);
  }, [aiProposals, onQuickUpdate, t]);

  /* ---------- render ---------- */

  return (
    <div className="space-y-6">
      {/* Header strip: stats + AI button */}
      <div className="flex items-center gap-4">
        {/* Stats cards */}
        <div className="flex-1 grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-3">
            <div className="text-xl font-semibold text-slate-900 dark:text-white">
              {allocations.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('initiatives.analysis.resources.teamMembers', 'Team members')}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-3">
            <div className="text-xl font-semibold text-slate-900 dark:text-white">
              {totalInitiatives}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('initiatives.analysis.resources.totalInitiatives', 'Initiatives')}
            </div>
          </div>
          <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-500/5 dark:bg-red-500/10 p-3">
            <div className="text-xl font-semibold text-red-600 dark:text-red-400">
              {overallocatedCount}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('initiatives.analysis.resources.overloaded', 'Overloaded')}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/5 dark:bg-emerald-500/10 p-3">
            <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
              {okCount + underutilizedCount}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('initiatives.analysis.resources.available', 'Available')}
            </div>
          </div>
        </div>

        {/* AI Balance button */}
        {onQuickUpdate && (
          <button
            onClick={computeAiProposals}
            disabled={aiRunning}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold
              bg-gradient-to-r from-purple-600 to-indigo-600 text-white
              hover:from-purple-700 hover:to-indigo-700
              disabled:opacity-60 disabled:cursor-not-allowed
              shadow-lg shadow-purple-500/20 transition-all duration-200"
          >
            {aiRunning ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {aiRunning
              ? t('initiatives.analysis.resources.aiAnalyzing', 'Analyzing...')
              : t('initiatives.analysis.resources.aiBalance', 'AI Balance workload')}
          </button>
        )}
      </div>

      {/* AI Proposals panel */}
      {aiProposals !== null && (
        <div className="rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-500/5 dark:bg-purple-500/10 overflow-hidden">
          <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                {t('initiatives.analysis.resources.aiProposals', 'AI rebalancing proposals')}
              </h3>
              <span className="text-xs text-purple-500 dark:text-purple-400">
                ({aiProposals.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              {aiProposals.some((p) => p.toUserId) && (
                <button
                  onClick={handleApplyAllProposals}
                  disabled={aiRunning}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                    bg-purple-600 text-white hover:bg-purple-700
                    disabled:opacity-50 transition-colors"
                >
                  <Check size={12} />
                  {t('initiatives.analysis.resources.applyAll', 'Apply all')}
                </button>
              )}
              <button
                onClick={() => setAiProposals(null)}
                className="p-1 rounded text-purple-500 hover:bg-purple-200/30 dark:hover:bg-purple-800/30 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {aiProposals.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Check size={24} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t(
                  'initiatives.analysis.resources.aiBalanced',
                  'Workload is balanced — no changes needed'
                )}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-purple-200/50 dark:divide-purple-900/30">
              {aiProposals.map((proposal, idx) => (
                <div
                  key={`${proposal.initiativeId}-${idx}`}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 dark:text-white truncate">
                        {proposal.initiativeName}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">:</span>
                      <span className="text-red-600 dark:text-red-400 line-through text-xs">
                        {proposal.fromUserName}
                      </span>
                      {proposal.toUserId ? (
                        <>
                          <span className="text-slate-400">→</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                            {proposal.toUserName}
                          </span>
                        </>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                          {t('initiatives.analysis.resources.noTarget', '⚠ No available person')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {proposal.reason}
                    </p>
                  </div>
                  {proposal.toUserId ? (
                    <button
                      onClick={() => handleApplyProposal(proposal, idx)}
                      disabled={applyingProposalIdx === idx}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                        bg-emerald-500/10 text-emerald-600 dark:text-emerald-400
                        hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                    >
                      {applyingProposalIdx === idx ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Check size={12} />
                      )}
                      {t('initiatives.analysis.resources.accept', 'Accept')}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const init = initiatives.find((i) => i.id === proposal.initiativeId);
                        if (init) onOpenInitiative(init.id);
                      }}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                        bg-primary-500/10 text-primary-600 dark:text-primary-400
                        hover:bg-primary-500/20 transition-colors"
                    >
                      <ExternalLink size={12} />
                      {t('initiatives.analysis.resources.resolve', 'Resolve manually')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team workload table */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-navy-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('initiatives.analysis.resources.teamWorkload', 'Team workload')}
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-navy-800/30 border-b border-slate-200 dark:border-navy-700">
              <th className="text-left px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 w-8" />
              <th className="text-left px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.analysis.resources.person', 'Person')}
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.analysis.resources.role', 'Role')}
              </th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 w-24">
                {t('initiatives.analysis.resources.initiatives', 'Initiatives')}
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 w-48">
                {t('initiatives.analysis.resources.workload', 'Workload')}
              </th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 w-28">
                {t('initiatives.analysis.resources.status', 'Status')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedAllocations.map((a) => {
              const isExpanded = expandedResourceId === a.resourceId;
              return (
                <React.Fragment key={a.resourceId}>
                  <tr
                    className={`border-b border-slate-100 dark:border-navy-800/50 cursor-pointer
                      hover:bg-slate-50 dark:hover:bg-navy-800/30 transition-colors
                      ${a.status === 'overallocated' ? 'bg-red-500/5 dark:bg-red-500/10' : ''}`}
                    onClick={() =>
                      setExpandedResourceId(isExpanded ? null : a.resourceId)
                    }
                  >
                    <td className="px-4 py-3 text-slate-400">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                            a.status === 'overallocated'
                              ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                              : a.status === 'underutilized'
                                ? 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                                : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {a.resourceName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {a.resourceName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{a.role}</td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">
                      {a.allocatedInitiatives.length}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2.5 bg-slate-200 dark:bg-navy-700 rounded-full">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-300 ${
                              a.utilizationPercent > 100
                                ? 'bg-red-500'
                                : a.utilizationPercent > 80
                                  ? 'bg-amber-500'
                                  : a.utilizationPercent > 0
                                    ? 'bg-emerald-500'
                                    : 'bg-slate-300 dark:bg-navy-600'
                            }`}
                            style={{
                              width: `${Math.min(100, a.utilizationPercent)}%`,
                            }}
                          />
                        </div>
                        <span
                          className={`text-xs font-semibold tabular-nums w-12 text-right ${
                            a.utilizationPercent > 100
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {a.utilizationPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          a.status === 'overallocated'
                            ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                            : a.status === 'underutilized'
                              ? 'bg-slate-200/70 dark:bg-navy-700 text-slate-600 dark:text-slate-400'
                              : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {a.status === 'overallocated'
                          ? t('initiatives.analysis.resources.overallocated', 'Overloaded')
                          : a.status === 'underutilized'
                            ? t('initiatives.analysis.resources.underutilized', 'Free')
                            : t('initiatives.analysis.resources.ok', 'OK')}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded: initiative assignments */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} className="px-0 py-0">
                        <div className="bg-slate-50/50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
                          <div className="px-12 py-3 space-y-1.5">
                            {a.allocatedInitiatives.map((initId) => {
                              const initName = getInitiativeName(initId);
                              const isReassigning = reassigningInitId === initId;
                              return (
                                <div
                                  key={initId}
                                  className="flex items-center gap-3 py-2 px-3 rounded-lg
                                    bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700"
                                >
                                  <span className="flex-1 text-sm font-medium text-slate-900 dark:text-white truncate">
                                    {initName}
                                  </span>
                                  {isReassigning ? (
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                      <select
                                        value={selectedNewOwner}
                                        onChange={(e) => setSelectedNewOwner(e.target.value)}
                                        className="px-2 py-1 text-xs bg-slate-50 dark:bg-navy-950
                                          border border-slate-200 dark:border-navy-700 rounded-lg
                                          text-slate-900 dark:text-white"
                                      >
                                        <option value="">
                                          {t(
                                            'initiatives.analysis.resources.selectOwner',
                                            'Select new owner...'
                                          )}
                                        </option>
                                        {users
                                          .filter((u) => u.id !== a.resourceId)
                                          .map((u) => (
                                            <option key={u.id} value={u.id}>
                                              {getUserLabel(u)}
                                            </option>
                                          ))}
                                      </select>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReassignOwner(initId, selectedNewOwner, a.role);
                                        }}
                                        disabled={!selectedNewOwner}
                                        className="p-1 rounded text-emerald-600 dark:text-emerald-400
                                          hover:bg-emerald-500/10 disabled:opacity-30"
                                      >
                                        <Check size={14} />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReassigningInitId(null);
                                          setSelectedNewOwner('');
                                        }}
                                        className="p-1 rounded text-slate-400
                                          hover:bg-slate-200 dark:hover:bg-navy-700"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      {onQuickUpdate && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setReassigningInitId(initId);
                                            setSelectedNewOwner('');
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg
                                            text-xs font-medium text-slate-600 dark:text-slate-400
                                            hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                                        >
                                          <UserPlus size={12} />
                                          {t('initiatives.analysis.resources.reassign', 'Reassign')}
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenInitiative(initId);
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg
                                          text-xs font-medium bg-primary-500/10 text-primary-600
                                          dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
                                      >
                                        <ExternalLink size={12} />
                                        {t('initiatives.analysis.openInitiative', 'Open')}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {allocations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
          <AlertTriangle size={32} className="mb-3 opacity-50" />
          <p className="text-sm">
            {t('initiatives.analysis.resources.noData', 'No team members assigned yet.')}
          </p>
        </div>
      )}
    </div>
  );
};
