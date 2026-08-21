/**
 * OrgAISettingsView
 *
 * Admin-level AI settings for organization configuration.
 * Includes policy levels, AI roles, enabled models, limits, and feature toggles.
 */

import { motion } from 'framer-motion';
import i18n from 'i18next';
import {
  AlertTriangle,
  Brain,
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
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { DegradedState } from '../../components/Admin/AdminState';
import {
  AuditLogViewer,
  ProactivitySelector,
  SettingsCard,
  SettingsSlider,
  SettingsToggle,
} from '../../components/AISettings';
import { InfoButton } from '../../components/shared/InfoButton';
import { SettingsHeaderActionPortal } from '../../components/settings/SettingsHeaderActions';
import { AdminApi } from '../../services/api/admin.api';
import { useAppStore } from '../../store/useAppStore';
import { AIPolicyLevel, AIRole, OrgAISettings } from '../../types/domain/ai';
import { normalizeApiErrorMessage } from '../../utils/apiError';

type SettingsTab = 'policy' | 'limits' | 'features' | 'audit';

const normalizeOrgAISettings = (
  organizationId: string,
  raw: Partial<OrgAISettings> | null | undefined
): OrgAISettings => ({
  organizationId,
  policyLevel: raw?.policyLevel || 'ADVISORY',
  maxPolicyLevel: raw?.maxPolicyLevel || 'AUTOPILOT',
  defaultProactivityMode: raw?.defaultProactivityMode || 'REACTIVE',
  activeRoles: Array.isArray(raw?.activeRoles) ? raw.activeRoles : ['ADVISOR'],
  defaultRole: raw?.defaultRole || 'ADVISOR',
  enabledModelIds: Array.isArray(raw?.enabledModelIds) ? raw.enabledModelIds : [],
  maxAICallsPerDay: typeof raw?.maxAICallsPerDay === 'number' ? raw.maxAICallsPerDay : 0,
  maxTokensPerMonth: typeof raw?.maxTokensPerMonth === 'number' ? raw.maxTokensPerMonth : 0,
  monthlyBudgetUSD: typeof raw?.monthlyBudgetUSD === 'number' ? raw.monthlyBudgetUSD : 0,
  hardLimitUSD: typeof raw?.hardLimitUSD === 'number' ? raw.hardLimitUSD : 0,
  freezeOnLimit: Boolean(raw?.freezeOnLimit),
  webSearchEnabled: Boolean(raw?.webSearchEnabled),
  artifactsEnabled: Boolean(raw?.artifactsEnabled),
  thinkingStepsEnabled: Boolean(raw?.thinkingStepsEnabled),
  focusModesEnabled: Boolean(raw?.focusModesEnabled),
  voiceEnabled: Boolean(raw?.voiceEnabled),
  autoTierEnabled: raw?.autoTierEnabled,
  autoTierDirection: raw?.autoTierDirection,
  autoTierThreshold: raw?.autoTierThreshold,
  systemPrompts: Array.isArray(raw?.systemPrompts) ? raw.systemPrompts : [],
  defaultSystemPromptId: raw?.defaultSystemPromptId,
  auditAllRequests: Boolean(raw?.auditAllRequests),
  auditPolicyChanges: Boolean(raw?.auditPolicyChanges),
  createdAt: raw?.createdAt || new Date(0).toISOString(),
  updatedAt: raw?.updatedAt || new Date(0).toISOString(),
  updatedBy: raw?.updatedBy || null,
});

const unorderedStringArraysMatch = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

const orgAISettingsMatch = (persisted: OrgAISettings, expected: OrgAISettings): boolean => {
  return (
    persisted.policyLevel === expected.policyLevel &&
    persisted.maxPolicyLevel === expected.maxPolicyLevel &&
    persisted.defaultProactivityMode === expected.defaultProactivityMode &&
    persisted.defaultRole === expected.defaultRole &&
    unorderedStringArraysMatch(persisted.activeRoles, expected.activeRoles) &&
    unorderedStringArraysMatch(persisted.enabledModelIds, expected.enabledModelIds) &&
    persisted.maxAICallsPerDay === expected.maxAICallsPerDay &&
    persisted.maxTokensPerMonth === expected.maxTokensPerMonth &&
    persisted.monthlyBudgetUSD === expected.monthlyBudgetUSD &&
    persisted.hardLimitUSD === expected.hardLimitUSD &&
    persisted.freezeOnLimit === expected.freezeOnLimit &&
    persisted.webSearchEnabled === expected.webSearchEnabled &&
    persisted.artifactsEnabled === expected.artifactsEnabled &&
    persisted.thinkingStepsEnabled === expected.thinkingStepsEnabled &&
    persisted.focusModesEnabled === expected.focusModesEnabled &&
    persisted.voiceEnabled === expected.voiceEnabled &&
    persisted.autoTierEnabled === expected.autoTierEnabled &&
    persisted.autoTierDirection === expected.autoTierDirection &&
    persisted.autoTierThreshold === expected.autoTierThreshold &&
    persisted.defaultSystemPromptId === expected.defaultSystemPromptId &&
    persisted.auditAllRequests === expected.auditAllRequests &&
    persisted.auditPolicyChanges === expected.auditPolicyChanges
  );
};

const validateOrgAISettings = (settings: OrgAISettings): string | null => {
  if (settings.maxAICallsPerDay < 1)
    return i18n.t(
      'admin.aiControlCenter.orgAISettings.validation.maxCallsPerDay',
      'Daily AI call limit must be at least 1.'
    );
  if (settings.maxTokensPerMonth < 1)
    return i18n.t(
      'admin.aiControlCenter.orgAISettings.validation.maxTokensPerMonth',
      'Monthly token limit must be at least 1.'
    );
  if (settings.monthlyBudgetUSD < 0 || settings.hardLimitUSD < 0) {
    return i18n.t(
      'admin.aiControlCenter.orgAISettings.validation.negativeBudget',
      'Budget limits cannot be negative.'
    );
  }
  if (settings.hardLimitUSD > 0 && settings.monthlyBudgetUSD > settings.hardLimitUSD) {
    return i18n.t(
      'admin.aiControlCenter.orgAISettings.validation.budgetExceedsHardLimit',
      'Monthly budget cannot be higher than the hard limit.'
    );
  }
  if (settings.activeRoles.length === 0)
    return i18n.t(
      'admin.aiControlCenter.orgAISettings.validation.atLeastOneRole',
      'At least one AI role must remain active.'
    );
  if (!settings.activeRoles.includes(settings.defaultRole)) {
    return i18n.t(
      'admin.aiControlCenter.orgAISettings.validation.defaultRoleMustBeActive',
      'Default AI role must be one of the active roles.'
    );
  }
  return null;
};

export const OrgAISettingsView: React.FC = () => {
  const { t } = useTranslation();
  // Policy level configurations
  const POLICY_LEVELS = [
    {
      id: 'ADVISORY',
      title: t('admin.aiControlCenter.orgAISettings.levels.advisory.title', 'Advisory'),
      description: t(
        'admin.aiControlCenter.orgAISettings.levels.advisory.description',
        'AI can only explain and suggest. No modifications.'
      ),
      icon: MessageSquare,
      color: 'text-slate-600 dark:text-slate-500',
      bgColor: 'from-slate-700 to-slate-800',
    },
    {
      id: 'ASSISTED',
      title: t('admin.aiControlCenter.orgAISettings.levels.assisted.title', 'Assisted'),
      description: t(
        'admin.aiControlCenter.orgAISettings.levels.assisted.description',
        'AI can create drafts that require approval.'
      ),
      icon: FileCode,
      color: 'text-blue-400',
      bgColor: 'from-blue-700 to-blue-800',
    },
    {
      id: 'PROACTIVE',
      title: t('admin.aiControlCenter.orgAISettings.levels.proactive.title', 'Proactive'),
      description: t(
        'admin.aiControlCenter.orgAISettings.levels.proactive.description',
        'AI can execute low-risk actions automatically.'
      ),
      icon: Zap,
      color: 'text-primary-400',
      bgColor: 'from-primary-700 to-primary-800',
    },
    {
      id: 'AUTOPILOT',
      title: t('admin.aiControlCenter.orgAISettings.levels.autopilot.title', 'Autopilot'),
      description: t(
        'admin.aiControlCenter.orgAISettings.levels.autopilot.description',
        'AI operates autonomously within governance rules.'
      ),
      icon: Brain,
      color: 'text-emerald-400',
      bgColor: 'from-emerald-700 to-emerald-800',
    },
  ];

  // AI Roles
  const AI_ROLES = [
    {
      id: 'ADVISOR',
      title: t('admin.aiControlCenter.orgAISettings.roles.advisor.title', 'Advisor'),
      description: t(
        'admin.aiControlCenter.orgAISettings.roles.advisor.description',
        'Provides guidance and recommendations'
      ),
    },
    {
      id: 'PMO_MANAGER',
      title: t('admin.aiControlCenter.orgAISettings.roles.pmoManager.title', 'PMO Manager'),
      description: t(
        'admin.aiControlCenter.orgAISettings.roles.pmoManager.description',
        'Manages project methodology'
      ),
    },
    {
      id: 'EXECUTOR',
      title: t('admin.aiControlCenter.orgAISettings.roles.executor.title', 'Executor'),
      description: t(
        'admin.aiControlCenter.orgAISettings.roles.executor.description',
        'Executes approved actions'
      ),
    },
    {
      id: 'EDUCATOR',
      title: t('admin.aiControlCenter.orgAISettings.roles.educator.title', 'Educator'),
      description: t(
        'admin.aiControlCenter.orgAISettings.roles.educator.description',
        'Teaches and explains concepts'
      ),
    },
  ] satisfies Array<{ id: AIRole; title: string; description: string }>;

  const { currentOrganization } = useAppStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('policy');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<OrgAISettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const organizationId = currentOrganization?.id;

  const loadSettings = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setLoadError(null);
      const data = await AdminApi.getOrganizationAISettings(organizationId);
      setSettings(normalizeOrgAISettings(organizationId, (data as Partial<OrgAISettings>) || null));
      setHasChanges(false);
    } catch (error) {
      const message = normalizeApiErrorMessage(
        error,
        t(
          'admin.aiControlCenter.orgAISettings.errors.load',
          'Failed to load organization AI settings'
        )
      );
      setSettings(null);
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [organizationId, t]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    if (!settings || !currentOrganization?.id) return;
    const validationError = validateOrgAISettings(settings);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      setSaveError(null);
      const expected = settings;
      await AdminApi.updateOrganizationAISettings(
        currentOrganization.id,
        expected as unknown as Record<string, unknown>
      );
      const persisted = await AdminApi.getOrganizationAISettings(currentOrganization.id);
      const persistedSettings = normalizeOrgAISettings(
        currentOrganization.id,
        (persisted as Partial<OrgAISettings>) || null
      );
      if (!orgAISettingsMatch(persistedSettings, expected)) {
        throw new Error(
          t(
            'admin.aiControlCenter.orgAISettings.errors.saveNotConfirmed',
            'Organization AI settings save was not confirmed by the server'
          )
        );
      }

      setSettings(persistedSettings);
      setHasChanges(false);
      toast.success(
        t('admin.aiControlCenter.orgAISettings.toasts.saved', 'Organization AI settings saved')
      );
    } catch (error) {
      const message = normalizeApiErrorMessage(
        error,
        t(
          'admin.aiControlCenter.orgAISettings.errors.save',
          'Failed to save organization AI settings'
        )
      );
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof OrgAISettings>(key: K, value: OrgAISettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
    setSaveError(null);
    setHasChanges(true);
  };

  const toggleRole = (roleId: string) => {
    if (!settings) return;
    const currentRoles = settings.activeRoles;
    const nextRole = roleId as AIRole;
    if (currentRoles.includes(nextRole) && currentRoles.length === 1) {
      toast.error(
        t(
          'admin.aiControlCenter.orgAISettings.validation.atLeastOneRole',
          'At least one AI role must remain active.'
        )
      );
      return;
    }
    const newRoles = currentRoles.includes(nextRole)
      ? currentRoles.filter((r) => r !== nextRole)
      : [...currentRoles, nextRole];
    setSettings((prev) => {
      if (!prev) return prev;
      const nextDefaultRole = newRoles.includes(prev.defaultRole) ? prev.defaultRole : newRoles[0];
      return { ...prev, activeRoles: newRoles, defaultRole: nextDefaultRole };
    });
    setSaveError(null);
    setHasChanges(true);
  };

  const tabs = [
    {
      id: 'policy' as SettingsTab,
      label: t('admin.aiControlCenter.orgAISettings.tabs.policy', 'Policy & Roles'),
      icon: Shield,
    },
    {
      id: 'limits' as SettingsTab,
      label: t('admin.aiControlCenter.orgAISettings.tabs.limits', 'Limits & Budget'),
      icon: DollarSign,
    },
    {
      id: 'features' as SettingsTab,
      label: t('admin.aiControlCenter.orgAISettings.tabs.features', 'Features'),
      icon: Sparkles,
    },
    {
      id: 'audit' as SettingsTab,
      label: t('admin.aiControlCenter.orgAISettings.tabs.audit', 'Audit Log'),
      icon: History,
    },
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-c-bg">
        <RefreshCw className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  if (!settings && !loading) {
    if (loadError) {
      return (
        <div className="h-full bg-c-bg p-8">
          <DegradedState
            title={t(
              'admin.aiControlCenter.orgAISettings.unavailableTitle',
              'Organization AI settings unavailable'
            )}
            description={loadError}
          />
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center bg-c-bg p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-c-surface-raised flex items-center justify-center mb-4">
          <Brain className="text-slate-500 dark:text-slate-400" size={32} />
        </div>
        <h2 className="text-xl font-semibold text-c-text mb-2">
          {t('admin.aiControlCenter.orgAISettings.noSettingsFound', 'No AI Settings Found')}
        </h2>
        <p className="text-slate-600 dark:text-slate-500 max-w-md mb-6">
          {t(
            'admin.aiControlCenter.orgAISettings.noSettingsDescription',
            "This organization doesn't have AI settings configured yet. Please contact support or check your permissions."
          )}
        </p>
        <button
          onClick={loadSettings}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
        >
          <RefreshCw size={16} />
          {t('admin.aiControlCenter.orgAISettings.retryLoading', 'Retry Loading')}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-c-bg overflow-hidden">
      <InfoButton cardId="admin-ai-settings" position="top-right" />

      {/* Header */}
      <div className="shrink-0 px-8 py-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Brain className="text-c-text" size={24} />
            </div>
            <div>
              <h2 className="type-section-title text-c-text">
                {t('admin.aiControlCenter.orgAISettings.title', 'Organization AI Settings')}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-500">
                {t(
                  'admin.aiControlCenter.orgAISettings.configureFor',
                  'Configure AI behavior for {{orgName}}',
                  {
                    orgName:
                      currentOrganization?.name ||
                      t(
                        'admin.aiControlCenter.orgAISettings.yourOrganization',
                        'your organization'
                      ),
                  }
                )}
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
                {t('admin.aiControlCenter.orgAISettings.unsavedChanges', 'Unsaved changes')}
              </motion.span>
            )}
            <SettingsHeaderActionPortal>
              <button
                onClick={saveSettings}
                disabled={saving || !hasChanges}
                className={`
                                flex items-center gap-2 p-4 py-2.5 rounded-lg font-medium transition-all
                                ${
                                  hasChanges
                                    ? 'bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] shadow-lg shadow-primary-500/20'
                                    : 'bg-c-surface-raised text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                }
                            `}
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {t('admin.aiControlCenter.orgAISettings.saveChanges', 'Save Changes')}
              </button>
            </SettingsHeaderActionPortal>
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
                                ? 'bg-c-text text-c-bg shadow-lg shadow-primary-500/20'
                                : 'text-slate-600 dark:text-slate-500 hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/20'
                            }
                        `}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {saveError && (
        <div
          role="alert"
          className="mx-8 mt-4 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-sm text-danger-200"
        >
          {saveError}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Policy & Roles Tab */}
          {activeTab === 'policy' && settings && (
            <>
              {/* Policy Level */}
              <SettingsCard
                title={t(
                  'admin.aiControlCenter.orgAISettings.policyLevel.title',
                  'AI Policy Level'
                )}
                description={t(
                  'admin.aiControlCenter.orgAISettings.policyLevel.description',
                  'Controls what actions AI can perform'
                )}
                icon={Shield}
                iconColor="text-primary-400"
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
                          !isDisabled && updateSetting('policyLevel', level.id as AIPolicyLevel)
                        }
                        disabled={isDisabled}
                        className={`
                                                    relative p-4 rounded-xl text-left transition-all
                                                    ${
                                                      isSelected
                                                        ? `bg-gradient-to-br ${level.bgColor} border-2 border-white/30`
                                                        : 'bg-c-surface-raised/30 border border-c-border/50 hover:border-slate-600'
                                                    }
                                                    ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                                                `}
                        whileHover={!isDisabled ? { scale: 1.02 } : {}}
                        whileTap={!isDisabled ? { scale: 0.98 } : {}}
                      >
                        {isMax && (
                          <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                            {t('admin.aiControlCenter.orgAISettings.maxAllowed', 'Max Allowed')}
                          </span>
                        )}
                        <div className="flex items-start gap-3">
                          <div
                            className={`
                                                        w-10 h-10 rounded-lg flex items-center justify-center
                                                        ${isSelected ? 'bg-white/20' : 'bg-c-surface-raised/50'}
                                                    `}
                          >
                            <Icon className={`w-5 h-5 ${level.color}`} />
                          </div>
                          <div>
                            <h4
                              className={`font-semibold ${isSelected ? 'text-c-text' : 'text-slate-600'}`}
                            >
                              {level.title}
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">
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
                title={t(
                  'admin.aiControlCenter.orgAISettings.activeRoles.title',
                  'Active AI Roles'
                )}
                description={t(
                  'admin.aiControlCenter.orgAISettings.activeRoles.description',
                  'Select which AI personas are available to users'
                )}
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
                                                  settings.activeRoles.includes(role.id)
                                                    ? 'bg-primary-500/10 border border-primary-500/30'
                                                    : 'bg-c-surface-raised/30 border border-c-border/50 hover:border-slate-600'
                                                }
                                            `}
                    >
                      <input
                        type="checkbox"
                        checked={settings.activeRoles.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className="w-4 h-4 rounded border-slate-600 text-primary-500 focus:ring-primary-500 bg-c-surface-raised"
                      />
                      <div>
                        <span className="font-medium text-c-text">{role.title}</span>
                        <p className="text-xs text-slate-600 dark:text-slate-500">
                          {role.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-c-border/50">
                  <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
                    {t('admin.aiControlCenter.orgAISettings.defaultRole', 'Default Role')}
                  </label>
                  <select
                    value={settings.defaultRole}
                    onChange={(e) => updateSetting('defaultRole', e.target.value as AIRole)}
                    className="w-full bg-c-surface-raised/50 border border-c-border rounded-lg p-2 text-c-text focus:border-primary-500 outline-none"
                  >
                    {AI_ROLES.filter((r) => settings.activeRoles.includes(r.id)).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              </SettingsCard>

              {/* Default Proactivity */}
              <SettingsCard
                title={t(
                  'admin.aiControlCenter.orgAISettings.defaultProactivity.title',
                  'Default Proactivity'
                )}
                description={t(
                  'admin.aiControlCenter.orgAISettings.defaultProactivity.description',
                  'Default AI proactivity level for new users'
                )}
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
                title={t('admin.aiControlCenter.orgAISettings.usageLimits.title', 'Usage Limits')}
                description={t(
                  'admin.aiControlCenter.orgAISettings.usageLimits.description',
                  'Set daily and monthly limits for AI usage'
                )}
                icon={AlertTriangle}
                iconColor="text-amber-400"
              >
                <div className="space-y-6">
                  <SettingsSlider
                    label={t(
                      'admin.aiControlCenter.orgAISettings.usageLimits.maxCallsPerDay',
                      'Max AI Calls per Day'
                    )}
                    description={t(
                      'admin.aiControlCenter.orgAISettings.usageLimits.maxCallsPerDayDescription',
                      'Daily limit per user'
                    )}
                    value={settings.maxAICallsPerDay}
                    onChange={(v) => updateSetting('maxAICallsPerDay', v)}
                    min={10}
                    max={1000}
                    step={10}
                    defaultValue={100}
                  />

                  <SettingsSlider
                    label={t(
                      'admin.aiControlCenter.orgAISettings.usageLimits.maxTokensPerMonth',
                      'Max Tokens per Month'
                    )}
                    description={t(
                      'admin.aiControlCenter.orgAISettings.usageLimits.maxTokensPerMonthDescription',
                      'Monthly token budget for the organization'
                    )}
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
                title={t(
                  'admin.aiControlCenter.orgAISettings.budgetControl.title',
                  'Budget Control'
                )}
                description={t(
                  'admin.aiControlCenter.orgAISettings.budgetControl.description',
                  'Set spending limits and automatic actions'
                )}
                icon={DollarSign}
                iconColor="text-emerald-400"
              >
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
                        {t(
                          'admin.aiControlCenter.orgAISettings.budgetControl.monthlyBudget',
                          'Monthly Budget (USD)'
                        )}
                      </label>
                      <input
                        type="number"
                        value={settings.monthlyBudgetUSD}
                        onChange={(e) =>
                          updateSetting('monthlyBudgetUSD', parseFloat(e.target.value) || 0)
                        }
                        className="w-full bg-c-surface-raised/50 border border-c-border rounded-lg p-2 text-c-text focus:border-primary-500 outline-none"
                        placeholder={t(
                          'admin.aiControlCenter.orgAISettings.budgetControl.unlimitedPlaceholder',
                          '0 = unlimited'
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
                        {t(
                          'admin.aiControlCenter.orgAISettings.budgetControl.hardLimit',
                          'Hard Limit (USD)'
                        )}
                      </label>
                      <input
                        type="number"
                        value={settings.hardLimitUSD}
                        onChange={(e) =>
                          updateSetting('hardLimitUSD', parseFloat(e.target.value) || 0)
                        }
                        className="w-full bg-c-surface-raised/50 border border-c-border rounded-lg p-2 text-c-text focus:border-primary-500 outline-none"
                        placeholder={t(
                          'admin.aiControlCenter.orgAISettings.budgetControl.noHardLimitPlaceholder',
                          '0 = no hard limit'
                        )}
                      />
                    </div>
                  </div>

                  <SettingsToggle
                    label={t(
                      'admin.aiControlCenter.orgAISettings.budgetControl.freezeOnLimit',
                      'Freeze on Limit'
                    )}
                    description={t(
                      'admin.aiControlCenter.orgAISettings.budgetControl.freezeOnLimitDescription',
                      'Automatically disable AI when budget is exceeded'
                    )}
                    checked={settings.freezeOnLimit}
                    onChange={(v) => updateSetting('freezeOnLimit', v)}
                    icon={AlertTriangle}
                    iconColor="text-danger-400"
                  />
                </div>
              </SettingsCard>
            </>
          )}

          {/* Features Tab */}
          {activeTab === 'features' && settings && (
            <SettingsCard
              title={t('admin.aiControlCenter.orgAISettings.features.title', 'AI Features')}
              description={t(
                'admin.aiControlCenter.orgAISettings.features.description',
                'Enable or disable specific AI capabilities for your organization'
              )}
              icon={Sparkles}
              iconColor="text-primary-400"
            >
              <div className="space-y-4">
                <SettingsToggle
                  label={t(
                    'admin.aiControlCenter.orgAISettings.features.artifacts.label',
                    'Artifacts Panel'
                  )}
                  description={t(
                    'admin.aiControlCenter.orgAISettings.features.artifacts.description',
                    'Allow AI to generate structured content (code, documents, diagrams)'
                  )}
                  icon={FileCode}
                  iconColor="text-blue-400"
                  checked={settings.artifactsEnabled}
                  onChange={(v) => updateSetting('artifactsEnabled', v)}
                />

                <SettingsToggle
                  label={t(
                    'admin.aiControlCenter.orgAISettings.features.thinkingSteps.label',
                    'Thinking Steps (Chain of Thought)'
                  )}
                  description={t(
                    'admin.aiControlCenter.orgAISettings.features.thinkingSteps.description',
                    'Show AI reasoning process with expandable thinking blocks'
                  )}
                  icon={Brain}
                  iconColor="text-primary-400"
                  checked={settings.thinkingStepsEnabled}
                  onChange={(v) => updateSetting('thinkingStepsEnabled', v)}
                />

                <SettingsToggle
                  label={t(
                    'admin.aiControlCenter.orgAISettings.features.focusModes.label',
                    'Focus Modes'
                  )}
                  description={t(
                    'admin.aiControlCenter.orgAISettings.features.focusModes.description',
                    'Allow users to filter AI context (PMO Docs, Project Data, Research)'
                  )}
                  icon={Focus}
                  iconColor="text-blue-400"
                  checked={settings.focusModesEnabled}
                  onChange={(v) => updateSetting('focusModesEnabled', v)}
                />

                <SettingsToggle
                  label={t(
                    'admin.aiControlCenter.orgAISettings.features.webSearch.label',
                    'Web Search'
                  )}
                  description={t(
                    'admin.aiControlCenter.orgAISettings.features.webSearch.description',
                    'Allow AI to search the internet for current information'
                  )}
                  icon={Eye}
                  iconColor="text-emerald-400"
                  checked={settings.webSearchEnabled}
                  onChange={(v) => updateSetting('webSearchEnabled', v)}
                />

                <SettingsToggle
                  label={t(
                    'admin.aiControlCenter.orgAISettings.features.voice.label',
                    'Voice Conversations'
                  )}
                  description={t(
                    'admin.aiControlCenter.orgAISettings.features.voice.description',
                    'Enable voice input and output for AI interactions'
                  )}
                  icon={Mic}
                  iconColor="text-danger-400"
                  checked={settings.voiceEnabled}
                  onChange={(v) => updateSetting('voiceEnabled', v)}
                />

                <div className="pt-4 border-t border-c-border/50">
                  <h4 className="font-medium text-c-text mb-3">
                    {t(
                      'admin.aiControlCenter.orgAISettings.features.auditSettings',
                      'Audit Settings'
                    )}
                  </h4>

                  <div className="space-y-3">
                    <SettingsToggle
                      label={t(
                        'admin.aiControlCenter.orgAISettings.features.auditAll.label',
                        'Audit All AI Requests'
                      )}
                      description={t(
                        'admin.aiControlCenter.orgAISettings.features.auditAll.description',
                        'Log every AI interaction for compliance (increases storage)'
                      )}
                      icon={History}
                      iconColor="text-amber-400"
                      checked={settings.auditAllRequests}
                      onChange={(v) => updateSetting('auditAllRequests', v)}
                    />

                    <SettingsToggle
                      label={t(
                        'admin.aiControlCenter.orgAISettings.features.auditPolicy.label',
                        'Audit Policy Changes'
                      )}
                      description={t(
                        'admin.aiControlCenter.orgAISettings.features.auditPolicy.description',
                        'Track all changes to AI settings'
                      )}
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
              title={t(
                'admin.aiControlCenter.orgAISettings.auditLog.title',
                'Settings Change History'
              )}
              description={t(
                'admin.aiControlCenter.orgAISettings.auditLog.description',
                'View all changes made to AI settings'
              )}
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
