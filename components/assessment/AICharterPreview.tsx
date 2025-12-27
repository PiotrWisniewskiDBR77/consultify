/**
 * AICharterPreview
 * 
 * Component for previewing and editing AI-generated initiative charter.
 * Shows all charter sections with inline editing and regeneration options.
 */

import React, { useState } from 'react';
import {
    Sparkles,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Edit2,
    Check,
    X,
    AlertTriangle,
    Target,
    FileText,
    Users,
    DollarSign,
    Clock,
    CheckCircle,
    AlertOctagon,
    Lightbulb,
    Plus,
    Trash2,
    GripVertical
} from 'lucide-react';
import { AIGeneratedCharter, Task, InitiativeTeamMember } from '../../types';

interface AICharterPreviewProps {
    charter: AIGeneratedCharter;
    isGenerating: boolean;
    onUpdate: (updates: Partial<AIGeneratedCharter>) => void;
    onRegenerateSection: (section: string) => Promise<void>;
}

type SectionId = 'basic' | 'problem' | 'target' | 'kill' | 'risks' | 'tasks' | 'team' | 'financials';

interface SectionConfig {
    id: SectionId;
    title: string;
    icon: React.ReactNode;
    color: string;
    canRegenerate: boolean;
}

const SECTIONS: SectionConfig[] = [
    { id: 'basic', title: 'Basic Information', icon: <FileText size={16} />, color: 'blue', canRegenerate: false },
    { id: 'problem', title: 'Problem Statement', icon: <AlertTriangle size={16} />, color: 'red', canRegenerate: true },
    { id: 'target', title: 'Target State', icon: <Target size={16} />, color: 'green', canRegenerate: true },
    { id: 'kill', title: 'Kill Criteria', icon: <AlertOctagon size={16} />, color: 'amber', canRegenerate: true },
    { id: 'risks', title: 'Key Risks', icon: <AlertTriangle size={16} />, color: 'orange', canRegenerate: true },
    { id: 'tasks', title: 'Suggested Tasks', icon: <CheckCircle size={16} />, color: 'purple', canRegenerate: true },
    { id: 'team', title: 'Team Composition', icon: <Users size={16} />, color: 'teal', canRegenerate: true },
    { id: 'financials', title: 'Financials', icon: <DollarSign size={16} />, color: 'emerald', canRegenerate: false }
];

export const AICharterPreview: React.FC<AICharterPreviewProps> = ({
    charter,
    isGenerating,
    onUpdate,
    onRegenerateSection
}) => {
    const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(new Set(['basic', 'problem', 'target']));
    const [regeneratingSections, setRegeneratingSections] = useState<Set<string>>(new Set());
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    const toggleSection = (sectionId: SectionId) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(sectionId)) {
            newExpanded.delete(sectionId);
        } else {
            newExpanded.add(sectionId);
        }
        setExpandedSections(newExpanded);
    };

    const handleRegenerate = async (sectionId: string) => {
        setRegeneratingSections(prev => new Set(prev).add(sectionId));
        try {
            await onRegenerateSection(sectionId);
        } finally {
            setRegeneratingSections(prev => {
                const next = new Set(prev);
                next.delete(sectionId);
                return next;
            });
        }
    };

    const startEditing = (field: string, value: string) => {
        setEditingField(field);
        setEditValue(value);
    };

    const saveEditing = (field: string, path: string[]) => {
        // Build update object from path
        let update: any = {};
        let current = update;
        for (let i = 0; i < path.length - 1; i++) {
            current[path[i]] = {};
            current = current[path[i]];
        }
        current[path[path.length - 1]] = editValue;
        
        onUpdate(update);
        setEditingField(null);
        setEditValue('');
    };

    const cancelEditing = () => {
        setEditingField(null);
        setEditValue('');
    };

    // Confidence indicator
    const getConfidenceColor = () => {
        switch (charter.generationConfidence) {
            case 'HIGH': return 'text-green-500 bg-green-500/10';
            case 'MEDIUM': return 'text-amber-500 bg-amber-500/10';
            case 'LOW': return 'text-red-500 bg-red-500/10';
            default: return 'text-slate-500 bg-slate-500/10';
        }
    };

    const renderEditableText = (value: string, field: string, path: string[], multiline = false) => {
        if (editingField === field) {
            return (
                <div className="flex items-start gap-2">
                    {multiline ? (
                        <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 bg-white dark:bg-navy-900 border border-blue-500 rounded p-2 text-sm text-navy-900 dark:text-white outline-none resize-none"
                            rows={3}
                            autoFocus
                        />
                    ) : (
                        <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 bg-white dark:bg-navy-900 border border-blue-500 rounded px-2 py-1 text-sm text-navy-900 dark:text-white outline-none"
                            autoFocus
                        />
                    )}
                    <button
                        onClick={() => saveEditing(field, path)}
                        className="p-1 bg-green-500 text-white rounded hover:bg-green-400"
                    >
                        <Check size={14} />
                    </button>
                    <button
                        onClick={cancelEditing}
                        className="p-1 bg-slate-500 text-white rounded hover:bg-slate-400"
                    >
                        <X size={14} />
                    </button>
                </div>
            );
        }

        return (
            <div className="group flex items-start gap-2">
                <span className="flex-1">{value || <span className="italic text-slate-400">Not set</span>}</span>
                <button
                    onClick={() => startEditing(field, value || '')}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-500 transition-opacity"
                >
                    <Edit2 size={12} />
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Header with Confidence */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Sparkles size={24} className="text-purple-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                            AI Generated Charter
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Review and edit the generated content below
                        </p>
                    </div>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${getConfidenceColor()}`}>
                    {charter.generationConfidence} Confidence
                </div>
            </div>

            {/* Sections */}
            <div className="space-y-3">
                {SECTIONS.map(section => {
                    const isExpanded = expandedSections.has(section.id);
                    const isRegenerating = regeneratingSections.has(section.id);

                    return (
                        <div
                            key={section.id}
                            className={`border rounded-xl overflow-hidden transition-all ${
                                isExpanded 
                                    ? `border-${section.color}-500/30 bg-${section.color}-50/50 dark:bg-${section.color}-500/5` 
                                    : 'border-slate-200 dark:border-white/5 bg-white dark:bg-navy-950'
                            }`}
                        >
                            {/* Section Header */}
                            <button
                                onClick={() => toggleSection(section.id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-lg bg-${section.color}-100 dark:bg-${section.color}-500/20 text-${section.color}-600 dark:text-${section.color}-400`}>
                                        {section.icon}
                                    </div>
                                    <span className="font-medium text-navy-900 dark:text-white">
                                        {section.title}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {section.canRegenerate && isExpanded && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRegenerate(section.id);
                                            }}
                                            disabled={isRegenerating}
                                            className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                                                isRegenerating 
                                                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-500' 
                                                    : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-purple-500 hover:bg-purple-50'
                                            }`}
                                        >
                                            <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} />
                                            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                                        </button>
                                    )}
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                            </button>

                            {/* Section Content */}
                            {isExpanded && (
                                <div className="px-4 pb-4 space-y-3">
                                    {section.id === 'basic' && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-slate-500 uppercase font-bold">Name</label>
                                                <div className="text-lg font-bold text-navy-900 dark:text-white">
                                                    {renderEditableText(charter.name, 'name', ['name'])}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 uppercase font-bold">Summary</label>
                                                <div className="text-sm text-slate-600 dark:text-slate-300">
                                                    {renderEditableText(charter.summary || '', 'summary', ['summary'], true)}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 uppercase font-bold">One-Liner</label>
                                                <div className="text-sm text-slate-600 dark:text-slate-300 italic">
                                                    {renderEditableText(charter.applicantOneLiner || '', 'oneLiner', ['applicantOneLiner'])}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="text-xs text-slate-500 uppercase font-bold">Strategic Intent</label>
                                                    <div className="text-sm font-medium text-navy-900 dark:text-white">
                                                        {charter.strategicIntent || 'Build Capability'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 uppercase font-bold">Timeline</label>
                                                    <div className="text-sm text-navy-900 dark:text-white flex items-center gap-1">
                                                        <Clock size={12} /> {charter.timeline || '6 months'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 uppercase font-bold">Priority</label>
                                                    <div className="text-sm font-medium text-navy-900 dark:text-white">
                                                        {charter.priority || 2}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {section.id === 'problem' && charter.problemStructured && (
                                        <div className="space-y-3 bg-white dark:bg-navy-900 p-4 rounded-lg border border-red-200 dark:border-red-500/20">
                                            <div>
                                                <label className="text-xs text-red-500 uppercase font-bold flex items-center gap-1">
                                                    <Lightbulb size={10} /> Symptom
                                                </label>
                                                <div className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                                                    {renderEditableText(charter.problemStructured.symptom, 'symptom', ['problemStructured', 'symptom'], true)}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-red-500 uppercase font-bold">Root Cause</label>
                                                <div className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                                                    {renderEditableText(charter.problemStructured.rootCause, 'rootCause', ['problemStructured', 'rootCause'], true)}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-red-500 uppercase font-bold">Cost of Inaction</label>
                                                <div className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                                                    {renderEditableText(charter.problemStructured.costOfInaction, 'costOfInaction', ['problemStructured', 'costOfInaction'], true)}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {section.id === 'target' && charter.targetState && (
                                        <div className="grid grid-cols-3 gap-4">
                                            {['process', 'behavior', 'capability'].map(key => (
                                                <div key={key} className="bg-white dark:bg-navy-900 p-3 rounded-lg border border-green-200 dark:border-green-500/20">
                                                    <label className="text-xs text-green-600 uppercase font-bold capitalize">{key}</label>
                                                    <ul className="mt-2 space-y-1">
                                                        {(charter.targetState[key as keyof typeof charter.targetState] as string[] || []).map((item, i) => (
                                                            <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1">
                                                                <span className="text-green-500">•</span>
                                                                {item}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {section.id === 'kill' && (
                                        <div className="space-y-2">
                                            {(charter.killCriteria || []).map((criteria, i) => (
                                                <div key={i} className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/20">
                                                    <AlertOctagon size={14} className="text-amber-500 mt-0.5 shrink-0" />
                                                    <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{criteria}</span>
                                                    <button
                                                        onClick={() => {
                                                            const updated = charter.killCriteria.filter((_, idx) => idx !== i);
                                                            onUpdate({ killCriteria: updated });
                                                        }}
                                                        className="text-slate-400 hover:text-red-500"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {section.id === 'risks' && (
                                        <div className="space-y-2">
                                            {(charter.keyRisks || []).map((risk, i) => (
                                                <div key={i} className="p-3 bg-white dark:bg-navy-900 rounded-lg border border-orange-200 dark:border-orange-500/20">
                                                    <div className="flex items-start justify-between">
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{risk.risk}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                            risk.metric === 'High' ? 'bg-red-100 text-red-600' :
                                                            risk.metric === 'Medium' ? 'bg-amber-100 text-amber-600' :
                                                            'bg-green-100 text-green-600'
                                                        }`}>
                                                            {risk.metric}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        <strong>Mitigation:</strong> {risk.mitigation}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {section.id === 'tasks' && (
                                        <div className="space-y-2">
                                            {(charter.suggestedTasks || []).map((task, i) => (
                                                <div key={task.id || i} className="flex items-start gap-3 p-3 bg-white dark:bg-navy-900 rounded-lg border border-purple-200 dark:border-purple-500/20">
                                                    <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 flex items-center justify-center text-xs font-bold shrink-0">
                                                        {i + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-sm text-navy-900 dark:text-white">{task.title}</span>
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-600 uppercase font-bold">
                                                                {task.taskType}
                                                            </span>
                                                        </div>
                                                        {task.description && (
                                                            <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                                                        )}
                                                        {task.estimatedHours && (
                                                            <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                                <Clock size={10} /> {task.estimatedHours}h
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const updated = charter.suggestedTasks.filter((_, idx) => idx !== i);
                                                            onUpdate({ suggestedTasks: updated });
                                                        }}
                                                        className="text-slate-400 hover:text-red-500"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {section.id === 'team' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            {(charter.suggestedTeam || []).map((member, i) => (
                                                <div key={member.id || i} className="flex items-center gap-3 p-3 bg-white dark:bg-navy-900 rounded-lg border border-teal-200 dark:border-teal-500/20">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white font-bold text-xs">
                                                        {(member as any).title?.[0] || 'T'}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-navy-900 dark:text-white">
                                                            {(member as any).title || member.role}
                                                        </div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-2">
                                                            <span className="px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-500/20 text-teal-600 uppercase text-[9px] font-bold">
                                                                {member.role}
                                                            </span>
                                                            <span>{member.allocation}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {section.id === 'financials' && (
                                        <div className="grid grid-cols-4 gap-4">
                                            <div className="p-3 bg-white dark:bg-navy-900 rounded-lg border border-emerald-200 dark:border-emerald-500/20 text-center">
                                                <div className="text-xs text-slate-500 uppercase">CAPEX</div>
                                                <div className="text-lg font-bold text-navy-900 dark:text-white">
                                                    ${((charter.capex || 0) / 1000).toFixed(0)}k
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white dark:bg-navy-900 rounded-lg border border-emerald-200 dark:border-emerald-500/20 text-center">
                                                <div className="text-xs text-slate-500 uppercase">OPEX (Y1)</div>
                                                <div className="text-lg font-bold text-navy-900 dark:text-white">
                                                    ${((charter.firstYearOpex || 0) / 1000).toFixed(0)}k
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white dark:bg-navy-900 rounded-lg border border-emerald-200 dark:border-emerald-500/20 text-center">
                                                <div className="text-xs text-slate-500 uppercase">Est. ROI</div>
                                                <div className="text-lg font-bold text-green-500">
                                                    {charter.estimatedROI?.toFixed(1) || '1.5'}x
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white dark:bg-navy-900 rounded-lg border border-emerald-200 dark:border-emerald-500/20 text-center">
                                                <div className="text-xs text-slate-500 uppercase">Annual Benefit</div>
                                                <div className="text-lg font-bold text-navy-900 dark:text-white">
                                                    ${((charter.annualBenefit || 0) / 1000).toFixed(0)}k
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AICharterPreview;



