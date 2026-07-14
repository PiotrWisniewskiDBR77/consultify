/**
 * Portfolio Kanban View
 *
 * Kanban board for Initiatives — "pokazywać co przesuwamy dalej".
 *
 * Two modes controlled by parent (InitiativesHub):
 *   ACTIVE  → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED
 *   ALL     → full lifecycle from DRAFT to ARCHIVED (left → right)
 *
 * Cards show: Name · Priority · Owner · Next gate · Missing/Blocking (max 3 chips)
 *
 * Tech Sexy v2.0:
 * - invisible borders, no column header separator line
 * - subtle hover, no shadow on cards (only on drag overlay)
 * - monochromatic chrome, semantic color only for dots/badges
 */

import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, User } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getPriorityStyle, getStatusStyle } from '../../constants/statusColors';
import { STATUS_METADATA } from '../../services/initiativeLifecycle';
import { InitiativeStatus, PortfolioInitiative } from '../../types';
import {
  ACTIVE_STATUSES,
  ALL_STATUSES,
  getHealthInfo,
  getNextStep,
} from '../../utils/initiativeHelpers';

// ==========================================
// TYPES
// ==========================================

export type KanbanScope = 'active' | 'all';

interface PortfolioKanbanViewProps {
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
  onStatusChange: (id: string, status: InitiativeStatus) => void;
  /** Controls column set: 'active' = core flow, 'all' = full lifecycle */
  scope?: KanbanScope;
  /** #75a — permission gate: false disables picking up any card (drag),
   *  e.g. for pilot/viewer roles without the right to change initiative
   *  status. Cards stay clickable to open. Default true (no behavior
   *  change for existing callers). */
  canDrag?: boolean;
  /** Tooltip explaining why drag is disabled (shown on card hover). */
  dragDisabledReason?: string;
}

// ==========================================
// COLUMN CONFIG
// ==========================================

function getColumnsForScope(scope: KanbanScope): { id: InitiativeStatus; label: string }[] {
  const statuses = scope === 'active' ? ACTIVE_STATUSES : ALL_STATUSES;
  return statuses.map((s) => ({
    id: s,
    label: STATUS_METADATA[s]?.label || s,
  }));
}

// ==========================================
// INITIATIVE KANBAN CARD
// ==========================================

interface KanbanCardProps {
  initiative: PortfolioInitiative;
  onClick: () => void;
  isDragging?: boolean;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ initiative, onClick, isDragging }) => {
  const { t } = useTranslation();
  const priorityStyle = getPriorityStyle(initiative.priority);
  const health = getHealthInfo(initiative);
  const nextStep = getNextStep(initiative.status);
  const owner = initiative.ownerBusiness || initiative.ownerExecution;

  return (
    <div
      onClick={onClick}
      className={`
        bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]
        p-3 cursor-pointer group transition-all
        hover:bg-c-surface-raised
        ${isDragging ? 'shadow-hig-xl dark:shadow-hig-dark-xl scale-[1.02] rotate-1' : ''}
      `}
    >
      {/* Row 1: Name */}
      <h4 className="font-medium text-sm text-c-text line-clamp-2 mb-2 leading-snug">
        {initiative.name}
      </h4>

      {/* Row 2: Priority + Health dot */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${priorityStyle.bg} ${priorityStyle.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
          {initiative.priority || 'N/A'}
        </span>
        <div className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${health.dotClass}`} />
          <span className="text-[10px] text-c-text-muted">{health.label}</span>
        </div>
      </div>

      {/* Row 3: Owner */}
      {owner ? (
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-4 h-4 rounded-full bg-c-surface-raised flex items-center justify-center text-[8px] font-medium text-c-text-secondary overflow-hidden flex-shrink-0">
            {owner.avatarUrl ? (
              <img src={owner.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              `${owner.firstName?.[0] || '?'}${owner.lastName?.[0] || ''}`
            )}
          </div>
          <span className="text-[11px] text-c-text-secondary truncate">
            {owner.firstName} {owner.lastName}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mb-2 text-[11px] text-c-text-muted">
          <User size={12} />
          <span>{t('initiatives.kanban.noOwner', 'Unassigned')}</span>
        </div>
      )}

      {/* Row 4: Next step → gate */}
      {nextStep && (
        <div className="pt-2 border-t border-c-border-subtle">
          <div className="text-[10px] text-c-text-muted mb-1 uppercase tracking-wider font-medium">
            {t('initiatives.kanban.nextGate', 'Next gate')}
          </div>
          <div className="text-xs text-c-text-secondary font-medium truncate">{nextStep.label}</div>
          {nextStep.role && (
            <div className="text-[10px] text-c-text-muted mt-0.5">{nextStep.role}</div>
          )}
        </div>
      )}

      {/* Row 5: Missing blocking (placeholder — populated when gateReadiness is loaded) */}
      {/* In future: map gateReadiness.topBlocking to chips */}
    </div>
  );
};

// ==========================================
// SORTABLE WRAPPER
// ==========================================

interface SortableCardProps {
  initiative: PortfolioInitiative;
  onClick: () => void;
  /** #75a — gate: false when the current user has no permission to change
   *  initiative status (e.g. pilot/viewer role). Card stays clickable (open
   *  the initiative) but cannot be picked up for drag. */
  canDrag?: boolean;
  /** Tooltip shown on hover when canDrag=false, explaining why. */
  dragDisabledReason?: string;
}

const SortableCard: React.FC<SortableCardProps> = ({
  initiative,
  onClick,
  canDrag = true,
  dragDisabledReason,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: initiative.id,
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      className={canDrag ? undefined : 'cursor-default'}
      title={canDrag ? undefined : dragDisabledReason}
    >
      <KanbanCard initiative={initiative} onClick={onClick} isDragging={isDragging} />
    </div>
  );
};

// ==========================================
// KANBAN COLUMN
// ==========================================

interface KanbanColumnProps {
  id: InitiativeStatus;
  label: string;
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
  isCompact?: boolean;
  canDrag?: boolean;
  dragDisabledReason?: string;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  id,
  label,
  initiatives,
  onInitiativeClick,
  isCompact,
  canDrag = true,
  dragDisabledReason,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const statusStyle = getStatusStyle(id);

  const columnWidth = isCompact ? 'min-w-[240px] max-w-[240px]' : 'min-w-[280px] max-w-[280px]';

  return (
    <div
      ref={setNodeRef}
      data-testid={`kanban-column-${id.toString().toLowerCase()}`}
      className={`
        flex flex-col ${columnWidth} rounded-xl overflow-hidden
        bg-c-bg
        border border-c-border-subtle
        ${isOver ? 'ring-2 ring-c-focus' : ''}
        transition-all
      `}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-c-surface">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusStyle.dot}`} />
          <span className="text-xs font-semibold text-c-text-secondary uppercase tracking-wider">
            {label}
          </span>
        </div>
        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-c-surface-raised text-c-text-muted rounded-full min-w-[20px] text-center">
          {initiatives.length}
        </span>
      </div>

      {/* Column Content */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        <SortableContext
          items={initiatives.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {initiatives.map((initiative) => (
            <SortableCard
              key={initiative.id}
              initiative={initiative}
              onClick={() => onInitiativeClick(initiative)}
              canDrag={canDrag}
              dragDisabledReason={dragDisabledReason}
            />
          ))}
        </SortableContext>

        {initiatives.length === 0 && (
          <div className="p-3 text-center text-c-text-muted text-xs">Drop initiatives here</div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// MAIN KANBAN VIEW
// ==========================================

export const PortfolioKanbanView: React.FC<PortfolioKanbanViewProps> = ({
  initiatives,
  onInitiativeClick,
  onStatusChange,
  scope = 'active',
  canDrag = true,
  dragDisabledReason,
}) => {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const columns = useMemo(() => getColumnsForScope(scope), [scope]);
  const isCompact = scope === 'all';
  const resolvedDragDisabledReason =
    dragDisabledReason ||
    t(
      'initiatives.kanban.dragDisabled',
      "You don't have permission to change this initiative's status."
    );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const columnData = useMemo(() => {
    const grouped: Record<string, PortfolioInitiative[]> = {};
    columns.forEach((col) => {
      grouped[col.id] = [];
    });
    initiatives.forEach((initiative) => {
      if (grouped[initiative.status]) {
        grouped[initiative.status].push(initiative);
      }
    });
    return grouped;
  }, [initiatives, columns]);

  const activeInitiative = useMemo(() => {
    if (!activeId) return null;
    return initiatives.find((i) => i.id === activeId) || null;
  }, [activeId, initiatives]);

  const handleDragStart = (event: DragStartEvent) => {
    if (!canDrag) return;
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canDrag) {
      setActiveId(null);
      return;
    }
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const draggedInitiative = initiatives.find((i) => i.id === active.id);
    if (!draggedInitiative) return;

    const overId = over.id as string;
    let newStatus = columns.find((col) => col.id === overId)?.id;
    if (!newStatus) {
      const overInitiative = initiatives.find((i) => i.id === overId);
      if (overInitiative) newStatus = columns.find((col) => col.id === overInitiative.status)?.id;
    }
    if (newStatus && newStatus !== draggedInitiative.status) {
      onStatusChange(active.id as string, newStatus);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full overflow-x-auto p-4">
        <div className="flex gap-3 h-full">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              label={column.label}
              initiatives={columnData[column.id] || []}
              onInitiativeClick={onInitiativeClick}
              isCompact={isCompact}
              canDrag={canDrag}
              dragDisabledReason={resolvedDragDisabledReason}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeInitiative && (
          <KanbanCard initiative={activeInitiative} onClick={() => {}} isDragging />
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default PortfolioKanbanView;
