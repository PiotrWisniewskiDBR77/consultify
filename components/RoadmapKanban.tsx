import React, { useState } from 'react';
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
    defaultDropAnimationSideEffects,
    DropAnimation
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FullInitiative, Quarter, Language, User } from '../types';
import { InitiativeDetailModal } from './InitiativeDetailModal';
import { GripVertical, Clock, AlertTriangle } from 'lucide-react';

interface Props {
    initiatives: FullInitiative[];
    onUpdateInitiative: (init: FullInitiative) => void;
    language: Language;
    users?: User[];
    currentUser?: User | null;
}

const quarters: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];

const SortableItem: React.FC<{ id: string, initiative: FullInitiative, onClick: () => void }> = ({ id, initiative, onClick }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={`bg-navy-800 p-3 rounded-lg mb-2 border hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group relative ${initiative.priority === 'High' ? 'border-red-500/20' :
                initiative.priority === 'Medium' ? 'border-yellow-500/20' : 'border-green-500/20'
                }`}
        >
            <div className="flex items-start gap-3">
                {/* Drag Handle */}
                <GripVertical size={14} className="text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2" />

                {/* Avatar (Owner) */}
                <div className="shrink-0 mt-0.5">
                    <div className="w-8 h-8 rounded-full bg-navy-700 border border-white/10 flex items-center justify-center overflow-hidden">
                        {initiative.ownerExecution?.avatarUrl ? (
                            <img src={initiative.ownerExecution.avatarUrl} alt="Owner" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xs font-bold text-slate-400">
                                {initiative.ownerExecution?.firstName?.[0] || '?'}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${initiative.priority === 'High' ? 'text-red-400 bg-red-500/10' :
                            initiative.priority === 'Medium' ? 'text-yellow-400 bg-yellow-500/10' : 'text-green-400 bg-green-500/10'
                            }`}>
                            {initiative.priority}
                        </span>
                        {initiative.status === 'step5' && <span className="w-2 h-2 rounded-full bg-blue-500 block animate-pulse" title="In Execution"></span>}
                    </div>

                    <h4 className="text-sm font-semibold text-white leading-tight mb-1 truncate">{initiative.name}</h4>

                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{initiative.axis}</span>
                        {initiative.endDate && (
                            <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Clock size={10} /> {new Date(initiative.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Hover visual cue */}
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
    );
};

export const RoadmapKanban: React.FC<Props> = ({ initiatives, onUpdateInitiative, language, users, currentUser }) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [selectedInitiative, setSelectedInitiative] = useState<FullInitiative | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Group by quarter
    const containers = quarters.reduce((acc, q) => {
        acc[q] = initiatives.filter(i => i.quarter === q).map(i => i.id);
        return acc;
    }, {} as Record<string, string[]>);

    const findContainer = (id: string) => {
        if (quarters.includes(id as Quarter)) return id as Quarter;
        return initiatives.find(i => i.id === id)?.quarter;
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

        const activeInit = initiatives.find(i => i.id === active.id);
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
                    {quarters.map(quarter => (
                        <div key={quarter} className="min-w-[280px] w-[280px] bg-navy-950/50 rounded-xl border border-white/5 flex flex-col max-h-full shrink-0">
                            <div className="p-3 border-b border-white/5 flex justify-between items-center sticky top-0 bg-navy-950/80 backdrop-blur z-10 rounded-t-xl group">
                                <span className="font-bold text-sm text-slate-300">{quarter}</span>
                                <span className="text-xs bg-navy-800 px-2 py-0.5 rounded text-slate-500 group-hover:text-white transition-colors">
                                    {containers[quarter]?.length || 0}
                                </span>
                            </div>
                            <div className="p-2 flex-1 overflow-y-auto min-h-[100px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                <SortableContext
                                    id={quarter}
                                    items={containers[quarter] || []}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {containers[quarter]?.map(id => {
                                        const init = initiatives.find(i => i.id === id);
                                        return init ? (
                                            <SortableItem
                                                key={id}
                                                id={id}
                                                initiative={init}
                                                onClick={() => setSelectedInitiative(init)}
                                            />
                                        ) : null;
                                    })}
                                </SortableContext>

                                {/* Placeholder */}
                                {(containers[quarter]?.length === 0) && (
                                    <div className="h-24 border-2 border-dashed border-white/5 rounded-lg m-1 flex flex-col items-center justify-center text-xs text-slate-600 gap-2">
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
                        <div className="bg-navy-800 p-3 rounded-lg border border-blue-500 shadow-2xl opacity-90 w-[280px]">
                            {/* Simplified Drag Preview */}
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-navy-700"></div>
                                <div>
                                    <div className="h-4 w-32 bg-slate-700/50 rounded mb-2"></div>
                                    <div className="h-3 w-16 bg-slate-700/50 rounded"></div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Modal */}
            {selectedInitiative && (
                <InitiativeDetailModal
                    initiative={selectedInitiative}
                    isOpen={!!selectedInitiative}
                    onClose={() => setSelectedInitiative(null)}
                    onSave={(updated) => {
                        onUpdateInitiative(updated);
                        // Also update local selected state if still open? 
                        // Actually modal closes on save, but if we wanted to keep it open we'd update.
                        // Here we just close it.
                    }}
                    users={users}
                    currentUser={currentUser}
                    language={language}
                />
            )}
        </>
    );
};
