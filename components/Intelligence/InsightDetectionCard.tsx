/**
 * InsightDetectionCard Component
 * 
 * Displays an AI-detected insight with options to save, edit, or skip
 */

import React, { useState } from 'react';
import { Check, Edit2, X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { DetectedInsight, InsightCategory } from '../../types';
import { CategoryIcon, getCategoryConfig, INSIGHT_CATEGORIES } from './CategoryIcon';

interface InsightDetectionCardProps {
    insight: DetectedInsight;
    onSave: (insight: DetectedInsight) => void;
    onEdit: (insight: DetectedInsight) => void;
    onSkip: () => void;
    className?: string;
}

export const InsightDetectionCard: React.FC<InsightDetectionCardProps> = ({
    insight,
    onSave,
    onEdit,
    onSkip,
    className = ''
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editedTitle, setEditedTitle] = useState(insight.title);
    const [editedDescription, setEditedDescription] = useState(
        (insight.content as any)?.description || ''
    );
    const [editedCategory, setEditedCategory] = useState<InsightCategory>(insight.category);

    const config = getCategoryConfig(insight.category);

    const handleSave = () => {
        if (editMode) {
            onSave({
                ...insight,
                category: editedCategory,
                title: editedTitle,
                content: { description: editedDescription }
            });
        } else {
            onSave(insight);
        }
    };

    const handleEdit = () => {
        if (editMode) {
            // Cancel edit
            setEditMode(false);
            setEditedTitle(insight.title);
            setEditedDescription((insight.content as any)?.description || '');
            setEditedCategory(insight.category);
        } else {
            setEditMode(true);
        }
    };

    const confidenceColors = {
        high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
    };

    return (
        <div className={`bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800/50 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 bg-white/50 dark:bg-navy-900/50 border-b border-purple-200/50 dark:border-purple-800/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                            <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                            AI Detected Insight
                        </span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${confidenceColors[insight.confidence]}`}>
                        {insight.confidence} confidence
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {editMode ? (
                    // Edit Mode
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                Category
                            </label>
                            <select
                                value={editedCategory}
                                onChange={(e) => setEditedCategory(e.target.value as InsightCategory)}
                                className="w-full px-3 py-1.5 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg"
                            >
                                {Object.values(INSIGHT_CATEGORIES).map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                Title
                            </label>
                            <input
                                type="text"
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                Description
                            </label>
                            <textarea
                                value={editedDescription}
                                onChange={(e) => setEditedDescription(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-1.5 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg resize-none"
                            />
                        </div>
                    </div>
                ) : (
                    // View Mode
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <CategoryIcon category={insight.category} size={18} showBackground />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${config.bgColor} ${config.textColor}`}>
                                        {config.label}
                                    </span>
                                </div>
                                <h4 className="font-medium text-navy-900 dark:text-white text-sm">
                                    {insight.title}
                                </h4>
                            </div>
                        </div>

                        {/* Source Quote (collapsible) */}
                        {insight.sourceQuote && (
                            <div>
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                >
                                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    Source context
                                </button>
                                {isExpanded && (
                                    <blockquote className="mt-2 text-xs text-slate-600 dark:text-slate-400 italic border-l-2 border-purple-300 dark:border-purple-700 pl-3 py-1">
                                        "{insight.sourceQuote}"
                                    </blockquote>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-purple-200/50 dark:border-purple-800/30">
                    <button
                        onClick={onSkip}
                        className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <X size={14} className="inline mr-1" />
                        Skip
                    </button>
                    <button
                        onClick={handleEdit}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            editMode
                                ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                    >
                        <Edit2 size={14} className="inline mr-1" />
                        {editMode ? 'Cancel' : 'Edit'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={editMode && !editedTitle.trim()}
                        className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Check size={14} className="inline mr-1" />
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InsightDetectionCard;


