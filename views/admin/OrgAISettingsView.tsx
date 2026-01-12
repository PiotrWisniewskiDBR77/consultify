/**
 * OrgAISettingsView
 *
 * Admin-level AI settings for organization configuration.
 * Includes policy levels, AI roles, enabled models, limits, and feature toggles.
 */

import { motion } from 'framer-motion';
import {
    AlertTriangle,
    Brain,
    ChevronRight,
    Cpu,
    DollarSign,
    Eye,
    FileCode,
    Focus,
    History,
    MessageSquare,
    Mic,
    RefreshCw,
    Save,
    Shield,
    Sparkles,
    Users,
    Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import {
    AuditLogViewer,
    ProactivitySelector,
    SettingsCard,
    SettingsSlider,
    SettingsToggle,
} from '../../components/AISettings';
import { InfoButton } from '../../components/shared/InfoButton';
import { useAppStore } from '../../store/useAppStore';
import { LLMProvider, OrgAISettings } from '../../types';

// Policy level configurations
const POLICY_LEVELS = [
    {
        id: 'ADVISORY',
        title: 'Advisory',
        description: 'AI can only explain and suggest. No modifications.',
        icon: MessageSquare,
        color: 'text-slate-400',
        bgColor: 'from-slate-700 to-slate-800',
    },
    {
        id: 'ASSISTED',
        title: 'Assisted',
        description: 'AI can create drafts that require approval.',
        icon: FileCode,
        color: 'text-blue-400',
        bgColor: 'from-blue-700 to-blue-800',
    },
    {
        id: 'PROACTIVE',
        title: 'Proactive',
        description: 'AI can execute low-risk actions automatically.',
        icon: Zap,
        color: 'text-violet-400',
        bgColor: 'from-violet-700 to-violet-800',
    },
    {
        id: 'AUTOPILOT',
        title: 'Autopilot',
        description: 'AI operates autonomously within governance rules.',
        icon: Brain,
        color: 'text-emerald-400',
        bgColor: 'from-emerald-700 to-emerald-800',
    },
];

// AI Roles
const AI_ROLES = [
    { id: 'ADVISOR', title: 'Advisor', description: 'Provides guidance and recommendations' },
    { id: 'PMO_MANAGER', title: 'PMO Manager', description: 'Manages project methodology' },
    { id: 'EXECUTOR', title: 'Executor', description: 'Executes approved actions' },
    { id: 'EDUCATOR', title: 'Educator', description: 'Teaches and explains concepts' },
];

type SettingsTab = 'policy' | 'limits' | 'features' | 'audit';

export const OrgAISettingsView: React.FC = () => {
    const { currentOrganization } = useAppStore();
    const [activeTab, setActiveTab] = useState<SettingsTab>('policy');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<OrgAISettings | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (currentOrganization?.id) {
            loadSettings();
        }
    }, [currentOrganization?.id]);

    const loadSettings = async () => {
        if (!currentOrganization?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Load org settings
            const settingsRes = await fetch(`/api/ai-settings/org/${currentOrganization.id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (settingsRes.ok) {
                const data = await settingsRes.json();
                setSettings(data);
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            toast.error('Failed to load organization AI settings');
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        if (!settings || !currentOrganization?.id) return;

        setSaving(true);
        try {
            const res = await fetch(`/api/ai-settings/org/${currentOrganization.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify(settings),
            });

            if (res.ok) {
                const updated = await res.json();
                setSettings(updated);
                setHasChanges(false);
                toast.success('Organization AI settings saved');
            } else {
                throw new Error('Save failed');
            }
        } catch (error) {
            toast.error('Failed to save settings');
        }
        setSaving(false);
    };

    const updateSetting = <K extends keyof OrgAISettings>(key: K, value: OrgAISettings[K]) => {
        setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
        setHasChanges(true);
    };

    const toggleRole = (roleId: string) => {
        if (!settings) return;
        const currentRoles = settings.activeRoles;
        const newRoles = currentRoles.includes(roleId as any)
            ? currentRoles.filter((r) => r !== roleId)
            : [...currentRoles, roleId as any];
        updateSetting('activeRoles', newRoles);
    };

    const tabs = [
        { id: 'policy' as SettingsTab, label: 'Policy & Roles', icon: Shield },
        { id: 'limits' as SettingsTab, label: 'Limits & Budget', icon: DollarSign },
        { id: 'features' as SettingsTab, label: 'Features', icon: Sparkles },
        { id: 'audit' as SettingsTab, label: 'Audit Log', icon: History },
    ];

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-navy-950">
                <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
        );
    }

    if (!settings && !loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-navy-950 p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                    <Brain className="text-slate-500" size={32} />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">No AI Settings Found</h2>
                <p className="text-slate-400 max-w-md mb-6">
                    This organization doesn't have AI settings configured yet. Please contact support or check your
                    permissions.
                </p>
                <button
                    onClick={loadSettings}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
                >
                    <RefreshCw size={16} />
                    Retry Loading
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-navy-950 overflow-hidden">
            <InfoButton cardId="admin-ai-settings" position="top-right" />

            {/* Header */}
            <div className="shrink-0 px-8 py-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <Brain className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Organization AI Settings</h1>
                            <p className="text-sm text-slate-400">
                                Configure AI behavior for {currentOrganization?.name || 'your organization'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {hasChanges && (
                            <motion.span
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full"
                            >
                                Unsaved changes
                            </motion.span>
                        )}
                        <button
                            onClick={saveSettings}
                            disabled={saving || !hasChanges}
                            className={`
                                flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all
                                ${
                                    hasChanges
                                        ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20'
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                }
                            `}
                        >
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="shrink-0 px-8 py-3 border-b border-white/5 flex gap-2 overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                            ${
                                activeTab === tab.id
                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }
                        `}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Policy & Roles Tab */}
                    {activeTab === 'policy' && settings && (
                        <>
                            {/* Policy Level */}
                            <SettingsCard
                                title="AI Policy Level"
                                description="Controls what actions AI can perform"
                                icon={Shield}
                                iconColor="text-violet-400"
                            >
                                <div className="grid grid-cols-2 gap-3">
                                    {POLICY_LEVELS.map((level) => {
                                        const Icon = level.icon;
                                        const isSelected = settings.policyLevel === level.id;
                                        const isMax = level.id === settings.maxPolicyLevel;
                                        const policyOrder = ['ADVISORY', 'ASSISTED', 'PROACTIVE', 'AUTOPILOT'];
                                        const currentIdx = policyOrder.indexOf(level.id);
                                        const maxIdx = policyOrder.indexOf(settings.maxPolicyLevel);
                                        const isDisabled = currentIdx > maxIdx;

                                        return (
                                            <motion.button
                                                key={level.id}
                                                onClick={() =>
                                                    !isDisabled && updateSetting('policyLevel', level.id as any)
                                                }
                                                disabled={isDisabled}
                                                className={`
                                                    relative p-4 rounded-xl text-left transition-all
                                                    ${
                                                        isSelected
                                                            ? `bg-gradient-to-br ${level.bgColor} border-2 border-white/30`
                                                            : 'bg-slate-800/30 border border-slate-700/50 hover:border-slate-600'
                                                    }
                                                    ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                                                `}
                                                whileHover={!isDisabled ? { scale: 1.02 } : {}}
                                                whileTap={!isDisabled ? { scale: 0.98 } : {}}
                                            >
                                                {isMax && (
                                                    <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                                                        Max Allowed
                                                    </span>
                                                )}
                                                <div className="flex items-start gap-3">
                                                    <div
                                                        className={`
                                                        w-10 h-10 rounded-lg flex items-center justify-center
                                                        ${isSelected ? 'bg-white/20' : 'bg-slate-700/50'}
                                                    `}
                                                    >
                                                        <Icon className={`w-5 h-5 ${level.color}`} />
                                                    </div>
                                                    <div>
                                                        <h4
                                                            className={`font-semibold ${isSelected ? 'text-white' : 'text-slate-300'}`}
                                                        >
                                                            {level.title}
                                                        </h4>
                                                        <p className="text-xs text-slate-400 mt-0.5">
                                                            {level.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </SettingsCard>

                            {/* Active AI Roles */}
                            <SettingsCard
                                title="Active AI Roles"
                                description="Select which AI personas are available to users"
                                icon={Users}
                                iconColor="text-blue-400"
                            >
                                <div className="space-y-2">
                                    {AI_ROLES.map((role) => (
                                        <label
                                            key={role.id}
                                            className={`
                                                flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors
                                                ${
                                                    settings.activeRoles.includes(role.id as any)
                                                        ? 'bg-violet-500/10 border border-violet-500/30'
                                                        : 'bg-slate-800/30 border border-slate-700/50 hover:border-slate-600'
                                                }
                                            `}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={settings.activeRoles.includes(role.id as any)}
                                                onChange={() => toggleRole(role.id)}
                                                className="w-4 h-4 rounded border-slate-600 text-violet-500 focus:ring-violet-500 bg-slate-700"
                                            />
                                            <div>
                                                <span className="font-medium text-white">{role.title}</span>
                                                <p className="text-xs text-slate-400">{role.description}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-700/50">
                                    <label className="block text-sm text-slate-400 mb-2">Default Role</label>
                                    <select
                                        value={settings.defaultRole}
                                        onChange={(e) => updateSetting('defaultRole', e.target.value as any)}
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-2.5 text-white focus:border-violet-500 outline-none"
                                    >
                                        {AI_ROLES.filter((r) => settings.activeRoles.includes(r.id as any)).map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </SettingsCard>

                            {/* Default Proactivity */}
                            <SettingsCard
                                title="Default Proactivity"
                                description="Default AI proactivity level for new users"
                                icon={Zap}
                                iconColor="text-emerald-400"
                            >
                                <ProactivitySelector
                                    value={settings.defaultProactivityMode}
                                    onChange={(mode) => updateSetting('defaultProactivityMode', mode)}
                                    showBehaviors={true}
                                />
                            </SettingsCard>
                        </>
                    )}

                    {/* Models Tab */}

                    {/* Limits & Budget Tab */}
                    {activeTab === 'limits' && settings && (
                        <>
                            <SettingsCard
                                title="Usage Limits"
                                description="Set daily and monthly limits for AI usage"
                                icon={AlertTriangle}
                                iconColor="text-amber-400"
                            >
                                <div className="space-y-6">
                                    <SettingsSlider
                                        label="Max AI Calls per Day"
                                        description="Daily limit per user"
                                        value={settings.maxAICallsPerDay}
                                        onChange={(v) => updateSetting('maxAICallsPerDay', v)}
                                        min={10}
                                        max={1000}
                                        step={10}
                                        defaultValue={100}
                                    />

                                    <SettingsSlider
                                        label="Max Tokens per Month"
                                        description="Monthly token budget for the organization"
                                        value={settings.maxTokensPerMonth}
                                        onChange={(v) => updateSetting('maxTokensPerMonth', v)}
                                        min={50000}
                                        max={10000000}
                                        step={50000}
                                        formatValue={(v) => `${(v / 1000).toFixed(0)}k`}
                                        defaultValue={500000}
                                    />
                                </div>
                            </SettingsCard>

                            <SettingsCard
                                title="Budget Control"
                                description="Set spending limits and automatic actions"
                                icon={DollarSign}
                                iconColor="text-emerald-400"
                            >
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-2">
                                                Monthly Budget (USD)
                                            </label>
                                            <input
                                                type="number"
                                                value={settings.monthlyBudgetUSD}
                                                onChange={(e) =>
                                                    updateSetting('monthlyBudgetUSD', parseFloat(e.target.value) || 0)
                                                }
                                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-2.5 text-white focus:border-violet-500 outline-none"
                                                placeholder="0 = unlimited"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-2">
                                                Hard Limit (USD)
                                            </label>
                                            <input
                                                type="number"
                                                value={settings.hardLimitUSD}
                                                onChange={(e) =>
                                                    updateSetting('hardLimitUSD', parseFloat(e.target.value) || 0)
                                                }
                                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-2.5 text-white focus:border-violet-500 outline-none"
                                                placeholder="0 = no hard limit"
                                            />
                                        </div>
                                    </div>

                                    <SettingsToggle
                                        label="Freeze on Limit"
                                        description="Automatically disable AI when budget is exceeded"
                                        checked={settings.freezeOnLimit}
                                        onChange={(v) => updateSetting('freezeOnLimit', v)}
                                        icon={AlertTriangle}
                                        iconColor="text-rose-400"
                                    />
                                </div>
                            </SettingsCard>
                        </>
                    )}

                    {/* Features Tab */}
                    {activeTab === 'features' && settings && (
                        <SettingsCard
                            title="AI Features"
                            description="Enable or disable specific AI capabilities for your organization"
                            icon={Sparkles}
                            iconColor="text-violet-400"
                        >
                            <div className="space-y-4">
                                <SettingsToggle
                                    label="Artifacts Panel"
                                    description="Allow AI to generate structured content (code, documents, diagrams)"
                                    icon={FileCode}
                                    iconColor="text-blue-400"
                                    checked={settings.artifactsEnabled}
                                    onChange={(v) => updateSetting('artifactsEnabled', v)}
                                />

                                <SettingsToggle
                                    label="Thinking Steps (Chain of Thought)"
                                    description="Show AI reasoning process with expandable thinking blocks"
                                    icon={Brain}
                                    iconColor="text-violet-400"
                                    checked={settings.thinkingStepsEnabled}
                                    onChange={(v) => updateSetting('thinkingStepsEnabled', v)}
                                />

                                <SettingsToggle
                                    label="Focus Modes"
                                    description="Allow users to filter AI context (PMO Docs, Project Data, Research)"
                                    icon={Focus}
                                    iconColor="text-cyan-400"
                                    checked={settings.focusModesEnabled}
                                    onChange={(v) => updateSetting('focusModesEnabled', v)}
                                />

                                <SettingsToggle
                                    label="Web Search"
                                    description="Allow AI to search the internet for current information"
                                    icon={Eye}
                                    iconColor="text-emerald-400"
                                    checked={settings.webSearchEnabled}
                                    onChange={(v) => updateSetting('webSearchEnabled', v)}
                                />

                                <SettingsToggle
                                    label="Voice Conversations"
                                    description="Enable voice input and output for AI interactions"
                                    icon={Mic}
                                    iconColor="text-rose-400"
                                    checked={settings.voiceEnabled}
                                    onChange={(v) => updateSetting('voiceEnabled', v)}
                                />

                                <div className="pt-4 border-t border-slate-700/50">
                                    <h4 className="font-medium text-white mb-3">Audit Settings</h4>

                                    <div className="space-y-3">
                                        <SettingsToggle
                                            label="Audit All AI Requests"
                                            description="Log every AI interaction for compliance (increases storage)"
                                            icon={History}
                                            iconColor="text-amber-400"
                                            checked={settings.auditAllRequests}
                                            onChange={(v) => updateSetting('auditAllRequests', v)}
                                        />

                                        <SettingsToggle
                                            label="Audit Policy Changes"
                                            description="Track all changes to AI settings"
                                            icon={Shield}
                                            iconColor="text-amber-400"
                                            checked={settings.auditPolicyChanges}
                                            onChange={(v) => updateSetting('auditPolicyChanges', v)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </SettingsCard>
                    )}

                    {/* Audit Log Tab */}
                    {activeTab === 'audit' && currentOrganization && (
                        <SettingsCard
                            title="Settings Change History"
                            description="View all changes made to AI settings"
                            icon={History}
                            iconColor="text-amber-400"
                        >
                            <AuditLogViewer
                                targetId={currentOrganization.id}
                                showFilters={true}
                                showExport={true}
                                limit={100}
                            />
                        </SettingsCard>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrgAISettingsView;
