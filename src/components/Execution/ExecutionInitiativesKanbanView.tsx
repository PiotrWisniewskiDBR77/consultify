/**
 * ExecutionInitiativesKanbanView
 *
 * Kanban board for initiatives in the Execution module.
 * Shows initiatives by status with drag-and-drop to change status.
 *
 * Two modes controlled by scope:
 *   ACTIVE  → SCHEDULED → EXECUTING → BLOCKED
 *   ALL     → SCHEDULED → EXECUTING → BLOCKED → DONE → CANCELLED → ARCHIVED
 *
 * Cards show: Name · Priority · Owner · Health · Next step
 * Matches PortfolioKanbanView styling for consistency.
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
import { User } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getPriorityStyle, getStatusStyle } from '@/constants/statusColors';
import { STATUS_METADATA } from '@/services/initiativeLifecycle';
import { InitiativeStatus, PortfolioInitiative } from '@/types';
import { getHealthInfo, getNextStep } from '@/utils/initiativeHelpers';

// ==========================================
// TYPES
// ==========================================

export type KanbanScope = 'active' | 'all';

interface ExecutionInitiativesKanbanViewProps {
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
  onStatusChange: (id: string, status: string) => void;
  scope?: KanbanScope;
}

// ==========================================
// COLUMN CONFIG — Execution-specific
// ==========================================

const ACTIVE_EXECUTION_STATUSES: InitiativeStatus[] = [
  InitiativeStatus.SCHEDULED,
  InitiativeStatus.EXECUTING,
  InitiativeStatus.BLOCKED,
];

const ALL_EXECUTION_STATUSES: InitiativeStatus[] = [
  InitiativeStatus.SCHEDULED,
  InitiativeStatus.EXECUTING,
  InitiativeStatus.BLOCKED,
  InitiativeStatus.DONE,
  InitiativeStatus.CANCELLED,
  InitiativeStatus.ARCHIVED,
];

function getColumnsForScope(scope: KanbanScope): { id: InitiativeStatus; label: string }[] {
  const statuses = scope === 'active' ? ACTIVE_EXECUTION_STATUSES : ALL_EXECUTION_STATUSES;
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
  const nextStep = getNextStep(initiative.status as string);
  const owner = initiative.ownerBusiness || initiative.ownerExecution;

  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-navy-900 rounded-xl border border-slate-200/60 dark:border-white/5
        p-3 cursor-pointer group transition-all
        hover:bg-slate-50/70 dark:hover:bg-white/[0.03]
        ${isDragging ? 'shadow-hig-xl dark:shadow-hig-dark-xl scale-[1.02] rotate-1' : ''}
      `}
    >
      {/* Row 1: Name */}
      <h4 className="font-medium text-sm text-slate-900 dark:text-slate-100 line-clamp-2 mb-2 leading-snug">
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
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{health.label}</span>
        </div>
      </div>

      {/* Row 3: Owner */}
      {owner ? (
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center text-[8px] font-medium text-slate-600 dark:text-slate-300 overflow-hidden flex-shrink-0">
            {owner.avatarUrl ? (
              <img src={owner.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              `${owner.firstName?.[0] || '?'}${owner.lastName?.[0] || ''}`
            )}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {owner.firstName} {owner.lastName}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mb-2 text-[11px] text-slate-400">
          <User size={12} />
          <span>{t('execution.kanban.noOwner', 'Unassigned')}</span>
        </div>
      )}

      {/* Row 4: Progress */}
      <div className="text-[10px] text-slate-400 dark:text-slate-500">
        {initiative.progress ?? 0}% {t('execution.kanban.complete', 'complete')}
      </div>

      {/* Row 5: Next step (when applicable) */}
      {nextStep && (
        <div className="pt-2 border-t border-slate-100/70 dark:border-white/[0.03]">
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider font-medium">
            {t('execution.kanban.nextStep', 'Next step')}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
            {nextStep.label}
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// SORTABLE WRAPPER
// ==========================================

interface SortableCardProps {
  initiative: PortfolioInitiative;
  onClick: () => void;
}

const SortableCard: React.FC<SortableCardProps> = ({ initiative, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: initiative.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
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
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  id,
  label,
  initiatives,
  onInitiativeClick,
  isCompact,
}) => {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id });
  const statusStyle = getStatusStyle(id as string);

  const columnWidth = isCompact ? 'min-w-[240px] max-w-[240px]' : 'min-w-[280px] max-w-[280px]';

  return (
    <div
      ref={setNodeRef}
      data-testid={`execution-kanban-column-${id.toString().toLowerCase()}`}
      className={`
        flex flex-col ${columnWidth} rounded-xl overflow-hidden
        bg-slate-50/50 dark:bg-navy-950/30
        border border-slate-200/40 dark:border-white/[0.03]
        ${isOver ? 'ring-2 ring-cyan-500/40' : ''}
        transition-all
      `}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-white/60 dark:bg-navy-900/40">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusStyle.dot}`} />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
            {label}
          </span>
        </div>
        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 rounded-full min-w-[20px] text-center">
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
            />
          ))}
        </SortableContext>

        {initiatives.length === 0 && (
          <div className="p-3 text-center text-slate-400 dark:text-slate-500 text-xs">
            {t('execution.kanban.dropHere', 'Drop initiatives here')}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// MAIN KANBAN VIEW
// ==========================================

export const ExecutionInitiativesKanbanView: React.FC<ExecutionInitiativesKanbanViewProps> = ({
  initiatives,
  onInitiativeClick,
  onStatusChange,
  scope = 'active',
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const columns = useMemo(() => getColumnsForScope(scope), [scope]);
  const isCompact = scope === 'all';

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
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const draggedInitiative = initiatives.find((i) => i.id === active.id);
    if (!draggedInitiative) return;

    const newStatus = columns.find((col) => col.id === over.id)?.id;
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

export default ExecutionInitiativesKanbanView;
