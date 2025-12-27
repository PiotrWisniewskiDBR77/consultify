/**
 * RecommendationCard Extension
 * 
 * Custom TipTap node for structured recommendation cards
 * with priority, impact, effort, and timeline.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import React, { useState } from 'react';
import {
    Lightbulb,
    TrendingUp,
    Clock,
    DollarSign,
    ChevronDown,
    ChevronUp,
    Edit3,
    Check,
    X
} from 'lucide-react';

interface RecommendationAttrs {
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    timeline: string;
    estimatedROI: string;
    owner: string;
    axisId?: string;
}

const PRIORITY_STYLES = {
    critical: {
        badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        border: 'border-l-red-500',
        label: 'Krytyczny'
    },
    high: {
        badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        border: 'border-l-orange-500',
        label: 'Wysoki'
    },
    medium: {
        badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        border: 'border-l-yellow-500',
        label: 'Średni'
    },
    low: {
        badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        border: 'border-l-green-500',
        label: 'Niski'
    }
};

const IMPACT_LABELS = {
    high: { label: 'Wysoki', color: 'text-green-600' },
    medium: { label: 'Średni', color: 'text-yellow-600' },
    low: { label: 'Niski', color: 'text-slate-500' }
};

const EFFORT_LABELS = {
    high: { label: 'Duży', color: 'text-red-500' },
    medium: { label: 'Średni', color: 'text-yellow-600' },
    low: { label: 'Mały', color: 'text-green-600' }
};

// React component
const RecommendationCardComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    const attrs = node.attrs as RecommendationAttrs;
    const [editForm, setEditForm] = useState(attrs);

    const priorityStyle = PRIORITY_STYLES[attrs.priority || 'medium'];
    const impactStyle = IMPACT_LABELS[attrs.impact || 'medium'];
    const effortStyle = EFFORT_LABELS[attrs.effort || 'medium'];

    const handleSave = () => {
        updateAttributes(editForm);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditForm(attrs);
        setIsEditing(false);
    };

    return (
        <NodeViewWrapper
            className={`premium-recommendation-card priority-${attrs.priority} ${priorityStyle.border} ${selected ? 'ring-2 ring-blue-500' : ''}`}
        >
            {isEditing ? (
                // Edit Mode
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-slate-900 dark:text-white">Edytuj Rekomendację</h4>
                        <div className="flex gap-2">
                            <button onClick={handleCancel} className="p-1.5 text-slate-400 hover:text-red-500">
                                <X className="w-4 h-4" />
                            </button>
                            <button onClick={handleSave} className="p-1.5 text-slate-400 hover:text-green-500">
                                <Check className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Tytuł</label>
                            <input
                                type="text"
                                value={editForm.title}
                                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Opis</label>
                            <textarea
                                value={editForm.description}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Priorytet</label>
                            <select
                                value={editForm.priority}
                                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as RecommendationAttrs['priority'] })}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm"
                            >
                                <option value="critical">Krytyczny</option>
                                <option value="high">Wysoki</option>
                                <option value="medium">Średni</option>
                                <option value="low">Niski</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Wpływ</label>
                            <select
                                value={editForm.impact}
                                onChange={(e) => setEditForm({ ...editForm, impact: e.target.value as RecommendationAttrs['impact'] })}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm"
                            >
                                <option value="high">Wysoki</option>
                                <option value="medium">Średni</option>
                                <option value="low">Niski</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Nakład pracy</label>
                            <select
                                value={editForm.effort}
                                onChange={(e) => setEditForm({ ...editForm, effort: e.target.value as RecommendationAttrs['effort'] })}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm"
                            >
                                <option value="low">Mały</option>
                                <option value="medium">Średni</option>
                                <option value="high">Duży</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Timeline</label>
                            <input
                                type="text"
                                value={editForm.timeline}
                                onChange={(e) => setEditForm({ ...editForm, timeline: e.target.value })}
                                placeholder="np. Q1 2025"
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Szacowany ROI</label>
                            <input
                                type="text"
                                value={editForm.estimatedROI}
                                onChange={(e) => setEditForm({ ...editForm, estimatedROI: e.target.value })}
                                placeholder="np. 150%"
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Właściciel</label>
                            <input
                                type="text"
                                value={editForm.owner}
                                onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
                                placeholder="np. CTO"
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                </div>
            ) : (
                // View Mode
                <>
                    {/* Header */}
                    <div className="rec-header flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg">
                                <Lightbulb className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1">
                                <h4 className="rec-title font-semibold text-slate-900 dark:text-white">{attrs.title || 'Nowa Rekomendacja'}</h4>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`rec-priority px-2 py-1 rounded text-xs font-medium ${priorityStyle.badge}`}>
                                {priorityStyle.label}
                            </span>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                            >
                                <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                            >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    {isExpanded && (
                        <>
                            <p className="text-slate-600 dark:text-slate-300 mt-3">
                                {attrs.description || 'Dodaj opis rekomendacji...'}
                            </p>

                            {/* Metrics */}
                            <div className="rec-metrics grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                                        <TrendingUp className="w-4 h-4" />
                                        <span className="text-xs">Wpływ</span>
                                    </div>
                                    <span className={`font-semibold ${impactStyle.color}`}>
                                        {impactStyle.label}
                                    </span>
                                </div>
                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                                        <Clock className="w-4 h-4" />
                                        <span className="text-xs">Nakład</span>
                                    </div>
                                    <span className={`font-semibold ${effortStyle.color}`}>
                                        {effortStyle.label}
                                    </span>
                                </div>
                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                                        <DollarSign className="w-4 h-4" />
                                        <span className="text-xs">ROI</span>
                                    </div>
                                    <span className="font-semibold text-green-600">
                                        {attrs.estimatedROI || 'N/A'}
                                    </span>
                                </div>
                            </div>

                            {/* Footer */}
                            {(attrs.timeline || attrs.owner) && (
                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm text-slate-500">
                                    {attrs.timeline && <span>📅 {attrs.timeline}</span>}
                                    {attrs.owner && <span>👤 {attrs.owner}</span>}
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </NodeViewWrapper>
    );
};

// TipTap extension
export const RecommendationCardExtension = Node.create({
    name: 'recommendationCard',

    group: 'block',

    atom: true,

    addAttributes() {
        return {
            title: { default: 'Nowa Rekomendacja' },
            description: { default: '' },
            priority: { default: 'medium' },
            impact: { default: 'medium' },
            effort: { default: 'medium' },
            timeline: { default: '' },
            estimatedROI: { default: '' },
            owner: { default: '' },
            axisId: { default: null }
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-recommendation-card]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-recommendation-card': '' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(RecommendationCardComponent);
    }
});

export default RecommendationCardExtension;
