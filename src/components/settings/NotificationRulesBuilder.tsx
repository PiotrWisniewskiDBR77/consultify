/**
 * NotificationRulesBuilder - Advanced notification rules per project
 *
 * Features:
 * - Per-project notification rules
 * - @mention preferences
 * - Digest settings
 * - Keyword filters
 * - VIP contacts
 */

import {
  AlertCircle,
  AtSign,
  Bell,
  Check,
  Clock,
  Filter,
  FolderOpen,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { Project, User } from '../../types';
import { ReadOnlyState } from '../Admin/AdminState';

interface NotificationRule {
  id: string;
  project_id: string | null;
  project_name?: string;
  rule_type: 'all' | 'mentions_only' | 'muted' | 'custom';
  notify_tasks: boolean;
  notify_comments: boolean;
  notify_mentions: boolean;
  notify_deadlines: boolean;
  priority_filter: 'all' | 'high_only' | 'high_medium';
}

interface DigestSettings {
  enabled: boolean;
  frequency: 'instant' | 'hourly' | 'daily' | 'weekly';
  preferred_time: string;
  preferred_day: number; // 0-6 for weekly
}

interface VIPContact {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
}

interface NotificationRulesBuilderProps {
  currentUser: User;
}

const DEFAULT_RULE: Omit<NotificationRule, 'id'> = {
  project_id: null,
  rule_type: 'all',
  notify_tasks: true,
  notify_comments: true,
  notify_mentions: true,
  notify_deadlines: true,
  priority_filter: 'all',
};

export const NotificationRulesBuilder: React.FC<NotificationRulesBuilderProps> = ({
  currentUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [digestSettings, setDigestSettings] = useState<DigestSettings>({
    enabled: false,
    frequency: 'daily',
    preferred_time: '09:00',
    preferred_day: 1,
  });
  const [vipContacts, setVipContacts] = useState<VIPContact[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRuleProjectId, setNewRuleProjectId] = useState('');
  const isReadOnly = true;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projectsData] = await Promise.all([Api.getProjects()]);
      setProjects(projectsData as any);

      // Initialize with default global rule
      setRules([
        {
          id: 'global',
          project_name: 'Global (All Projects)',
          ...DEFAULT_RULE,
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch notification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = () => {
    if (!newRuleProjectId) return;

    const project = projects.find((p) => p.id === newRuleProjectId);
    if (!project) return;

    const newRule: NotificationRule = {
      id: `rule-${Date.now()}`,
      project_name: project.name,
      ...DEFAULT_RULE,
      project_id: newRuleProjectId,
    };

    setRules((prev) => [...prev, newRule]);
    setNewRuleProjectId('');
    setShowAddRule(false);
  };

  const handleUpdateRule = (ruleId: string, updates: Partial<NotificationRule>) => {
    setRules((prev) => prev.map((rule) => (rule.id === ruleId ? { ...rule, ...updates } : rule)));
  };

  const handleDeleteRule = (ruleId: string) => {
    if (ruleId === 'global') return; // Can't delete global rule
    setRules((prev) => prev.filter((rule) => rule.id !== ruleId));
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim() || keywords.includes(newKeyword.trim().toLowerCase())) return;
    setKeywords((prev) => [...prev, newKeyword.trim().toLowerCase()]);
    setNewKeyword('');
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords((prev) => prev.filter((k) => k !== keyword));
  };

  const handleSave = async () => {
    toast.error(
      t(
        'settings.notifications.readOnlySave',
        'Notification rules are read-only until persistence is connected'
      )
    );
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Filter className="w-5 h-5 text-c-accent" />
          {t('settings.notifications.rules.title', 'Notification Rules')}
        </h3>
        <p className="text-sm text-c-text-muted mt-1">
          {t(
            'settings.notifications.rules.description',
            'Customize notifications for different projects and scenarios'
          )}
        </p>
      </div>

      <ReadOnlyState
        title={t('settings.notifications.readOnlyTitle', 'Notification rules are read-only')}
        description={t(
          'settings.notifications.readOnlyDescription',
          'Project notification rules, digests, keywords, and VIP contacts are visible only until their persistence API is connected.'
        )}
      />

      {/* Per-Project Rules */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-c-text flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-c-text-muted" />
            {t('settings.notifications.rules.projectRules', 'Project Rules')}
          </h4>
          <button
            onClick={() => setShowAddRule(true)}
            disabled={isReadOnly}
            className="flex items-center gap-1 text-sm text-c-accent hover:underline"
          >
            <Plus className="w-4 h-4" />
            {t('settings.notifications.rules.addRule', 'Add Project Rule')}
          </button>
        </div>

        {rules.map((rule) => (
          <div
            key={rule.id}
            className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    rule.project_id === null
                      ? 'bg-c-accent-soft dark:bg-c-accent-soft text-c-accent'
                      : 'bg-c-surface-raised text-c-text-secondary'
                  }`}
                >
                  {rule.project_name || 'Unknown Project'}
                </span>
              </div>
              {rule.id !== 'global' && (
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  disabled={isReadOnly}
                  className="p-1.5 text-c-text-secondary hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Rule Type Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-c-text-secondary mb-2">
                {t('settings.notifications.rules.ruleType', 'Notification Mode')}
              </label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'mentions_only', 'custom', 'muted'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleUpdateRule(rule.id, { rule_type: type })}
                    disabled={isReadOnly}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      rule.rule_type === type
                        ? 'bg-navy-900 text-white'
                        : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
                    }`}
                  >
                    {t(`settings.notifications.rules.${type}`, type.replace('_', ' '))}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Options */}
            {rule.rule_type === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-c-border-subtle dark:border-navy-700">
                {[
                  { key: 'notify_tasks', label: 'Task updates', icon: Check },
                  { key: 'notify_comments', label: 'Comments', icon: MessageSquare },
                  { key: 'notify_mentions', label: '@Mentions', icon: AtSign },
                  { key: 'notify_deadlines', label: 'Deadlines', icon: Clock },
                ].map((option) => (
                  <label key={option.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule[option.key as keyof NotificationRule] as boolean}
                      disabled={isReadOnly}
                      onChange={(e) =>
                        handleUpdateRule(rule.id, { [option.key]: e.target.checked })
                      }
                      className="rounded border-c-border-subtle text-c-accent focus:ring-[color:var(--c-focus)]"
                    />
                    <option.icon className="w-4 h-4 text-c-text-secondary" />
                    <span className="text-sm text-c-text-secondary">{option.label}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Priority Filter */}
            {rule.rule_type !== 'muted' && (
              <div className="mt-3 pt-3 border-t border-c-border-subtle dark:border-navy-700">
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  {t('settings.notifications.rules.priorityFilter', 'Priority Filter')}
                </label>
                <select
                  value={rule.priority_filter}
                  disabled={isReadOnly}
                  onChange={(e) =>
                    handleUpdateRule(rule.id, { priority_filter: e.target.value as any })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface text-c-text text-sm focus:ring-2 focus:ring-[color:var(--c-focus)]"
                >
                  <option value="all">
                    {t('settings.notifications.rules.allPriorities', 'All priorities')}
                  </option>
                  <option value="high_medium">
                    {t('settings.notifications.rules.highMedium', 'High & Medium only')}
                  </option>
                  <option value="high_only">
                    {t('settings.notifications.rules.highOnly', 'High priority only')}
                  </option>
                </select>
              </div>
            )}
          </div>
        ))}

        {/* Add Rule Modal */}
        {showAddRule && (
          <div className="p-4 bg-c-accent-soft dark:bg-c-accent-soft rounded-xl border border-c-accent dark:border-c-accent">
            <div className="flex items-center gap-3">
              <select
                value={newRuleProjectId}
                onChange={(e) => setNewRuleProjectId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface text-c-text text-sm"
              >
                <option value="">
                  {t('settings.notifications.rules.selectProject', 'Select a project...')}
                </option>
                {projects
                  .filter((p) => !rules.find((r) => r.project_id === p.id))
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
              </select>
              <button
                onClick={handleAddRule}
                disabled={!newRuleProjectId}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {t('common.add', 'Add')}
              </button>
              <button
                onClick={() => setShowAddRule(false)}
                className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg text-sm"
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Digest Settings */}
      <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-c-text">
                {t('settings.notifications.digest.title', 'Email Digest')}
              </h4>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.notifications.digest.description',
                  'Bundle notifications into periodic summaries'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDigestSettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
            disabled={isReadOnly}
            className={`w-12 h-6 rounded-full transition-colors ${
              digestSettings.enabled ? 'bg-navy-900' : 'bg-c-surface-raised'
            }`}
          >
            <div
              className={`w-5 h-5 bg-c-surface rounded-full transform transition-transform ${
                digestSettings.enabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {digestSettings.enabled && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">
                {t('settings.notifications.digest.frequency', 'Frequency')}
              </label>
              <select
                value={digestSettings.frequency}
                disabled={isReadOnly}
                onChange={(e) =>
                  setDigestSettings((prev) => ({ ...prev, frequency: e.target.value as any }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface text-c-text text-sm"
              >
                <option value="instant">Instant (no digest)</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            {digestSettings.frequency !== 'instant' && digestSettings.frequency !== 'hourly' && (
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('settings.notifications.digest.time', 'Preferred Time')}
                </label>
                <input
                  type="time"
                  value={digestSettings.preferred_time}
                  disabled={isReadOnly}
                  onChange={(e) =>
                    setDigestSettings((prev) => ({ ...prev, preferred_time: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface text-c-text text-sm"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Keyword Filters */}
      <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h4 className="font-medium text-c-text">
              {t('settings.notifications.keywords.title', 'Priority Keywords')}
            </h4>
            <p className="text-sm text-c-text-muted">
              {t(
                'settings.notifications.keywords.description',
                'Always notify when these keywords appear'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <span
              key={keyword}
              className="flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full text-sm"
            >
              {keyword}
              <button
                onClick={() => handleRemoveKeyword(keyword)}
                className="hover:text-amber-900 dark:hover:text-amber-100"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
              placeholder="Add keyword..."
              disabled={isReadOnly}
              className="px-3 py-1 border border-c-border-subtle dark:border-navy-700 rounded-full text-sm bg-c-surface text-c-text w-32"
            />
            <button
              onClick={handleAddKeyword}
              disabled={isReadOnly || !newKeyword.trim()}
              className="p-1 text-c-accent hover:bg-c-accent-soft dark:hover:bg-c-accent-soft rounded-full disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* VIP Contacts */}
      <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-100 dark:bg-pink-500/20 flex items-center justify-center">
            <Star className="w-5 h-5 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <h4 className="font-medium text-c-text">
              {t('settings.notifications.vip.title', 'VIP Contacts')}
            </h4>
            <p className="text-sm text-c-text-muted">
              {t(
                'settings.notifications.vip.description',
                'Always receive notifications from these people'
              )}
            </p>
          </div>
        </div>

        <p className="text-sm text-c-text-secondary italic">
          {t(
            'settings.notifications.vip.empty',
            'No VIP contacts configured. Messages from VIP contacts will always notify you.'
          )}
        </p>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving || isReadOnly}
          className="flex items-center gap-2 px-6 py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.saving', 'Saving...')}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {t('common.saveChanges', 'Save Changes')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default NotificationRulesBuilder;
