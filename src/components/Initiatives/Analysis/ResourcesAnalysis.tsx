/**
 * ResourcesAnalysis — Team workload management view
 * V3-F02b: Team-centric resource view with deterministic rebalancing
 *
 * Shows team members with their initiative assignments and workload.
 * The „Balance workload" button proposes reassignments computed LOCALLY from
 * allocation arithmetic (no model call, no fake delay) — see the note above
 * `computeRebalanceProposals`.
 */

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Filter,
  Loader2,
  Scale,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { PortfolioInitiative } from '@/types';

import { getMenu3DeterministicButtonClass } from './menu3ActionButtonStyles';
import { DEFAULT_CONCURRENT_CAPACITY, formatUtilizationPercent } from './resourceLoadMath';
import type {
  OrgUser,
  QuickUpdatePayload,
  RegisterAnalysisWorkspacePanel,
  ResourceAllocation,
} from './types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RebalanceProposal {
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
  onRegisterActions?: (node: React.ReactNode) => void;
  onRegisterWorkspacePanel?: RegisterAnalysisWorkspacePanel;
}

/* ------------------------------------------------------------------ */
/*  Sort helpers                                                       */
/* ------------------------------------------------------------------ */

type SortColumn = 'person' | 'role' | 'initiatives' | 'workload' | 'status';
type SortDir = 'asc' | 'desc';

const SortIcon: React.FC<{ column: SortColumn; currentCol: SortColumn; currentDir: SortDir }> = ({
  column,
  currentCol,
  currentDir,
}) => {
  if (column !== currentCol)
    return <ArrowUpDown size={12} className="text-slate-600 dark:text-slate-400" />;
  return currentDir === 'asc' ? (
    <ArrowUp size={12} className="text-c-info" />
  ) : (
    <ArrowDown size={12} className="text-c-info" />
  );
};

const SortableHeader: React.FC<{
  label: string;
  column: SortColumn;
  currentCol: SortColumn;
  currentDir: SortDir;
  onSort: (col: SortColumn) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
}> = ({ label, column, currentCol, currentDir, onSort, align = 'left', className = '' }) => (
  <th
    className={`text-${align} px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 ${className}`}
  >
    <button
      onClick={() => onSort(column)}
      className={`inline-flex items-center gap-1 hover:text-c-info dark:hover:text-c-info transition-colors ${
        align === 'center' ? 'mx-auto' : ''
      }`}
    >
      {label}
      <SortIcon column={column} currentCol={currentCol} currentDir={currentDir} />
    </button>
  </th>
);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const ResourcesAnalysis: React.FC<ResourcesAnalysisProps> = ({
  allocations,
  onOpenInitiative,
  onQuickUpdate,
  users = [],
  initiatives = [],
  onRegisterActions,
  onRegisterWorkspacePanel,
}) => {
  const { t, i18n } = useTranslation();
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(null);
  const [reassigningInitId, setReassigningInitId] = useState<string | null>(null);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>('');

  // Rebalancing state. `applyingAll` covers ONLY the real async apply-all round
  // trip — computing the proposals is synchronous and never shows a spinner.
  const [rebalanceProposals, setRebalanceProposals] = useState<RebalanceProposal[] | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [applyingProposalIdx, setApplyingProposalIdx] = useState<number | null>(null);
  const [proposalOverrides, setProposalOverrides] = useState<Record<number, string>>({});

  // Sort & filter state
  const [sortCol, setSortCol] = useState<SortColumn>('workload');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  /* ---------- derived stats ---------- */

  const overallocatedCount = allocations.filter((a) => a.status === 'overallocated').length;
  const okCount = allocations.filter((a) => a.status === 'ok').length;
  const underutilizedCount = allocations.filter((a) => a.status === 'underutilized').length;
  const totalInitiatives = initiatives.length;

  const uniqueRoles = useMemo(
    () => Array.from(new Set(allocations.map((a) => a.role))).sort(),
    [allocations]
  );

  const handleSort = useCallback(
    (col: SortColumn) => {
      if (sortCol === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortCol(col);
        setSortDir(col === 'workload' || col === 'initiatives' ? 'desc' : 'asc');
      }
    },
    [sortCol]
  );

  const sortedAllocations = useMemo(() => {
    let list = [...allocations];

    if (roleFilter !== 'all') {
      list = list.filter((a) => a.role === roleFilter);
    }

    const statusOrder: Record<string, number> = {
      overallocated: 0,
      ok: 1,
      underutilized: 2,
    };

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'person':
          cmp = a.resourceName.localeCompare(b.resourceName);
          break;
        case 'role':
          cmp = a.role.localeCompare(b.role);
          break;
        case 'initiatives':
          cmp = a.allocatedInitiatives.length - b.allocatedInitiatives.length;
          break;
        case 'workload':
          cmp = a.utilizationPercent - b.utilizationPercent;
          break;
        case 'status':
          cmp = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [allocations, roleFilter, sortCol, sortDir]);

  /* ---------- helpers ---------- */

  const getInitiativeName = (id: string) => {
    return initiatives.find((i) => i.id === id)?.name ?? id;
  };

  const getUserLabel = (u: OrgUser) => `${u.firstName} ${u.lastName}`;

  const closeRebalancePanel = useCallback(() => {
    setRebalanceProposals(null);
    setProposalOverrides({});
  }, []);

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
        toast.error(t('initiatives.analysis.resources.reassignFailed', 'Failed to reassign owner'));
      }
    },
    [onQuickUpdate, t]
  );

  /* ---------- Rozkład obciążenia (DETERMINISTYCZNY, nie AI) ---------- */
  //
  // 2026-07-23 — wycięta atrapa AI. Do dziś ta funkcja nazywała się „AI Balance
  // workload", miała ikonę Sparkles, spinner „Analyzing…" i `setTimeout(800)`
  // z komentarzem `Simulate a short delay for "thinking"`. Żaden model nigdy nie
  // był wołany: wynik to ARYTMETYKA na `allocations` (status przeciążenia, rola,
  // `utilizationPercent`, wolne osoby). Reguła: wynik policzony lokalnie NIE MOŻE
  // być podpisany „AI". Liczy się natychmiast → pokazuje się natychmiast.
  // Rachunek zostaje bez zmian (był poprawny) — zmienia się tylko uczciwa etykieta.

  const computeRebalanceProposals = useCallback(() => {
    {
      const overloaded = allocations.filter((a) => a.status === 'overallocated');
      const available = allocations.filter(
        (a) => a.status === 'ok' || a.status === 'underutilized'
      );

      // Also consider users not yet assigned to any initiative
      const assignedUserIds = new Set(allocations.map((a) => a.resourceId));
      const unassignedUsers = users.filter((u) => !assignedUserIds.has(u.id));

      const proposals: RebalanceProposal[] = [];

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

          const target =
            sameRoleFree ||
            (unassigned
              ? {
                  resourceId: unassigned.id,
                  resourceName: getUserLabel(unassigned),
                }
              : null);

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
                ? t(
                    'initiatives.analysis.resources.reasonHasCapacity',
                    '{{name}} has capacity ({{load}})',
                    {
                      name: target.resourceName,
                      load: formatUtilizationPercent(
                        (sameRoleFree as ResourceAllocation).utilizationPercent,
                        i18n.language
                      ),
                    }
                  )
                : t(
                    'initiatives.analysis.resources.reasonUnassigned',
                    '{{name}} is currently unassigned',
                    {
                      name: target.resourceName,
                    }
                  ),
            });

            // Update available capacity in-memory. One reassigned initiative adds
            // one capacity-unit of load (100% ÷ DEFAULT_CONCURRENT_CAPACITY), matching
            // the utilization model in resourceLoadMath — NOT a flat +100 per move.
            if (sameRoleFree) {
              (sameRoleFree as any).utilizationPercent += Math.round(
                100 / DEFAULT_CONCURRENT_CAPACITY
              );
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
                'initiatives.analysis.resources.noCapacity',
                'No available team member — consider hiring or postponing'
              ),
            });
          }
        }
      }

      setRebalanceProposals(proposals.length > 0 ? proposals : []);
      setProposalOverrides({});
    }
  }, [allocations, users, initiatives, t]);

  const handleApplyProposal = useCallback(
    async (proposal: RebalanceProposal, idx: number) => {
      if (!onQuickUpdate || !proposal.toUserId) return;
      setApplyingProposalIdx(idx);
      try {
        const updates: QuickUpdatePayload =
          proposal.role === 'Business Owner'
            ? { ownerBusinessId: proposal.toUserId }
            : { ownerExecutionId: proposal.toUserId };
        await onQuickUpdate(proposal.initiativeId, updates);
        toast.success(t('initiatives.analysis.resources.proposalApplied', 'Reassignment applied'));
        // Remove applied proposal
        setRebalanceProposals((prev) => prev?.filter((_, i) => i !== idx) ?? null);
      } catch {
        toast.error(t('initiatives.analysis.resources.reassignFailed', 'Failed to reassign'));
      } finally {
        setApplyingProposalIdx(null);
      }
    },
    [onQuickUpdate, t]
  );

  const handleApplyAllProposals = useCallback(async () => {
    if (!onQuickUpdate || !rebalanceProposals) return;
    const resolvedProposals = rebalanceProposals.map((p, idx) => {
      const overrideId = proposalOverrides[idx];
      return overrideId ? { ...p, toUserId: overrideId } : p;
    });
    const actionable = resolvedProposals.filter((p) => p.toUserId);
    if (actionable.length === 0) {
      toast.error(
        t(
          'initiatives.analysis.resources.noActionable',
          'No actionable proposals — select a person for each row first'
        )
      );
      return;
    }
    setApplyingAll(true);
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
    setRebalanceProposals(null);
    setProposalOverrides({});
    setApplyingAll(false);
  }, [rebalanceProposals, proposalOverrides, onQuickUpdate, t]);

  const rebalancePanel =
    rebalanceProposals !== null ? (
      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] overflow-hidden m-4">
        <div className="px-4 py-3 bg-white dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-[var(--c-info)]" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t(
                'initiatives.analysis.resources.rebalanceProposals',
                'Workload rebalancing proposals'
              )}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({rebalanceProposals.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {rebalanceProposals.some((p, i) => p.toUserId || proposalOverrides[i]) && (
              <button
                onClick={handleApplyAllProposals}
                disabled={applyingAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50 transition-colors"
              >
                <Check size={12} />
                {t('initiatives.analysis.resources.applyAll', 'Apply all')}
              </button>
            )}
            <button
              onClick={closeRebalancePanel}
              className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {rebalanceProposals.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <Check size={24} className="mx-auto mb-2 text-emerald-500" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t(
                'initiatives.analysis.resources.balanced',
                'Workload is balanced — no changes needed'
              )}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-white/5">
            {rebalanceProposals.map((proposal, idx) => {
              const overrideUserId = proposalOverrides[idx];
              const effectiveUserId = overrideUserId ?? proposal.toUserId;
              const effectiveUserName = overrideUserId
                ? users.find((u) => u.id === overrideUserId)
                  ? getUserLabel(users.find((u) => u.id === overrideUserId)!)
                  : overrideUserId
                : proposal.toUserName;
              const isOverridden = !!overrideUserId && overrideUserId !== proposal.toUserId;

              return (
                <div
                  key={`${proposal.initiativeId}-${idx}`}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 dark:text-white truncate">
                        {proposal.initiativeName}
                      </span>
                      <span className="text-slate-600 dark:text-slate-500">:</span>
                      <span className="text-danger-600 dark:text-danger-400 line-through text-xs">
                        {proposal.fromUserName}
                      </span>
                      <span className="text-slate-600">→</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {proposal.reason}
                    </p>
                  </div>

                  <select
                    value={effectiveUserId}
                    onChange={(e) => {
                      setProposalOverrides((prev) => ({ ...prev, [idx]: e.target.value }));
                    }}
                    className={`shrink-0 px-2 py-1.5 text-xs rounded-lg border transition-colors bg-white dark:bg-navy-950 text-slate-900 dark:text-white ${
                      isOverridden
                        ? 'border-c-info/60 ring-1 ring-c-info/20'
                        : 'border-slate-200 dark:border-navy-700'
                    }`}
                  >
                    {proposal.toUserId && (
                      // Znacznik osoby PODPOWIEDZIANEJ przez wyliczenie. Do 2026-07-23
                      // było tu „(AI)" — przy propozycji, której nie policzył żaden model.
                      <option value={proposal.toUserId}>
                        {proposal.toUserName} (
                        {t('initiatives.analysis.resources.suggested', 'suggested')})
                      </option>
                    )}
                    {!proposal.toUserId && (
                      <option value="">
                        {t('initiatives.analysis.resources.selectPerson', '— Select person —')}
                      </option>
                    )}
                    {users
                      .filter((u) => u.id !== proposal.fromUserId && u.id !== proposal.toUserId)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {getUserLabel(u)}
                        </option>
                      ))}
                  </select>

                  <button
                    onClick={() => {
                      if (!effectiveUserId) return;
                      const effectiveProposal: RebalanceProposal = {
                        ...proposal,
                        toUserId: effectiveUserId,
                        toUserName: effectiveUserName,
                      };
                      handleApplyProposal(effectiveProposal, idx);
                    }}
                    disabled={applyingProposalIdx === idx || !effectiveUserId}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                  >
                    {applyingProposalIdx === idx ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    {t('initiatives.analysis.resources.accept', 'Accept')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    ) : null;

  useEffect(() => {
    if (!onRegisterActions) return;
    if (!onQuickUpdate) {
      onRegisterActions(null);
      return;
    }
    const toggleAiProposalsPanel = () => {
      if (rebalanceProposals !== null) {
        closeRebalancePanel();
        return;
      }
      computeRebalanceProposals();
    };
    onRegisterActions(
      <button
        onClick={toggleAiProposalsPanel}
        disabled={applyingAll}
        className={getMenu3DeterministicButtonClass(rebalanceProposals !== null)}
      >
        {applyingAll ? <Loader2 size={12} className="animate-spin" /> : <Scale size={12} />}
        {applyingAll
          ? t('initiatives.analysis.resources.applying', 'Applying…')
          : t('initiatives.analysis.resources.balanceAction', 'Balance workload')}
      </button>
    );
  }, [
    onRegisterActions,
    onQuickUpdate,
    computeRebalanceProposals,
    rebalanceProposals,
    applyingAll,
    closeRebalancePanel,
  ]);

  useEffect(() => {
    if (!onRegisterWorkspacePanel) return;
    if (!rebalancePanel) {
      onRegisterWorkspacePanel(null);
      return;
    }
    onRegisterWorkspacePanel({
      title: t('initiatives.analysis.resources.balanceAction', 'Balance workload'),
      subtitle: t(
        'initiatives.analysis.resources.balanceSubtitle',
        'Computed from current assignments and capacity — reassign ownership to remove overload.'
      ),
      icon: <Scale size={16} />,
      content: rebalancePanel,
    });
    return () => onRegisterWorkspacePanel(null);
  }, [rebalancePanel, onRegisterWorkspacePanel, t]);

  /* ---------- render ---------- */

  return (
    <div className="space-y-6">
      {/* Header strip: stats */}
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
          {/* Danger styling only when there is an actual overload — a zero count
              stays neutral (kanon: no danger-fill on benign/zero metrics). */}
          <div
            className={`rounded-xl border p-3 ${
              overallocatedCount > 0
                ? 'border-danger-200 dark:border-danger-900/50 bg-danger-500/5 dark:bg-danger-500/10'
                : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900'
            }`}
          >
            <div
              className={`text-xl font-semibold ${
                overallocatedCount > 0
                  ? 'text-danger-600 dark:text-danger-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
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
      </div>

      {/* AI Proposals panel */}
      {!onRegisterWorkspacePanel && rebalancePanel}

      {/* Team workload table */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('initiatives.analysis.resources.teamWorkload', 'Team workload')}
          </h3>
          {roleFilter !== 'all' && (
            <button
              onClick={() => setRoleFilter('all')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300
                hover:bg-slate-300 dark:hover:bg-white/15 transition-colors"
            >
              <X size={10} />
              {roleFilter}
            </button>
          )}
        </div>
        <table
          /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */ className="w-full text-sm"
        >
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700">
              <th className="text-left px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 w-8" />
              <SortableHeader
                label={t('initiatives.analysis.resources.person', 'Person')}
                column="person"
                currentCol={sortCol}
                currentDir={sortDir}
                onSort={handleSort}
                align="left"
              />
              <th className="text-left px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 relative">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSort('role')}
                    className="inline-flex items-center gap-1 hover:text-c-info dark:hover:text-c-info transition-colors"
                  >
                    {t('initiatives.analysis.resources.role', 'Role')}
                    <SortIcon column="role" currentCol={sortCol} currentDir={sortDir} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRoleDropdown((v) => !v)}
                    aria-haspopup="true"
                    aria-expanded={showRoleDropdown}
                    aria-label={
                      roleFilter !== 'all'
                        ? t(
                            'initiatives.analysis.resources.filterRoleActive',
                            'Filter by role (active: {{role}})',
                            {
                              role: roleFilter,
                            }
                          )
                        : t(
                            'initiatives.analysis.resources.filterRoleInactive',
                            'Filter by role, no filter applied'
                          )
                    }
                    className={`p-0.5 rounded hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors ${
                      roleFilter !== 'all'
                        ? 'text-c-info dark:text-c-info'
                        : 'text-slate-600 dark:text-slate-500'
                    }`}
                  >
                    <Filter size={12} aria-hidden="true" />
                  </button>
                </div>
                {showRoleDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowRoleDropdown(false)}
                    />
                    <div
                      className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-navy-900
                      border border-slate-200 dark:border-navy-700 rounded-lg shadow-lg py-1 min-w-[180px]"
                    >
                      <button
                        onClick={() => {
                          setRoleFilter('all');
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors ${
                          roleFilter === 'all'
                            ? 'font-semibold text-c-info dark:text-c-info'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {t('initiatives.analysis.resources.allRoles', 'All roles')}
                      </button>
                      {uniqueRoles.map((role) => (
                        <button
                          key={role}
                          onClick={() => {
                            setRoleFilter(role);
                            setShowRoleDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors ${
                            roleFilter === role
                              ? 'font-semibold text-slate-900 dark:text-white'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </th>
              <SortableHeader
                label={t('initiatives.analysis.resources.initiatives', 'Initiatives')}
                column="initiatives"
                currentCol={sortCol}
                currentDir={sortDir}
                onSort={handleSort}
                align="center"
                className="w-24"
              />
              <SortableHeader
                label={t('initiatives.analysis.resources.workload', 'Workload')}
                column="workload"
                currentCol={sortCol}
                currentDir={sortDir}
                onSort={handleSort}
                align="left"
                className="w-48"
              />
              <SortableHeader
                label={t('initiatives.analysis.resources.status', 'Status')}
                column="status"
                currentCol={sortCol}
                currentDir={sortDir}
                onSort={handleSort}
                align="center"
                className="w-28"
              />
            </tr>
          </thead>
          <tbody>
            {sortedAllocations.map((a) => {
              const isExpanded = expandedResourceId === a.resourceId;
              return (
                <React.Fragment key={a.resourceId}>
                  <tr
                    className="border-b border-slate-200 dark:border-navy-800/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800/30 transition-colors"
                    onClick={() => setExpandedResourceId(isExpanded ? null : a.resourceId)}
                  >
                    <td className="px-4 py-3 text-slate-600">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                            a.status === 'overallocated'
                              ? 'bg-danger-500/20 text-danger-700 dark:text-danger-300'
                              : a.status === 'underutilized'
                                ? 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                                : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {a.resourceName
                            .split(' ')
                            .map((w) => w[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
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
                                ? 'bg-danger-500'
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
                              ? 'text-danger-600 dark:text-danger-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {formatUtilizationPercent(a.utilizationPercent, i18n.language)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          a.status === 'overallocated'
                            ? 'bg-danger-500/20 text-danger-700 dark:text-danger-300'
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
                                    <div
                                      className="flex items-center gap-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
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
                                        className="p-1 rounded text-slate-600
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
                                          text-xs font-medium bg-slate-100 text-slate-700
                                          dark:bg-white/10 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15 transition-colors"
                                      >
                                        <ExternalLink size={12} />
                                        {t('initiatives.analysis.previewInitiative', 'Preview')}
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
