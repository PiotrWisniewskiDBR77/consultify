import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FullInitiative, Quarter } from '../types';

import { GripVertical } from 'lucide-react';

interface RoadmapGanttProps {
    initiatives: FullInitiative[];
    onUpdateInitiative: (initiative: FullInitiative) => void;

}

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];

export const RoadmapGantt: React.FC<RoadmapGanttProps> = ({
    initiatives,
    onUpdateInitiative,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeDrag, setActiveDrag] = useState<string | null>(null);

    // Calculate grid layout
    // We'll use a CSS grid for the timeline

     
    const handleDragEnd = (init: FullInitiative, info: any) => {
        setActiveDrag(null);
        if (!containerRef.current) return;

        // Simple logic: Divide width by 8 to find drop column
        // The draggable area width
        const bounds = containerRef.current.getBoundingClientRect();
        const colWidth = bounds.width / 8;

        // Relative position of drag
        // info.point.x is page relative. We need relative to container.
        // Actually, simpler: framer's dragConstraints might help, but we need to snap.
        // Let's use the offset. 

        // Correct approach with Framer Motion for this is tricky without specific "drop zones".
        // Instead we interpret the final X position.

        // current X offset from start
        const x = info.offset.x;

        // Calculate new index
        const currentQIdx = QUARTERS.indexOf(init.quarter || 'Q1');
        const moveCols = Math.round(x / colWidth);

        let newIdx = currentQIdx + moveCols;
        if (newIdx < 0) newIdx = 0;
        if (newIdx > 7) newIdx = 7;

        const newQuarter = QUARTERS[newIdx];

        if (newQuarter !== init.quarter) {
            onUpdateInitiative({ ...init, quarter: newQuarter });
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-navy-950 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
            {/* Header Row */}
            <div className="flex border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-navy-900">
                <div className="w-1/4 min-w-[250px] p-4 font-bold text-xs uppercase text-slate-500 border-r border-slate-200 dark:border-white/5">
                    Initiative
                </div>
                <div className="flex-1 flex" ref={containerRef}>
                    {QUARTERS.map(q => (
                        <div key={q} className="flex-1 p-2 text-center border-r border-slate-200 dark:border-white/5 last:border-r-0 font-bold text-xs text-slate-500">
                            {q}
                        </div>
                    ))}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
                {initiatives.map(init => {
                    const currentQIdx = QUARTERS.indexOf(init.quarter || 'Q1');
                    const colWidthPercent = 100 / 8;
                    const leftPercent = currentQIdx * colWidthPercent;

                    // Color based on Axis or Priority
                    const axisColors: Record<string, string> = {
                        processes: 'bg-blue-500',
                        digitalProducts: 'bg-purple-500',
                        dataManagement: 'bg-cyan-500',
                        culture: 'bg-amber-500',
                        aiMaturity: 'bg-emerald-500',
                        businessModels: 'bg-indigo-500',
                        cybersecurity: 'bg-red-500'
                    };
                    const barColor = axisColors[init.axis] || 'bg-slate-500';

                    return (
                        <div key={init.id} className="flex border-b border-slate-100 dark:border-white/5 group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            {/* Info Column */}
                            <div className="w-1/4 min-w-[250px] p-3 text-sm border-r border-slate-200 dark:border-white/5 z-10 bg-inherit relative">
                                <div className="font-semibold text-navy-900 dark:text-white truncate" title={init.name}>
                                    {init.name}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
                                    <span>{init.axis}</span>
                                    <span className={`px-1.5 py-0.5 rounded ${init.priority === 'High' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{init.priority}</span>
                                </div>
                            </div>

                            {/* Timeline Columns Container */}
                            <div className="flex-1 relative h-16">
                                {/* Background Grid Lines */}
                                <div className="absolute inset-0 flex pointer-events-none">
                                    {QUARTERS.map(q => (
                                        <div key={q} className="flex-1 border-r border-slate-100 dark:border-white/5 last:border-r-0"></div>
                                    ))}
                                </div>

                                {/* Draggable Bar */}
                                <motion.div
                                    drag="x"
                                    dragMomentum={false}
                                    dragElastic={0.1}
                                    // Using a fixed layout width percentage for positioning initially
                                    // Framer needs absolute to drag effectively across the container
                                    style={{
                                        position: 'absolute',
                                        left: `${leftPercent}%`,
                                        width: `${colWidthPercent}%`,
                                        top: '15%',
                                        bottom: '15%',
                                        zIndex: activeDrag === init.id ? 50 : 10
                                    }}
                                    onDragStart={() => setActiveDrag(init.id)}
                                    onDragEnd={(e, info) => handleDragEnd(init, info)}
                                    className={`rounded-md shadow-md cursor-grab active:cursor-grabbing flex items-center px-2 text-white ${barColor} text-xs font-bold overflow-hidden whitespace-nowrap`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <GripVertical size={14} className="mr-1 opacity-50" />
                                    <span className="truncate">{init.name}</span>
                                </motion.div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
