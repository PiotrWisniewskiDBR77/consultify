/**
 * PolicyGovernanceTab - AI Policy & Governance
 *
 * Tab 3 of the reorganized AI & Intelligence section
 * Includes: AI Policy Level, AI Roles, Default Proactivity Mode, Governance Rules
 *
 * Moved from OrgAISettingsView for centralized AI management
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Brain,
  FileCode,
  ListChecks,
  Lock,
  MessageSquare,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Users,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { LoadingState } from '@/components/ui/primitives';

import { useAppStore } from '../../../store/useAppStore';
import { OrgAISettings } from '../../../types';
import { ProactivitySelector, SettingsCard } from '../../AISettings';

// Policy level configurations
const POLICY_LEVELS = [
  {
    id: 'ADVISORY',
    title: 'Advisory',
    description: 'AI can only explain and suggest. No modifications.',
    icon: MessageSquare,
    color: 'text-slate-600 dark:text-slate-500',
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
    color: 'text-primary-400',
    bgColor: 'from-primary-700 to-primary-800',
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

export const PolicyGovernanceTab: React.FC = () => {
  const { currentOrganization } = useAppStore();
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
    if (!currentOrganization?.id) return;

    setLoading(true);
    try {
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
    }
    setLoading(false);
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
        toast.success('AI Policy settings saved');
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

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Save Button - DBR77 Compatible */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            <Shield className="text-primary-600 dark:text-primary-400" size={20} />
            AI Policy & Governance
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure AI behavior and governance rules for your organization
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs text-warning-700 dark:text-amber-400 bg-warning-500/10 px-3 py-1.5 rounded-full border border-warning-500/30 dark:border-transparent"
            >
              Unsaved changes
            </motion.span>
          )}
          <button
            onClick={saveSettings}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 p-4 py-2.5 rounded-lg font-medium transition-all ${
              hasChanges
                ? 'bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] shadow-lg shadow-primary-500/20'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {settings && (
        <div className="space-y-6">
          {/* Policy Level */}
          <SettingsCard
            title="AI Policy Level"
            description="Controls what actions AI can perform in your organization"
            icon={Shield}
            iconColor="text-primary-400"
          >
            <div className="grid grid-cols-2 gap-3">
              {POLICY_LEVELS.map((level) => {
                const Icon = level.icon;
                const isSelected = settings.policyLevel === level.id;
                const policyOrder = ['ADVISORY', 'ASSISTED', 'PROACTIVE', 'AUTOPILOT'];
                const currentIdx = policyOrder.indexOf(level.id);
                const maxIdx = policyOrder.indexOf(settings.maxPolicyLevel);
                const isDisabled = currentIdx > maxIdx;
                const isMax = level.id === settings.maxPolicyLevel;

                return (
                  <motion.button
                    key={level.id}
                    onClick={() => !isDisabled && updateSetting('policyLevel', level.id as any)}
                    disabled={isDisabled}
                    className={`relative p-4 rounded-xl text-left transition-all ${
                      isSelected
                        ? `bg-gradient-to-br ${level.bgColor} border-2 border-c-border`
                        : 'bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
                    } ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    whileHover={!isDisabled ? { scale: 1.02 } : {}}
                    whileTap={!isDisabled ? { scale: 0.98 } : {}}
                  >
                    {isMax && (
                      <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full bg-warning-500/10 text-warning-700 dark:text-amber-400 border border-warning-500/30 dark:border-transparent">
                        Max Allowed
                      </span>
                    )}
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700/50'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${level.color}`} />
                      </div>
                      <div>
                        <h4
                          className={`font-semibold ${isSelected ? 'text-c-text' : 'text-navy-900 dark:text-slate-300'}`}
                        >
                          {level.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    settings.activeRoles.includes(role.id as any)
                      ? 'bg-primary-500/10 border border-primary-500/30'
                      : 'bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={settings.activeRoles.includes(role.id as any)}
                    onChange={() => toggleRole(role.id)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-c-focus bg-white dark:bg-slate-700"
                  />
                  <div>
                    <span className="font-medium text-navy-900 dark:text-white">{role.title}</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{role.description}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">
                Default Role
              </label>
              <select
                value={settings.defaultRole}
                onChange={(e) => updateSetting('defaultRole', e.target.value as any)}
                className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-navy-900 dark:text-white focus:border-c-focus-solid outline-none"
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

          {/* Governance Rules */}
          <SettingsCard
            title="Governance Rules"
            description="Additional governance and approval settings"
            icon={Lock}
            iconColor="text-amber-400"
          >
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/50">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-warning-500/20 rounded-lg">
                    <AlertTriangle size={16} className="text-warning-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-navy-900 dark:text-white">Regulatory Mode</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      When enabled, AI operates in strict compliance mode. All actions require
                      explicit approval.
                    </p>
                    <p className="text-xs text-warning-600 dark:text-amber-400 mt-2">
                      Note: Regulatory Mode can be configured per-project in Project Settings.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/50">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary-500/20 rounded-lg">
                    <ListChecks size={16} className="text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-navy-900 dark:text-white">Project Overrides</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Individual projects can override organization AI policy settings.
                    </p>
                    <button className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
                      View Project Overrides →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </SettingsCard>
        </div>
      )}
    </div>
  );
};

export default PolicyGovernanceTab;
