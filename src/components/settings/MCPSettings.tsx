/**
 * MCPSettings - Manage MCP server connections
 * Configure external tool plugins via Model Context Protocol
 *
 * @version 1.0.0
 */

import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Edit2,
  ExternalLink,
  Loader2,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Server,
  Settings,
  Terminal,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MCPServer {
  id: string;
  name: string;
  description?: string;
  transport: 'stdio' | 'http' | 'websocket';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
  autoConnect: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastError?: string;
  tools: Array<{ name: string; description: string }>;
  resources: Array<{ uri: string; name: string }>;
}

interface MCPSettingsProps {
  servers: MCPServer[];
  onAddServer: (server: Omit<MCPServer, 'id' | 'status' | 'tools' | 'resources'>) => Promise<void>;
  onUpdateServer: (id: string, updates: Partial<MCPServer>) => Promise<void>;
  onDeleteServer: (id: string) => Promise<void>;
  onConnect: (id: string) => Promise<void>;
  onDisconnect: (id: string) => Promise<void>;
  onRefresh: (id: string) => Promise<void>;
}

const PRESET_SERVERS = [
  {
    name: 'File System',
    description: 'Access local files and directories',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
    transport: 'stdio' as const,
  },
  {
    name: 'GitHub',
    description: 'Interact with GitHub repositories',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    transport: 'stdio' as const,
  },
  {
    name: 'SQLite',
    description: 'Query SQLite databases',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite'],
    transport: 'stdio' as const,
  },
  {
    name: 'Brave Search',
    description: 'Search the web with Brave',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    transport: 'stdio' as const,
  },
];

export const MCPSettings: React.FC<MCPSettingsProps> = ({
  servers,
  onAddServer,
  onUpdateServer,
  onDeleteServer,
  onConnect,
  onDisconnect,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleConnect = async (id: string) => {
    setIsLoading(id);
    try {
      await onConnect(id);
    } finally {
      setIsLoading(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    setIsLoading(id);
    try {
      await onDisconnect(id);
    } finally {
      setIsLoading(null);
    }
  };

  const handleRefresh = async (id: string) => {
    setIsLoading(id);
    try {
      await onRefresh(id);
    } finally {
      setIsLoading(null);
    }
  };

  const getStatusColor = (status: MCPServer['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-amber-500 animate-pulse';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-slate-300 dark:bg-slate-600';
    }
  };

  const getStatusLabel = (status: MCPServer['status']) => {
    switch (status) {
      case 'connected':
        return t('mcp.status.connected', 'Connected');
      case 'connecting':
        return t('mcp.status.connecting', 'Connecting...');
      case 'error':
        return t('mcp.status.error', 'Error');
      default:
        return t('mcp.status.disconnected', 'Disconnected');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
            {t('mcp.title', 'MCP Servers')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('mcp.description', 'Connect to Model Context Protocol servers for extended capabilities')}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
        >
          <Plus size={16} />
          {t('mcp.addServer', 'Add Server')}
        </button>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
        <div className="flex items-start gap-3">
          <Server size={20} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t(
                'mcp.info',
                'MCP servers provide additional tools, resources, and prompts that can be used by the AI assistant. Learn more at'
              )}{' '}
              <a
                href="https://modelcontextprotocol.io"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                modelcontextprotocol.io
                <ExternalLink size={12} className="inline ml-1" />
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Server List */}
      {servers.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-dashed border-slate-200 dark:border-navy-700">
          <Server size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {t('mcp.noServers', 'No MCP servers configured')}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
          >
            <Plus size={16} />
            {t('mcp.addFirstServer', 'Add your first server')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => (
            <div
              key={server.id}
              className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden"
            >
              {/* Server Header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setExpandedServer(expandedServer === server.id ? null : server.id)
                    }
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {expandedServer === server.id ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(server.status)}`} />
                    <div>
                      <h4 className="font-medium text-slate-800 dark:text-white">{server.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {server.transport === 'stdio' ? (
                          <span className="flex items-center gap-1">
                            <Terminal size={12} />
                            {server.command}
                          </span>
                        ) : (
                          server.url
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {server.status === 'connected' && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {server.tools.length} {t('mcp.tools', 'tools')}
                    </span>
                  )}

                  {isLoading === server.id ? (
                    <Loader2 size={18} className="animate-spin text-slate-400" />
                  ) : server.status === 'connected' ? (
                    <>
                      <button
                        onClick={() => handleRefresh(server.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 rounded"
                        title={t('mcp.refresh', 'Refresh')}
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        onClick={() => handleDisconnect(server.id)}
                        className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title={t('mcp.disconnect', 'Disconnect')}
                      >
                        <PowerOff size={16} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleConnect(server.id)}
                      className="p-1.5 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                      title={t('mcp.connect', 'Connect')}
                    >
                      <Power size={16} />
                    </button>
                  )}

                  <button
                    onClick={() => setEditingServer(server)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 rounded"
                    title={t('common.edit', 'Edit')}
                  >
                    <Edit2 size={16} />
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(t('mcp.confirmDelete', 'Delete this server?'))) {
                        onDeleteServer(server.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title={t('common.delete', 'Delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {server.status === 'error' && server.lastError && (
                <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-900/30">
                  <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle size={14} />
                    {server.lastError}
                  </div>
                </div>
              )}

              {/* Expanded Content */}
              {expandedServer === server.id && (
                <div className="px-4 py-3 bg-slate-50 dark:bg-navy-800/50 border-t border-slate-200 dark:border-navy-700">
                  {server.status !== 'connected' ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                      {t('mcp.connectToSeeCapabilities', 'Connect to see available tools and resources')}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {/* Tools */}
                      {server.tools.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Wrench size={12} />
                            {t('mcp.availableTools', 'Available Tools')}
                          </h5>
                          <div className="grid grid-cols-2 gap-2">
                            {server.tools.map((tool) => (
                              <div
                                key={tool.name}
                                className="px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg"
                              >
                                <div className="font-medium text-sm text-slate-700 dark:text-slate-300">
                                  {tool.name}
                                </div>
                                {tool.description && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                    {tool.description}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Resources */}
                      {server.resources.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            {t('mcp.availableResources', 'Available Resources')}
                          </h5>
                          <div className="space-y-1">
                            {server.resources.map((resource) => (
                              <div
                                key={resource.uri}
                                className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
                              >
                                <span className="font-medium">{resource.name}</span>
                                <span className="text-slate-400 dark:text-slate-500 text-xs">
                                  {resource.uri}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingServer) && (
        <MCPServerModal
          server={editingServer}
          presets={PRESET_SERVERS}
          onSave={async (data) => {
            if (editingServer) {
              await onUpdateServer(editingServer.id, data);
            } else {
              await onAddServer(data);
            }
            setShowAddModal(false);
            setEditingServer(null);
          }}
          onClose={() => {
            setShowAddModal(false);
            setEditingServer(null);
          }}
        />
      )}
    </div>
  );
};

// Modal Component
interface MCPServerModalProps {
  server?: MCPServer | null;
  presets: Array<{
    name: string;
    description: string;
    command: string;
    args: string[];
    transport: 'stdio';
  }>;
  onSave: (data: Omit<MCPServer, 'id' | 'status' | 'tools' | 'resources'>) => Promise<void>;
  onClose: () => void;
}

const MCPServerModal: React.FC<MCPServerModalProps> = ({ server, presets, onSave, onClose }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: server?.name || '',
    description: server?.description || '',
    transport: server?.transport || ('stdio' as const),
    command: server?.command || '',
    args: server?.args?.join(' ') || '',
    url: server?.url || '',
    enabled: server?.enabled ?? true,
    autoConnect: server?.autoConnect ?? false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handlePresetSelect = (preset: (typeof presets)[0]) => {
    setFormData({
      ...formData,
      name: preset.name,
      description: preset.description,
      transport: preset.transport,
      command: preset.command,
      args: preset.args.join(' '),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await onSave({
        name: formData.name,
        description: formData.description,
        transport: formData.transport,
        command: formData.transport === 'stdio' ? formData.command : undefined,
        args: formData.transport === 'stdio' ? formData.args.split(' ').filter(Boolean) : undefined,
        url: formData.transport !== 'stdio' ? formData.url : undefined,
        enabled: formData.enabled,
        autoConnect: formData.autoConnect,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-navy-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
            {server ? t('mcp.editServer', 'Edit Server') : t('mcp.addServer', 'Add Server')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Presets */}
          {!server && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('mcp.quickStart', 'Quick Start Presets')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className="text-left px-3 py-2 border border-slate-200 dark:border-navy-700 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
                  >
                    <div className="font-medium text-sm text-slate-700 dark:text-slate-300">
                      {preset.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('mcp.fields.name', 'Name')} *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Transport */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('mcp.fields.transport', 'Transport')}
            </label>
            <select
              value={formData.transport}
              onChange={(e) =>
                setFormData({ ...formData, transport: e.target.value as 'stdio' | 'http' })
              }
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="stdio">stdio (Local Command)</option>
              <option value="http">HTTP</option>
            </select>
          </div>

          {/* Command (for stdio) */}
          {formData.transport === 'stdio' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('mcp.fields.command', 'Command')} *
                </label>
                <input
                  type="text"
                  value={formData.command}
                  onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                  placeholder="npx"
                  required
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('mcp.fields.args', 'Arguments')}
                </label>
                <input
                  type="text"
                  value={formData.args}
                  onChange={(e) => setFormData({ ...formData, args: e.target.value })}
                  placeholder="-y @modelcontextprotocol/server-filesystem /"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono"
                />
              </div>
            </>
          )}

          {/* URL (for HTTP) */}
          {formData.transport === 'http' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('mcp.fields.url', 'URL')} *
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="http://localhost:3000"
                required
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          {/* Options */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {t('mcp.fields.enabled', 'Enabled')}
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoConnect}
                onChange={(e) => setFormData({ ...formData, autoConnect: e.target.checked })}
                className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {t('mcp.fields.autoConnect', 'Auto-connect on startup')}
              </span>
            </label>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !formData.name}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 rounded-lg transition-colors"
          >
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            {server ? t('common.save', 'Save') : t('mcp.addServer', 'Add Server')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MCPSettings;
