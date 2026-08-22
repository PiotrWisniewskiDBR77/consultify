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

import {
  Archive,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Edit2,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type RowActionSection, RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { SELECTED_ROW_CLASS } from '@/components/shared/selectionTokens';
import {
  DueChip,
  PriorityChip,
  type PriorityLevel,
  statusChipTone,
} from '@/components/ui/primitives/chips';
import { FilterDropdown } from '@/components/ui/ResizableTable/FilterDropdown';
import type { ColumnDef, TableFilters } from '@/components/ui/ResizableTable/types';

import { STATUS_METADATA } from '../../services/initiativeLifecycle';
import { InitiativeStatus, PortfolioInitiative } from '../../types';
import {
  formatRelativeTime,
  formatShortDate,
  getHealthInfo,
  getNextStep,
} from '../../utils/initiativeHelpers';
import { PortfolioAiPanel } from './PortfolioAiPanel';

/** Map raw initiative priority → PriorityChip level (canon §4.2 — dot carries the signal). */
const PRIORITY_LEVEL: Record<string, PriorityLevel> = {
  CRITICAL: 'urgent',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

/** Signal-tone dot class for the inline status editor (canon c.* family, §4.1). */
const STATUS_DOT_CLASS: Record<string, string> = {
  info: 'bg-c-info',
  warning: 'bg-c-warning',
  success: 'bg-c-success',
  danger: 'bg-c-danger',
  neutral: 'bg-c-text-muted',
};

interface PortfolioListViewProps {
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
  onOpenFull?: (initiative: PortfolioInitiative) => void;
  onStatusChange: (id: string, status: InitiativeStatus) => void;
  onQuickUpdate: (id: string, updates: Partial<PortfolioInitiative>) => void;
  onSelectionChange?: (ids: Set<string>) => void;
  /** Table canvas padding (V3 standard: pl-4 pr-1.5 pt-3 pb-4) */
  canvasClassName?: string;
  /** Called when Archive is clicked (only enabled for DONE/CANCELLED status) */
  onArchive?: (initiative: PortfolioInitiative) => void;
  /** Called when Delete is clicked */
  onDelete?: (initiative: PortfolioInitiative) => void;
  /** Canonical lifecycle is advanced only in gate-specific workspaces. */
  allowLifecycleMutation?: boolean;
  /**
   * Canon §27 — localStorage persistence key for table view state.
   * This is a hand-rolled static table (fixed column widths, no resize/hide
   * model), so the persisted "column state it manages" is the per-column
   * filters + sort. Pass e.g. "initiatives.portfolio".
   */
  persistKey?: string;
}

type PersistedTableState = {
  filters?: TableFilters;
  sort?: { field: SortField; direction: 'asc' | 'desc' };
};

const loadPersistedTableState = (persistKey?: string): PersistedTableState | null => {
  if (!persistKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`table-state:${persistKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedTableState;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const savePersistedTableState = (persistKey: string | undefined, state: PersistedTableState) => {
  if (!persistKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`table-state:${persistKey}`, JSON.stringify(state));
  } catch {
    // ignore quota / serialization errors
  }
};

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
  onOpenFull,
  onStatusChange,
  onQuickUpdate,
  allowLifecycleMutation = true,
  onSelectionChange,
  canvasClassName = 'pl-4 pr-1.5 pt-3 pb-4',
  onArchive,
  onDelete,
  persistKey,
}) => {
  const { t } = useTranslation();
  const persisted = useMemo(() => loadPersistedTableState(persistKey), [persistKey]);
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: 'asc' | 'desc' }>(
    persisted?.sort ?? {
      field: 'priority',
      direction: 'asc',
    }
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [_activeMenu, _setActiveMenu] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [tableFilters, setTableFilters] = useState<TableFilters>(persisted?.filters ?? {});
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

  // Canon §27: persist per-column filters + sort to localStorage under persistKey.
  useEffect(() => {
    savePersistedTableState(persistKey, { filters: tableFilters, sort: sortConfig });
  }, [persistKey, tableFilters, sortConfig]);

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

  // Column filter options (canon §5) — derived from the current rows.
  const statusFilterCol: ColumnDef = useMemo(
    () => ({
      id: 'status',
      label: t('initiatives.table.status', 'Status'),
      width: 128,
      minWidth: 80,
      resizable: false,
      filterable: true,
      filterType: 'multiselect',
      filterOptions: Array.from(new Set(initiatives.map((i) => i.status)))
        .sort((a, b) => (STATUS_ORDER[a] || 99) - (STATUS_ORDER[b] || 99))
        .map((s) => ({ value: s, label: STATUS_METADATA[s as InitiativeStatus]?.label || s })),
    }),
    [initiatives, t]
  );

  const priorityFilterCol: ColumnDef = useMemo(
    () => ({
      id: 'priority',
      label: t('initiatives.table.priority', 'Priority'),
      width: 96,
      minWidth: 80,
      resizable: false,
      filterable: true,
      filterType: 'multiselect',
      filterOptions: Array.from(new Set(initiatives.map((i) => i.priority).filter(Boolean)))
        .sort((a, b) => (PRIORITY_ORDER[a] || 99) - (PRIORITY_ORDER[b] || 99))
        .map((p) => ({ value: p, label: p })),
    }),
    [initiatives, t]
  );

  const ownerFilterCol: ColumnDef = useMemo(() => {
    const owners = new Map<string, string>();
    initiatives.forEach((i) => {
      const o = i.ownerBusiness || i.ownerExecution;
      if (o) owners.set(o.id, `${o.firstName || ''} ${o.lastName || ''}`.trim() || o.id);
    });
    return {
      id: 'owner',
      label: t('initiatives.table.owner', 'Owner'),
      width: 144,
      minWidth: 80,
      resizable: false,
      filterable: true,
      filterType: 'multiselect',
      filterOptions: Array.from(owners.entries()).map(([value, label]) => ({ value, label })),
    };
  }, [initiatives, t]);

  const filteredInitiatives = useMemo(() => {
    const statusF = tableFilters.status as string[] | undefined;
    const priorityF = tableFilters.priority as string[] | undefined;
    const ownerF = tableFilters.owner as string[] | undefined;
    return initiatives.filter((i) => {
      if (statusF?.length && !statusF.includes(i.status)) return false;
      if (priorityF?.length && !priorityF.includes(i.priority)) return false;
      if (ownerF?.length) {
        const o = i.ownerBusiness || i.ownerExecution;
        if (!o || !ownerF.includes(o.id)) return false;
      }
      return true;
    });
  }, [initiatives, tableFilters]);

  const sortedInitiatives = useMemo(() => {
    return [...filteredInitiatives].sort((a, b) => {
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
  }, [filteredInitiatives, sortConfig]);

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

  const selectedInitiatives = useMemo(
    () => initiatives.filter((i) => selectedIds.has(i.id)),
    [initiatives, selectedIds]
  );

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortConfig.field !== field) return <div className="w-4 h-4" />;
    return sortConfig.direction === 'asc' ? (
      <ChevronUp size={14} className="text-c-text-muted" />
    ) : (
      <ChevronDown size={14} className="text-c-text-muted" />
    );
  };

  // Column header helper
  const TH: React.FC<{
    field?: SortField;
    children: React.ReactNode;
    className?: string;
    filter?: { col: ColumnDef; key: keyof TableFilters };
  }> = ({ field, children, className = '', filter }) => (
    <th className={`text-left px-4 py-2 ${className}`}>
      <div className="flex items-center gap-1 text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
        <span
          className={
            field
              ? 'inline-flex items-center gap-1 cursor-pointer transition-colors hover:text-c-text-secondary'
              : 'inline-flex items-center gap-1'
          }
          onClick={field ? () => handleSort(field) : undefined}
        >
          {children}
          {field && <SortIcon field={field} />}
        </span>
        {filter && (
          <FilterDropdown
            column={filter.col}
            value={tableFilters[filter.key] as string[] | undefined}
            onChange={(v) => setTableFilters((f) => ({ ...f, [filter.key]: v }))}
            isOpen={openFilterId === String(filter.key)}
            onToggle={() =>
              setOpenFilterId((id) => (id === String(filter.key) ? null : String(filter.key)))
            }
            onClose={() => setOpenFilterId(null)}
          />
        )}
      </div>
    </th>
  );

  return (
    <div className={canvasClassName}>
      <div className="bg-c-surface backdrop-blur border border-slate-200/60 dark:border-white/[0.03] rounded-xl overflow-x-auto">
        <table
          /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full table-fixed"
          style={{ minWidth: 1080 }}
        >
          <thead className="sticky top-0 z-10 bg-c-surface-raised backdrop-blur border-b border-c-border-subtle">
            <tr>
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === initiatives.length && initiatives.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-c-border bg-c-surface text-c-info focus:ring-c-focus"
                />
              </th>
              <TH field="name">{t('initiatives.table.initiative', 'Initiative')}</TH>
              <TH field="status" className="w-32" filter={{ col: statusFilterCol, key: 'status' }}>
                {t('initiatives.table.status', 'Status')}
              </TH>
              <TH
                field="priority"
                className="w-24"
                filter={{ col: priorityFilterCol, key: 'priority' }}
              >
                {t('initiatives.table.priority', 'Priority')}
              </TH>
              <TH className="w-36" filter={{ col: ownerFilterCol, key: 'owner' }}>
                {t('initiatives.table.owner', 'Owner')}
              </TH>
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

          <tbody className="divide-y divide-c-border-subtle">
            {sortedInitiatives.map((initiative) => {
              const terminal = isTerminal(initiative.status);
              const owner = initiative.ownerBusiness || initiative.ownerExecution;
              const statusDotClass =
                STATUS_DOT_CLASS[statusChipTone(initiative.status)] ?? STATUS_DOT_CLASS.neutral;
              const priorityLevel = PRIORITY_LEVEL[initiative.priority];
              const health = getHealthInfo(initiative);
              const nextStep = getNextStep(initiative.status);
              const selected = selectedIds.has(initiative.id);

              return (
                <tr
                  key={initiative.id}
                  className={`group cursor-pointer transition-colors ${
                    selected ? SELECTED_ROW_CLASS : 'hover:bg-c-surface-raised'
                  } ${terminal ? 'opacity-50' : ''}`}
                  onClick={() => onInitiativeClick(initiative)}
                  onDoubleClick={() => onOpenFull?.(initiative)}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(initiative.id)}
                      onChange={() => toggleSelect(initiative.id)}
                      className="w-4 h-4 rounded border-c-border bg-c-surface text-c-info focus:ring-c-focus"
                    />
                  </td>

                  {/* Initiative (name only, 1 line) */}
                  <td className="px-4 py-2">
                    <div className="font-medium text-sm text-c-text truncate">
                      {initiative.name}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass}`}
                      />
                      {allowLifecycleMutation ? <select
                        value={initiative.status}
                        onChange={(e) =>
                          handleStatusChange(
                            initiative.id,
                            initiative.status,
                            e.target.value as InitiativeStatus
                          )
                        }
                        className="appearance-none bg-transparent text-xs font-medium cursor-pointer pr-4 text-c-text-secondary focus:outline-none"
                      >
                        {ALL_INITIATIVE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {getStatusLabel(s)}
                          </option>
                        ))}
                      </select> : <span className="text-xs font-medium text-c-text-secondary">{getStatusLabel(initiative.status)}</span>}
                      {allowLifecycleMutation && <ChevronDown
                        size={12}
                        className="absolute right-0 text-c-text-muted pointer-events-none"
                      />}
                    </div>
                  </td>

                  {/* Priority */}
                  <td className="px-4 py-2">
                    {priorityLevel ? (
                      <PriorityChip level={priorityLevel} label={initiative.priority} />
                    ) : (
                      <span className="text-xs text-c-text-muted">—</span>
                    )}
                  </td>

                  {/* Owner */}
                  <td className="px-4 py-2">
                    {owner ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-c-surface-raised flex items-center justify-center text-[10px] font-medium text-c-text-secondary overflow-hidden flex-shrink-0">
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
                        <span className="text-xs text-c-text-secondary truncate">
                          {owner.firstName} {owner.lastName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-c-text-muted">—</span>
                    )}
                  </td>

                  {/* Target date — single DueChip (canon §4.4) */}
                  <td className="px-4 py-2">
                    {initiative.plannedEndDate ? (
                      <DueChip
                        label={formatShortDate(initiative.plannedEndDate)}
                        due={terminal ? null : initiative.plannedEndDate}
                        showIcon
                      />
                    ) : (
                      <span className="text-xs text-c-text-muted">—</span>
                    )}
                  </td>

                  {/* Health (RAG) */}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${health.dotClass}`} />
                      <span className="text-xs text-c-text-muted">{health.label}</span>
                    </div>
                  </td>

                  {/* Next step */}
                  <td className="px-4 py-2">
                    {nextStep ? (
                      <div
                        className="text-xs text-c-text-secondary truncate"
                        title={
                          nextStep.role ? `${nextStep.label} (${nextStep.role})` : nextStep.label
                        }
                      >
                        <span className="font-medium text-c-text-secondary">{nextStep.label}</span>
                        {nextStep.role && (
                          <span className="text-c-text-muted ml-1">({nextStep.role})</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-c-text-muted">—</span>
                    )}
                  </td>

                  {/* Missing (blocking) — placeholder, filled when gate readiness is fetched per-row */}
                  <td className="px-4 py-2">
                    <span className="text-xs text-c-text-muted">—</span>
                  </td>

                  {/* Updated */}
                  <td className="px-4 py-2">
                    <span className="text-xs text-c-text-muted">
                      {formatRelativeTime(initiative.updatedAt)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <RowActionsMenu
                      iconVariant="vertical"
                      className="opacity-40 transition-opacity group-hover:opacity-100"
                      sections={
                        [
                          // GÓRA — kontekstowe
                          {
                            id: 'context',
                            kind: 'context' as const,
                            actions: [],
                          },
                          // DÓŁ — stały (kanon §9): Open preview · Edit · Archiwizuj/Przywróć
                          {
                            id: 'fixed',
                            kind: 'manage' as const,
                            actions: [
                              {
                                id: 'open-preview',
                                label: t('common.openPreview', 'Otwórz podgląd'),
                                icon: ChevronRight,
                                onClick: () => onInitiativeClick(initiative),
                              },
                              ...(onOpenFull
                                ? [
                                    {
                                      id: 'open-full',
                                      label: t('common.openFull', 'Otwórz pełny widok'),
                                      icon: ChevronRight,
                                      onClick: () => onOpenFull(initiative),
                                    },
                                  ]
                                : []),
                              {
                                id: 'edit',
                                label: t('common.edit', 'Edytuj'),
                                icon: Edit2,
                                onClick: () => onInitiativeClick(initiative),
                              },
                              initiative.status === InitiativeStatus.ARCHIVED
                                ? {
                                    id: 'restore',
                                    label: t('common.restore', 'Przywróć'),
                                    icon: RotateCcw,
                                    disabled: true,
                                    description: t('common.comingSoonBackend', 'Wkrótce (backend)'),
                                    onClick: () => {},
                                  }
                                : {
                                    id: 'archive',
                                    label: t('common.archive', 'Archiwizuj'),
                                    icon: Archive,
                                    disabled:
                                      !onArchive ||
                                      ![InitiativeStatus.DONE, InitiativeStatus.CANCELLED].includes(
                                        initiative.status
                                      ),
                                    description:
                                      !onArchive ||
                                      ![InitiativeStatus.DONE, InitiativeStatus.CANCELLED].includes(
                                        initiative.status
                                      )
                                        ? t(
                                            'initiatives.archive.hint',
                                            'Zakończ lub anuluj najpierw'
                                          )
                                        : undefined,
                                    onClick: () => onArchive?.(initiative),
                                  },
                              // 4 — Delay (slot present because initiative has a due date; §9.2)
                              ...(initiative.plannedEndDate
                                ? [
                                    {
                                      id: 'delay',
                                      label: t('common.delay', 'Przesuń termin'),
                                      icon: Clock,
                                      disabled: true,
                                      description: t(
                                        'common.comingSoonBackend',
                                        'Wkrótce (backend)'
                                      ),
                                      onClick: () => {},
                                    },
                                  ]
                                : []),
                            ],
                          },
                          // DANGER
                          {
                            id: 'danger',
                            kind: 'danger' as const,
                            actions: [
                              {
                                id: 'delete',
                                label: t('common.delete', 'Usuń'),
                                icon: Trash2,
                                variant: 'danger' as const,
                                disabled: !onDelete,
                                description: !onDelete
                                  ? t('common.comingSoonBackend', 'Wkrótce (backend)')
                                  : undefined,
                                onClick: () => onDelete?.(initiative),
                              },
                            ],
                          },
                        ] as RowActionSection[]
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedInitiatives.length === 0 && (
        <div className="flex items-center justify-center h-64 text-c-text-muted">
          {t('initiatives.hub.noInitiativesFound', 'No initiatives found')}
        </div>
      )}

      {aiOpen && (
        <PortfolioAiPanel
          selected={selectedInitiatives}
          onQuickUpdate={onQuickUpdate}
          onClose={() => setAiOpen(false)}
        />
      )}
    </div>
  );
};

export default PortfolioListView;
