/**
 * ExecutionInitiativesKanbanView
 *
 * Execution module initiatives kanban — presentation aligned with Initiatives module.
 *
 * Columns:
 *  - Active: SCHEDULED → EXECUTING → BLOCKED
 *  - All:    SCHEDULED → EXECUTING → BLOCKED → DONE → CANCELLED → ARCHIVED
 */
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
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

import { getPriorityStyle, getStatusStyle } from '../../constants/statusColors';
import { STATUS_METADATA } from '../../services/initiativeLifecycle';
import type { InitiativeStatus, PortfolioInitiative } from '../../types';
import { getHealthInfo, getNextStep } from '../../utils/initiativeHelpers';

export type ExecutionKanbanScope = 'active' | 'all';

interface ExecutionInitiativesKanbanViewProps {
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
  onStatusChange: (id: string, status: InitiativeStatus) => void;
  scope: ExecutionKanbanScope;
  readOnly?: boolean;
}

const ACTIVE: InitiativeStatus[] = ['SCHEDULED', 'EXECUTING', 'BLOCKED'] as InitiativeStatus[];
const ALL: InitiativeStatus[] = [
  'SCHEDULED',
  'EXECUTING',
  'BLOCKED',
  'DONE',
  'CANCELLED',
  'ARCHIVED',
] as InitiativeStatus[];

function getColumns(scope: ExecutionKanbanScope): { id: InitiativeStatus; label: string }[] {
  const statuses = scope === 'active' ? ACTIVE : ALL;
  return statuses.map((s) => ({ id: s, label: STATUS_METADATA[s]?.label || s }));
}

const KanbanCard: React.FC<{
  initiative: PortfolioInitiative;
  onClick: () => void;
  isDragging?: boolean;
}> = ({ initiative, onClick, isDragging }) => {
  const { t } = useTranslation();
  const priorityStyle = getPriorityStyle(initiative.priority);
  const health = getHealthInfo(initiative);
  const nextStep = getNextStep(initiative.status);
  const owner = initiative.ownerBusiness || initiative.ownerExecution;

  return (
    <div
      onClick={onClick}
      className={`
        bg-c-surface rounded-xl border border-c-border
        p-3 cursor-pointer group transition-all
        hover:bg-c-surface-raised
        ${isDragging ? 'shadow-hig-xl dark:shadow-hig-dark-xl scale-[1.02] rotate-1' : ''}
      `}
    >
      <h4 className="font-medium text-sm text-c-text line-clamp-2 mb-2 leading-snug">
        {initiative.name}
      </h4>

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

      {nextStep && (
        <div className="pt-2 border-t border-c-border-subtle">
          <div className="text-[10px] text-c-text-muted mb-1 uppercase tracking-wider font-medium">
            {t('initiatives.kanban.nextGate', 'Next gate')}
          </div>
          <div className="text-xs text-c-text-secondary font-medium truncate">
            {nextStep.label}
          </div>
          {nextStep.role && (
            <div className="text-[10px] text-c-text-muted mt-0.5">
              {nextStep.role}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SortableCard: React.FC<{
  initiative: PortfolioInitiative;
  onClick: () => void;
  draggable?: boolean;
}> = ({ initiative, onClick, draggable = true }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: initiative.id,
    disabled: !draggable,
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
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
    >
      <KanbanCard initiative={initiative} onClick={onClick} isDragging={isDragging} />
    </div>
  );
};

const KanbanColumn: React.FC<{
  id: InitiativeStatus;
  label: string;
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
  isCompact: boolean;
  draggable?: boolean;
}> = ({ id, label, initiatives, onInitiativeClick, isCompact, draggable = true }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const statusStyle = getStatusStyle(id);
  const columnWidth = isCompact ? 'min-w-[240px] max-w-[240px]' : 'min-w-[280px] max-w-[280px]';

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col ${columnWidth} rounded-xl overflow-hidden
        bg-c-bg
        border border-c-border-subtle
        ${isOver ? 'ring-2 ring-c-focus' : ''}
        transition-all
      `}
    >
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
              draggable={draggable}
            />
          ))}
        </SortableContext>
        {initiatives.length === 0 && (
          <div className="p-3 text-center text-c-text-muted text-xs">
            Drop initiatives here
          </div>
        )}
      </div>
    </div>
  );
};

export const ExecutionInitiativesKanbanView: React.FC<ExecutionInitiativesKanbanViewProps> = ({
  initiatives,
  onInitiativeClick,
  onStatusChange,
  scope,
  readOnly = false,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const columns = useMemo(() => getColumns(scope), [scope]);
  const isCompact = scope === 'all';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const columnData = useMemo(() => {
    const grouped: Record<string, PortfolioInitiative[]> = {};
    columns.forEach((c) => {
      grouped[c.id] = [];
    });
    initiatives.forEach((i) => {
      if (grouped[i.status]) grouped[i.status].push(i);
    });
    return grouped;
  }, [initiatives, columns]);

  const activeInitiative = useMemo(() => {
    if (!activeId) return null;
    return initiatives.find((i) => i.id === activeId) || null;
  }, [activeId, initiatives]);

  const handleDragStart = (event: DragStartEvent) => {
    if (readOnly) return;
    setActiveId(event.active.id as string);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly) {
      setActiveId(null);
      return;
    }
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const dragged = initiatives.find((i) => i.id === active.id);
    if (!dragged) return;
    // `over.id` is the column status when dropped on empty column space, but
    // when dropped on another card (the common case in a populated column) it is
    // that card's initiative id. Resolve the target column in both cases —
    // otherwise card-on-card drops silently no-op (mirrors the task kanban in
    // ExecutionHub.handleDragEnd).
    const overId = over.id as string;
    let newStatus = columns.find((c) => c.id === overId)?.id;
    if (!newStatus) {
      const overInitiative = initiatives.find((i) => i.id === overId);
      if (overInitiative) {
        newStatus = columns.find((c) => c.id === overInitiative.status)?.id;
      }
    }
    if (newStatus && newStatus !== dragged.status) {
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
          {columns.map((c) => (
            <KanbanColumn
              key={c.id}
              id={c.id}
              label={c.label}
              initiatives={columnData[c.id] || []}
              onInitiativeClick={onInitiativeClick}
              isCompact={isCompact}
              draggable={!readOnly}
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
