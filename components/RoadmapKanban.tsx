import React from 'react';
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
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FullInitiative, Quarter, Language } from '../types';
import { translations } from '../translations';
import { GripVertical } from 'lucide-react';

interface Props {
    initiatives: FullInitiative[];
    onUpdateInitiative: (init: FullInitiative) => void;
    language: Language;
}

const quarters: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];

const SortableItem: React.FC<{ id: string, initiative: FullInitiative }> = ({ id, initiative }) => {
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
            className={`bg-navy-800 p-3 rounded mb-2 border hover:border-blue-500/50 group cursor-grab active:cursor-grabbing shadow-sm ${initiative.priority === 'High' ? 'border-red-500/20' :
                initiative.priority === 'Medium' ? 'border-yellow-500/20' : 'border-green-500/20'
                }`}
        >
            <div className="flex items-start gap-2">
                <GripVertical size={14} className="text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div>
                    <div className="text-xs font-semibold text-white leading-tight">{initiative.name}</div>
                    <div className="flex gap-2 mt-1.5">
                        <span className={`text-[10px] px-1 rounded ${initiative.priority === 'High' ? 'text-red-400 bg-red-500/10' :
                            initiative.priority === 'Medium' ? 'text-yellow-400 bg-yellow-500/10' : 'text-green-400 bg-green-500/10'
                            }`}>
                            {initiative.priority}
                        </span>
                        <span className="text-[10px] text-slate-500">{initiative.axis}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const RoadmapKanban: React.FC<Props> = ({ initiatives, onUpdateInitiative, language }) => {
    const [activeId, setActiveId] = React.useState<string | null>(null);

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
        const { active, over } = event;
        if (!over) return;

        // Note: We don't need complex array logic here because we just updated the 'quarter' property
        // and let React re-render the groups. 
        // However, for smooth DnD, dnd-kit expects controlled state. 
        // Since our state is "Initiative Objects", changing quarter is enough.
        // But visual feedback might lag if we only update on Drop.
        // For simplicity in this iteration, we'll update on Drop.
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeInit = initiatives.find(i => i.id === active.id);
        const overContainer = findContainer(over.id as string); // Could be Quarter ID or Item ID

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
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 overflow-x-auto pb-4 h-full items-start">
                {quarters.map(quarter => (
                    <div key={quarter} className="min-w-[250px] bg-navy-950/50 rounded-xl border border-white/5 flex flex-col max-h-full">
                        <div className="p-3 border-b border-white/5 flex justify-between items-center sticky top-0 bg-navy-950/80 backdrop-blur z-10 rounded-t-xl">
                            <span className="font-bold text-sm text-slate-300">{quarter}</span>
                            <span className="text-xs bg-navy-800 px-2 py-0.5 rounded text-slate-500">
                                {containers[quarter]?.length || 0}
                            </span>
                        </div>
                        <div className="p-2 flex-1 overflow-y-auto min-h-[100px]">
                            <SortableContext
                                id={quarter}
                                items={containers[quarter] || []}
                                strategy={verticalListSortingStrategy}
                            >
                                {containers[quarter]?.map(id => {
                                    const init = initiatives.find(i => i.id === id);
                                    return init ? <SortableItem key={id} id={id} initiative={init} /> : null;
                                })}
                            </SortableContext>

                            {/* Placeholder for empty columns to be droppable */}
                            {(containers[quarter]?.length === 0) && (
                                <div className="h-20 border-2 border-dashed border-white/5 rounded m-2 flex items-center justify-center text-xs text-slate-600">
                                    Drop here
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <DragOverlay dropAnimation={dropAnimation}>
                {activeId ? (
                    <div className="bg-navy-800 p-3 rounded mb-2 border border-blue-500 shadow-xl opacity-90 w-[230px]">
                        <div className="flex items-start gap-2">
                            <GripVertical size={14} className="text-slate-600 mt-1" />
                            <div>
                                <div className="text-xs font-semibold text-white leading-tight">
                                    {initiatives.find(i => i.id === activeId)?.name}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
