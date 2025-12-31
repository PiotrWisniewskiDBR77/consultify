/**
 * WorkCenter - Left panel orchestrator for unified MyWork module
 * Contains PillNavigation, QuickFilters, content area, and DecisionDetailModal
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PillNavigation, WorkTab } from './PillNavigation';
import { QuickFilterBar, QuickFilter } from './QuickFilterBar';
import { MyTasksList } from './MyTasksList';
import { DecisionsList } from './DecisionsList';
import { MyProjects } from './MyProjects';
import { DecisionDetailModal } from './DecisionDetailModal';
import { DecisionBottleneckPanel } from './DecisionBottleneckPanel';
import { TaskTimeGroup } from './WorkSidebar';
import { DecisionGroup } from './WorkSidebar';

interface WorkCenterProps {
    onTaskClick: (taskId: string) => void;
    onDecisionClick?: (decisionId: string) => void;
    onCreateTask: () => void;
    onCreateDecision?: () => void;
    onNavigateToObject?: (type: string, id: string) => void;
}

interface TaskCounts {
    total: number;
    overdue: number;
    today: number;
    week: number;
    later: number;
    noDate: number;
}

interface DecisionCounts {
    total: number;
    my: number;
    awaiting: number;
}

// Map QuickFilter to TaskTimeGroup
const filterToTimeGroup: Record<QuickFilter, TaskTimeGroup> = {
    all: 'all',
    overdue: 'overdue',
    today: 'today',
    week: 'week',
    urgent: 'all' // Urgent shows all but will filter by priority
};

export const WorkCenter: React.FC<WorkCenterProps> = ({
    onTaskClick,
    onDecisionClick,
    onCreateTask,
    onCreateDecision,
    onNavigateToObject
}) => {
    // Tab state
    const [activeTab, setActiveTab] = useState<WorkTab>('tasks');
    
    // Filter state for tasks
    const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilter>('all');
    
    // Decision modal state
    const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
    
    // Refresh trigger for decision list
    const [decisionRefreshKey, setDecisionRefreshKey] = useState(0);
    
    // Counts
    const [taskCounts, setTaskCounts] = useState<TaskCounts>({
        total: 0,
        overdue: 0,
        today: 0,
        week: 0,
        later: 0,
        noDate: 0
    });
    const [decisionCounts, setDecisionCounts] = useState<DecisionCounts>({
        total: 0,
        my: 0,
        awaiting: 0
    });
    const [urgentCount, setUrgentCount] = useState(0);

    // Memoized quick filter counts
    const quickFilterCounts = useMemo(() => ({
        overdue: taskCounts.overdue,
        today: taskCounts.today,
        week: taskCounts.week,
        urgent: urgentCount
    }), [taskCounts, urgentCount]);

    // Handle task counts update
    const handleTaskCountsChange = useCallback((counts: TaskCounts) => {
        setTaskCounts(counts);
        // TODO: Calculate urgent count from task priorities
        setUrgentCount(counts.overdue); // For now, overdue = urgent
    }, []);

    // Handle decision counts update
    const handleDecisionCountsChange = useCallback((counts: DecisionCounts) => {
        setDecisionCounts(counts);
    }, []);

    // Handle tab change
    const handleTabChange = useCallback((tab: WorkTab) => {
        setActiveTab(tab);
        // Reset quick filter when switching tabs
        if (tab !== 'tasks') {
            setActiveQuickFilter('all');
        }
    }, []);

    // Handle create new
    const handleCreateNew = useCallback(() => {
        if (activeTab === 'tasks') {
            onCreateTask();
        } else if (activeTab === 'decisions' && onCreateDecision) {
            onCreateDecision();
        }
    }, [activeTab, onCreateTask, onCreateDecision]);

    // Handle decision click - open modal
    const handleDecisionClick = useCallback((decisionId: string) => {
        setSelectedDecisionId(decisionId);
    }, []);

    // Handle modal close
    const handleModalClose = useCallback(() => {
        setSelectedDecisionId(null);
    }, []);

    // Handle decision made - refresh list
    const handleDecisionMade = useCallback(() => {
        setDecisionRefreshKey(prev => prev + 1);
    }, []);

    // Calculate active time group from quick filter
    const activeTimeGroup: TaskTimeGroup = useMemo(() => {
        return filterToTimeGroup[activeQuickFilter];
    }, [activeQuickFilter]);

    // Calculate active decision group
    const activeDecisionGroup: DecisionGroup = useMemo(() => {
        // For now, show all decisions
        return 'all';
    }, []);

    return (
        <>
            <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950">
                {/* Pill Navigation */}
                <PillNavigation
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    counts={{
                        tasks: taskCounts.total,
                        decisions: decisionCounts.total
                    }}
                    onCreateNew={handleCreateNew}
                />

                {/* Quick Filter Bar (only for tasks) */}
                <QuickFilterBar
                    activeFilter={activeQuickFilter}
                    onFilterChange={setActiveQuickFilter}
                    counts={quickFilterCounts}
                    visible={activeTab === 'tasks'}
                />

                {/* Bottleneck Panel (only for decisions tab) */}
                {activeTab === 'decisions' && (
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-white/5">
                        <DecisionBottleneckPanel
                            onDecisionClick={handleDecisionClick}
                        />
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {activeTab === 'tasks' && (
                            <motion.div
                                key="tasks"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ duration: 0.15 }}
                                className="h-full"
                            >
                                <MyTasksList
                                    activeTimeGroup={activeTimeGroup}
                                    onCountsChange={handleTaskCountsChange}
                                    onTaskClick={onTaskClick}
                                    onCreateTask={onCreateTask}
                                />
                            </motion.div>
                        )}

                        {activeTab === 'decisions' && (
                            <motion.div
                                key={`decisions-${decisionRefreshKey}`}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ duration: 0.15 }}
                                className="h-full"
                            >
                                <DecisionsList
                                    activeGroup={activeDecisionGroup}
                                    onCountsChange={handleDecisionCountsChange}
                                    onDecisionClick={handleDecisionClick}
                                    onCreateDecision={onCreateDecision}
                                />
                            </motion.div>
                        )}

                        {activeTab === 'projects' && (
                            <motion.div
                                key="projects"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ duration: 0.15 }}
                                className="h-full"
                            >
                                <MyProjects />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Decision Detail Modal */}
            {selectedDecisionId && (
                <DecisionDetailModal
                    decisionId={selectedDecisionId}
                    onClose={handleModalClose}
                    onDecisionMade={handleDecisionMade}
                    onNavigateToObject={onNavigateToObject}
                />
            )}
        </>
    );
};

export default WorkCenter;
