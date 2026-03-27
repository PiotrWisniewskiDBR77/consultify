/**
 * IntegrationsMarketplace - Third-party Integrations Hub
 *
 * Features:
 * - GitHub, GitLab, Jira, Trello, Asana integrations
 * - Slack, Teams, Google Workspace, Microsoft 365
 * - Dropbox, OneDrive, Zapier, Make integrations
 */

import {
  AlertCircle,
  CheckCircle,
  Download,
  ExternalLink,
  Filter,
  Link,
  Loader2,
  Puzzle,
  Save,
  Search,
  Settings,
  Star,
  Unlink,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { User } from '../../../types';
import { InfoButton } from '../../shared/InfoButton';

interface IntegrationsMarketplaceProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  connected: boolean;
  enabled: boolean;
  popular: boolean;
  features: string[];
  setupUrl?: string;
}

const availableIntegrations: Integration[] = [
  // Development
  {
    id: 'github',
    name: 'GitHub',
    description: 'Connect repositories, track issues, sync commits',
    category: 'development',
    icon: '🐙',
    color: 'bg-[#24292e]',
    connected: false,
    enabled: false,
    popular: true,
    features: ['Repo sync', 'Issue tracking', 'PR integration'],
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'GitLab repositories and CI/CD pipelines',
    category: 'development',
    icon: '🦊',
    color: 'bg-[#FC6D26]',
    connected: false,
    enabled: false,
    popular: false,
    features: ['Repo sync', 'Pipeline status', 'Issue sync'],
  },

  // Project Management
  {
    id: 'jira',
    name: 'Jira',
    description: 'Sync issues and sprints from Jira',
    category: 'project',
    icon: '🎫',
    color: 'bg-[#0052CC]',
    connected: false,
    enabled: false,
    popular: true,
    features: ['Issue sync', 'Sprint import', 'Status mapping'],
  },
  {
    id: 'trello',
    name: 'Trello',
    description: 'Import boards and cards from Trello',
    category: 'project',
    icon: '📋',
    color: 'bg-[#0079BF]',
    connected: false,
    enabled: false,
    popular: true,
    features: ['Board import', 'Card sync', 'Checklist sync'],
  },
  {
    id: 'asana',
    name: 'Asana',
    description: 'Sync tasks and projects from Asana',
    category: 'project',
    icon: '🎯',
    color: 'bg-[#F06A6A]',
    connected: false,
    enabled: false,
    popular: false,
    features: ['Task sync', 'Project import', 'Timeline view'],
  },

  // Communication
  {
    id: 'slack',
    name: 'Slack',
    description: 'Receive notifications and updates in Slack',
    category: 'communication',
    icon: '💬',
    color: 'bg-[#4A154B]',
    connected: false,
    enabled: false,
    popular: true,
    features: ['Notifications', 'Commands', 'File sharing'],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Integrate with Microsoft Teams',
    category: 'communication',
    icon: '👥',
    color: 'bg-[#6264A7]',
    connected: false,
    enabled: false,
    popular: true,
    features: ['Notifications', 'Tabs', 'Bots'],
  },

  // Productivity
  {
    id: 'google',
    name: 'Google Workspace',
    description: 'Connect Google Drive, Calendar, Docs',
    category: 'productivity',
    icon: '🔵',
    color: 'bg-[#4285F4]',
    connected: false,
    enabled: false,
    popular: true,
    features: ['Drive sync', 'Calendar', 'Docs integration'],
  },
  {
    id: 'microsoft365',
    name: 'Microsoft 365',
    description: 'Connect OneDrive, Outlook, Office apps',
    category: 'productivity',
    icon: '📦',
    color: 'bg-[#D83B01]',
    connected: false,
    enabled: false,
    popular: true,
    features: ['OneDrive', 'Outlook', 'Office apps'],
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Attach and sync files from Dropbox',
    category: 'storage',
    icon: '📥',
    color: 'bg-[#0061FF]',
    connected: false,
    enabled: false,
    popular: false,
    features: ['File sync', 'Attachments', 'Sharing'],
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    description: 'Access files from OneDrive',
    category: 'storage',
    icon: '☁️',
    color: 'bg-[#094AB2]',
    connected: false,
    enabled: false,
    popular: false,
    features: ['File sync', 'Attachments', 'Sharing'],
  },

  // Automation
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Create automated workflows with Zapier',
    category: 'automation',
    icon: '⚡',
    color: 'bg-[#FF4A00]',
    connected: false,
    enabled: false,
    popular: true,
    features: ['Triggers', 'Actions', '5000+ apps'],
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    description: 'Advanced automation scenarios',
    category: 'automation',
    icon: '🔄',
    color: 'bg-[#6D00CC]',
    connected: false,
    enabled: false,
    popular: false,
    features: ['Scenarios', 'Visual builder', 'Advanced logic'],
  },
];

const categories = [
  { id: 'all', label: 'All' },
  { id: 'development', label: 'Development' },
  { id: 'project', label: 'Project Management' },
  { id: 'communication', label: 'Communication' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'storage', label: 'Storage' },
  { id: 'automation', label: 'Automation' },
];

export const IntegrationsMarketplace: React.FC<IntegrationsMarketplaceProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>(availableIntegrations);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [showConnectedOnly, setShowConnectedOnly] = useState(false);

  useEffect(() => {
    loadIntegrations();
  }, [currentUser.id]);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const response = await Api.get('/api/user/integrations');
      if (response.success && response.data) {
        // Merge server data with available integrations
        const merged = availableIntegrations.map((int) => {
          const serverInt = response.data.find((s: any) => s.id === int.id);
          return serverInt ? { ...int, ...serverInt } : int;
        });
        setIntegrations(merged);
      }
    } catch (error) {
      console.error('Error loading integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectIntegration = async (integrationId: string) => {
    setConnecting(integrationId);
    try {
      const response = await Api.post(`/api/integrations/${integrationId}/connect`, {});
      if (response.success) {
        if (response.authUrl) {
          window.open(response.authUrl, '_blank', 'width=600,height=700');
          toast.success('Authorization started. Finish the external auth step to complete setup.');
        } else if (
          response.onboardingStatus === 'pending_external_auth_or_configuration' ||
          response.onboardingStatus === 'pending_configuration'
        ) {
          toast.success('Setup started. Complete the required configuration fields to continue.');
        } else if (response.onboardingStatus === 'configuration_submitted_pending_validation') {
          toast.success('Configuration submitted. Validation is still pending.');
        } else {
          setIntegrations(
            integrations.map((int) =>
              int.id === integrationId ? { ...int, connected: true, enabled: true } : int
            )
          );
          toast.success(`${integrationId} connected successfully`);
        }
      }
    } catch (error) {
      toast.error(`Failed to connect ${integrationId}`);
    } finally {
      setConnecting(null);
    }
  };

  const disconnectIntegration = async (integrationId: string) => {
    try {
      await Api.post(`/api/integrations/${integrationId}/disconnect`, {});
      setIntegrations(
        integrations.map((int) =>
          int.id === integrationId ? { ...int, connected: false, enabled: false } : int
        )
      );
      toast.success('Integration disconnected');
    } catch (error) {
      toast.error('Failed to disconnect integration');
    }
  };

  const toggleEnabled = async (integrationId: string) => {
    const integration = integrations.find((int) => int.id === integrationId);
    if (!integration?.connected) return;

    try {
      await Api.put(`/api/integrations/${integrationId}/toggle`, { enabled: !integration.enabled });
      setIntegrations(
        integrations.map((int) =>
          int.id === integrationId ? { ...int, enabled: !int.enabled } : int
        )
      );
    } catch (error) {
      toast.error('Failed to update integration');
    }
  };

  const filteredIntegrations = integrations.filter((int) => {
    const matchesSearch =
      int.name.toLowerCase().includes(search.toLowerCase()) ||
      int.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || int.category === category;
    const matchesConnected = !showConnectedOnly || int.connected;
    return matchesSearch && matchesCategory && matchesConnected;
  });

  const connectedCount = integrations.filter((int) => int.connected).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <InfoButton cardId="settings-integrations-marketplace" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Puzzle size={28} className="text-indigo-500" />
            {t('settings.integrations.marketplace.title', 'Integrations')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {connectedCount} connected • {availableIntegrations.length} available
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search integrations..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowConnectedOnly(!showConnectedOnly)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              showConnectedOnly
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Filter size={16} />
            Connected
          </button>
        </div>
      </div>

      {/* Popular Section */}
      {category === 'all' && !search && !showConnectedOnly && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Star size={18} className="text-amber-500" />
            Popular Integrations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations
              .filter((int) => int.popular)
              .map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  connecting={connecting}
                  onConnect={connectIntegration}
                  onDisconnect={disconnectIntegration}
                  onToggle={toggleEnabled}
                />
              ))}
          </div>
        </div>
      )}

      {/* All Integrations */}
      <div>
        {(category !== 'all' || search || showConnectedOnly) && (
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            {showConnectedOnly ? 'Connected Integrations' : 'All Integrations'}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">
              ({filteredIntegrations.length})
            </span>
          </h3>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              connecting={connecting}
              onConnect={connectIntegration}
              onDisconnect={disconnectIntegration}
              onToggle={toggleEnabled}
            />
          ))}
        </div>
      </div>

      {filteredIntegrations.length === 0 && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <Puzzle size={48} className="mx-auto mb-4 opacity-30" />
          <p>No integrations found</p>
        </div>
      )}
    </div>
  );
};

const IntegrationCard: React.FC<{
  integration: Integration;
  connecting: string | null;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onToggle: (id: string) => void;
}> = ({ integration, connecting, onConnect, onDisconnect, onToggle }) => (
  <div
    className={`p-4 rounded-xl border-2 transition-all ${
      integration.connected
        ? 'border-green-500/50 bg-green-50 dark:bg-green-500/5'
        : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 hover:border-indigo-300'
    }`}
  >
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-3">
        <div
          className={`w-12 h-12 rounded-xl ${integration.color} flex items-center justify-center text-2xl`}
        >
          {integration.icon}
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-white">{integration.name}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
            {integration.category}
          </p>
        </div>
      </div>
      {integration.connected && <CheckCircle size={20} className="text-green-500" />}
    </div>

    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{integration.description}</p>

    <div className="flex flex-wrap gap-1 mb-4">
      {integration.features.map((feature) => (
        <span
          key={feature}
          className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 rounded"
        >
          {feature}
        </span>
      ))}
    </div>

    {integration.connected ? (
      <div className="flex items-center justify-between">
        <button
          onClick={() => onToggle(integration.id)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            integration.enabled ? 'bg-green-600' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white dark:bg-navy-900 shadow transition-all ${
              integration.enabled ? 'left-5' : 'left-0.5'
            }`}
          />
        </button>
        <div className="flex gap-2">
          <button
            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg"
            title="Settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={() => onDisconnect(integration.id)}
            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
            title="Disconnect"
          >
            <Unlink size={16} />
          </button>
        </div>
      </div>
    ) : (
      <button
        onClick={() => onConnect(integration.id)}
        disabled={connecting === integration.id}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
      >
        {connecting === integration.id ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Link size={16} />
        )}
        Connect
      </button>
    )}
  </div>
);

export default IntegrationsMarketplace;
