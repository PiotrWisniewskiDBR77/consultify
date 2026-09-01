/**
 * ApiKeysManagementView - API Keys Management for Organization
 *
 * Features:
 * - Create new API keys with custom permissions
 * - List all API keys with usage stats
 * - Revoke keys
 * - Copy key to clipboard (only shown once)
 * - Set expiration dates
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Calendar,
  Check,
  Copy,
  Key,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { DegradedState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { LoadingState } from '../../components/ui/primitives';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { ApiKey } from '../../types';

// Available API permissions (scopes) - matches backend
const API_PERMISSIONS = [
  { id: 'read:projects', label: 'Read projects', description: 'Read project data' },
  { id: 'write:projects', label: 'Write projects', description: 'Create and modify projects' },
  { id: 'read:tasks', label: 'Read tasks', description: 'Read task data' },
  { id: 'write:tasks', label: 'Write tasks', description: 'Create and modify tasks' },
  { id: 'read:calendar', label: 'Read calendar', description: 'Read calendar sources and items' },
  {
    id: 'write:calendar',
    label: 'Write calendar',
    description: 'Create and modify calendar sources and items',
  },
  {
    id: 'read:integrations',
    label: 'Read integrations',
    description: 'Read integration connections and health',
  },
  {
    id: 'write:integrations',
    label: 'Write integrations',
    description: 'Create and modify integration connections',
  },
  { id: 'read:reports', label: 'Read reports', description: 'Read reports and analytics' },
  { id: 'write:reports', label: 'Write reports', description: 'Generate and export reports' },
  { id: 'ai:execute', label: 'AI execute', description: 'Execute AI actions' },
  { id: 'ai:read', label: 'AI read', description: 'Read AI insights and recommendations' },
  { id: 'webhooks:manage', label: 'Webhooks', description: 'Manage webhook configurations' },
  { id: 'full:access', label: 'Full access', description: 'Full API access' },
];

interface ApiKeysManagementViewProps {
  className?: string;
}

export const ApiKeysManagementView: React.FC<ApiKeysManagementViewProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currentOrganization } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
    expiresIn: '90', // days
  });

  const loadApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const data = await Api.get('/api/api-keys');
      // Map the response to match expected format
      setApiKeys(
        (data.keys || []).map((k: any) => ({
          id: k.id,
          organizationId: currentOrganization?.id || '',
          name: k.name,
          description: k.description,
          keyPrefix: k.keyPrefix,
          keyHash: '***',
          permissions: k.permissions || k.scopes || [],
          expiresAt: k.expiresAt,
          lastUsedAt: k.lastUsedAt,
          createdBy: k.createdBy,
          createdAt: k.createdAt,
          revokedAt: k.revokedAt || (k.status === 'revoked' ? k.updatedAt : undefined),
        }))
      );
    } catch (error: any) {
      console.error('Failed to load API keys:', error);
      toast.error(error.message || 'Failed to load API keys');
      setApiKeys([]);
      setLoadError(error.message || 'Failed to load API keys');
    }
    setLoading(false);
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadApiKeys();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id, loadApiKeys]);

  const handleCreateKey = async () => {
    if (!newKeyForm.name) {
      toast.error('Please enter a name for the API key');
      return;
    }
    if (newKeyForm.permissions.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }

    setCreating(true);
    try {
      // Calculate expiration date from days
      let expiresAt = null;
      if (newKeyForm.expiresIn) {
        const days = parseInt(newKeyForm.expiresIn);
        if (days > 0) {
          const date = new Date();
          date.setDate(date.getDate() + days);
          expiresAt = date.toISOString();
        }
      }

      const data = await Api.post('/api/api-keys', {
        name: newKeyForm.name,
        description: newKeyForm.description,
        permissions: newKeyForm.permissions,
        expiresInDays: newKeyForm.expiresIn ? parseInt(newKeyForm.expiresIn, 10) : undefined,
        expiresAt,
      });

      const plainTextKey = data.plainTextKey || data.apiKey || data.key?.apiKey || data.key?.key;
      if (plainTextKey && data.key) {
        setNewKeyValue(plainTextKey); // The full key is only returned once!
        setShowCreateModal(false);
        setShowNewKeyModal(true);
        await loadApiKeys();
        setNewKeyForm({ name: '', description: '', permissions: [], expiresIn: '90' });
        toast.success('API key created successfully');
      } else {
        toast.error(data.error || 'Failed to create API key');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create API key');
    }
    setCreating(false);
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const data = await Api.delete(`/api/api-keys/${keyId}`);

      if (data.success !== false) {
        toast.success('API key revoked');
        await loadApiKeys();
      } else {
        toast.error(data.error || 'Failed to revoke API key');
      }
    } catch (error: any) {
      console.error('Failed to revoke API key:', error);
      toast.error(error.message || 'Failed to revoke API key');
    }
  };

  const copyToClipboard = async (text: string, keyId?: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(keyId || 'new');
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const togglePermission = (permId: string) => {
    setNewKeyForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId],
    }));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'Never used';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const isKeyExpiringSoon = (key: ApiKey) => {
    if (!key.expiresAt) return false;
    const expiresAt = new Date(key.expiresAt);
    const now = new Date();
    const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry < 14 && daysUntilExpiry > 0;
  };

  const isKeyExpired = (key: ApiKey) => {
    if (!key.expiresAt) return false;
    return new Date(key.expiresAt) < new Date();
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <InfoButton cardId="admin-api-keys" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Key size={24} />
            {t('admin.apiKeys.title', 'API Keys')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('admin.apiKeys.desc', 'Create and manage API keys for external integrations')}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!!loadError}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium"
        >
          <Plus size={18} />
          Create API Key
        </button>
      </div>

      {loadError && <DegradedState title="API keys unavailable" description={loadError} />}

      {/* Security Notice */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
        <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Keep your API keys secure
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
            API keys provide access to your organization's data. Never share them in public
            repositories or client-side code.
          </p>
        </div>
      </div>

      {/* API Keys List */}
      {loadError ? (
        <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <DegradedState title="API key list unavailable" description={loadError} />
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <Key className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">No API Keys</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1 mb-4">
            Create your first API key to get started with integrations
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!!loadError}
            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium"
          >
            Create API Key
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className={`p-4 bg-white dark:bg-navy-800 rounded-xl border ${
                isKeyExpired(key)
                  ? 'border-danger-200 dark:border-danger-800'
                  : isKeyExpiringSoon(key)
                    ? 'border-amber-200 dark:border-amber-800'
                    : 'border-slate-200 dark:border-navy-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-lg ${
                      isKeyExpired(key) || key.revokedAt
                        ? 'bg-danger-100 dark:bg-danger-900/30'
                        : 'bg-c-success/10 dark:bg-c-success/20'
                    }`}
                  >
                    <Key
                      className={`w-5 h-5 ${
                        isKeyExpired(key) || key.revokedAt
                          ? 'text-danger-600 dark:text-danger-400'
                          : 'text-c-success'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900 dark:text-white">{key.name}</h3>
                      {isKeyExpired(key) && (
                        <span className="px-2 py-0.5 bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400 text-xs rounded-full">
                          Expired
                        </span>
                      )}
                      {key.revokedAt && (
                        <span className="px-2 py-0.5 bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400 text-xs rounded-full">
                          Revoked
                        </span>
                      )}
                      {isKeyExpiringSoon(key) && !isKeyExpired(key) && (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded-full">
                          Expiring Soon
                        </span>
                      )}
                    </div>
                    {key.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {key.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Activity size={12} />
                        Last used: {formatRelativeTime(key.lastUsedAt)}
                      </span>
                      {key.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          Expires: {formatDate(key.expiresAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {key.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="px-2 py-0.5 bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300 text-xs rounded"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(`${key.keyPrefix}...`, key.id)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300"
                    title="Copy key prefix"
                  >
                    {copiedKey === key.id ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                  {!key.revokedAt && (
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      disabled={!!loadError}
                      className="p-2 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded-lg text-slate-500 dark:text-slate-400 hover:text-danger-600"
                      title="Revoke key"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Key Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden"
            >
              <div className="p-6 border-b border-slate-200 dark:border-navy-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Key size={20} />
                  Create API Key
                </h3>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newKeyForm.name}
                    onChange={(e) => setNewKeyForm({ ...newKeyForm, name: e.target.value })}
                    placeholder="e.g., Production Integration"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={newKeyForm.description}
                    onChange={(e) => setNewKeyForm({ ...newKeyForm, description: e.target.value })}
                    placeholder="What is this key used for?"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Expiration
                  </label>
                  <select
                    value={newKeyForm.expiresIn}
                    onChange={(e) => setNewKeyForm({ ...newKeyForm, expiresIn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="365">1 year</option>
                    <option value="">Never expires</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Permissions *
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {API_PERMISSIONS.map((perm) => (
                      <label
                        key={perm.id}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          newKeyForm.permissions.includes(perm.id)
                            ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                            : 'bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={newKeyForm.permissions.includes(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-600 focus:ring-primary-500"
                        />
                        <div>
                          <span className="font-medium text-slate-900 dark:text-white text-sm">
                            {perm.label}
                          </span>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {perm.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateKey}
                  disabled={creating || !newKeyForm.name || newKeyForm.permissions.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium disabled:opacity-50"
                >
                  {creating && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Create Key
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Key Created Modal - Show key only once */}
      <AnimatePresence>
        {showNewKeyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
            >
              <div className="p-6 border-b border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 flex items-center gap-2">
                  <Check size={20} />
                  API Key Created
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-danger-600 dark:text-danger-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-danger-800 dark:text-danger-200">
                        This key will only be shown once!
                      </p>
                      <p className="text-xs text-danger-600 dark:text-danger-300 mt-1">
                        Make sure to copy it now. You won't be able to see it again.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Your API Key
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-slate-100 dark:bg-navy-900 rounded-lg text-sm font-mono text-slate-900 dark:text-white break-all">
                      {newKeyValue}
                    </code>
                    <button
                      onClick={() => copyToClipboard(newKeyValue)}
                      className="flex-shrink-0 p-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg"
                    >
                      {copiedKey === 'new' ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end">
                <button
                  onClick={() => {
                    setShowNewKeyModal(false);
                    setNewKeyValue('');
                  }}
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium"
                >
                  I've Copied the Key
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ApiKeysManagementView;
