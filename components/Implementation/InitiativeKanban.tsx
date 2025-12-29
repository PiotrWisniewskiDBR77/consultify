/**
 * InitiativeKanban
 * 
 * Kanban board for managing initiatives in execution.
 * Shows initiatives by stage with SLA tracking and task breakdown.
 */

import React, { useState, useCallback } from 'react';
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult
} from 'react-beautiful-dnd';
import {
    Clock,
    User,
    AlertTriangle,
    CheckCircle2,
    ListTodo,
    Calendar,
    ArrowRight,
    MoreHorizontal,
    Target,
    Rocket,
    Package,
    Flag,
    Timer
} from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { InitiativeStatus } from '../../types';

interface Task {
    id: string;
    title: string;
    status: string;
    dueDate?: string;
    assignee?: { firstName: string; lastName: string };
    priority?: string;
}

interface Initiative {
    id: string;
    name: string;
    status: string;
    progress: number;
    currentStage: string;
    plannedEndDate?: string;
    actualEndDate?: string;
    ownerExecution?: { firstName: string; lastName: string };
    tasks?: Task[];
    slaDeadline?: string;
    priority?: string;
}

interface Column {
    id: string;
    title: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
}

interface InitiativeKanbanProps {
    initiatives: Initiative[];
    onInitiativeClick?: (initiative: Initiative) => void;
    onStageChange?: (initiativeId: string, newStage: string) => void;
    onStatusChange?: (initiativeId: string, newStatus: string) => void;
}

const EXECUTION_STAGES: Column[] = [
    { id: 'KICKOFF', title: 'Kickoff', icon: <Rocket size={16} />, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
    { id: 'IN_PROGRESS', title: 'In Progress', icon: <Timer size={16} />, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-900/20' },
    { id: 'REVIEW', title: 'Under Review', icon: <Target size={16} />, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20' },
    { id: 'DELIVERY', title: 'Delivery', icon: <Package size={16} />, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/20' },
];

export const InitiativeKanban: React.FC<InitiativeKanbanProps> = ({
    initiatives,
    onInitiativeClick,
    onStageChange,
    onStatusChange
}) => {
    const [localInitiatives, setLocalInitiatives] = useState(initiatives);

    // Calculate SLA status
    const getSLAStatus = (initiative: Initiative): 'ok' | 'warning' | 'overdue' => {
        if (!initiative.slaDeadline && !initiative.plannedEndDate) return 'ok';
        const deadline = initiative.slaDeadline || initiative.plannedEndDate;
        const daysToDeadline = Math.ceil(
            (new Date(deadline!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysToDeadline < 0) return 'overdue';
        if (daysToDeadline <= 7) return 'warning';
        return 'ok';
    };

    // Handle drag end
    const handleDragEnd = useCallback(async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStage = destination.droppableId;
        
        // Optimistic update
        setLocalInitiatives(prev => 
            prev.map(init => 
                init.id === draggableId 
                    ? { ...init, currentStage: newStage }
                    : init
            )
        );

        // Call parent handler
        onStageChange?.(draggableId, newStage);

        // API call
        try {
            await Api.put(`/initiatives/${draggableId}`, { currentStage: newStage });
            toast.success('Stage updated');
        } catch (err) {
            // Revert on error
            setLocalInitiatives(initiatives);
            toast.error('Failed to update stage');
        }
    }, [initiatives, onStageChange]);

    // Group initiatives by stage
    const getInitiativesByStage = (stageId: string) => {
        return localInitiatives.filter(init => 
            (init.currentStage || 'KICKOFF') === stageId && 
            init.status === 'EXECUTING'
        );
    };

    const renderInitiativeCard = (initiative: Initiative, index: number) => {
        const slaStatus = getSLAStatus(initiative);
        const completedTasks = initiative.tasks?.filter(t => t.status === 'DONE').length || 0;
        const totalTasks = initiative.tasks?.length || 0;
        const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return (
            <Draggable key={initiative.id} draggableId={initiative.id} index={index}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`bg-white dark:bg-navy-900 rounded-lg border p-4 mb-3 cursor-pointer transition-all ${
                            snapshot.isDragging 
                                ? 'shadow-lg border-purple-400 dark:border-purple-500 rotate-2' 
                                : 'border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/50'
                        }`}
                        onClick={() => !snapshot.isDragging && onInitiativeClick?.(initiative)}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                                <h4 className="font-medium text-navy-900 dark:text-white text-sm line-clamp-2">
                                    {initiative.name}
                                </h4>
                            </div>
                            <button className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded">
                                <MoreHorizontal size={14} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Progress bar */}
                        <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    Overall Progress
                                </span>
                                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                                    {initiative.progress || 0}%
                                </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-purple-500 rounded-full transition-all"
                                    style={{ width: `${initiative.progress || 0}%` }}
                                />
                            </div>
                        </div>

                        {/* Tasks progress */}
                        {totalTasks > 0 && (
                            <div className="flex items-center gap-2 mb-3 text-xs text-slate-500 dark:text-slate-400">
                                <ListTodo size={12} />
                                <span>{completedTasks}/{totalTasks} tasks</span>
                                <div className="flex-1 h-1 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-green-500 rounded-full"
                                        style={{ width: `${taskProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* SLA indicator */}
                        <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                            slaStatus === 'overdue' 
                                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                : slaStatus === 'warning'
                                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                    : 'bg-slate-50 dark:bg-navy-800 text-slate-600 dark:text-slate-400'
                        }`}>
                            {slaStatus === 'overdue' ? (
                                <AlertTriangle size={12} />
                            ) : slaStatus === 'warning' ? (
                                <Clock size={12} />
                            ) : (
                                <Calendar size={12} />
                            )}
                            <span>
                                {initiative.plannedEndDate 
                                    ? new Date(initiative.plannedEndDate).toLocaleDateString('pl-PL')
                                    : 'No deadline'
                                }
                            </span>
                            {slaStatus === 'overdue' && (
                                <span className="font-medium ml-auto">OVERDUE</span>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                            {/* Owner */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                <div className="w-5 h-5 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                                    <User size={10} className="text-purple-600 dark:text-purple-400" />
                                </div>
                                <span>
                                    {initiative.ownerExecution 
                                        ? `${initiative.ownerExecution.firstName} ${initiative.ownerExecution.lastName}`
                                        : 'Unassigned'
                                    }
                                </span>
                            </div>
                            
                            {/* Priority */}
                            {initiative.priority && (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                    initiative.priority === 'CRITICAL' 
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                        : initiative.priority === 'HIGH'
                                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                    {initiative.priority}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </Draggable>
        );
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
                {EXECUTION_STAGES.map(column => {
                    const columnInitiatives = getInitiativesByStage(column.id);
                    
                    return (
                        <div key={column.id} className="flex-1 min-w-[280px] max-w-[320px]">
                            {/* Column Header */}
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${column.bgColor}`}>
                                <span className={column.color}>{column.icon}</span>
                                <h3 className={`font-semibold text-sm ${column.color}`}>
                                    {column.title}
                                </h3>
                                <span className={`ml-auto text-xs font-medium ${column.color} bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded`}>
                                    {columnInitiatives.length}
                                </span>
                            </div>

                            {/* Column Content */}
                            <Droppable droppableId={column.id}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`min-h-[400px] p-2 rounded-b-lg transition-colors ${
                                            snapshot.isDraggingOver 
                                                ? 'bg-purple-50 dark:bg-purple-900/20' 
                                                : 'bg-slate-50 dark:bg-navy-950/50'
                                        }`}
                                    >
                                        {columnInitiatives.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-sm">
                                                <Package size={24} className="mb-2 opacity-50" />
                                                <span>No initiatives</span>
                                            </div>
                                        ) : (
                                            columnInitiatives.map((init, index) => renderInitiativeCard(init, index))
                                        )}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    );
                })}
            </div>
        </DragDropContext>
    );
};

export default InitiativeKanban;

