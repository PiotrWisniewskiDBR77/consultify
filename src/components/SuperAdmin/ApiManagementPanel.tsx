/**
 * ApiManagementPanel - API Keys Management
 */

import { Eye, EyeOff, Key, Loader2, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

export const ApiManagementPanel: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const data = await Api.getApiKeys();
      setApiKeys(data);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;

    try {
      await (Api as any).revokeApiKey(id);
      toast.success('API key revoked');
      fetchApiKeys();
    } catch (error) {
      console.error('Failed to revoke key:', error);
      toast.error('Failed to revoke API key');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text mb-2">API Keys</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            Manage API keys for machine-to-machine access
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus size={16} />
          Create API Key
        </button>
      </div>

      <div className="space-y-2">
        {apiKeys.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            <Key size={48} className="mx-auto mb-4 opacity-50" />
            <p>No API keys configured</p>
          </div>
        ) : (
          apiKeys.map((key) => (
            <div
              key={key.id}
              className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-c-text font-medium">{key.name || 'Unnamed Key'}</span>
                    <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded">
                      {key.key_prefix}...
                    </span>
                    {key.revoked_at ? (
                      <span className="px-2 py-1 text-xs bg-danger-500/20 text-danger-400 rounded">
                        Revoked
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  {key.last_used_at && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Last used: {new Date(key.last_used_at).toLocaleString()}
                    </p>
                  )}
                  {key.expires_at && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Expires: {new Date(key.expires_at).toLocaleString()}
                    </p>
                  )}
                </div>
                {!key.revoked_at && (
                  <button
                    onClick={() => handleRevoke(key.id)}
                    className="p-2 rounded-lg bg-danger-500/20 text-danger-400 hover:bg-danger-500/30 transition-colors"
                    title="Revoke"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ApiManagementPanel;
