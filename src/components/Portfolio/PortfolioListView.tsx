/**
 * Portfolio List View
 *
 * Initiatives table — "całościowy obraz sytuacji portfela".
 *
 * Columns: Initiative | Status | Priority | Owner | Target date | Health | Next step | Missing | Updated | Actions
 *
 * Tech Sexy v2.0:
 * - invisible borders, no header separator line
 * - hover = subtle bg shift only
 * - shadows only on floating menus
 * - monochromatic chrome, color only for semantic data
 */

import { AlertTriangle, Calendar, ChevronDown, ChevronUp, Eye, MoreVertical } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { getPriorityStyle, getStatusStyle } from '../../constants/statusColors';
import { STATUS_METADATA } from '../../services/initiativeLifecycle';
import { InitiativeStatus, PortfolioInitiative } from '../../types';
import {
  formatRelativeTime,
  formatShortDate,
  getHealthInfo,
  getNextStep,
} from '../../utils/initiativeHelpers';

interface PortfolioListViewProps {
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
  onStatusChange: (id: string, status: InitiativeStatus) => void;
  onQuickUpdate: (id: string, updates: Partial<PortfolioInitiative>) => void;
  onSelectionChange?: (ids: Set<string>) => void;
}

type SortField = 'name' | 'status' | 'priority' | 'plannedEndDate' | 'updatedAt';

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

const LEVEL_ORDER: Record<string, number> = STATUS_ORDER;

export const PortfolioListView: React.FC<PortfolioListViewProps> = ({
  initiatives,
  onInitiativeClick,
  onStatusChange,
  onQuickUpdate,
  onSelectionChange,
}) => {
  const { t } = useTranslation();
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: 'asc' | 'desc' }>({
    field: 'priority',
    direction: 'asc',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const isDowngrade = (currentStatus: string, newStatus: string): boolean => {
    const currentLevel = LEVEL_ORDER[currentStatus] || 0;
    const newLevel = LEVEL_ORDER[newStatus] || 0;
    if (newStatus === 'CANCELLED' || newStatus === 'ARCHIVED') return false;
    return newLevel < currentLevel;
  };

  const handleStatusChange = (id: string, currentStatus: string, newStatus: InitiativeStatus) => {
    if (isDowngrade(currentStatus, newStatus)) {
      toast.error(
        t(
          'portfolio.toast.cannotDowngrade',
          'Nie można obniżyć statusu. Użyj "Anuluj" lub "Archiwizuj".'
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
        case 'plannedEndDate':
          comparison = (a.plannedEndDate || '').localeCompare(b.plannedEndDate || '');
          break;
        case 'updatedAt':
          comparison = (a.updatedAt || '').localeCompare(b.updatedAt || '');
          break;
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [initiatives, sortConfig]);

  const handleSort = (field: SortField) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set<string>(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  const getStatusLabel = (status: string) => {
    const meta = STATUS_METADATA[status as InitiativeStatus];
    return meta?.label || status;
  };

  const isTerminal = (status: string) => status === 'CANCELLED' || status === 'ARCHIVED';

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortConfig.field !== field) return <div className="w-4 h-4" />;
    return sortConfig.direction === 'asc' ? (
      <ChevronUp size={14} className="text-slate-400 dark:text-slate-500" />
    ) : (
      <ChevronDown size={14} className="text-slate-400 dark:text-slate-500" />
    );
  };

  // Column header helper
  const TH: React.FC<{
    field?: SortField;
    children: React.ReactNode;
    className?: string;
  }> = ({ field, children, className = '' }) => (
    <th
      className={`text-left px-4 py-2 ${field ? 'cursor-pointer transition-colors hover:bg-slate-100/70 dark:hover:bg-white/[0.03]' : ''} ${className}`}
      onClick={field ? () => handleSort(field) : undefined}
    >
      <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {children}
        {field && <SortIcon field={field} />}
      </div>
    </th>
  );

  return (
    <div className="h-full overflow-auto p-4">
      <div className="bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-white/5 rounded-xl overflow-hidden">
        <table className="w-full table-fixed" style={{ minWidth: 1080 }}>
          <thead className="sticky top-0 z-10 bg-slate-50/80 dark:bg-navy-900/50 backdrop-blur-hig">
            <tr>
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === initiatives.length && initiatives.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 dark:border-white/10 bg-white/80 dark:bg-navy-950 text-primary-600 focus:ring-primary-500/30"
                />
              </th>
              <TH field="name">{t('initiatives.table.initiative', 'Initiative')}</TH>
              <TH field="status" className="w-32">
                {t('initiatives.table.status', 'Status')}
              </TH>
              <TH field="priority" className="w-24">
                {t('initiatives.table.priority', 'Priority')}
              </TH>
              <TH className="w-36">{t('initiatives.table.owner', 'Owner')}</TH>
              <TH field="plannedEndDate" className="w-28">
                {t('initiatives.table.targetDate', 'Target date')}
              </TH>
              <TH className="w-24">{t('initiatives.table.health', 'Health')}</TH>
              <TH className="w-40">{t('initiatives.table.nextStep', 'Next step')}</TH>
              <TH className="w-24">{t('initiatives.table.missing', 'Missing')}</TH>
              <TH field="updatedAt" className="w-24">
                {t('initiatives.table.updated', 'Updated')}
              </TH>
              <th className="w-10 px-4 py-2" />
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100/60 dark:divide-white/[0.03]">
            {sortedInitiatives.map((initiative) => {
              const terminal = isTerminal(initiative.status);
              const owner = initiative.ownerBusiness || initiative.ownerExecution;
              const statusStyle = getStatusStyle(initiative.status);
              const priorityStyle = getPriorityStyle(initiative.priority);
              const health = getHealthInfo(initiative);
              const nextStep = getNextStep(initiative.status);

              return (
                <tr
                  key={initiative.id}
                  className={`group cursor-pointer transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.03] ${terminal ? 'opacity-50' : ''}`}
                  onClick={() => onInitiativeClick(initiative)}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(initiative.id)}
                      onChange={() => toggleSelect(initiative.id)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-white/10 bg-white/80 dark:bg-navy-950 text-primary-600 focus:ring-primary-500/30"
                    />
                  </td>

                  {/* Initiative (name only, 1 line) */}
                  <td className="px-4 py-2">
                    <div className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                      {initiative.name}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusStyle.dot}`} />
                      <select
                        value={initiative.status}
                        onChange={(e) =>
                          handleStatusChange(
                            initiative.id,
                            initiative.status,
                            e.target.value as InitiativeStatus
                          )
                        }
                        className="appearance-none bg-transparent text-xs font-medium cursor-pointer pr-4 text-slate-700 dark:text-slate-300 focus:outline-none"
                      >
                        {ALL_INITIATIVE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {getStatusLabel(s)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={12}
                        className="absolute right-0 text-slate-400 pointer-events-none"
                      />
                    </div>
                  </td>

                  {/* Priority */}
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full ${priorityStyle.bg} ${priorityStyle.text}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
                      {initiative.priority || '—'}
                    </span>
                  </td>

                  {/* Owner */}
                  <td className="px-4 py-2">
                    {owner ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center text-[10px] font-medium text-slate-600 dark:text-slate-300 overflow-hidden flex-shrink-0">
                          {owner.avatarUrl ? (
                            <img
                              src={owner.avatarUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            `${owner.firstName?.[0] || '?'}${owner.lastName?.[0] || ''}`
                          )}
                        </div>
                        <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
                          {owner.firstName} {owner.lastName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  {/* Target date */}
                  <td className="px-4 py-2">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {formatShortDate(initiative.plannedEndDate)}
                    </span>
                  </td>

                  {/* Health (RAG) */}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${health.dotClass}`} />
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {health.label}
                      </span>
                    </div>
                  </td>

                  {/* Next step */}
                  <td className="px-4 py-2">
                    {nextStep ? (
                      <div
                        className="text-xs text-slate-600 dark:text-slate-400 truncate"
                        title={
                          nextStep.role ? `${nextStep.label} (${nextStep.role})` : nextStep.label
                        }
                      >
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {nextStep.label}
                        </span>
                        {nextStep.role && (
                          <span className="text-slate-400 dark:text-slate-500 ml-1">
                            ({nextStep.role})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  {/* Missing (blocking) — placeholder, filled when gate readiness is fetched per-row */}
                  <td className="px-4 py-2">
                    <span className="text-xs text-slate-400">—</span>
                  </td>

                  {/* Updated */}
                  <td className="px-4 py-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatRelativeTime(initiative.updatedAt)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                      <button
                        onClick={() =>
                          setActiveMenu(activeMenu === initiative.id ? null : initiative.id)
                        }
                        className="p-1.5 rounded text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100/70 dark:hover:bg-white/[0.05] opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label={t('common.actions', 'Actions')}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {activeMenu === initiative.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setActiveMenu(null)}
                            aria-hidden="true"
                          />
                          <div className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-navy-800 rounded-xl shadow-hig-xl dark:shadow-hig-dark-xl py-1 z-20 overflow-hidden">
                            <button
                              onClick={() => {
                                onInitiativeClick(initiative);
                                setActiveMenu(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.05] transition-colors"
                            >
                              <Eye size={14} /> View Details
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedInitiatives.length === 0 && (
        <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
          No initiatives found
        </div>
      )}
    </div>
  );
};

export default PortfolioListView;
