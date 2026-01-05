/**
 * Portfolio Kanban View
 *
 * Drag-and-drop kanban board organized by status columns.
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
import { AlertTriangle, Calendar, DollarSign, GripVertical, TrendingUp, User } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { getAxisColor, getPriorityColors, getStatusColors, KANBAN_COLUMN_COLORS } from '../../config/portfolioColors';
import { InitiativeStatus, PortfolioInitiative } from '../../types';

interface PortfolioKanbanViewProps {
    initiatives: PortfolioInitiative[];
    onInitiativeClick: (initiative: PortfolioInitiative) => void;
    onStatusChange: (id: string, status: InitiativeStatus) => void;
}

// Kanban column configuration
const KANBAN_COLUMNS: { id: InitiativeStatus; label: string }[] = [
    { id: 'DRAFT' as InitiativeStatus, label: 'Draft' },
    { id: 'PLANNING' as InitiativeStatus, label: 'Planning' },
    { id: 'REVIEW' as InitiativeStatus, label: 'Review' },
    { id: 'APPROVED' as InitiativeStatus, label: 'Approved' },
    { id: 'EXECUTING' as InitiativeStatus, label: 'Executing' },
];

// ============================================
// INITIATIVE CARD COMPONENT
// ============================================

interface InitiativeCardProps {
    initiative: PortfolioInitiative;
    onClick: () => void;
    isDragging?: boolean;
}

const InitiativeCard: React.FC<InitiativeCardProps> = ({ initiative, onClick, isDragging }) => {
    const priorityColors = getPriorityColors(initiative.priority);
    const axisColor = getAxisColor(initiative.axis);

    const formatCurrency = (amount: number) => {
        if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
        if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
        return `$${amount}`;
    };

    return (
        <div
            onClick={onClick}
            className={`
                bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-white/10 
                p-4 cursor-pointer group hover:shadow-md transition-all
                ${isDragging ? 'shadow-xl scale-105 rotate-2' : ''}
            `}
        >
            {/* Priority bar */}
            <div className={`h-1 -mx-4 -mt-4 mb-3 rounded-t-lg ${priorityColors.bg}`} />

            {/* Axis indicator + Name */}
            <div className="flex items-start gap-2 mb-3">
                <div className={`w-1 h-full min-h-[40px] rounded-full ${axisColor}`} />
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-navy-900 dark:text-white line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {initiative.name}
                    </h4>
                    {initiative.projectName && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {initiative.projectName}
                        </p>
                    )}
                </div>
            </div>

            {/* Priority badge */}
            <div className="flex items-center gap-2 mb-3">
                <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityColors.bg} ${priorityColors.text}`}
                >
                    {initiative.priority}
                </span>
                {initiative.isCriticalPath && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                        Critical Path
                    </span>
                )}
            </div>

            {/* Owner */}
            {initiative.ownerBusiness && (
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-[10px] font-medium text-purple-700 dark:text-purple-300 overflow-hidden">
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
                    <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {initiative.ownerBusiness.firstName} {initiative.ownerBusiness.lastName}
                    </span>
                </div>
            )}

            {/* Timeline */}
            {initiative.targetQuarter && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-3">
                    <Calendar size={12} />
                    {initiative.targetQuarter}
                </div>
            )}

            {/* Progress bar */}
            <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>Progress</span>
                    <span>{initiative.progress}%</span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${initiative.progress}%` }}
                    />
                </div>
            </div>

            {/* Footer with budget and ROI */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                    <DollarSign size={12} />
                    {formatCurrency(initiative.budget)}
                </div>
                {initiative.expectedRoi && initiative.expectedRoi > 0 && (
                    <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <TrendingUp size={12} />
                        {initiative.expectedRoi.toFixed(1)}x ROI
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================
// SORTABLE CARD WRAPPER
// ============================================

interface SortableCardProps {
    initiative: PortfolioInitiative;
    onClick: () => void;
}

const SortableCard: React.FC<SortableCardProps> = ({ initiative, onClick }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: initiative.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <InitiativeCard initiative={initiative} onClick={onClick} isDragging={isDragging} />
        </div>
    );
};

// ============================================
// KANBAN COLUMN COMPONENT
// ============================================

interface KanbanColumnProps {
    id: InitiativeStatus;
    label: string;
    initiatives: PortfolioInitiative[];
    onInitiativeClick: (initiative: PortfolioInitiative) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ id, label, initiatives, onInitiativeClick }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    const statusColors = getStatusColors(id);
    const columnColors = KANBAN_COLUMN_COLORS[id] || KANBAN_COLUMN_COLORS.DRAFT;

    return (
        <div
            ref={setNodeRef}
            className={`
                flex flex-col min-w-[300px] max-w-[300px] rounded-xl overflow-hidden
                ${columnColors.bg}
                ${isOver ? 'ring-2 ring-purple-500' : ''}
            `}
        >
            {/* Column Header */}
            <div className={`flex items-center justify-between px-4 py-3 ${columnColors.header}`}>
                <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColors.indicator}`} />
                    <span className="font-semibold text-navy-900 dark:text-white">{label}</span>
                </div>
                <span className="px-2 py-0.5 text-xs font-medium bg-white/50 dark:bg-black/20 text-navy-700 dark:text-white rounded-full">
                    {initiatives.length}
                </span>
            </div>

            {/* Column Content */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
                <SortableContext items={initiatives.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    {initiatives.map((initiative) => (
                        <SortableCard
                            key={initiative.id}
                            initiative={initiative}
                            onClick={() => onInitiativeClick(initiative)}
                        />
                    ))}
                </SortableContext>

                {initiatives.length === 0 && (
                    <div className="p-4 text-center text-slate-400 dark:text-slate-500 text-sm">
                        Drop initiatives here
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================
// MAIN KANBAN VIEW
// ============================================

export const PortfolioKanbanView: React.FC<PortfolioKanbanViewProps> = ({
    initiatives,
    onInitiativeClick,
    onStatusChange,
}) => {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor),
    );

    // Group initiatives by status
    const columnData = useMemo(() => {
        const grouped: Record<string, PortfolioInitiative[]> = {};
        KANBAN_COLUMNS.forEach((col) => {
            grouped[col.id] = [];
        });

        initiatives.forEach((initiative) => {
            if (grouped[initiative.status]) {
                grouped[initiative.status].push(initiative);
            }
        });

        return grouped;
    }, [initiatives]);

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

        const activeInitiative = initiatives.find((i) => i.id === active.id);
        if (!activeInitiative) return;

        // Check if dropped on a column
        const newStatus = KANBAN_COLUMNS.find((col) => col.id === over.id)?.id;
        if (newStatus && newStatus !== activeInitiative.status) {
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
                <div className="flex gap-4 h-full">
                    {KANBAN_COLUMNS.map((column) => (
                        <KanbanColumn
                            key={column.id}
                            id={column.id}
                            label={column.label}
                            initiatives={columnData[column.id] || []}
                            onInitiativeClick={onInitiativeClick}
                        />
                    ))}
                </div>
            </div>

            <DragOverlay>
                {activeInitiative && <InitiativeCard initiative={activeInitiative} onClick={() => {}} isDragging />}
            </DragOverlay>
        </DndContext>
    );
};

export default PortfolioKanbanView;
