/**
 * AdvancedSettings Component
 *
 * Advanced user settings including:
 * - Personal API keys management
 * - Export format preferences
 * - Keyboard shortcuts configuration
 * - Connected accounts (SSO)
 * - Developer options
 */

import {
  AlertTriangle,
  Check,
  Code,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileDown,
  Key,
  Keyboard,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed';
import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { User } from '../../types';

interface AdvancedSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface APIKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
  permissions: string[];
}

interface ConnectedAccount {
  provider: 'google' | 'microsoft' | 'github';
  email: string;
  connectedAt: string;
  status: 'active' | 'expired';
}

interface AdvancedPreferences {
  // Export Settings
  defaultExportFormat: 'pdf' | 'csv' | 'xlsx' | 'json';
  includeAttachments: boolean;
  exportDateRange: 'all' | '30days' | '90days' | '1year';

  // Developer Settings
  enableDeveloperMode: boolean;
  showDebugInfo: boolean;
  logAPIRequests: boolean;

  // Keyboard Shortcuts
  keyboardShortcutsEnabled: boolean;

  // Beta Features
  enableBetaFeatures: boolean;
}

const DEFAULT_PREFERENCES: AdvancedPreferences = {
  defaultExportFormat: 'pdf',
  includeAttachments: true,
  exportDateRange: 'all',
  enableDeveloperMode: false,
  showDebugInfo: false,
  logAPIRequests: false,
  keyboardShortcutsEnabled: true,
  enableBetaFeatures: false,
};

// Common keyboard shortcuts
const KEYBOARD_SHORTCUTS = [
  { id: 'newTask', action: 'New Task', shortcut: 'Ctrl/Cmd + N', category: 'tasks' },
  { id: 'search', action: 'Search', shortcut: 'Ctrl/Cmd + K', category: 'navigation' },
  {
    id: 'quickSwitchProject',
    action: 'Quick Switch Project',
    shortcut: 'Ctrl/Cmd + P',
    category: 'navigation',
  },
  {
    id: 'toggleSidebar',
    action: 'Toggle Sidebar',
    shortcut: 'Ctrl/Cmd + B',
    category: 'navigation',
  },
  { id: 'openSettings', action: 'Open Settings', shortcut: 'Ctrl/Cmd + ,', category: 'general' },
  {
    id: 'toggleDarkMode',
    action: 'Toggle Dark Mode',
    shortcut: 'Ctrl/Cmd + D',
    category: 'general',
  },
  {
    id: 'markTaskComplete',
    action: 'Mark Task Complete',
    shortcut: 'Ctrl/Cmd + Enter',
    category: 'tasks',
  },
  { id: 'openAiAssistant', action: 'Open AI Assistant', shortcut: 'Ctrl/Cmd + J', category: 'ai' },
  {
    id: 'focusMode',
    action: 'Focus Mode',
    shortcut: 'Ctrl/Cmd + Shift + F',
    category: 'focus',
  },
];

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<AdvancedPreferences>(DEFAULT_PREFERENCES);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // API Key modal state
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read']);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // Visibility state for API keys
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const loadData = async () => {
    try {
      const [prefsData, keysData, accountsData] = await Promise.all([
        Api.get('/settings/preferences/advanced'),
        Api.get('/settings/api-keys'),
        Api.get('/settings/connected-accounts'),
      ]);

      if (prefsData.preferences) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...prefsData.preferences });
      }
      if (keysData.keys) {
        setApiKeys(keysData.keys);
      }
      if (accountsData.accounts) {
        setConnectedAccounts(accountsData.accounts);
      }
    } catch (error) {
      console.error('Failed to load advanced settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Api.put('/settings/preferences/advanced', { preferences });
      const persisted = await Api.get('/settings/preferences/advanced').catch(() => null);
      if (persisted?.preferences) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...persisted.preferences });
      }
      toast.success(t('settings.advanced.saved', 'Advanced settings saved'));
    } catch (error) {
      toast.error(t('settings.advanced.error', 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = <K extends keyof AdvancedPreferences>(
    key: K,
    value: AdvancedPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreateAPIKey = async () => {
    if (!newKeyName.trim()) {
      toast.error(t('settings.advanced.keyNameRequired', 'Key name is required'));
      return;
    }

    setCreatingKey(true);
    try {
      const result = await Api.post('/settings/api-keys', {
        name: newKeyName,
        permissions: newKeyPermissions,
      });

      setNewlyCreatedKey(result.key);
      setApiKeys((prev) => [...prev, result.apiKey]);
      toast.success(t('settings.advanced.keyCreated', 'API key created'));
    } catch (error: any) {
      toast.error(
        error.message || t('settings.advanced.keyCreateError', 'Failed to create API key')
      );
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteAPIKey = async (keyId: string) => {
    if (
      !confirm(
        t('settings.advanced.confirmDeleteKey', 'Are you sure you want to delete this API key?')
      )
    ) {
      return;
    }

    try {
      await Api.delete(`/settings/api-keys/${keyId}`);
      setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
      toast.success(t('settings.advanced.keyDeleted', 'API key deleted'));
    } catch (error) {
      toast.error(t('settings.advanced.keyDeleteError', 'Failed to delete API key'));
    }
  };

  const handleDisconnectAccount = async (provider: string) => {
    if (
      !confirm(
        t(
          'settings.advanced.confirmDisconnect',
          'Are you sure you want to disconnect this account?'
        )
      )
    ) {
      return;
    }

    try {
      await Api.delete(`/settings/connected-accounts/${provider}`);
      setConnectedAccounts((prev) => prev.filter((a) => a.provider !== provider));
      toast.success(t('settings.advanced.accountDisconnected', 'Account disconnected'));
    } catch (error) {
      toast.error(t('settings.advanced.disconnectError', 'Failed to disconnect account'));
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('common.copied', 'Copied to clipboard'));
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return '🔵';
      case 'microsoft':
        return '🟦';
      case 'github':
        return '⚫';
      default:
        return '🔗';
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Settings size={28} className="text-c-text-muted" />
            {t('settings.advanced.title', 'Advanced Settings')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.advanced.description',
              'Developer tools, API access, and advanced options'
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-c-surface hover:bg-c-surface text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save Changes')}
        </button>
      </div>

      {/* Personal API Keys */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
              <Key size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-c-text">
                {t('settings.advanced.apiKeys', 'Personal API Keys')}
              </h3>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.advanced.apiKeysDescription',
                  'Create API keys for programmatic access'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowNewKeyModal(true);
              setNewKeyName('');
              setNewKeyPermissions(['read']);
              setNewlyCreatedKey(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            {t('settings.advanced.newKey', 'New Key')}
          </button>
        </div>

        {apiKeys.length === 0 ? (
          <EmptyState
            icon={<Key />}
            title={t('settings.advanced.noKeys', 'No API keys created yet')}
          />
        ) : (
          <div className="space-y-3">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-c-text">{apiKey.name}</span>
                    {apiKey.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="px-2 py-0.5 text-xs bg-c-surface-raised text-c-text-secondary rounded"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm font-mono text-c-text-muted">
                      {visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                    </code>
                    <button
                      onClick={() => toggleKeyVisibility(apiKey.id)}
                      className="p-1 hover:bg-c-surface-raised rounded"
                    >
                      {visibleKeys.has(apiKey.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(apiKey.key)}
                      className="p-1 hover:bg-c-surface-raised rounded"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-c-text-secondary mt-1">
                    {t('settings.advanced.created', 'Created')}:{' '}
                    {new Date(apiKey.createdAt).toLocaleDateString()}
                    {apiKey.lastUsed &&
                      ` • ${t('settings.advanced.lastUsed', 'Last used')}: ${new Date(apiKey.lastUsed).toLocaleDateString()}`}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteAPIKey(apiKey.id)}
                  className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Preferences */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <FileDown size={20} className="text-blue-500" />
          {t('settings.advanced.exportPreferences', 'Export Preferences')}
        </h3>

        <div className="space-y-4">
          {/* Default Format */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.advanced.defaultFormat', 'Default Export Format')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t('settings.advanced.defaultFormatDescription', 'Format used when exporting data')}
              </p>
            </div>
            <select
              value={preferences.defaultExportFormat}
              onChange={(e) =>
                updatePreference(
                  'defaultExportFormat',
                  e.target.value as AdvancedPreferences['defaultExportFormat']
                )
              }
              className="px-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text"
            >
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (XLSX)</option>
              <option value="json">JSON</option>
            </select>
          </div>

          {/* Include Attachments */}
          <div className="flex items-center justify-between pt-4 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.advanced.includeAttachments', 'Include Attachments')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.advanced.includeAttachmentsDescription',
                  'Export files attached to tasks'
                )}
              </p>
            </div>
            <button
              onClick={() =>
                updatePreference('includeAttachments', !preferences.includeAttachments)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.includeAttachments ? 'bg-blue-600' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.includeAttachments ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>

          {/* Date Range */}
          <div className="flex items-center justify-between pt-4 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.advanced.dateRange', 'Default Date Range')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t('settings.advanced.dateRangeDescription', 'Default range for data exports')}
              </p>
            </div>
            <select
              value={preferences.exportDateRange}
              onChange={(e) =>
                updatePreference(
                  'exportDateRange',
                  e.target.value as AdvancedPreferences['exportDateRange']
                )
              }
              className="px-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text"
            >
              <option value="all">{t('settings.advanced.allTime', 'All Time')}</option>
              <option value="30days">{t('settings.advanced.30days', 'Last 30 Days')}</option>
              <option value="90days">{t('settings.advanced.90days', 'Last 90 Days')}</option>
              <option value="1year">{t('settings.advanced.1year', 'Last Year')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-c-accent-soft dark:bg-c-accent-soft rounded-lg">
              <Keyboard size={20} className="text-c-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-c-text">
                {t('settings.advanced.keyboardShortcuts', 'Keyboard Shortcuts')}
              </h3>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.advanced.keyboardShortcutsDescription',
                  'Quick actions using your keyboard'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              updatePreference('keyboardShortcutsEnabled', !preferences.keyboardShortcutsEnabled)
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              preferences.keyboardShortcutsEnabled ? 'bg-c-focus' : 'bg-c-surface-raised'
            }`}
          >
            <span
              className={`${preferences.keyboardShortcutsEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
            />
          </button>
        </div>

        {preferences.keyboardShortcutsEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {KEYBOARD_SHORTCUTS.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg"
              >
                <div>
                  <span className="font-medium text-c-text-secondary">
                    {t(`settings.advanced.shortcuts.${shortcut.id}`, shortcut.action)}
                  </span>
                  <span className="text-xs text-c-text-secondary ml-2">
                    {t(
                      `settings.advanced.shortcutCategories.${shortcut.category}`,
                      shortcut.category
                    )}
                  </span>
                </div>
                <kbd className="px-2 py-1 bg-c-surface-raised rounded text-sm font-mono text-c-text-secondary">
                  {shortcut.shortcut}
                </kbd>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connected Accounts */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Link2 size={20} className="text-blue-500" />
          {t('settings.advanced.connectedAccounts', 'Connected Accounts')}
        </h3>
        <p className="text-sm text-c-text-muted mb-4">
          {t(
            'settings.advanced.connectedAccountsDescription',
            'Accounts linked for single sign-on'
          )}
        </p>

        <div className="space-y-3">
          {/* Google */}
          {renderAccountConnection('google', 'Google', connectedAccounts)}
          {/* Microsoft */}
          {renderAccountConnection('microsoft', 'Microsoft', connectedAccounts)}
          {/* GitHub */}
          {renderAccountConnection('github', 'GitHub', connectedAccounts)}
        </div>
      </div>

      {/* Developer Options */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Code size={20} className="text-green-500" />
          {t('settings.advanced.developerOptions', 'Developer Options')}
        </h3>

        <div className="space-y-4">
          {/* Developer Mode */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.advanced.developerMode', 'Developer Mode')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.advanced.developerModeDescription',
                  'Enable advanced debugging features'
                )}
              </p>
            </div>
            <button
              onClick={() =>
                updatePreference('enableDeveloperMode', !preferences.enableDeveloperMode)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.enableDeveloperMode ? 'bg-green-600' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.enableDeveloperMode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>

          {preferences.enableDeveloperMode && (
            <>
              {/* Show Debug Info */}
              <div className="flex items-center justify-between pl-6 pt-4 border-t border-c-border-subtle dark:border-navy-700">
                <div>
                  <label className="block font-medium text-c-text-secondary">
                    {t('settings.advanced.showDebugInfo', 'Show Debug Info')}
                  </label>
                  <p className="text-sm text-c-text-muted">
                    {t(
                      'settings.advanced.showDebugInfoDescription',
                      'Display technical information in UI'
                    )}
                  </p>
                </div>
                <button
                  onClick={() => updatePreference('showDebugInfo', !preferences.showDebugInfo)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.showDebugInfo ? 'bg-green-600' : 'bg-c-surface-raised'
                  }`}
                >
                  <span
                    className={`${preferences.showDebugInfo ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
                  />
                </button>
              </div>

              {/* Log API Requests */}
              <div className="flex items-center justify-between pl-6">
                <div>
                  <label className="block font-medium text-c-text-secondary">
                    {t('settings.advanced.logAPIRequests', 'Log API Requests')}
                  </label>
                  <p className="text-sm text-c-text-muted">
                    {t(
                      'settings.advanced.logAPIRequestsDescription',
                      'Log all API calls to console'
                    )}
                  </p>
                </div>
                <button
                  onClick={() => updatePreference('logAPIRequests', !preferences.logAPIRequests)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.logAPIRequests ? 'bg-green-600' : 'bg-c-surface-raised'
                  }`}
                >
                  <span
                    className={`${preferences.logAPIRequests ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
                  />
                </button>
              </div>
            </>
          )}

          {/* Beta Features */}
          <div className="flex items-center justify-between pt-4 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary flex items-center gap-2">
                <Shield size={16} className="text-amber-500" />
                {t('settings.advanced.betaFeatures', 'Beta Features')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t('settings.advanced.betaFeaturesDescription', 'Try experimental features early')}
              </p>
            </div>
            <button
              onClick={() =>
                updatePreference('enableBetaFeatures', !preferences.enableBetaFeatures)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.enableBetaFeatures ? 'bg-amber-500' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.enableBetaFeatures ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* New API Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-c-surface rounded-xl max-w-md w-full p-6 shadow-2xl">
            {newlyCreatedKey ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-green-100 dark:bg-green-500/20 rounded-full">
                    <Check size={24} className="text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-c-text">
                      {t('settings.advanced.keyCreatedTitle', 'API Key Created')}
                    </h3>
                    <p className="text-sm text-c-text-muted">
                      {t(
                        'settings.advanced.keyCreatedMessage',
                        "Save this key - it won't be shown again"
                      )}
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-600 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      {t(
                        'settings.advanced.keyWarning',
                        "Make sure to copy your API key now. You won't be able to see it again!"
                      )}
                    </p>
                  </div>
                </div>

                <div className="bg-c-surface-raised p-4 rounded-lg mb-4">
                  <code className="text-sm font-mono text-c-text break-all">{newlyCreatedKey}</code>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => copyToClipboard(newlyCreatedKey)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500"
                  >
                    <Copy size={16} />
                    {t('common.copy', 'Copy')}
                  </button>
                  <button
                    onClick={() => {
                      setShowNewKeyModal(false);
                      setNewlyCreatedKey(null);
                    }}
                    className="flex-1 px-4 py-2 bg-c-surface-raised text-c-text-secondary rounded-lg hover:bg-c-surface-raised"
                  >
                    {t('common.done', 'Done')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold mb-4 text-c-text">
                  {t('settings.advanced.createKey', 'Create API Key')}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-2">
                      {t('settings.advanced.keyName', 'Key Name')}
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder={t('settings.advanced.keyNamePlaceholder', 'e.g. My Integration')}
                      className="w-full px-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-2">
                      {t('settings.advanced.permissions', 'Permissions')}
                    </label>
                    <div className="space-y-2">
                      {['read', 'write', 'delete'].map((perm) => (
                        <label key={perm} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newKeyPermissions.includes(perm)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewKeyPermissions((prev) => [...prev, perm]);
                              } else {
                                setNewKeyPermissions((prev) => prev.filter((p) => p !== perm));
                              }
                            }}
                            className="w-4 h-4 rounded border-c-border-subtle dark:border-navy-700 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-sm text-c-text-secondary capitalize">{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end mt-6">
                  <button
                    onClick={() => setShowNewKeyModal(false)}
                    className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    onClick={handleCreateAPIKey}
                    disabled={creatingKey || !newKeyName.trim()}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50 flex items-center gap-2"
                  >
                    {creatingKey && <Loader2 size={16} className="animate-spin" />}
                    {creatingKey
                      ? t('settings.advanced.creating', 'Creating...')
                      : t('settings.advanced.create', 'Create Key')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  function renderAccountConnection(provider: string, name: string, accounts: ConnectedAccount[]) {
    const account = accounts.find((a) => a.provider === provider);
    const isConnected = !!account;

    return (
      <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getProviderIcon(provider)}</span>
          <div>
            <span className="font-medium text-c-text-secondary">{name}</span>
            {isConnected && <p className="text-xs text-c-text-muted">{account.email}</p>}
          </div>
        </div>
        {isConnected ? (
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded">
              {t('settings.advanced.connected', 'Connected')}
            </span>
            <button
              onClick={() => handleDisconnectAccount(provider)}
              className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
            <Link2 size={16} />
            {t('settings.advanced.connect', 'Connect')}
          </button>
        )}
      </div>
    );
  }
};

export default AdvancedSettings;
