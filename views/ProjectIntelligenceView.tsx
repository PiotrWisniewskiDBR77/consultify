/**
 * ProjectIntelligenceView
 * 
 * Project Intelligence Hub - AI-powered knowledge capture
 * Captures and organizes project knowledge through structured interviews
 * 
 * Features:
 * - AI Chat for structured knowledge capture
 * - Knowledge categories with PMO domain mapping
 * - Interview sessions with progress tracking
 * - Auto-detection of insights from conversations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Brain,
    Target,
    Users,
    AlertTriangle,
    FileQuestion,
    Lock,
    GitBranch,
    CheckCircle,
    MessageSquare,
    BookOpen,
    History,
    Plus,
    RefreshCw,
    Loader2,
    ChevronRight,
    Sparkles,
    X,
    Check,
    Edit2,
    Trash2,
    Link2
} from 'lucide-react';
import { SplitLayout } from '../components/SplitLayout';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import toast from 'react-hot-toast';
import { 
    InsightCategory, 
    ProjectInsight, 
    InterviewSession,
    InsightCategoryConfig,
    PMODomainId 
} from '../types';

// Category configuration with icons and colors
const CATEGORY_CONFIG: Record<InsightCategory, InsightCategoryConfig> = {
    objective: {
        id: 'objective',
        label: 'Objectives',
        icon: 'Target',
        color: 'emerald',
        pmoDomain: PMODomainId.BENEFITS_REALIZATION,
        description: 'Project goals and expected outcomes'
    },
    stakeholder: {
        id: 'stakeholder',
        label: 'Stakeholders',
        icon: 'Users',
        color: 'purple',
        pmoDomain: PMODomainId.RESOURCE_RESPONSIBILITY,
        description: 'Key people and their roles'
    },
    risk: {
        id: 'risk',
        label: 'Risks',
        icon: 'AlertTriangle',
        color: 'amber',
        pmoDomain: PMODomainId.RISK_ISSUE_MANAGEMENT,
        description: 'Potential problems and mitigations'
    },
    assumption: {
        id: 'assumption',
        label: 'Assumptions',
        icon: 'FileQuestion',
        color: 'sky',
        pmoDomain: PMODomainId.SCOPE_CHANGE_CONTROL,
        description: 'Things assumed to be true'
    },
    constraint: {
        id: 'constraint',
        label: 'Constraints',
        icon: 'Lock',
        color: 'rose',
        pmoDomain: PMODomainId.SCOPE_CHANGE_CONTROL,
        description: 'Limitations and boundaries'
    },
    decision: {
        id: 'decision',
        label: 'Decisions',
        icon: 'CheckCircle',
        color: 'indigo',
        pmoDomain: PMODomainId.GOVERNANCE_DECISION_MAKING,
        description: 'Key decisions made'
    },
    dependency: {
        id: 'dependency',
        label: 'Dependencies',
        icon: 'GitBranch',
        color: 'orange',
        pmoDomain: PMODomainId.SCHEDULE_MILESTONES,
        description: 'External dependencies'
    },
    success_criteria: {
        id: 'success_criteria',
        label: 'Success Criteria',
        icon: 'CheckCircle',
        color: 'teal',
        pmoDomain: PMODomainId.PERFORMANCE_MONITORING,
        description: 'How success is measured'
    }
};

// Get icon component by name
const getCategoryIcon = (iconName: string, size = 16) => {
    const icons: Record<string, React.ReactNode> = {
        Target: <Target size={size} />,
        Users: <Users size={size} />,
        AlertTriangle: <AlertTriangle size={size} />,
        FileQuestion: <FileQuestion size={size} />,
        Lock: <Lock size={size} />,
        CheckCircle: <CheckCircle size={size} />,
        GitBranch: <GitBranch size={size} />,
    };
    return icons[iconName] || <Target size={size} />;
};

// Color classes for categories
const getColorClasses = (color: string) => ({
    bg: `bg-${color}-100 dark:bg-${color}-900/30`,
    text: `text-${color}-600 dark:text-${color}-400`,
    border: `border-${color}-200 dark:border-${color}-800`,
    badge: `bg-${color}-500/20 text-${color}-600 dark:text-${color}-400`
});

type TabType = 'interview' | 'knowledge' | 'sessions';

export const ProjectIntelligenceView: React.FC = () => {
    const { t } = useTranslation();
    const { currentProjectId, isChatCollapsed, toggleChatCollapse, setCurrentProjectId } = useAppStore();
    
    const [activeTab, setActiveTab] = useState<TabType>('knowledge');
    const [insights, setInsights] = useState<ProjectInsight[]>([]);
    const [sessions, setSessions] = useState<InterviewSession[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<InsightCategory | null>(null);
    const [selectedInsight, setSelectedInsight] = useState<ProjectInsight | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newInsightCategory, setNewInsightCategory] = useState<InsightCategory>('objective');
    const [newInsightTitle, setNewInsightTitle] = useState('');
    const [newInsightContent, setNewInsightContent] = useState('');
    const [availableProjects, setAvailableProjects] = useState<Array<{ id: string; name: string }>>([]);

    // Expand chat if collapsed on mount
    useEffect(() => {
        if (isChatCollapsed) {
            toggleChatCollapse();
        }
    }, []); // Run only on mount

    // Auto-detect and set project if none selected
    useEffect(() => {
        const fetchAndSetProject = async () => {
            if (!currentProjectId) {
                try {
                    const response = await Api.get('/projects');
                    const projects = response.projects || response || [];
                    if (Array.isArray(projects) && projects.length > 0) {
                        setAvailableProjects(projects.map((p: any) => ({ id: p.id, name: p.name })));
                        // Auto-select the first project
                        setCurrentProjectId(projects[0].id);
                        console.log('[ProjectIntelligence] Auto-selected project:', projects[0].name);
                    }
                } catch (err) {
                    console.error('[ProjectIntelligence] Could not fetch projects:', err);
                }
            }
        };
        fetchAndSetProject();
    }, [currentProjectId, setCurrentProjectId]);

    // Fetch insights for the current project
    const fetchInsights = useCallback(async () => {
        if (!currentProjectId) {
            setInsights([]);
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        try {
            const response = await Api.get(`/intelligence/projects/${currentProjectId}/insights`);
            setInsights(response.insights || []);
        } catch (err) {
            console.error('[ProjectIntelligence] Error fetching insights:', err);
            setInsights([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentProjectId]);

    // Fetch sessions for the current project
    const fetchSessions = useCallback(async () => {
        if (!currentProjectId) {
            setSessions([]);
            return;
        }
        
        try {
            const response = await Api.get(`/intelligence/projects/${currentProjectId}/sessions`);
            setSessions(response.sessions || []);
        } catch (err) {
            console.error('[ProjectIntelligence] Error fetching sessions:', err);
            setSessions([]);
        }
    }, [currentProjectId]);

    // Seed sample data
    const handleSeedData = async () => {
        if (!currentProjectId) {
            toast.error('Please select a project first');
            return;
        }
        
        setIsSeeding(true);
        try {
            await Api.post(`/intelligence/projects/${currentProjectId}/seed`, {});
            toast.success('Sample data created!');
            fetchInsights();
            fetchSessions();
        } catch (err) {
            console.error('[ProjectIntelligence] Seed error:', err);
            toast.error('Failed to create sample data');
        } finally {
            setIsSeeding(false);
        }
    };

    useEffect(() => {
        fetchInsights();
        fetchSessions();
    }, [fetchInsights, fetchSessions]);

    // Calculate category counts
    const categoryCounts = insights.reduce((acc, insight) => {
        acc[insight.category] = (acc[insight.category] || 0) + 1;
        return acc;
    }, {} as Record<InsightCategory, number>);

    // Filter insights by selected category
    const filteredInsights = selectedCategory 
        ? insights.filter(i => i.category === selectedCategory)
        : insights;

    // Handle adding new insight
    const handleAddInsight = async () => {
        if (!currentProjectId || !newInsightTitle.trim()) {
            toast.error('Title is required');
            return;
        }

        try {
            const response = await Api.post(`/intelligence/projects/${currentProjectId}/insights`, {
                category: newInsightCategory,
                title: newInsightTitle,
                content: { description: newInsightContent },
                status: 'confirmed'
            });

            setInsights(prev => [response, ...prev]);
            setShowAddModal(false);
            setNewInsightTitle('');
            setNewInsightContent('');
            toast.success('Insight added');
        } catch (err) {
            toast.error('Failed to add insight');
        }
    };

    // Handle deleting insight
    const handleDeleteInsight = async (insightId: string) => {
        if (!confirm('Are you sure you want to delete this insight?')) return;

        try {
            await Api.delete(`/intelligence/insights/${insightId}`);
            setInsights(prev => prev.filter(i => i.id !== insightId));
            if (selectedInsight?.id === insightId) {
                setSelectedInsight(null);
            }
            toast.success('Insight deleted');
        } catch (err) {
            toast.error('Failed to delete insight');
        }
    };

    // Handle confirming insight
    const handleConfirmInsight = async (insightId: string) => {
        try {
            await Api.patch(`/intelligence/insights/${insightId}`, {
                status: 'confirmed'
            });
            setInsights(prev => prev.map(i => 
                i.id === insightId ? { ...i, status: 'confirmed' } : i
            ));
            toast.success('Insight confirmed');
        } catch (err) {
            toast.error('Failed to confirm insight');
        }
    };

    // Tabs configuration
    const tabs = [
        { id: 'interview', label: 'Interview', icon: MessageSquare },
        { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen, badge: insights.length },
        { id: 'sessions', label: 'Sessions', icon: History, badge: sessions.length },
    ];

    return (
        <SplitLayout
            title={
                <div className="flex items-center gap-2">
                    <Brain className="text-purple-600 dark:text-purple-400" size={20} />
                    <span className="text-purple-600 dark:text-purple-400">AI</span>
                </div>
            }
            subtitle="Project Intelligence Assistant"
        >
            <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
                {/* Header */}
                <div className="shrink-0 px-6 py-4 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-navy-900 dark:text-white flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                                    <Brain className="w-6 h-6 text-white" />
                                </div>
                                Project Intelligence Hub
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Capture and organize project knowledge through AI-powered conversations
                            </p>
                            {/* Project Selector */}
                            {availableProjects.length > 0 && (
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs text-slate-400">Project:</span>
                                    <select
                                        value={currentProjectId || ''}
                                        onChange={(e) => setCurrentProjectId(e.target.value || null)}
                                        className="text-sm bg-transparent border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-purple-600 dark:text-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="">Select project...</option>
                                        {availableProjects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {currentProjectId && (
                                <>
                                    <button
                                        onClick={handleSeedData}
                                        disabled={isSeeding}
                                        className="flex items-center gap-2 px-3 py-2 border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                        title="Generate sample insights for testing"
                                    >
                                        {isSeeding ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                        Seed Demo Data
                                    </button>
                                    <button
                                        onClick={() => setShowAddModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Plus size={16} />
                                        Add Insight
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => { fetchInsights(); fetchSessions(); }}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-950 rounded-lg p-1 w-fit">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    activeTab === tab.id
                                        ? 'bg-white dark:bg-navy-800 text-navy-900 dark:text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                                {tab.badge !== undefined && tab.badge > 0 && (
                                    <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full">
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {!currentProjectId ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-navy-700 dark:to-navy-800 flex items-center justify-center mb-6">
                                <Brain className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                            </div>
                            <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-2">
                                Select a Project
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">
                                Choose a project from the dashboard to start capturing project knowledge and insights.
                            </p>
                            <div className="text-sm text-slate-400 dark:text-slate-500">
                                Use the project selector in the navigation or go to Dashboard → Projects
                            </div>
                        </div>
                    ) : activeTab === 'interview' ? (
                        <InterviewTabContent 
                            projectId={currentProjectId}
                            onInsightDetected={(insight) => {
                                setInsights(prev => [insight, ...prev]);
                            }}
                        />
                    ) : activeTab === 'knowledge' ? (
                        <KnowledgeTabContent
                            insights={filteredInsights}
                            categoryCounts={categoryCounts}
                            selectedCategory={selectedCategory}
                            selectedInsight={selectedInsight}
                            isLoading={isLoading}
                            onSelectCategory={setSelectedCategory}
                            onSelectInsight={setSelectedInsight}
                            onConfirmInsight={handleConfirmInsight}
                            onDeleteInsight={handleDeleteInsight}
                        />
                    ) : activeTab === 'sessions' ? (
                        <SessionsTabContent
                            sessions={sessions}
                            isLoading={isLoading}
                        />
                    ) : null}
                </div>

                {/* Add Insight Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                                    Add New Insight
                                </h3>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Category
                                    </label>
                                    <select
                                        value={newInsightCategory}
                                        onChange={(e) => setNewInsightCategory(e.target.value as InsightCategory)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-navy-900 dark:text-white"
                                    >
                                        {Object.values(CATEGORY_CONFIG).map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Title
                                    </label>
                                    <input
                                        type="text"
                                        value={newInsightTitle}
                                        onChange={(e) => setNewInsightTitle(e.target.value)}
                                        placeholder="Enter insight title..."
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-navy-900 dark:text-white placeholder-slate-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={newInsightContent}
                                        onChange={(e) => setNewInsightContent(e.target.value)}
                                        placeholder="Describe this insight..."
                                        rows={4}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-navy-900 dark:text-white placeholder-slate-400"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddInsight}
                                    disabled={!newInsightTitle.trim()}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                                >
                                    Add Insight
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </SplitLayout>
    );
};

// Interview Tab Content
const InterviewTabContent: React.FC<{
    projectId: string | null;
    onInsightDetected: (insight: ProjectInsight) => void;
}> = ({ projectId, onInsightDetected }) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-purple-500" />
            </div>
            <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-2">
                Start an Interview Session
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">
                Use the AI Chat on the left to capture project knowledge. 
                The AI will automatically detect and extract insights from your conversation.
            </p>
            <div className="flex flex-col gap-3 text-left bg-slate-100 dark:bg-navy-800 rounded-xl p-4 max-w-md">
                <p className="text-sm font-medium text-navy-900 dark:text-white">Try asking:</p>
                <div className="space-y-2">
                    <p className="text-sm text-slate-600 dark:text-slate-400">• "Who are the key stakeholders for this project?"</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">• "What are the main risks we should track?"</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">• "What assumptions are we making?"</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">• "What are our project objectives?"</p>
                </div>
            </div>
        </div>
    );
};

// Knowledge Tab Content
const KnowledgeTabContent: React.FC<{
    insights: ProjectInsight[];
    categoryCounts: Record<InsightCategory, number>;
    selectedCategory: InsightCategory | null;
    selectedInsight: ProjectInsight | null;
    isLoading: boolean;
    onSelectCategory: (category: InsightCategory | null) => void;
    onSelectInsight: (insight: ProjectInsight | null) => void;
    onConfirmInsight: (id: string) => void;
    onDeleteInsight: (id: string) => void;
}> = ({
    insights,
    categoryCounts,
    selectedCategory,
    selectedInsight,
    isLoading,
    onSelectCategory,
    onSelectInsight,
    onConfirmInsight,
    onDeleteInsight
}) => {
    return (
        <div className="flex-1 flex overflow-hidden">
            {/* Categories Sidebar */}
            <div className="w-64 shrink-0 border-r border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 overflow-y-auto">
                <div className="p-4">
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        Categories
                    </h3>
                    <div className="space-y-1">
                        <button
                            onClick={() => onSelectCategory(null)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                                selectedCategory === null
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                        >
                            <span>All Insights</span>
                            <span className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-navy-700 rounded-full">
                                {insights.length}
                            </span>
                        </button>
                        
                        {Object.values(CATEGORY_CONFIG).map(cat => {
                            const count = categoryCounts[cat.id] || 0;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => onSelectCategory(cat.id)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                                        selectedCategory === cat.id
                                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {getCategoryIcon(cat.icon, 14)}
                                        <span>{cat.label}</span>
                                    </div>
                                    {count > 0 && (
                                        <span className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-navy-700 rounded-full">
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Insights List */}
            <div className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                    </div>
                ) : insights.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center mb-4">
                            <BookOpen className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-1">
                            No insights yet
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Start a conversation to capture project knowledge
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {insights.map(insight => {
                            const cat = CATEGORY_CONFIG[insight.category];
                            return (
                                <div
                                    key={insight.id}
                                    onClick={() => onSelectInsight(insight)}
                                    className={`bg-white dark:bg-navy-900 rounded-xl border p-4 cursor-pointer transition-all ${
                                        selectedInsight?.id === insight.id
                                            ? 'border-purple-500 ring-2 ring-purple-500/20'
                                            : 'border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-700'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-lg bg-${cat.color}-100 dark:bg-${cat.color}-900/30`}>
                                            {getCategoryIcon(cat.icon, 16)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-medium text-navy-900 dark:text-white truncate">
                                                    {insight.title}
                                                </h4>
                                                {insight.status === 'draft' && (
                                                    <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                                                        Draft
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                                                {(insight.content as any)?.description || JSON.stringify(insight.content)}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                                                <span className={`px-2 py-0.5 rounded-full bg-${cat.color}-100 dark:bg-${cat.color}-900/30 text-${cat.color}-600 dark:text-${cat.color}-400`}>
                                                    {cat.label}
                                                </span>
                                                <span>
                                                    {new Date(insight.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {insight.status === 'draft' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onConfirmInsight(insight.id); }}
                                                    className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                                    title="Confirm"
                                                >
                                                    <Check size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDeleteInsight(insight.id); }}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Insight Detail Panel */}
            {selectedInsight && (
                <div className="w-80 shrink-0 border-l border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 overflow-y-auto">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Insight Detail
                            </h3>
                            <button
                                onClick={() => onSelectInsight(null)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <h4 className="text-lg font-semibold text-navy-900 dark:text-white">
                                    {selectedInsight.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 text-xs rounded-full bg-${CATEGORY_CONFIG[selectedInsight.category].color}-100 dark:bg-${CATEGORY_CONFIG[selectedInsight.category].color}-900/30 text-${CATEGORY_CONFIG[selectedInsight.category].color}-600 dark:text-${CATEGORY_CONFIG[selectedInsight.category].color}-400`}>
                                        {CATEGORY_CONFIG[selectedInsight.category].label}
                                    </span>
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                                        selectedInsight.status === 'confirmed'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    }`}>
                                        {selectedInsight.status}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">
                                    Content
                                </h5>
                                <p className="text-sm text-navy-900 dark:text-white">
                                    {(selectedInsight.content as any)?.description || JSON.stringify(selectedInsight.content, null, 2)}
                                </p>
                            </div>

                            {selectedInsight.source?.quote && (
                                <div>
                                    <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">
                                        Source Quote
                                    </h5>
                                    <blockquote className="text-sm text-slate-600 dark:text-slate-400 italic border-l-2 border-purple-500 pl-3">
                                        "{selectedInsight.source.quote}"
                                    </blockquote>
                                </div>
                            )}

                            <div>
                                <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">
                                    PMO Domain
                                </h5>
                                <p className="text-sm text-navy-900 dark:text-white">
                                    {selectedInsight.pmoDomain || CATEGORY_CONFIG[selectedInsight.category].pmoDomain}
                                </p>
                            </div>

                            <div>
                                <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">
                                    Created
                                </h5>
                                <p className="text-sm text-navy-900 dark:text-white">
                                    {new Date(selectedInsight.createdAt).toLocaleString()}
                                    {selectedInsight.createdBy && (
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {' '}by {selectedInsight.createdBy.firstName} {selectedInsight.createdBy.lastName}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Sessions Tab Content
const SessionsTabContent: React.FC<{
    sessions: InterviewSession[];
    isLoading: boolean;
}> = ({ sessions, isLoading }) => {
    return (
        <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
            ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center mb-4">
                        <History className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-1">
                        No interview sessions yet
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Your interview history will appear here
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h4 className="font-medium text-navy-900 dark:text-white">
                                        {session.topic}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        <span>{new Date(session.startedAt).toLocaleDateString()}</span>
                                        {session.durationMinutes && (
                                            <span>{session.durationMinutes} min</span>
                                        )}
                                        {session.insightCount !== undefined && session.insightCount > 0 && (
                                            <span className="flex items-center gap-1">
                                                <Sparkles size={12} />
                                                {session.insightCount} insights
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                    session.status === 'completed'
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : session.status === 'active'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                    {session.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProjectIntelligenceView;

