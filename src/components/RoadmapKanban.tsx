import {
  closestCorners,
  defaultDropAnimationSideEffects,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  DropAnimation,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, GripVertical } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';

import { getPriorityStyle } from '../constants/statusColors';
import { FullInitiative, InitiativeStatus, Quarter, User } from '../types';
import { InitiativeCompactPanel } from './Initiatives/InitiativeCompactPanel';

interface Props {
  initiatives: FullInitiative[];
  onUpdateInitiative: (init: FullInitiative) => void;

  users?: User[];
  currentUser?: User | null;
}

const quarters: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];

const SortableItem: React.FC<{ id: string; initiative: FullInitiative; onClick: () => void }> = ({
  id,
  initiative,
  onClick,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isHighChange = (initiative.effortProfile?.change || 0) >= 4;
  const priorityStyle = getPriorityStyle(initiative.priority);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-c-surface p-3 rounded-lg mb-2 border border-slate-200/60 dark:border-white/[0.03] hover:border-c-border-strong hover:shadow-lg transition-all cursor-pointer group relative"
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <GripVertical
          size={14}
          className="text-c-text-muted mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2"
        />

        {/* Avatar (Owner) */}
        <div className="shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-full bg-c-surface-raised border border-slate-200/60 dark:border-white/[0.03] flex items-center justify-center overflow-hidden">
            {initiative.ownerExecution?.avatarUrl ? (
              <img
                src={initiative.ownerExecution.avatarUrl}
                alt="Owner"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold text-c-text-muted">
                {initiative.ownerExecution?.firstName?.[0] || '?'}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${priorityStyle.bg} ${priorityStyle.text}`}
            >
              {initiative.priority}
            </span>

            {/* New Strategic Role Badge */}
            {initiative.strategicRole && (
              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-c-surface-raised text-c-text-secondary">
                {initiative.strategicRole.substring(0, 3)}
              </span>
            )}

            {initiative.status === InitiativeStatus.IN_EXECUTION && (
              <span
                className="w-2 h-2 rounded-full bg-blue-500 block animate-pulse"
                title="In Execution"
              ></span>
            )}

            {/* High Change Indicator */}
            {isHighChange && (
              <span className="text-danger-500" title="High Change Effort">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-spin-slow"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                  <path d="M16 16l5 5"></path>
                  <path d="M21 21v-5h-5"></path>
                </svg>
              </span>
            )}
          </div>

          <h4 className="text-sm font-semibold text-c-text leading-tight mb-1 truncate">
            {initiative.name}
          </h4>

          <div className="flex items-center justify-between mt-2">
            {/* Effort Bar Mini */}
            {initiative.effortProfile && (
              <div className="flex items-end gap-0.5 h-2 w-12 opacity-50">
                <div
                  className="bg-blue-500 w-1/3 rounded-sm"
                  style={{ height: `${(initiative.effortProfile.analytical / 5) * 100}%` }}
                ></div>
                <div
                  className="bg-emerald-500 w-1/3 rounded-sm"
                  style={{ height: `${(initiative.effortProfile.operational / 5) * 100}%` }}
                ></div>
                <div
                  className="bg-danger-500 w-1/3 rounded-sm"
                  style={{ height: `${(initiative.effortProfile.change / 5) * 100}%` }}
                ></div>
              </div>
            )}

            {initiative.endDate && (
              <span className="flex items-center gap-1 text-[10px] text-c-text-muted ml-auto">
                <Clock size={10} />{' '}
                {new Date(initiative.endDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hover visual cue */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-c-focus to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
    </div>
  );
};

export const RoadmapKanban: React.FC<Props> = ({
  initiatives,
  onUpdateInitiative,
  users,
  currentUser,
}) => {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedInitiative, setSelectedInitiative] = useState<FullInitiative | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group by quarter
  const containers = quarters.reduce(
    (acc, q) => {
      acc[q] = initiatives.filter((i) => i.quarter === q).map((i) => i.id);
      return acc;
    },
    {} as Record<string, string[]>
  );

  const findContainer = (id: string) => {
    if (quarters.includes(id as Quarter)) return id as Quarter;
    return initiatives.find((i) => i.id === id)?.quarter;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) return;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeInit = initiatives.find((i) => i.id === active.id);
    const overContainer = findContainer(over.id as string);

    if (activeInit && overContainer && activeInit.quarter !== overContainer) {
      onUpdateInitiative({ ...activeInit, quarter: overContainer as Quarter });
    }
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 h-full items-start px-1">
          {quarters.map((quarter) => (
            <div
              key={quarter}
              className="min-w-[280px] w-[280px] bg-c-bg rounded-xl border border-c-border-subtle flex flex-col max-h-full shrink-0"
            >
              <div className="p-3 border-b border-c-border-subtle flex justify-between items-center sticky top-0 bg-c-surface backdrop-blur z-10 rounded-t-xl group">
                <span className="font-bold text-sm text-c-text-secondary">{quarter}</span>
                <span className="text-xs bg-c-surface-raised px-2 py-0.5 rounded text-c-text-muted group-hover:text-c-text transition-colors">
                  {containers[quarter]?.length || 0}
                </span>
              </div>
              <div className="p-2 flex-1 overflow-y-auto min-h-[100px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <SortableContext
                  id={quarter}
                  items={containers[quarter] || []}
                  strategy={verticalListSortingStrategy}
                >
                  {containers[quarter]?.map((id: string) => {
                    const init = initiatives.find((i) => i.id === id);
                    return init ? (
                      <SortableItem
                        key={id}
                        id={id}
                        initiative={init}
                        onClick={() => {
                          setSelectedInitiative(init);
                          setIsDrawerOpen(true);
                        }}
                      />
                    ) : null;
                  })}
                </SortableContext>

                {/* Placeholder */}
                {containers[quarter]?.length === 0 && (
                  <div className="h-24 border-2 border-dashed border-c-border-subtle rounded-lg m-1 flex flex-col items-center justify-center text-xs text-c-text-muted gap-2">
                    <Clock size={16} opacity={0.5} />
                    <span>No initiatives planned</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <DragOverlay dropAnimation={dropAnimation}>
          {activeId ? (
            <div className="bg-c-surface p-3 rounded-lg border border-c-focus shadow-2xl opacity-90 w-[280px]">
              {/* Simplified Drag Preview */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-c-surface-raised"></div>
                <div>
                  <div className="h-4 w-32 bg-c-surface-raised rounded mb-2"></div>
                  <div className="h-3 w-16 bg-c-surface-raised rounded"></div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <InitiativeCompactPanel
        initiative={selectedInitiative as any}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setTimeout(() => setSelectedInitiative(null), 200);
        }}
        onUpdate={(updated) => {
          onUpdateInitiative(updated as any);
          setSelectedInitiative(updated as any);
        }}
        onOpenFull={(initiative) => {
          navigate(`${ROUTES.INITIATIVES}?open=${initiative.id}&mode=doc`);
        }}
        users={users as any}
      />
    </>
  );
};
