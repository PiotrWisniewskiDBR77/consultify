/**
 * InitiativeEditor
 * 
 * Modal/Panel component for editing an initiative before approval.
 */

import React, { useState, useEffect } from 'react';
import {
    X,
    Save,
    Plus,
    Trash2,
    AlertTriangle
} from 'lucide-react';
import { GeneratedInitiative, DRDAxis, InitiativeRiskLevel } from '../../types';

interface InitiativeEditorProps {
    initiative: GeneratedInitiative;
    onSave: (updates: Partial<GeneratedInitiative>) => void;
    onCancel: () => void;
}

const AXIS_OPTIONS: { value: DRDAxis; label: string }[] = [
    { value: 'processes', label: 'Processes' },
    { value: 'digitalProducts', label: 'Digital Products' },
    { value: 'businessModels', label: 'Business Models' },
    { value: 'dataManagement', label: 'Data Management' },
    { value: 'culture', label: 'Organizational Culture' },
    { value: 'cybersecurity', label: 'Cybersecurity' },
    { value: 'aiMaturity', label: 'AI Maturity' }
];

const RISK_OPTIONS: { value: InitiativeRiskLevel; label: string }[] = [
    { value: 'LOW', label: 'Low Risk' },
    { value: 'MEDIUM', label: 'Medium Risk' },
    { value: 'HIGH', label: 'High Risk' }
];

const TIMELINE_OPTIONS = [
    '1-3 months',
    '3-6 months',
    '6-9 months',
    '9-12 months',
    '12-18 months',
    '18-24 months'
];

export const InitiativeEditor: React.FC<InitiativeEditorProps> = ({
    initiative,
    onSave,
    onCancel
}) => {
    // Form state
    const [name, setName] = useState(initiative.name);
    const [description, setDescription] = useState(initiative.description);
    const [sourceAxisId, setSourceAxisId] = useState(initiative.sourceAxisId);
    const [estimatedROI, setEstimatedROI] = useState(initiative.estimatedROI);
    const [estimatedBudget, setEstimatedBudget] = useState(initiative.estimatedBudget);
    const [timeline, setTimeline] = useState(initiative.timeline);
    const [riskLevel, setRiskLevel] = useState(initiative.riskLevel);
    const [objectives, setObjectives] = useState<string[]>(initiative.objectives || []);
    const [newObjective, setNewObjective] = useState('');

    // Validation state
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Validate on change
    useEffect(() => {
        const newErrors: Record<string, string> = {};

        if (!name || name.length < 5) {
            newErrors.name = 'Name must be at least 5 characters';
        }

        if (!description || description.length < 20) {
            newErrors.description = 'Description must be at least 20 characters';
        }

        if (estimatedBudget <= 0) {
            newErrors.estimatedBudget = 'Budget must be greater than 0';
        }

        if (estimatedROI <= 0) {
            newErrors.estimatedROI = 'ROI must be greater than 0';
        }

        setErrors(newErrors);
    }, [name, description, estimatedBudget, estimatedROI]);

    const handleAddObjective = () => {
        if (newObjective.trim()) {
            setObjectives([...objectives, newObjective.trim()]);
            setNewObjective('');
        }
    };

    const handleRemoveObjective = (index: number) => {
        setObjectives(objectives.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        if (Object.keys(errors).length > 0) {
            return;
        }

        onSave({
            name,
            description,
            sourceAxisId,
            estimatedROI,
            estimatedBudget,
            timeline,
            riskLevel,
            objectives
        });
    };

    const isValid = Object.keys(errors).length === 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-navy-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-navy-900 dark:text-white">
                        Edit Initiative
                    </h2>
                    <button
                        onClick={onCancel}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Initiative Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={`
                                w-full px-4 py-2.5 rounded-lg border bg-white dark:bg-navy-950 text-navy-900 dark:text-white
                                ${errors.name 
                                    ? 'border-red-300 dark:border-red-500/50 focus:ring-red-500' 
                                    : 'border-slate-200 dark:border-white/10 focus:ring-purple-500'
                                }
                            `}
                            placeholder="Enter initiative name"
                        />
                        {errors.name && (
                            <p className="text-xs text-red-500">{errors.name}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Description *
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            className={`
                                w-full px-4 py-2.5 rounded-lg border bg-white dark:bg-navy-950 text-navy-900 dark:text-white resize-none
                                ${errors.description 
                                    ? 'border-red-300 dark:border-red-500/50 focus:ring-red-500' 
                                    : 'border-slate-200 dark:border-white/10 focus:ring-purple-500'
                                }
                            `}
                            placeholder="Describe the initiative..."
                        />
                        {errors.description && (
                            <p className="text-xs text-red-500">{errors.description}</p>
                        )}
                    </div>

                    {/* Grid: Axis + Risk */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Source Axis
                            </label>
                            <select
                                value={sourceAxisId}
                                onChange={(e) => setSourceAxisId(e.target.value as DRDAxis)}
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                            >
                                {AXIS_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Risk Level
                            </label>
                            <select
                                value={riskLevel}
                                onChange={(e) => setRiskLevel(e.target.value as InitiativeRiskLevel)}
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                            >
                                {RISK_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Grid: Budget + ROI + Timeline */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Budget (PLN) *
                            </label>
                            <input
                                type="number"
                                value={estimatedBudget}
                                onChange={(e) => setEstimatedBudget(parseInt(e.target.value) || 0)}
                                className={`
                                    w-full px-4 py-2.5 rounded-lg border bg-white dark:bg-navy-950 text-navy-900 dark:text-white
                                    ${errors.estimatedBudget 
                                        ? 'border-red-300 dark:border-red-500/50' 
                                        : 'border-slate-200 dark:border-white/10'
                                    }
                                `}
                            />
                            {errors.estimatedBudget && (
                                <p className="text-xs text-red-500">{errors.estimatedBudget}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Expected ROI *
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                value={estimatedROI}
                                onChange={(e) => setEstimatedROI(parseFloat(e.target.value) || 0)}
                                className={`
                                    w-full px-4 py-2.5 rounded-lg border bg-white dark:bg-navy-950 text-navy-900 dark:text-white
                                    ${errors.estimatedROI 
                                        ? 'border-red-300 dark:border-red-500/50' 
                                        : 'border-slate-200 dark:border-white/10'
                                    }
                                `}
                            />
                            {errors.estimatedROI && (
                                <p className="text-xs text-red-500">{errors.estimatedROI}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Timeline
                            </label>
                            <select
                                value={timeline}
                                onChange={(e) => setTimeline(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                            >
                                {TIMELINE_OPTIONS.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Objectives */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Objectives
                        </label>
                        
                        {objectives.length > 0 && (
                            <ul className="space-y-2 mb-3">
                                {objectives.map((obj, idx) => (
                                    <li 
                                        key={idx}
                                        className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-navy-950 rounded-lg"
                                    >
                                        <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-medium text-purple-600 dark:text-purple-400 shrink-0">
                                            {idx + 1}
                                        </span>
                                        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                                            {obj}
                                        </span>
                                        <button
                                            onClick={() => handleRemoveObjective(idx)}
                                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newObjective}
                                onChange={(e) => setNewObjective(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddObjective()}
                                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white text-sm"
                                placeholder="Add new objective..."
                            />
                            <button
                                onClick={handleAddObjective}
                                disabled={!newObjective.trim()}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-colors"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Warning for high budget + high risk */}
                    {riskLevel === 'HIGH' && estimatedBudget > 500000 && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-500/20 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                    High-Risk, High-Budget Initiative
                                </p>
                                <p className="text-sm text-amber-600 dark:text-amber-400">
                                    Consider breaking this into smaller phases or implementing additional governance controls.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3 bg-slate-50 dark:bg-navy-950">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!isValid}
                        className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-400 text-white rounded-lg font-medium transition-colors"
                    >
                        <Save size={18} />
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

