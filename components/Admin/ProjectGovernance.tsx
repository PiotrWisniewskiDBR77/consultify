import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Save, AlertTriangle, CheckCircle2, Loader2, Settings2, FileText, Lock, Zap } from 'lucide-react';
import { Api } from '../../services/api';
import toast from 'react-hot-toast';

/**
 * GAP-10: Project Governance Configuration UI
 * Allows admin to configure governance settings per project
 */

interface GovernanceSettings {
    requireApprovalForPhaseTransition: boolean;
    allowPhaseRollback: boolean;
    stageGatesEnabled: boolean;
    requireChangeRequestForSchedule: boolean;
    requireChangeRequestForScope: boolean;
    aiPolicyLevel: 'ADVISORY' | 'ASSISTED' | 'PROACTIVE' | 'AUTOPILOT' | null;
    // AI Roles Model
    aiRole: 'ADVISOR' | 'MANAGER' | 'OPERATOR';
}

interface ProjectGovernanceProps {
    projectId: string;
    onSave?: () => void;
}

const defaultSettings: GovernanceSettings = {
    requireApprovalForPhaseTransition: true,
    allowPhaseRollback: false,
    stageGatesEnabled: true,
    requireChangeRequestForSchedule: true,
    requireChangeRequestForScope: true,
    aiPolicyLevel: null,
    // AI Roles Model
    aiRole: 'ADVISOR'
};

export const ProjectGovernance: React.FC<ProjectGovernanceProps> = ({ projectId, onSave }) => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<GovernanceSettings>(defaultSettings);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // Regulatory Mode: Separate state for strict compliance mode
    const [regulatoryModeEnabled, setRegulatoryModeEnabled] = useState(true); // Default to enabled (safest)
    const [isSavingRegulatoryMode, setIsSavingRegulatoryMode] = useState(false);

    useEffect(() => {
        if (projectId) {
            fetchSettings();
            fetchRegulatoryMode();
        }
    }, [projectId]);

    // Fetch Regulatory Mode status separately (stored in projects table)
    const fetchRegulatoryMode = async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}/regulatory-mode`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setRegulatoryModeEnabled(data.enabled);
            }
        } catch (err) {
            console.error('Failed to fetch regulatory mode:', err);
        }
    };

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/projects/${projectId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const project = await res.json();
                if (project.governance_settings) {
                    try {
                        const parsed = JSON.parse(project.governance_settings);
                        setSettings({ ...defaultSettings, ...parsed });
                    } catch { }
                }
            }
        } catch (err) {
            console.error('Failed to fetch governance settings:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/projects/${projectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    governanceSettings: JSON.stringify(settings)
                })
            });

            if (res.ok) {
                toast.success('Governance settings saved');
                onSave?.();
            } else {
                throw new Error('Failed to save');
            }
        } catch (err) {
            toast.error('Failed to save governance settings');
        } finally {
            setIsSaving(false);
        }
    };

    // Save Regulatory Mode separately
    const handleToggleRegulatoryMode = async () => {
        const newValue = !regulatoryModeEnabled;
        setIsSavingRegulatoryMode(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/regulatory-mode`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ enabled: newValue })
            });

            if (res.ok) {
                setRegulatoryModeEnabled(newValue);
                toast.success(newValue
                    ? 'Regulatory Mode enabled - AI is now advisory-only'
                    : 'Regulatory Mode disabled - AI can operate normally'
                );
            } else {
                throw new Error('Failed to update');
            }
        } catch (err) {
            toast.error('Failed to update Regulatory Mode');
        } finally {
            setIsSavingRegulatoryMode(false);
        }
    };

    const toggleSetting = (key: keyof GovernanceSettings) => {
        setSettings(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
        );
    }

    const settingsConfig = [
        {
            key: 'stageGatesEnabled' as const,
            label: 'Stage Gates Enabled',
            description: 'Require gate criteria to be met before phase transitions',
            icon: <Lock size={18} />
        },
        {
            key: 'requireApprovalForPhaseTransition' as const,
            label: 'Require Approval for Phase Transition',
            description: 'Decisions must be approved before moving to next phase',
            icon: <CheckCircle2 size={18} />
        },
        {
            key: 'allowPhaseRollback' as const,
            label: 'Allow Phase Rollback',
            description: 'Allow moving back to previous phases if needed',
            icon: <AlertTriangle size={18} />
        },
        {
            key: 'requireChangeRequestForSchedule' as const,
            label: 'Require CR for Schedule Changes',
            description: 'Changes to baselined schedule require a change request',
            icon: <FileText size={18} />
        },
        {
            key: 'requireChangeRequestForScope' as const,
            label: 'Require CR for Scope Changes',
            description: 'Changes to initiative scope require a change request',
            icon: <FileText size={18} />
        }
    ];

    return (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Shield size={20} className="text-purple-500" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                            Governance Settings
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Configure change control and approval rules
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Save
                </button>
            </div>

            {/* Settings List */}
            <div className="divide-y divide-slate-100 dark:divide-white/5">
                {settingsConfig.map(config => (
                    <div
                        key={config.key}
                        className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                                {config.icon}
                            </div>
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">
                                    {config.label}
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    {config.description}
                                </div>
                            </div>
                        </div>

                        {/* Toggle Switch */}
                        <button
                            onClick={() => toggleSetting(config.key)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${settings[config.key]
                                ? 'bg-purple-600'
                                : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[config.key] ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                        </button>
                    </div>
                ))}

                {/* AI Policy Level */}
                <div className="px-6 py-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                            <Zap size={18} />
                        </div>
                        <div>
                            <div className="font-medium text-slate-900 dark:text-white">
                                AI Policy Override
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                Override organization AI policy for this project
                            </div>
                        </div>
                    </div>
                    <select
                        value={settings.aiPolicyLevel || ''}
                        onChange={(e) => setSettings(prev => ({
                            ...prev,
                            aiPolicyLevel: e.target.value as any || null
                        }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 text-slate-900 dark:text-white"
                    >
                        <option value="">Use Organization Default</option>
                        <option value="ADVISORY">Advisory (Read-only)</option>
                        <option value="ASSISTED">Assisted (Drafts)</option>
                        <option value="PROACTIVE">Proactive (Suggestions)</option>
                        <option value="AUTOPILOT">Autopilot (Autonomous)</option>
                    </select>
                </div>

                {/* AI Roles Model: AI Governance Role Selector */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                            <Shield size={18} />
                        </div>
                        <div>
                            <div className="font-medium text-slate-900 dark:text-white">
                                AI Governance Role
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                Controls what AI is allowed to do in this project
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {(['ADVISOR', 'MANAGER', 'OPERATOR'] as const).map(role => {
                            const roleInfo = {
                                ADVISOR: {
                                    label: 'Advisor',
                                    desc: 'Explains only, no changes',
                                    color: 'blue'
                                },
                                MANAGER: {
                                    label: 'Manager',
                                    desc: 'Prepares drafts, needs approval',
                                    color: 'amber'
                                },
                                OPERATOR: {
                                    label: 'Operator',
                                    desc: 'Executes within governance',
                                    color: 'green'
                                }
                            };
                            const info = roleInfo[role];
                            const isSelected = settings.aiRole === role;

                            return (
                                <button
                                    key={role}
                                    onClick={() => setSettings(prev => ({ ...prev, aiRole: role }))}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${isSelected
                                        ? `border-${info.color}-500 bg-${info.color}-500/10`
                                        : 'border-slate-200 dark:border-white/10 hover:border-purple-500/50'
                                        }`}
                                >
                                    <div className={`font-semibold ${isSelected
                                        ? `text-${info.color}-600 dark:text-${info.color}-400`
                                        : 'text-slate-900 dark:text-white'
                                        }`}>
                                        {info.label}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {info.desc}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                        ⚠️ Changing AI role affects what AI can do: Advisor (read-only) → Manager (drafts) → Operator (execute)
                    </p>
                </div>

                {/* Regulatory Mode: Strict Compliance Toggle */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 bg-amber-500/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-500">
                                <Shield size={18} />
                            </div>
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                    Regulatory Mode
                                    {regulatoryModeEnabled && (
                                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-500 rounded border border-amber-500/30">
                                            ACTIVE
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    Strict compliance mode: AI can only explain and advise
                                </div>
                            </div>
                        </div>

                        {/* Toggle Switch */}
                        <button
                            onClick={handleToggleRegulatoryMode}
                            disabled={isSavingRegulatoryMode}
                            className={`relative w-12 h-6 rounded-full transition-colors ${regulatoryModeEnabled
                                    ? 'bg-amber-500'
                                    : 'bg-slate-300 dark:bg-slate-600'
                                } ${isSavingRegulatoryMode ? 'opacity-50' : ''}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${regulatoryModeEnabled ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                        </button>
                    </div>

                    {/* Warning/Info Box */}
                    <div className={`mt-3 p-3 rounded-lg text-sm ${regulatoryModeEnabled
                            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                        }`}>
                        {regulatoryModeEnabled ? (
                            <>
                                <strong>⚠️ Regulatory Mode is ON</strong>
                                <ul className="mt-1 ml-4 list-disc text-xs space-y-0.5">
                                    <li>AI cannot create, modify, or delete any data</li>
                                    <li>AI cannot propose executable actions</li>
                                    <li>AI uses only advisory language</li>
                                    <li>All blocked attempts are logged for audit</li>
                                </ul>
                            </>
                        ) : (
                            <>
                                <strong>ℹ️ Regulatory Mode is OFF</strong>
                                <p className="mt-1 text-xs">
                                    AI operates with normal permissions based on the AI Governance Role setting above.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectGovernance;
