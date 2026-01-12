/**
 * RoadmapGantt
 *
 * Strategic Roadmap Gantt Chart with:
 * - Drag-and-drop to move initiatives
 * - Resize handles to adjust duration
 * - Dependency visualization (arrows)
 * - Full-screen mode
 * - Zoom levels (Month/Quarter/Year)
 * - Status indicators
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertTriangle,
    ArrowRight,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Filter,
    GripVertical,
    Link,
    Maximize2,
    Minimize2,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { Initiative, InitiativeStatus } from '../types/domain';
import { StatusTransitionDropdown } from './PMO/StatusTransitionDropdown';

type Quarter = string;

interface FullInitiative extends Initiative {
    axis: string;
    quarter?: string;
    plannedStartDate?: string;
    plannedEndDate?: string;
    dependencies?: any[];
    name: string;
}

interface RoadmapGanttProps {
    initiatives: FullInitiative[];
    onUpdateInitiative: (initiative: FullInitiative) => void;
    onInitiativeClick?: (initiative: FullInitiative) => void;
    onCreateDependency?: (fromId: string, toId: string, type: 'FINISH_TO_START' | 'START_TO_START') => void;
}

interface GanttInitiative extends Omit<FullInitiative, 'status'> {
    status: string;
}

type ZoomLevel = 'month' | 'quarter' | 'year';

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];

// Generate months for the timeline
const generateMonths = (startYear: number, numMonths: number) => {
    const months = [];
    let year = startYear;
    let month = 0; // January

    for (let i = 0; i < numMonths; i++) {
        months.push({
            index: i,
            month,
            year,
            label: new Date(year, month).toLocaleDateString('pl-PL', { month: 'short' }),
            fullLabel: new Date(year, month).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' }),
        });
        month++;
        if (month > 11) {
            month = 0;
            year++;
        }
    }
    return months;
};

// Axis colors
const AXIS_COLORS: Record<string, string> = {
    processes: 'bg-blue-500',
    digitalProducts: 'bg-purple-500',
    dataManagement: 'bg-cyan-500',
    culture: 'bg-amber-500',
    aiMaturity: 'bg-emerald-500',
    businessModels: 'bg-indigo-500',
    cybersecurity: 'bg-red-500',
};

// Status colors
const STATUS_COLORS: Record<string, string> = {
    approved: 'border-l-4 border-l-green-500',
    active: 'border-l-4 border-l-purple-500',
    on_hold: 'border-l-4 border-l-red-500 animate-pulse',
    // Legacy support
    APPROVED: 'border-l-4 border-l-green-500',
    EXECUTING: 'border-l-4 border-l-purple-500',
    BLOCKED: 'border-l-4 border-l-red-500 animate-pulse',
};

export const RoadmapGantt: React.FC<RoadmapGanttProps> = ({
    initiatives,
    onUpdateInitiative,
    onInitiativeClick,
    onCreateDependency,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('quarter');
    const [activeDrag, setActiveDrag] = useState<string | null>(null);
    const [resizing, setResizing] = useState<{ id: string; edge: 'start' | 'end' } | null>(null);
    const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [hoveredInitiative, setHoveredInitiative] = useState<string | null>(null);

    // Timeline configuration
    const currentYear = new Date().getFullYear();
    const months = useMemo(() => generateMonths(currentYear, 24), [currentYear]); // 2 years

    // Calculate cell width based on zoom
    const cellWidth = useMemo(() => {
        switch (zoomLevel) {
            case 'month':
                return 100;
            case 'quarter':
                return 300;
            case 'year':
                return 600;
            default:
                return 100;
        }
    }, [zoomLevel]);

    // Calculate positions based on dates or quarters
    const getInitiativePosition = useCallback(
        (init: GanttInitiative) => {
            // Try dates first
            if (init.plannedStartDate && init.plannedEndDate) {
                const startDate = new Date(init.plannedStartDate);
                const endDate = new Date(init.plannedEndDate);
                const startMonth = (startDate.getFullYear() - currentYear) * 12 + startDate.getMonth();
                const endMonth = (endDate.getFullYear() - currentYear) * 12 + endDate.getMonth();

                return {
                    left: startMonth * cellWidth,
                    width: Math.max((endMonth - startMonth + 1) * cellWidth, cellWidth),
                };
            }

            // Fall back to quarter
            const quarterIndex = QUARTERS.indexOf(init.quarter || 'Q1');
            const monthIndex = quarterIndex * 3;

            return {
                left: monthIndex * cellWidth,
                width: cellWidth * 3, // Default 3 months
            };
        },
        [cellWidth, currentYear],
    );

    // Handle drag end
    const handleDragEnd = useCallback(
        (init: GanttInitiative, info: any) => {
            setActiveDrag(null);
            if (!timelineRef.current) return;

            const bounds = timelineRef.current.getBoundingClientRect();
            const pixelsPerMonth = cellWidth;
            const monthsMoved = Math.round(info.offset.x / pixelsPerMonth);

            if (monthsMoved === 0) return;

            // Calculate new dates
            const currentStart = init.plannedStartDate
                ? new Date(init.plannedStartDate)
                : new Date(currentYear, QUARTERS.indexOf(init.quarter || 'Q1') * 3, 1);
            const currentEnd = init.plannedEndDate
                ? new Date(init.plannedEndDate)
                : new Date(currentStart.getTime() + 90 * 24 * 60 * 60 * 1000);

            currentStart.setMonth(currentStart.getMonth() + monthsMoved);
            currentEnd.setMonth(currentEnd.getMonth() + monthsMoved);

            onUpdateInitiative({
                ...(init as any),
                ...init,
                plannedStartDate: currentStart.toISOString(),
                plannedEndDate: currentEnd.toISOString(),
            });

            toast.success('Initiative moved');
        },
        [cellWidth, currentYear, onUpdateInitiative],
    );

    // Handle resize
    const handleResize = useCallback(
        (init: GanttInitiative, deltaX: number, edge: 'start' | 'end') => {
            const monthsDelta = Math.round(deltaX / cellWidth);
            if (monthsDelta === 0) return;

            const currentStart = init.plannedStartDate
                ? new Date(init.plannedStartDate)
                : new Date(currentYear, QUARTERS.indexOf(init.quarter || 'Q1') * 3, 1);
            const currentEnd = init.plannedEndDate
                ? new Date(init.plannedEndDate)
                : new Date(currentStart.getTime() + 90 * 24 * 60 * 60 * 1000);

            if (edge === 'start') {
                currentStart.setMonth(currentStart.getMonth() + monthsDelta);
                if (currentStart >= currentEnd) return; // Prevent invalid range
            } else {
                currentEnd.setMonth(currentEnd.getMonth() + monthsDelta);
                if (currentEnd <= currentStart) return;
            }

            onUpdateInitiative({
                ...(init as any),
                ...init,
                plannedStartDate: currentStart.toISOString(),
                plannedEndDate: currentEnd.toISOString(),
            });
        },
        [cellWidth, currentYear, onUpdateInitiative],
    );

    // Handle dependency creation
    const handleLinkClick = useCallback(
        (initiativeId: string) => {
            if (!linkingFrom) {
                setLinkingFrom(initiativeId);
                toast('Click another initiative to create dependency', { icon: '🔗' });
            } else if (linkingFrom !== initiativeId) {
                onCreateDependency?.(linkingFrom, initiativeId, 'FINISH_TO_START');
                setLinkingFrom(null);
                toast.success('Dependency created');
            } else {
                setLinkingFrom(null);
            }
        },
        [linkingFrom, onCreateDependency],
    );

    // Toggle fullscreen
    const toggleFullscreen = useCallback(() => {
        setIsFullscreen((prev) => !prev);
    }, []);

    // Scroll handlers
    const scrollLeft = () => setScrollOffset((prev) => Math.max(0, prev - cellWidth * 3));
    const scrollRight = () => setScrollOffset((prev) => prev + cellWidth * 3);

    // Group by timeline columns
    const timelineGroups = useMemo(() => {
        if (zoomLevel === 'month') {
            return months;
        } else if (zoomLevel === 'quarter') {
            const quarters = [];
            for (let i = 0; i < months.length; i += 3) {
                const q = (Math.floor(i / 3) % 4) + 1;
                const year = months[i].year;
                quarters.push({
                    index: i / 3,
                    label: `Q${q}`,
                    fullLabel: `Q${q} ${year}`,
                    width: cellWidth,
                });
            }
            return quarters;
        }
        return months;
    }, [months, zoomLevel, cellWidth]);

    return (
        <div
            className={`flex flex-col bg-white dark:bg-navy-950 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm ${
                isFullscreen ? 'fixed inset-4 z-50' : 'h-full'
            }`}
        >
            {/* Toolbar */}
            <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-navy-900 dark:text-white">Strategic Roadmap</h3>
                    <span className="text-xs text-slate-500">{initiatives.length} initiatives</span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Zoom Controls */}
                    <div className="flex items-center bg-white dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-white/10 p-0.5">
                        <button
                            onClick={() => setZoomLevel('month')}
                            className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                zoomLevel === 'month'
                                    ? 'bg-purple-600 text-white'
                                    : 'text-slate-600 dark:text-slate-400'
                            }`}
                        >
                            Month
                        </button>
                        <button
                            onClick={() => setZoomLevel('quarter')}
                            className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                zoomLevel === 'quarter'
                                    ? 'bg-purple-600 text-white'
                                    : 'text-slate-600 dark:text-slate-400'
                            }`}
                        >
                            Quarter
                        </button>
                    </div>

                    {/* Scroll Controls */}
                    <button
                        onClick={scrollLeft}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        onClick={scrollRight}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                    >
                        <ChevronRight size={16} />
                    </button>

                    {/* Fullscreen Toggle */}
                    <button
                        onClick={toggleFullscreen}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                </div>
            </div>

            {/* Header Row */}
            <div className="flex border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-navy-900">
                <div className="w-72 min-w-[288px] p-3 font-bold text-xs uppercase text-slate-500 border-r border-slate-200 dark:border-white/5 shrink-0">
                    Initiative
                </div>
                <div className="flex-1 overflow-hidden" style={{ transform: `translateX(-${scrollOffset}px)` }}>
                    <div className="flex" style={{ width: timelineGroups.length * cellWidth }}>
                        {timelineGroups.map((group: any, idx) => (
                            <div
                                key={idx}
                                className="border-r border-slate-200 dark:border-white/5 last:border-r-0 p-2 text-center"
                                style={{ width: cellWidth }}
                            >
                                <span className="font-bold text-xs text-slate-500 whitespace-nowrap">
                                    {group.fullLabel || group.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
                {initiatives.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-slate-400 dark:text-slate-500">
                        <div className="text-center">
                            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p>No approved initiatives on roadmap</p>
                            <p className="text-sm">Approve initiatives to add them here</p>
                        </div>
                    </div>
                ) : (
                    initiatives.map((init: GanttInitiative) => {
                        const position = getInitiativePosition(init);
                        const barColor = AXIS_COLORS[init.axis] || 'bg-slate-500';
                        const statusBorder = STATUS_COLORS[init.status || ''] || '';
                        const isActive = activeDrag === init.id || hoveredInitiative === init.id;
                        const isLinking = linkingFrom === init.id;

                        return (
                            <div
                                key={init.id}
                                className={`flex border-b border-slate-100 dark:border-white/5 group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors ${
                                    isLinking ? 'bg-purple-50 dark:bg-purple-900/10' : ''
                                }`}
                            >
                                {/* Info Column */}
                                <div
                                    className="w-72 min-w-[288px] p-3 text-sm border-r border-slate-200 dark:border-white/5 z-10 bg-inherit relative shrink-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5"
                                    onClick={() => onInitiativeClick?.(init as FullInitiative)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${barColor}`} />
                                        <div
                                            className="font-semibold text-navy-900 dark:text-white truncate flex-1"
                                            title={init.name}
                                        >
                                            {init.name}
                                        </div>
                                        {onCreateDependency && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleLinkClick(init.id);
                                                }}
                                                className={`p-1 rounded transition-colors ${
                                                    isLinking
                                                        ? 'bg-purple-600 text-white'
                                                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10'
                                                }`}
                                                title="Create dependency"
                                            >
                                                <Link size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                                        <span className="capitalize">{init.axis}</span>
                                        <span>•</span>
                                        <span
                                            className={`px-1.5 py-0.5 rounded ${
                                                init.priority === 'high' || init.priority === 'critical'
                                                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                            }`}
                                        >
                                            {init.priority}
                                        </span>
                                        {(init.status === 'BLOCKED' || init.status === 'on_hold') && (
                                            <AlertTriangle size={10} className="text-red-500" />
                                        )}
                                    </div>
                                </div>

                                {/* Timeline Container */}
                                <div
                                    ref={(idx) => {
                                        if (init.id === initiatives[0]?.id) timelineRef.current = idx as any;
                                    }}
                                    className="flex-1 relative h-20 overflow-hidden"
                                    style={{ transform: `translateX(-${scrollOffset}px)` }}
                                >
                                    {/* Background Grid Lines */}
                                    <div
                                        className="absolute inset-0 flex pointer-events-none"
                                        style={{ width: timelineGroups.length * cellWidth }}
                                    >
                                        {timelineGroups.map((_: any, idx: number) => (
                                            <div
                                                key={idx}
                                                className="border-r border-slate-100 dark:border-white/5 last:border-r-0"
                                                style={{ width: cellWidth }}
                                            />
                                        ))}
                                    </div>

                                    {/* Draggable Bar */}
                                    <motion.div
                                        drag="x"
                                        dragMomentum={false}
                                        dragElastic={0}
                                        dragConstraints={{
                                            left: 0,
                                            right: timelineGroups.length * cellWidth - position.width,
                                        }}
                                        style={{
                                            position: 'absolute',
                                            left: position.left,
                                            width: position.width,
                                            top: '20%',
                                            bottom: '20%',
                                            zIndex: isActive ? 50 : 10,
                                        }}
                                        onDragStart={() => setActiveDrag(init.id)}
                                        onDragEnd={(e, info) => handleDragEnd(init, info)}
                                        onHoverStart={() => setHoveredInitiative(init.id)}
                                        onHoverEnd={() => setHoveredInitiative(null)}
                                        className={`rounded-lg shadow-md cursor-grab active:cursor-grabbing flex items-center text-white ${barColor} ${statusBorder} text-xs font-medium overflow-hidden ${
                                            isActive ? 'ring-2 ring-white ring-offset-2' : ''
                                        }`}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                    >
                                        {/* Resize Handle Start */}
                                        <div
                                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setResizing({ id: init.id, edge: 'start' });
                                            }}
                                        >
                                            <div className="w-0.5 h-4 bg-white/50 rounded" />
                                        </div>

                                        {/* Content */}
                                        <div className="flex items-center gap-1 px-3 flex-1 min-w-0">
                                            <GripVertical size={12} className="opacity-50 shrink-0" />
                                            <span className="truncate">{init.name}</span>
                                        </div>

                                        {/* Resize Handle End */}
                                        <div
                                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setResizing({ id: init.id, edge: 'end' });
                                            }}
                                        >
                                            <div className="w-0.5 h-4 bg-white/50 rounded" />
                                        </div>
                                    </motion.div>

                                    {/* Dependency Arrows - simplified visualization */}
                                    {init.dependencies?.map((dep: any) => {
                                        const depInit = initiatives.find((i) => i.id === dep.initiativeId);
                                        if (!depInit) return null;
                                        const depPos = getInitiativePosition(depInit as GanttInitiative);

                                        return (
                                            <svg
                                                key={dep.initiativeId}
                                                className="absolute pointer-events-none"
                                                style={{
                                                    left: depPos.left + depPos.width,
                                                    top: '50%',
                                                    width: position.left - (depPos.left + depPos.width),
                                                    height: 20,
                                                    transform: 'translateY(-50%)',
                                                }}
                                            >
                                                <line
                                                    x1="0"
                                                    y1="10"
                                                    x2="100%"
                                                    y2="10"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeDasharray="4 2"
                                                    className="text-slate-300 dark:text-slate-600"
                                                />
                                                <polygon
                                                    points="100,5 90,10 100,15"
                                                    fill="currentColor"
                                                    className="text-slate-400 dark:text-slate-500"
                                                />
                                            </svg>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer with legend */}
            <div className="shrink-0 px-4 py-2 bg-slate-50 dark:bg-navy-900 border-t border-slate-200 dark:border-white/5 flex items-center gap-4 text-xs text-slate-500">
                <span className="font-medium">Legend:</span>
                {Object.entries(AXIS_COLORS)
                    .slice(0, 5)
                    .map(([axis, color]) => (
                        <div key={axis} className="flex items-center gap-1.5">
                            <div className={`w-3 h-3 rounded ${color}`} />
                            <span className="capitalize">{axis.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                    ))}
            </div>

            {/* Fullscreen overlay */}
            {isFullscreen && <div className="fixed inset-0 bg-black/50 -z-10" onClick={toggleFullscreen} />}
        </div>
    );
};

export default RoadmapGantt;
