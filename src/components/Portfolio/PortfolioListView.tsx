/**
 * Portfolio List View
 *
 * D2.1-D2.2: Unified initiative table with standard columns:
 *   checkbox | Initiative | Owner | Status | Priority | Start Date | End Date | Progress | Actions
 *
 * Status dropdown shows all lifecycle statuses with colored indicators.
 * Sortable columns, inline status editing, row selection for bulk ops.
 */

import { Calendar, ChevronDown, ChevronUp, Edit2, Eye, MoreVertical, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { getAxisColor, getPriorityClasses } from '../../config/portfolioColors';
import { STATUS_METADATA } from '../../services/initiativeLifecycle';
import { InitiativeStatus, PortfolioInitiative, PortfolioSortConfig } from '../../types';

interface PortfolioListViewProps {
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
  onStatusChange: (id: string, status: InitiativeStatus) => void;
  onQuickUpdate: (id: string, updates: Partial<PortfolioInitiative>) => void;
  onSelectionChange?: (ids: Set<string>) => void;
}

type SortField =
  | 'name'
  | 'status'
  | 'priority'
  | 'plannedStartDate'
  | 'plannedEndDate'
  | 'progress';

const PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

const STATUS_ORDER: Record<string, number> = {
  DRAFT: 1,
  PENDING_REVIEW: 2,
  REVIEW: 3,
  PROMOTED: 4,
  PLANNING: 5,
  APPROVED: 6,
  SCHEDULED: 7,
  EXECUTING: 8,
  BLOCKED: 9,
  DONE: 10,
  TRACKING: 11,
  CANCELLED: 12,
  ARCHIVED: 13,
};

// D1.2: Level order for downgrade detection — higher level = further along lifecycle
const LEVEL_ORDER: Record<string, number> = STATUS_ORDER;

// All statuses for the inline status dropdown
const ALL_INITIATIVE_STATUSES: InitiativeStatus[] = [
  InitiativeStatus.DRAFT,
  InitiativeStatus.PENDING_REVIEW,
  InitiativeStatus.REVIEW,
  InitiativeStatus.PROMOTED,
  InitiativeStatus.PLANNING,
  InitiativeStatus.APPROVED,
  InitiativeStatus.SCHEDULED,
  InitiativeStatus.EXECUTING,
  InitiativeStatus.BLOCKED,
  InitiativeStatus.DONE,
  InitiativeStatus.TRACKING,
  InitiativeStatus.CANCELLED,
  InitiativeStatus.ARCHIVED,
];

export const PortfolioListView: React.FC<PortfolioListViewProps> = ({
  initiatives,
  onInitiativeClick,
  onStatusChange,
  onQuickUpdate,
  onSelectionChange,
}) => {
  const { t } = useTranslation();
  const [sortConfig, setSortConfig] = useState<PortfolioSortConfig>({
    field: 'priority',
    direction: 'asc',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // D1.2: Block downgrade transitions
  const isDowngrade = (currentStatus: string, newStatus: string): boolean => {
    const currentLevel = LEVEL_ORDER[currentStatus] || 0;
    const newLevel = LEVEL_ORDER[newStatus] || 0;
    // Allow terminal statuses (CANCELLED, ARCHIVED) from any state
    if (newStatus === 'CANCELLED' || newStatus === 'ARCHIVED') return false;
    return newLevel < currentLevel;
  };

  const handleStatusChange = (id: string, currentStatus: string, newStatus: InitiativeStatus) => {
    if (isDowngrade(currentStatus, newStatus)) {
      toast.error(
        t(
          'portfolio.toast.cannotDowngrade',
          'Nie można obniżyć statusu z {{from}} na {{to}}. Użyj "Anuluj" lub "Archiwizuj".',
          { from: getStatusLabel(currentStatus), to: getStatusLabel(newStatus) }
        )
      );
      return;
    }
    onStatusChange(id, newStatus);
  };

  useEffect(() => {
    if (selectedIds.size === 0) return;
    const allowed = new Set(initiatives.map((i) => i.id));
    const filtered = new Set(Array.from(selectedIds).filter((id) => allowed.has(id)));
    if (filtered.size !== selectedIds.size) {
      setSelectedIds(filtered);
      onSelectionChange?.(filtered);
    }
  }, [initiatives, onSelectionChange, selectedIds]);

  // Sort initiatives
  const sortedInitiatives = useMemo(() => {
    return [...initiatives].sort((a, b) => {
      let comparison = 0;

      switch (sortConfig.field) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = (STATUS_ORDER[a.status] || 99) - (STATUS_ORDER[b.status] || 99);
          break;
        case 'priority':
          comparison = (PRIORITY_ORDER[a.priority] || 99) - (PRIORITY_ORDER[b.priority] || 99);
          break;
        case 'plannedStartDate':
          comparison = (a.plannedStartDate || '').localeCompare(b.plannedStartDate || '');
          break;
        case 'plannedEndDate':
          comparison = (a.plannedEndDate || '').localeCompare(b.plannedEndDate || '');
          break;
        case 'progress':
          comparison = (a.progress || 0) - (b.progress || 0);
          break;
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [initiatives, sortConfig]);

  const handleSort = (field: SortField) => {
    setSortConfig((prev: any) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev: Set<string>) => {
      const next = new Set<string>(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelectionChange?.(next);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === initiatives.length) {
      const next = new Set<string>();
      setSelectedIds(next);
      onSelectionChange?.(next);
    } else {
      const next = new Set(initiatives.map((i) => i.id));
      setSelectedIds(next);
      onSelectionChange?.(next);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortConfig.field !== field) {
      return <div className="w-4 h-4" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ChevronUp size={14} className="text-purple-500" />
    ) : (
      <ChevronDown size={14} className="text-purple-500" />
    );
  };

  // Helper: get status indicator dot color from STATUS_METADATA
  const getStatusDot = (status: string) => {
    const meta = STATUS_METADATA[status as InitiativeStatus];
    return meta?.dotColor || 'bg-slate-400';
  };

  const getStatusLabel = (status: string) => {
    const meta = STATUS_METADATA[status as InitiativeStatus];
    return meta?.label || status;
  };

  // Check if status is terminal (for visual dimming)
  const isTerminal = (status: string) => status === 'CANCELLED' || status === 'ARCHIVED';

  return (
    <div className="h-full overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-slate-50 dark:bg-navy-950 z-10">
          <tr className="border-b border-slate-200 dark:border-navy-700">
            {/* Checkbox */}
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={selectedIds.size === initiatives.length && initiatives.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
              />
            </th>

            {/* Name */}
            <th
              className="text-left px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Initiative
                <SortIcon field="name" />
              </div>
            </th>

            {/* Owner */}
            <th className="text-left px-4 py-3 w-44">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Owner
              </div>
            </th>

            {/* Status */}
            <th
              className="text-left px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800 w-40"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Status
                <SortIcon field="status" />
              </div>
            </th>

            {/* Priority */}
            <th
              className="text-left px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800 w-28"
              onClick={() => handleSort('priority')}
            >
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Priority
                <SortIcon field="priority" />
              </div>
            </th>

            {/* Start Date */}
            <th
              className="text-left px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800 w-32"
              onClick={() => handleSort('plannedStartDate')}
            >
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Start
                <SortIcon field="plannedStartDate" />
              </div>
            </th>

            {/* End Date */}
            <th
              className="text-left px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800 w-32"
              onClick={() => handleSort('plannedEndDate')}
            >
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                End
                <SortIcon field="plannedEndDate" />
              </div>
            </th>

            {/* D2.2: Contractor */}
            <th className="text-left px-4 py-3 w-36">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Contractor
              </div>
            </th>

            {/* Progress */}
            <th
              className="text-left px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800 w-28"
              onClick={() => handleSort('progress')}
            >
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Progress
                <SortIcon field="progress" />
              </div>
            </th>

            {/* Actions */}
            <th className="w-12 px-4 py-3" />
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {sortedInitiatives.map((initiative) => {
            const terminal = isTerminal(initiative.status);
            return (
              <tr
                key={initiative.id}
                className={`hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors cursor-pointer ${terminal ? 'opacity-60' : ''}`}
                onClick={() => onInitiativeClick(initiative)}
              >
                {/* Checkbox */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(initiative.id)}
                    onChange={() => toggleSelect(initiative.id)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
                  />
                </td>

                {/* Name + axis indicator */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-1 h-10 rounded-full ${getAxisColor(initiative.axis)}`} />
                    <div className="min-w-0">
                      <div className="font-medium text-navy-900 dark:text-white truncate">
                        {initiative.name}
                      </div>
                      {initiative.projectName && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {initiative.projectName}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Owner */}
                <td className="px-4 py-3">
                  {initiative.ownerBusiness ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-medium text-purple-700 dark:text-purple-300 overflow-hidden flex-shrink-0">
                        {initiative.ownerBusiness.avatarUrl ? (
                          <img
                            src={initiative.ownerBusiness.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          `${initiative.ownerBusiness.firstName[0]}${initiative.ownerBusiness.lastName[0]}`
                        )}
                      </div>
                      <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                        {initiative.ownerBusiness.firstName} {initiative.ownerBusiness.lastName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                      Unassigned
                    </span>
                  )}
                </td>

                {/* Status — full dropdown with all statuses */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="relative inline-flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDot(initiative.status)}`}
                    />
                    <select
                      value={initiative.status}
                      onChange={(e) =>
                        handleStatusChange(
                          initiative.id,
                          initiative.status,
                          e.target.value as InitiativeStatus
                        )
                      }
                      className="appearance-none bg-transparent text-xs font-medium cursor-pointer pr-4 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white focus:outline-none"
                    >
                      {ALL_INITIATIVE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {getStatusLabel(s)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={12}
                      className="absolute right-0 text-slate-500 dark:text-slate-400 pointer-events-none"
                    />
                  </div>
                </td>

                {/* Priority */}
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityClasses(initiative.priority)}`}
                  >
                    {initiative.priority}
                  </span>
                </td>

                {/* Start Date */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                    <Calendar size={13} className="flex-shrink-0" />
                    <span className="text-xs">{formatDate(initiative.plannedStartDate)}</span>
                  </div>
                </td>

                {/* End Date */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                    <Calendar size={13} className="flex-shrink-0" />
                    <span className="text-xs">{formatDate(initiative.plannedEndDate)}</span>
                  </div>
                </td>

                {/* Progress */}
                {/* D2.2: Contractor cell */}
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-600 dark:text-slate-400 truncate block max-w-[130px]">
                    {(initiative as any).contractor || (initiative as any).vendor || '—'}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${initiative.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 w-8 text-right">
                      {initiative.progress}%
                    </span>
                  </div>
                </td>

                {/* Actions */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <button
                      onClick={() =>
                        setActiveMenu(activeMenu === initiative.id ? null : initiative.id)
                      }
                      className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {activeMenu === initiative.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-navy-900 rounded-lg shadow-xl border border-slate-200 dark:border-navy-700 py-1 z-20">
                        <button
                          onClick={() => {
                            onInitiativeClick(initiative);
                            setActiveMenu(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                        >
                          <Eye size={14} /> View Details
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10">
                          <Edit2 size={14} /> Edit
                        </button>
                        <hr className="my-1 border-slate-200 dark:border-navy-700" />
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {sortedInitiatives.length === 0 && (
        <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
          No initiatives found
        </div>
      )}
    </div>
  );
};

export default PortfolioListView;
