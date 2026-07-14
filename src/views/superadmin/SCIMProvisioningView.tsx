/**
 * SCIM Provisioning View
 *
 * Manages SCIM 2.0 provisioning configuration for enterprise organizations.
 * Allows configuration of tokens, group mappings, and sync monitoring.
 */

import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  History,
  Key,
  Link2,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { LoadingState } from '../../components/ui/primitives';
import { api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';

interface SCIMToken {
  id: string;
  name: string;
  description: string | null;
  tokenPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  usageCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface GroupMapping {
  id: string;
  externalGroupId: string;
  externalGroupName: string;
  internalRole: string;
  customRoleId: string | null;
  isActive: boolean;
}

interface SyncLog {
  id: string;
  operation: string;
  resourceType: string;
  resourceId: string;
  externalId: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface SCIMConflict {
  id: string;
  organizationId: string;
  conflictType: string;
  resourceType: string;
  externalId: string | null;
  internalId: string | null;
  details: Record<string, unknown> | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface ServiceProvider {
  id: string;
  organizationId: string;
  baseUrl: string;
  patchSupported: boolean;
  filterSupported: boolean;
  isActive: boolean;
  lastSyncAt: string | null;
  syncStatus: string;
}

type TabType = 'overview' | 'tokens' | 'mappings' | 'logs' | 'conflicts';

interface SCIMDataSnapshot {
  serviceProvider: ServiceProvider | null;
  tokens: SCIMToken[];
  groupMappings: GroupMapping[];
  conflicts: SCIMConflict[];
}

const mappingMatchesCreate = (
  mapping: GroupMapping,
  expected: { externalGroupId: string; externalGroupName: string; internalRole: string }
) =>
  mapping.externalGroupId === expected.externalGroupId &&
  mapping.externalGroupName === expected.externalGroupName &&
  mapping.internalRole === expected.internalRole;

const tokenMatchesCreate = (token: SCIMToken, expected: { id?: string; name: string }) =>
  token.name === expected.name && (!expected.id || token.id === expected.id);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const unwrapApiPayload = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  const first = isRecord(value.data) ? value.data : value;
  return isRecord(first) && 'data' in first ? first.data : first;
};

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  const payload = unwrapApiPayload(value);
  if (Array.isArray(payload)) return payload as T[];
  if (!isRecord(payload)) return [];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key] as T[];
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  const payload = unwrapApiPayload(value);
  return (
    Array.isArray(payload) ||
    (isRecord(payload) &&
      (Array.isArray(payload.data) || keys.some((key) => Array.isArray(payload[key]))))
  );
};

const getObjectPayload = <T,>(value: unknown, keys: string[] = []): T | null => {
  const payload = unwrapApiPayload(value);
  if (!isRecord(payload)) return null;
  for (const key of keys) {
    if (isRecord(payload[key])) return payload[key] as T;
  }
  return payload as T;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  normalizeApiErrorMessage(error, fallback);

const SCIMProvisioningView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(false);

  // Data state
  const [serviceProvider, setServiceProvider] = useState<ServiceProvider | null>(null);
  const [tokens, setTokens] = useState<SCIMToken[]>([]);
  const [groupMappings, setGroupMappings] = useState<GroupMapping[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [conflicts, setConflicts] = useState<SCIMConflict[]>([]);
  const [syncing, setSyncing] = useState(false);

  // UI state
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [newToken, setNewToken] = useState<{ name: string; description: string; scopes: string[] }>(
    {
      name: '',
      description: '',
      scopes: ['users:read', 'users:write', 'groups:read', 'groups:write'],
    }
  );
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newMapping, setNewMapping] = useState({
    externalGroupId: '',
    externalGroupName: '',
    internalRole: 'member',
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [spResponse, tokensResponse, mappingsResponse, logsResponse, conflictsResponse] =
        await Promise.all([
          api.get('/scim/admin/service-provider'),
          api.get('/scim/admin/tokens'),
          api.get('/scim/admin/group-mappings'),
          api.get('/scim/admin/sync-logs?limit=50'),
          api.get('/scim/admin/conflicts'),
        ]);

      const nextServiceProvider = getObjectPayload<ServiceProvider>(spResponse, [
        'serviceProvider',
      ]);
      const nextTokens = getListPayload<SCIMToken>(tokensResponse, ['tokens', 'items']);
      const nextGroupMappings = getListPayload<GroupMapping>(mappingsResponse, [
        'groupMappings',
        'mappings',
        'items',
      ]);
      const nextSyncLogs = getListPayload<SyncLog>(logsResponse, ['logs', 'syncLogs', 'items']);
      const nextConflicts = getListPayload<SCIMConflict>(conflictsResponse, ['conflicts', 'items']);

      if (!hasListShape(tokensResponse, ['tokens', 'items'])) {
        throw new Error('SCIM tokens response was not a list');
      }
      if (!hasListShape(mappingsResponse, ['groupMappings', 'mappings', 'items'])) {
        throw new Error('SCIM group mappings response was not a list');
      }
      if (!hasListShape(logsResponse, ['logs', 'syncLogs', 'items'])) {
        throw new Error('SCIM sync logs response was not a list');
      }
      if (!hasListShape(conflictsResponse, ['conflicts', 'items'])) {
        throw new Error('SCIM conflicts response was not a list');
      }

      setServiceProvider(nextServiceProvider);
      setTokens(nextTokens);
      setGroupMappings(nextGroupMappings);
      setSyncLogs(nextSyncLogs);
      setConflicts(nextConflicts);
      return {
        serviceProvider: nextServiceProvider,
        tokens: nextTokens,
        groupMappings: nextGroupMappings,
        conflicts: nextConflicts,
      } as SCIMDataSnapshot;
    } catch (error) {
      setServiceProvider(null);
      setTokens([]);
      setGroupMappings([]);
      setSyncLogs([]);
      setConflicts([]);
      setLoadError(getErrorMessage(error, 'Failed to load SCIM data'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Enable SCIM
  const handleEnableSCIM = async () => {
    setActionError(null);
    try {
      await api.post('/scim/admin/service-provider', { isActive: true });
      const refreshed = await fetchData();
      if (!refreshed?.serviceProvider?.isActive) {
        throw new Error('SCIM enablement was not confirmed by the server');
      }
    } catch (error) {
      setActionError(getErrorMessage(error, 'Failed to enable SCIM service provider'));
    }
  };

  // Generate Token
  const handleGenerateToken = async () => {
    if (!newToken.name) return;

    setActionError(null);
    try {
      const response = await api.post('/scim/admin/tokens', newToken);
      const createdToken = getObjectPayload<SCIMToken & { token?: string }>(response, ['token']);
      if (!createdToken?.name) {
        throw new Error('SCIM token generation response was incomplete');
      }
      const refreshed = await fetchData();
      if (!refreshed?.tokens.some((token) => tokenMatchesCreate(token, createdToken))) {
        throw new Error('SCIM token generation was not confirmed by the server');
      }
      setGeneratedToken(createdToken.token ?? null);
    } catch (error) {
      setActionError(getErrorMessage(error, 'Failed to generate SCIM token'));
    }
  };

  // Revoke Token
  const handleRevokeToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.'))
      return;

    setActionError(null);
    try {
      await api.delete(`/scim/admin/tokens/${tokenId}`);
      const refreshed = await fetchData();
      if (!refreshed || refreshed.tokens.some((token) => token.id === tokenId)) {
        throw new Error('SCIM token revocation was not confirmed by the server');
      }
    } catch (error) {
      setActionError(getErrorMessage(error, 'Failed to revoke SCIM token'));
    }
  };

  // Create Group Mapping
  const handleCreateMapping = async () => {
    if (!newMapping.externalGroupId || !newMapping.externalGroupName) return;

    setActionError(null);
    try {
      const expected = { ...newMapping };
      await api.post('/scim/admin/group-mappings', expected);
      const refreshed = await fetchData();
      if (!refreshed?.groupMappings.some((mapping) => mappingMatchesCreate(mapping, expected))) {
        throw new Error('SCIM group mapping was not confirmed by the server');
      }
      setShowMappingModal(false);
      setNewMapping({ externalGroupId: '', externalGroupName: '', internalRole: 'member' });
    } catch (error) {
      setActionError(getErrorMessage(error, 'Failed to create SCIM group mapping'));
    }
  };

  // Delete Group Mapping
  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Delete this group mapping?')) return;

    setActionError(null);
    try {
      await api.delete(`/scim/admin/group-mappings/${mappingId}`);
      const refreshed = await fetchData();
      if (!refreshed || refreshed.groupMappings.some((mapping) => mapping.id === mappingId)) {
        throw new Error('SCIM group mapping deletion was not confirmed by the server');
      }
    } catch (error) {
      setActionError(getErrorMessage(error, 'Failed to delete SCIM group mapping'));
    }
  };

  // Trigger Full Sync
  const handleTriggerSync = async () => {
    setActionError(null);
    setSyncing(true);
    try {
      await api.post('/scim/admin/sync', {});
      const refreshed = await fetchData();
      if (!refreshed) {
        throw new Error('SCIM sync was not confirmed by read-back');
      }
    } catch (error) {
      setActionError(getErrorMessage(error, 'Failed to trigger SCIM sync'));
    } finally {
      setSyncing(false);
    }
  };

  // Resolve Conflict
  const handleResolveConflict = async (
    conflictId: string,
    resolution: 'merge' | 'skip' | 'overwrite'
  ) => {
    setActionError(null);
    try {
      await api.post(`/scim/admin/conflicts/${conflictId}/resolve`, { resolution });
      const refreshed = await fetchData();
      const refreshedConflict = refreshed?.conflicts.find((conflict) => conflict.id === conflictId);
      if (!refreshed || (refreshedConflict && refreshedConflict.resolution !== resolution)) {
        throw new Error('SCIM conflict resolution was not confirmed by the server');
      }
    } catch (error) {
      setActionError(getErrorMessage(error, 'Failed to resolve SCIM conflict'));
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: Settings },
    { id: 'tokens' as TabType, label: 'API Tokens', icon: Key },
    { id: 'mappings' as TabType, label: 'Group Mappings', icon: Users },
    { id: 'conflicts' as TabType, label: 'Conflicts', icon: AlertTriangle },
    { id: 'logs' as TabType, label: 'Sync Logs', icon: History },
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                serviceProvider?.isActive ? 'bg-green-500/15' : 'bg-slate-100 dark:bg-gray-700'
              }`}
            >
              <Link2
                className={
                  serviceProvider?.isActive
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-slate-500 dark:text-gray-400'
                }
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                SCIM 2.0 Provisioning
              </h3>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                {serviceProvider?.isActive
                  ? 'Automatic user provisioning is active'
                  : 'Enable to sync users from your identity provider'}
              </p>
            </div>
          </div>
          {!serviceProvider?.isActive && (
            <button
              onClick={handleEnableSCIM}
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
            >
              Enable SCIM
            </button>
          )}
        </div>

        {serviceProvider && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-gray-900/50 rounded-lg p-4 border border-slate-200/60 dark:border-transparent">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {tokens.length}
                </div>
                <div className="text-sm text-slate-600 dark:text-gray-400">Active Tokens</div>
              </div>
              <div className="bg-slate-50 dark:bg-gray-900/50 rounded-lg p-4 border border-slate-200/60 dark:border-transparent">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {groupMappings.length}
                </div>
                <div className="text-sm text-slate-600 dark:text-gray-400">Group Mappings</div>
              </div>
              <div className="bg-slate-50 dark:bg-gray-900/50 rounded-lg p-4 border border-slate-200/60 dark:border-transparent">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {syncLogs.filter((l) => l.status === 'success').length}
                </div>
                <div className="text-sm text-slate-600 dark:text-gray-400">
                  Successful Syncs (24h)
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-gray-900/50 rounded-lg p-4 border border-slate-200/60 dark:border-transparent">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {conflicts.filter((c) => !c.resolution).length}
                </div>
                <div className="text-sm text-slate-600 dark:text-gray-400">
                  Unresolved Conflicts
                </div>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleTriggerSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing...' : 'Trigger Full Sync'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* SCIM Endpoint Info */}
      <div className="bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          SCIM Endpoint Configuration
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700 dark:text-gray-300 mb-1">Base URL</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-slate-50 dark:bg-gray-900 rounded-lg text-sm text-slate-900 dark:text-primary-300 font-mono border border-slate-200 dark:border-gray-700">
                {window.location.origin}/api/scim/v2
              </code>
              <button
                onClick={() => copyToClipboard(`${window.location.origin}/api/scim/v2`)}
                className="p-2 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-600 dark:text-gray-400">Users Endpoint:</span>
              <code className="ml-2 text-primary-700 dark:text-primary-300">/Users</code>
            </div>
            <div>
              <span className="text-slate-600 dark:text-gray-400">Groups Endpoint:</span>
              <code className="ml-2 text-primary-700 dark:text-primary-300">/Groups</code>
            </div>
            <div>
              <span className="text-slate-600 dark:text-gray-400">Authentication:</span>
              <code className="ml-2 text-primary-700 dark:text-primary-300">Bearer Token</code>
            </div>
            <div>
              <span className="text-slate-600 dark:text-gray-400">PATCH Support:</span>
              <code className="ml-2 text-green-600 dark:text-green-400">Yes</code>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Setup Guide */}
      <div className="bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Quick Setup Guide
        </h3>
        <div className="space-y-3">
          {[
            {
              step: 1,
              text: 'Generate a SCIM API token in the Tokens tab',
              done: tokens.length > 0,
            },
            { step: 2, text: 'Configure your IdP with the SCIM endpoint URL', done: false },
            {
              step: 3,
              text: 'Set up group mappings to assign roles automatically',
              done: groupMappings.length > 0,
            },
            {
              step: 4,
              text: 'Test provisioning with a test user',
              done: syncLogs.some((l) => l.status === 'success'),
            },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  item.done
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300'
                }`}
              >
                {item.done ? <Check size={14} /> : item.step}
              </div>
              <span
                className={
                  item.done
                    ? 'text-slate-800 dark:text-gray-200'
                    : 'text-slate-600 dark:text-gray-400'
                }
              >
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTokens = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">SCIM API Tokens</h3>
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Tokens for authenticating SCIM requests from your IdP
          </p>
        </div>
        <button
          onClick={() => setShowTokenModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
        >
          <Plus size={18} />
          Generate Token
        </button>
      </div>

      {tokens.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800/50 rounded-xl border border-slate-200 dark:border-gray-700">
          <Key className="mx-auto text-slate-600 dark:text-gray-400 mb-4" size={48} />
          <p className="text-slate-700 dark:text-gray-300">No tokens generated yet</p>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Generate a token to enable SCIM provisioning
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-xl p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      token.isActive ? 'bg-green-500/20' : 'bg-danger-500/20'
                    }`}
                  >
                    <Key
                      className={token.isActive ? 'text-green-400' : 'text-danger-400'}
                      size={20}
                    />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">{token.name}</h4>
                    <p className="text-sm text-slate-600 dark:text-gray-400">
                      {token.tokenPrefix}••••••••
                      {token.lastUsedAt &&
                        ` • Last used: ${new Date(token.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-gray-400">
                    {token.usageCount} requests
                  </span>
                  <button
                    onClick={() => handleRevokeToken(token.id)}
                    title={`Revoke token ${token.name}`}
                    className="p-2 text-danger-400 hover:text-danger-300 hover:bg-danger-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {token.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="px-2 py-1 bg-slate-100 dark:bg-gray-700 rounded text-xs text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-transparent"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Token Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-6 max-w-md w-full">
            {generatedToken ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Check className="text-green-400" size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Token Generated
                  </h3>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Copy this token now. It won't be shown again.
                    </p>
                  </div>
                </div>
                <div className="relative mb-4">
                  <code className="block w-full p-3 bg-slate-50 dark:bg-gray-900 rounded-lg text-sm text-slate-900 dark:text-primary-300 font-mono break-all border border-slate-200 dark:border-gray-700">
                    {generatedToken}
                  </code>
                  <button
                    onClick={() => copyToClipboard(generatedToken)}
                    className="absolute right-2 top-2 p-1.5 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white bg-white/80 dark:bg-gray-800 rounded border border-slate-200 dark:border-gray-700"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowTokenModal(false);
                    setGeneratedToken(null);
                    setNewToken({
                      name: '',
                      description: '',
                      scopes: ['users:read', 'users:write', 'groups:read', 'groups:write'],
                    });
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-lg transition-colors"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Generate SCIM Token
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-700 dark:text-gray-300 mb-1">
                      Token Name *
                    </label>
                    <input
                      type="text"
                      value={newToken.name}
                      onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                      placeholder="e.g., Azure AD SCIM"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={newToken.description}
                      onChange={(e) => setNewToken({ ...newToken, description: e.target.value })}
                      placeholder="Optional description"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 dark:text-gray-300 mb-2">
                      Scopes
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['users:read', 'users:write', 'groups:read', 'groups:write'].map((scope) => (
                        <label
                          key={scope}
                          className="flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200"
                        >
                          <input
                            type="checkbox"
                            checked={newToken.scopes.includes(scope)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewToken({
                                  ...newToken,
                                  scopes: [...newToken.scopes, scope],
                                });
                              } else {
                                setNewToken({
                                  ...newToken,
                                  scopes: newToken.scopes.filter((s) => s !== scope),
                                });
                              }
                            }}
                            className="rounded border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-primary-600"
                          />
                          {scope}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowTokenModal(false)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateToken}
                    disabled={!newToken.name}
                    className="flex-1 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    Generate
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderMappings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Group Mappings</h3>
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Map IdP groups to Consultify roles
          </p>
        </div>
        <button
          onClick={() => setShowMappingModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
        >
          <Plus size={18} />
          Add Mapping
        </button>
      </div>

      {groupMappings.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800/50 rounded-xl border border-slate-200 dark:border-gray-700">
          <Users className="mx-auto text-slate-600 dark:text-gray-400 mb-4" size={48} />
          <p className="text-slate-700 dark:text-gray-300">No group mappings configured</p>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Map IdP groups to automatically assign roles
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <table
            /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full"
          >
            <thead className="bg-slate-50 dark:bg-gray-900/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-gray-300">
                  External Group
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-gray-300">
                  →
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-gray-300">
                  Internal Role
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-700 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
              {groupMappings.map((mapping) => (
                <tr key={mapping.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div className="text-slate-900 dark:text-white font-medium">
                      {mapping.externalGroupName}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-gray-400">
                      {mapping.externalGroupId}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="text-slate-600 dark:text-gray-400" size={18} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-primary-500/15 text-primary-700 dark:text-primary-200 rounded text-sm">
                      {mapping.internalRole}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeleteMapping(mapping.id)}
                      title={`Delete mapping ${mapping.externalGroupName}`}
                      className="p-2 text-danger-400 hover:text-danger-300 hover:bg-danger-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Add Group Mapping
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 dark:text-gray-300 mb-1">
                  External Group ID *
                </label>
                <input
                  type="text"
                  value={newMapping.externalGroupId}
                  onChange={(e) =>
                    setNewMapping({ ...newMapping, externalGroupId: e.target.value })
                  }
                  placeholder="e.g., 00000000-0000-0000-0000-000000000000"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 dark:text-gray-300 mb-1">
                  External Group Name *
                </label>
                <input
                  type="text"
                  value={newMapping.externalGroupName}
                  onChange={(e) =>
                    setNewMapping({ ...newMapping, externalGroupName: e.target.value })
                  }
                  placeholder="e.g., Consultify Admins"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 dark:text-gray-300 mb-1">
                  Internal Role
                </label>
                <select
                  value={newMapping.internalRole}
                  onChange={(e) => setNewMapping({ ...newMapping, internalRole: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="project_manager">Project Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMappingModal(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMapping}
                disabled={!newMapping.externalGroupId || !newMapping.externalGroupName}
                className="flex-1 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Add Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Sync Logs</h3>
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Recent SCIM provisioning activity
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {syncLogs.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800/50 rounded-xl border border-slate-200 dark:border-gray-700">
          <History className="mx-auto text-slate-600 dark:text-gray-400 mb-4" size={48} />
          <p className="text-slate-700 dark:text-gray-300">No sync activity yet</p>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Logs will appear here when your IdP syncs users
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {syncLogs.map((log) => (
            <div
              key={log.id}
              className="bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      log.status === 'success'
                        ? 'bg-green-400'
                        : log.status === 'error'
                          ? 'bg-danger-400'
                          : 'bg-yellow-400'
                    }`}
                  />
                  <span className="text-slate-900 dark:text-white font-medium">
                    {log.operation}
                  </span>
                  <span className="text-slate-600 dark:text-gray-400">{log.resourceType}</span>
                  {log.externalId && (
                    <code className="text-xs text-slate-600 dark:text-gray-300 bg-slate-50 dark:bg-gray-900 px-2 py-0.5 rounded border border-slate-200 dark:border-gray-700">
                      {log.externalId}
                    </code>
                  )}
                </div>
                <span className="text-sm text-slate-500 dark:text-gray-400">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              {log.errorMessage && (
                <div className="mt-2 text-sm text-danger-700 dark:text-danger-300 bg-danger-500/10 rounded px-3 py-1">
                  {log.errorMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderConflicts = () => {
    const unresolved = conflicts.filter((c) => !c.resolution);
    const resolved = conflicts.filter((c) => c.resolution);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Provisioning Conflicts
            </h3>
            <p className="text-sm text-slate-600 dark:text-gray-400">
              Resolve conflicts from duplicate users or groups during SCIM sync
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-lg transition-colors"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        {unresolved.length === 0 && resolved.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800/50 rounded-xl border border-slate-200 dark:border-gray-700">
            <Shield className="mx-auto text-green-400 mb-4" size={48} />
            <p className="text-slate-700 dark:text-gray-300">No conflicts detected</p>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
              All SCIM provisioning operations completed without conflicts
            </p>
          </div>
        ) : (
          <>
            {unresolved.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-3">
                  Unresolved ({unresolved.length})
                </h4>
                <div className="space-y-3">
                  {unresolved.map((conflict) => (
                    <div
                      key={conflict.id}
                      className="bg-white dark:bg-gray-800/50 border border-yellow-500/30 rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <AlertTriangle className="text-yellow-500" size={16} />
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white">
                              {conflict.conflictType === 'duplicate_email'
                                ? 'Duplicate Email'
                                : conflict.conflictType === 'duplicate_group_name'
                                  ? 'Duplicate Group Name'
                                  : conflict.conflictType}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-gray-400 mt-1">
                              {conflict.resourceType} •{' '}
                              {conflict.details
                                ? Object.entries(conflict.details)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(', ')
                                : 'No details'}
                            </div>
                            {conflict.externalId && (
                              <div className="text-xs text-slate-500 dark:text-gray-500 mt-1">
                                External: {conflict.externalId} → Internal: {conflict.internalId}
                              </div>
                            )}
                            <div className="text-xs text-slate-600 dark:text-gray-500 mt-1">
                              {new Date(conflict.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleResolveConflict(conflict.id, 'merge')}
                            className="px-3 py-1.5 text-xs bg-green-500/15 text-green-700 dark:text-green-300 hover:bg-green-500/25 rounded-lg transition-colors"
                          >
                            Merge
                          </button>
                          <button
                            onClick={() => handleResolveConflict(conflict.id, 'overwrite')}
                            className="px-3 py-1.5 text-xs bg-primary-500/15 text-primary-700 dark:text-primary-300 hover:bg-primary-500/25 rounded-lg transition-colors"
                          >
                            Overwrite
                          </button>
                          <button
                            onClick={() => handleResolveConflict(conflict.id, 'skip')}
                            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resolved.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-3">
                  Resolved ({resolved.length})
                </h4>
                <div className="space-y-2">
                  {resolved.map((conflict) => (
                    <div
                      key={conflict.id}
                      className="bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-lg p-4 opacity-70"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Check className="text-green-400" size={16} />
                          <span className="text-slate-900 dark:text-white text-sm">
                            {conflict.conflictType} — {conflict.resourceType}
                          </span>
                          <span className="px-2 py-0.5 bg-green-500/15 text-green-700 dark:text-green-300 rounded text-xs">
                            {conflict.resolution}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-gray-400">
                          {conflict.resolvedAt
                            ? new Date(conflict.resolvedAt).toLocaleString()
                            : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">SCIM Provisioning</h2>
          <p className="text-slate-600 dark:text-gray-400 mt-1">
            Automatic user provisioning via SCIM 2.0
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-gray-700">
        <div className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300"
        >
          <div className="flex items-start justify-between gap-3">
            <span>{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              className="font-medium hover:text-amber-900 dark:hover:text-amber-200"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <LoadingState variant="spinner" className="py-12" />
      ) : loadError ? (
        <div className="rounded-xl border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 p-6 text-danger-700 dark:text-danger-300">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle size={18} />
            Failed to load SCIM data
          </div>
          <p className="mt-2 text-sm">{loadError}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 rounded-lg bg-danger-100 hover:bg-danger-200 dark:bg-danger-500/20 dark:hover:bg-danger-500/30 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'tokens' && renderTokens()}
          {activeTab === 'mappings' && renderMappings()}
          {activeTab === 'conflicts' && renderConflicts()}
          {activeTab === 'logs' && renderLogs()}
        </>
      )}
    </div>
  );
};

export default SCIMProvisioningView;
