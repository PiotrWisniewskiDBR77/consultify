/**
 * TemplateLibrary
 * 
 * Component for browsing and selecting initiative templates.
 * Features category filters, search, and template preview.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search,
    Database,
    Workflow,
    Package,
    Users,
    Shield,
    Brain,
    Sparkles,
    ChevronRight,
    Check,
    X,
    Clock,
    DollarSign,
    FileText
} from 'lucide-react';
import { InitiativeTemplate, TemplateCategory, DRDAxis } from '../../types';

interface TemplateLibraryProps {
    templates: InitiativeTemplate[];
    isLoading: boolean;
    selectedTemplateId: string | null;
    onSelect: (template: InitiativeTemplate | null) => void;
    onSkip: () => void;
}

const CATEGORY_CONFIG: Record<TemplateCategory, { label: string; icon: React.ReactNode; color: string }> = {
    DATA: { label: 'Data Management', icon: <Database size={16} />, color: 'blue' },
    PROCESS: { label: 'Process', icon: <Workflow size={16} />, color: 'green' },
    PRODUCT: { label: 'Digital Product', icon: <Package size={16} />, color: 'purple' },
    CULTURE: { label: 'Culture & Change', icon: <Users size={16} />, color: 'amber' },
    SECURITY: { label: 'Security', icon: <Shield size={16} />, color: 'red' },
    AI_ML: { label: 'AI / ML', icon: <Brain size={16} />, color: 'pink' },
    CUSTOM: { label: 'Custom', icon: <FileText size={16} />, color: 'slate' }
};

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
    templates,
    isLoading,
    selectedTemplateId,
    onSelect,
    onSkip
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'ALL'>('ALL');
    const [previewTemplate, setPreviewTemplate] = useState<InitiativeTemplate | null>(null);

    // Filter templates
    const filteredTemplates = useMemo(() => {
        return templates.filter(t => {
            const matchesCategory = selectedCategory === 'ALL' || t.category === selectedCategory;
            const matchesSearch = !searchQuery || 
                t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.description?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [templates, selectedCategory, searchQuery]);

    // Group templates by category
    const groupedTemplates = useMemo(() => {
        const groups: Record<string, InitiativeTemplate[]> = {};
        filteredTemplates.forEach(t => {
            if (!groups[t.category]) groups[t.category] = [];
            groups[t.category].push(t);
        });
        return groups;
    }, [filteredTemplates]);

    // Get category counts
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { ALL: templates.length };
        templates.forEach(t => {
            counts[t.category] = (counts[t.category] || 0) + 1;
        });
        return counts;
    }, [templates]);

    const handleSelect = (template: InitiativeTemplate) => {
        if (selectedTemplateId === template.id) {
            onSelect(null);
        } else {
            onSelect(template);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with Skip Option */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                        Choose a Template
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Start with a template for faster setup, or skip for full AI generation
                    </p>
                </div>
                <button
                    onClick={onSkip}
                    className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                    <Sparkles size={16} />
                    Skip - Use AI Only
                </button>
            </div>

            {/* Search & Filters */}
            <div className="flex gap-4">
                {/* Search */}
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search templates..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-navy-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500/50"
                    />
                </div>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        selectedCategory === 'ALL'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700'
                    }`}
                >
                    All ({categoryCounts.ALL || 0})
                </button>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                    <button
                        key={key}
                        onClick={() => setSelectedCategory(key as TemplateCategory)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                            selectedCategory === key
                                ? `bg-${config.color}-600 text-white`
                                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700'
                        }`}
                    >
                        {config.icon}
                        {config.label}
                        <span className="opacity-70">({categoryCounts[key] || 0})</span>
                    </button>
                ))}
            </div>

            {/* Template Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <FileText size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No templates found matching your criteria</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map(template => {
                        const config = CATEGORY_CONFIG[template.category];
                        const isSelected = selectedTemplateId === template.id;

                        return (
                            <div
                                key={template.id}
                                onClick={() => handleSelect(template)}
                                className={`relative bg-white dark:bg-navy-950 border rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg ${
                                    isSelected
                                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                                        : 'border-slate-200 dark:border-white/5 hover:border-blue-500/30'
                                }`}
                            >
                                {/* Selected Check */}
                                {isSelected && (
                                    <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                        <Check size={14} className="text-white" />
                                    </div>
                                )}

                                {/* Category Badge */}
                                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-${config.color}-100 dark:bg-${config.color}-500/20 text-${config.color}-700 dark:text-${config.color}-400 mb-3`}>
                                    {config.icon}
                                    {config.label}
                                </div>

                                {/* Title & Description */}
                                <h4 className="text-sm font-semibold text-navy-900 dark:text-white mb-2">
                                    {template.name}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                                    {template.description || 'No description available'}
                                </p>

                                {/* Quick Stats */}
                                <div className="flex items-center gap-4 text-[10px] text-slate-400">
                                    {template.typicalTimeline && (
                                        <span className="flex items-center gap-1">
                                            <Clock size={10} />
                                            {template.typicalTimeline}
                                        </span>
                                    )}
                                    {template.typicalBudgetRange && (
                                        <span className="flex items-center gap-1">
                                            <DollarSign size={10} />
                                            {template.typicalBudgetRange.min / 1000}k - {template.typicalBudgetRange.max / 1000}k
                                        </span>
                                    )}
                                    {template.suggestedTasks && (
                                        <span className="flex items-center gap-1">
                                            <FileText size={10} />
                                            {template.suggestedTasks.length} tasks
                                        </span>
                                    )}
                                </div>

                                {/* Preview Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewTemplate(template);
                                    }}
                                    className="mt-3 text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1"
                                >
                                    Preview <ChevronRight size={12} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Template Preview Modal */}
            {previewTemplate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-navy-900 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                            <div>
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-${CATEGORY_CONFIG[previewTemplate.category].color}-100 dark:bg-${CATEGORY_CONFIG[previewTemplate.category].color}-500/20 text-${CATEGORY_CONFIG[previewTemplate.category].color}-700 dark:text-${CATEGORY_CONFIG[previewTemplate.category].color}-400 mb-1`}>
                                    {CATEGORY_CONFIG[previewTemplate.category].icon}
                                    {CATEGORY_CONFIG[previewTemplate.category].label}
                                </span>
                                <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                                    {previewTemplate.name}
                                </h3>
                            </div>
                            <button
                                onClick={() => setPreviewTemplate(null)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                {previewTemplate.description}
                            </p>

                            {/* Problem Template */}
                            {previewTemplate.problemStructured && (
                                <div className="bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">
                                    <h4 className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">Problem Template</h4>
                                    <div className="space-y-1 text-xs text-red-600 dark:text-red-300">
                                        {previewTemplate.problemStructured.symptom && (
                                            <p><strong>Symptom:</strong> {previewTemplate.problemStructured.symptom}</p>
                                        )}
                                        {previewTemplate.problemStructured.rootCause && (
                                            <p><strong>Root Cause:</strong> {previewTemplate.problemStructured.rootCause}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Target State */}
                            {previewTemplate.targetState && (
                                <div className="bg-green-50 dark:bg-green-500/10 p-3 rounded-lg">
                                    <h4 className="text-xs font-bold text-green-700 dark:text-green-400 mb-2">Target State</h4>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        {previewTemplate.targetState.process && (
                                            <div>
                                                <span className="font-medium text-green-600">Process:</span>
                                                <ul className="list-disc list-inside text-green-600/80">
                                                    {previewTemplate.targetState.process.map((p, i) => (
                                                        <li key={i}>{p}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {previewTemplate.targetState.behavior && (
                                            <div>
                                                <span className="font-medium text-green-600">Behavior:</span>
                                                <ul className="list-disc list-inside text-green-600/80">
                                                    {previewTemplate.targetState.behavior.map((b, i) => (
                                                        <li key={i}>{b}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {previewTemplate.targetState.capability && (
                                            <div>
                                                <span className="font-medium text-green-600">Capability:</span>
                                                <ul className="list-disc list-inside text-green-600/80">
                                                    {previewTemplate.targetState.capability.map((c, i) => (
                                                        <li key={i}>{c}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Suggested Tasks */}
                            {previewTemplate.suggestedTasks && previewTemplate.suggestedTasks.length > 0 && (
                                <div className="bg-blue-50 dark:bg-blue-500/10 p-3 rounded-lg">
                                    <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-2">
                                        Suggested Tasks ({previewTemplate.suggestedTasks.length})
                                    </h4>
                                    <div className="space-y-1">
                                        {previewTemplate.suggestedTasks.slice(0, 5).map((task, i) => (
                                            <div key={i} className="text-xs text-blue-600 dark:text-blue-300 flex items-center gap-2">
                                                <span className="w-4 h-4 rounded bg-blue-200 dark:bg-blue-600 text-blue-700 dark:text-white flex items-center justify-center text-[10px] font-bold">
                                                    {i + 1}
                                                </span>
                                                {task.title}
                                            </div>
                                        ))}
                                        {previewTemplate.suggestedTasks.length > 5 && (
                                            <p className="text-[10px] text-blue-500 italic">
                                                +{previewTemplate.suggestedTasks.length - 5} more tasks
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-200 dark:border-white/5 flex justify-end gap-3">
                            <button
                                onClick={() => setPreviewTemplate(null)}
                                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    onSelect(previewTemplate);
                                    setPreviewTemplate(null);
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg flex items-center gap-2"
                            >
                                <Check size={16} />
                                Use This Template
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemplateLibrary;

