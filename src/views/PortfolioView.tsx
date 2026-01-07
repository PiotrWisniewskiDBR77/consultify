/**
 * Portfolio View
 *
 * Unified Portfolio & Roadmap view combining Initiative Management and Roadmap.
 * Provides 4 view modes: List, Kanban, Timeline, Matrix
 *
 * Design inspired by Monday.com UX with Planview/ServiceNow enterprise functionality.
 */

import {
    AlertTriangle,
    Briefcase,
    Calendar,
    CheckCircle2,
    ChevronDown,
    Clock,
    DollarSign,
    Download,
    Filter,
    Grid3X3,
    LayoutGrid,
    Lightbulb,
    List,
    Loader2,
    Plus,
    RefreshCw,
    Search,
    TrendingUp,
    X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { InitiativeSidePanel } from '../components/Portfolio/InitiativeSidePanel';
import { PortfolioKanbanView } from '../components/Portfolio/PortfolioKanbanView';
import { PortfolioListView } from '../components/Portfolio/PortfolioListView';
import { PortfolioMatrixView } from '../components/Portfolio/PortfolioMatrixView';
import { PortfolioTimelineView } from '../components/Portfolio/PortfolioTimelineView';
import { Api } from '@/services/api';
import { useAppStore } from '../store/useAppStore';
import { InitiativeStatus, PortfolioFilters, PortfolioInitiative, PortfolioStats, PortfolioViewMode } from '../types';

// ============================================
// VIEW MODE CONFIGURATION
// ============================================

const VIEW_MODES: { id: PortfolioViewMode; icon: React.ReactNode; label: string }[] = [
    { id: 'list', icon: <List size={18} />, label: 'List' },
    { id: 'kanban', icon: <LayoutGrid size={18} />, label: 'Kanban' },
    { id: 'timeline', icon: <Calendar size={18} />, label: 'Timeline' },
    { id: 'matrix', icon: <Grid3X3 size={18} />, label: 'Matrix' },
];

const STATUS_OPTIONS = [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'PLANNING', label: 'Planning' },
    { value: 'REVIEW', label: 'Review' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'EXECUTING', label: 'Executing' },
    { value: 'DONE', label: 'Done' },
    { value: 'BLOCKED', label: 'Blocked' },
];

const PRIORITY_OPTIONS = [
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export const PortfolioView: React.FC = () => {
    const { t } = useTranslation();
    const { currentProjectId } = useAppStore();

    // View state
    const [viewMode, setViewMode] = useState<PortfolioViewMode>('kanban');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Data state
    const [initiatives, setInitiatives] = useState<PortfolioInitiative[]>([]);
    const [stats, setStats] = useState<PortfolioStats | null>(null);
    const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

    // Filter state
    const [filters, setFilters] = useState<PortfolioFilters>({});
    const [showFilters, setShowFilters] = useState(false);

    // Side panel state
    const [selectedInitiative, setSelectedInitiative] = useState<PortfolioInitiative | null>(null);
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

    // ============================================
    // DATA FETCHING
    // ============================================

    const fetchData = useCallback(
        async (showRefreshIndicator = false) => {
            if (showRefreshIndicator) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }

            try {
                const params = new URLSearchParams();
                if (filters.projectId) params.append('projectId', filters.projectId);
                if (filters.status?.length) filters.status.forEach((s) => params.append('status', s));
                if (filters.priority?.length) filters.priority.forEach((p: any) => params.append('priority', p));
                if (filters.owner) params.append('owner', filters.owner);
                if (filters.quarter) params.append('quarter', filters.quarter);
                if (filters.search) params.append('search', filters.search);

                const response = await Api.get(`/initiatives/portfolio?${params.toString()}`);
                setInitiatives(response.initiatives || []);
                setStats(response.stats || null);

                // Extract unique projects
                const uniqueProjects = new Map<string, string>();
                (response.initiatives || []).forEach((init: PortfolioInitiative) => {
                    if (init.projectId && init.projectName) {
                        uniqueProjects.set(init.projectId, init.projectName);
                    }
                });
                setProjects(Array.from(uniqueProjects, ([id, name]) => ({ id, name })));
            } catch (error) {
                console.error('[PortfolioView] Fetch error:', error);
                toast.error('Failed to load portfolio data');
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        [filters],
    );

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ============================================
    // HANDLERS
    // ============================================

    const handleInitiativeClick = useCallback((initiative: PortfolioInitiative) => {
        setSelectedInitiative(initiative);
        setIsSidePanelOpen(true);
    }, []);

    const handleCloseSidePanel = useCallback(() => {
        setIsSidePanelOpen(false);
        setTimeout(() => setSelectedInitiative(null), 300);
    }, []);

    const handleStatusChange = useCallback(async (initiativeId: string, newStatus: InitiativeStatus) => {
        try {
            await Api.patch(`/initiatives/${initiativeId}/status`, { status: newStatus });
            setInitiatives((prev: any) => prev.map((i: any) => (i.id === initiativeId ? { ...i, status: newStatus } : i)));
            toast.success('Status updated');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to update status');
        }
    }, []);

    const handleQuickUpdate = useCallback(async (initiativeId: string, updates: Partial<PortfolioInitiative>) => {
        try {
            await Api.patch(`/initiatives/${initiativeId}/quick-update`, updates);
            setInitiatives((prev: any) => prev.map((i: any) => (i.id === initiativeId ? { ...i, ...updates } : i)));
        } catch (error: any) {
            toast.error('Failed to update');
        }
    }, []);

    const handleFilterChange = useCallback((key: keyof PortfolioFilters, value: any) => {
        setFilters((prev: any) => ({ ...prev, [key]: value }));
    }, []);

    const clearFilters = useCallback(() => {
        setFilters({});
    }, []);

    const hasActiveFilters = useMemo(() => {
        return (
            filters.projectId ||
            filters.status?.length ||
            filters.priority?.length ||
            filters.owner ||
            filters.quarter ||
            filters.search
        );
    }, [filters]);

    // ============================================
    // RENDER HELPERS
    // ============================================

    const formatCurrency = (amount: number) => {
        if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
        if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
        return `$${amount}`;
    };

    const renderStats = () => {
        if (!stats) return null;

        return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {/* Total */}
                <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                        <Briefcase size={16} className="text-slate-400" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">Total</span>
                    </div>
                    <div className="text-2xl font-bold text-navy-900 dark:text-white">{stats.total}</div>
                </div>

                {/* In Progress */}
                <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock size={16} className="text-purple-500" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">Executing</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {stats.byStatus.EXECUTING || 0}
                    </div>
                </div>

                {/* Approved */}
                <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 size={16} className="text-blue-500" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">Approved</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {stats.byStatus.APPROVED || 0}
                    </div>
                </div>

                {/* Review */}
                <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={16} className="text-yellow-500" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">In Review</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {stats.byStatus.REVIEW || 0}
                    </div>
                </div>

                {/* Blocked */}
                <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={16} className="text-red-500" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">Blocked</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.blockedCount || 0}</div>
                </div>

                {/* Total Budget */}
                <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                        <DollarSign size={16} className="text-green-500" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">Total Budget</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(stats.totalBudget || 0)}
                    </div>
                </div>
            </div>
        );
    };

    const renderFilters = () => (
        <div
            className={`overflow-hidden transition-all duration-300 ${showFilters ? 'max-h-32 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}
        >
            <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 dark:bg-navy-900/50 rounded-lg">
                {/* Project Filter */}
                {projects.length > 0 && (
                    <select
                        value={filters.projectId || ''}
                        onChange={(e) => handleFilterChange('projectId', e.target.value || undefined)}
                        className="px-3 py-1.5 text-sm bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white"
                    >
                        <option value="">All Projects</option>
                        {projects.map((p: any) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                )}

                {/* Status Filter */}
                <select
                    value={filters.status?.[0] || ''}
                    onChange={(e) => handleFilterChange('status', e.target.value ? [e.target.value] : undefined)}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white"
                >
                    <option value="">All Statuses</option>
                    {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                            {s.label}
                        </option>
                    ))}
                </select>

                {/* Priority Filter */}
                <select
                    value={filters.priority?.[0] || ''}
                    onChange={(e) => handleFilterChange('priority', e.target.value ? [e.target.value] : undefined)}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white"
                >
                    <option value="">All Priorities</option>
                    {PRIORITY_OPTIONS.map((p: any) => (
                        <option key={p.value} value={p.value}>
                            {p.label}
                        </option>
                    ))}
                </select>

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                        <X size={14} />
                        Clear
                    </button>
                )}
            </div>
        </div>
    );

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-96">
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
            );
        }

        if (initiatives.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-96 text-center">
                    <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center mb-4">
                        <Briefcase className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-navy-900 dark:text-white mb-2">No initiatives yet</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md">
                        Create your first initiative or generate from assessment to start building your portfolio.
                    </p>
                    <button className="mt-6 flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors">
                        <Plus size={18} />
                        New Initiative
                    </button>
                </div>
            );
        }

        switch (viewMode) {
            case 'list':
                return (
                    <PortfolioListView
                        initiatives={initiatives}
                        onInitiativeClick={handleInitiativeClick}
                        onStatusChange={handleStatusChange}
                        onQuickUpdate={handleQuickUpdate}
                    />
                );
            case 'kanban':
                return (
                    <PortfolioKanbanView
                        initiatives={initiatives}
                        onInitiativeClick={handleInitiativeClick}
                        onStatusChange={handleStatusChange}
                    />
                );
            case 'timeline':
                return (
                    <PortfolioTimelineView
                        initiatives={initiatives}
                        onInitiativeClick={handleInitiativeClick}
                        projectId={filters.projectId || currentProjectId || undefined}
                    />
                );
            case 'matrix':
                return <PortfolioMatrixView initiatives={initiatives} onInitiativeClick={handleInitiativeClick} />;
            default:
                return null;
        }
    };

    // ============================================
    // MAIN RENDER
    // ============================================

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-white/10">
                {/* Title Row */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-navy-900 dark:text-white flex items-center gap-3">
                            <Lightbulb className="text-purple-500" />
                            {t('sidebar.portfolioRoadmap', 'Initiatives')}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {t('portfolio.subtitle', 'Manage initiatives from idea to execution')}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchData(true)}
                            disabled={isRefreshing}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                            <Download size={18} />
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors">
                            <Plus size={18} />
                            New Initiative
                        </button>
                    </div>
                </div>

                {/* Controls Row */}
                <div className="flex items-center justify-between">
                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-950 rounded-lg p-1">
                        {VIEW_MODES.map((mode) => (
                            <button
                                key={mode.id}
                                onClick={() => setViewMode(mode.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    viewMode === mode.id
                                        ? 'bg-white dark:bg-navy-800 text-purple-600 dark:text-purple-400 shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                {mode.icon}
                                <span className="hidden sm:inline">{mode.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Search & Filter */}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                value={filters.search || ''}
                                onChange={(e) => handleFilterChange('search', e.target.value || undefined)}
                                placeholder="Search initiatives..."
                                className="w-64 pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                showFilters || hasActiveFilters
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
                            }`}
                        >
                            <Filter size={16} />
                            Filters
                            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-purple-500" />}
                            <ChevronDown
                                size={14}
                                className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}
                            />
                        </button>
                    </div>
                </div>

                {/* Expandable Filters */}
                {renderFilters()}
            </div>

            {/* Stats Row */}
            <div className="shrink-0 px-6 py-4">{renderStats()}</div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden px-6 pb-6">
                <div className="h-full bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    {renderContent()}
                </div>
            </div>

            {/* Side Panel */}
            <InitiativeSidePanel
                initiative={selectedInitiative}
                isOpen={isSidePanelOpen}
                onClose={handleCloseSidePanel}
                onUpdate={(updated) => {
                    setInitiatives((prev: any) => prev.map((i: any) => (i.id === updated.id ? updated : i)));
                }}
            />
        </div>
    );
};

export default PortfolioView;
