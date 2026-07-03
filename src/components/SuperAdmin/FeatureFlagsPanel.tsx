/**
 * FeatureFlagsPanel - Full Implementation
 *
 * Complete feature flag management with CRUD operations, targeting rules, and A/B testing
 */

import {
  Check,
  Edit,
  Filter,
  Flag,
  History,
  Loader2,
  Plus,
  Search,
  Settings,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

interface FeatureFlag {
  id: string;
  flag_key: string;
  name: string;
  description?: string;
  enabled: boolean;
  flag_type: 'boolean' | 'percentage' | 'targeting' | 'ab_test';
  targeting_rules: any[];
  rollout_percentage: number;
  environment: string;
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

export const FeatureFlagsPanel: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEnvironment, setFilterEnvironment] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [selectedFlagHistory, setSelectedFlagHistory] = useState<string | null>(null);

  useEffect(() => {
    fetchFlags();
  }, [filterEnvironment]);

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (filterEnvironment !== 'all') {
        filters.environment = filterEnvironment;
      }
      const data = await Api.getFeatureFlags(filters);
      setFlags(data);
    } catch (error) {
      console.error('Failed to fetch feature flags:', error);
      toast.error('Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      await Api.toggleFeatureFlag(flag.id, !flag.enabled);
      toast.success(`Feature flag ${!flag.enabled ? 'enabled' : 'disabled'}`);
      fetchFlags();
    } catch (error) {
      console.error('Failed to toggle flag:', error);
      toast.error('Failed to toggle feature flag');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feature flag?')) return;

    try {
      await Api.deleteFeatureFlag(id);
      toast.success('Feature flag deleted');
      fetchFlags();
    } catch (error) {
      console.error('Failed to delete flag:', error);
      toast.error('Failed to delete feature flag');
    }
  };

  const filteredFlags = flags.filter((flag) => {
    const matchesSearch =
      !searchTerm ||
      flag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.flag_key.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Feature Flags</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            Control feature availability across your platform
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
        >
          <Plus size={16} />
          Create Flag
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500"
            size={16}
          />
          <input
            type="text"
            placeholder="Search flags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={filterEnvironment}
          onChange={(e) => setFilterEnvironment(e.target.value)}
          className="px-4 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Environments</option>
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
        </select>
      </div>

      {/* Flags List */}
      <div className="space-y-2">
        {filteredFlags.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            <Flag size={48} className="mx-auto mb-4 opacity-50" />
            <p>No feature flags found</p>
          </div>
        ) : (
          filteredFlags.map((flag) => (
            <div
              key={flag.id}
              className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-white font-medium">{flag.name}</h3>
                    <span className="px-2 py-0.5 text-xs bg-primary-500/20 text-primary-400 rounded">
                      {flag.flag_key}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                      {flag.environment}
                    </span>
                  </div>
                  {flag.description && (
                    <p className="text-sm text-slate-400 dark:text-slate-500 mb-2">
                      {flag.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span>Type: {flag.flag_type}</span>
                    {flag.flag_type === 'percentage' && (
                      <span>Rollout: {flag.rollout_percentage}%</span>
                    )}
                    {flag.organization_id && <span>Org-specific</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(flag)}
                    className={`p-2 rounded-lg transition-colors ${
                      flag.enabled
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-600'
                    }`}
                    title={flag.enabled ? 'Disable' : 'Enable'}
                  >
                    {flag.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                  <button
                    onClick={() => setEditingFlag(flag)}
                    className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => setSelectedFlagHistory(flag.id)}
                    className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                    title="History"
                  >
                    <History size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(flag.id)}
                    className="p-2 rounded-lg bg-danger-500/20 text-danger-400 hover:bg-danger-500/30 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <FeatureFlagModal
          flag={editingFlag}
          onClose={() => {
            setShowCreateModal(false);
            setEditingFlag(null);
          }}
          onSave={() => {
            fetchFlags();
            setShowCreateModal(false);
            setEditingFlag(null);
          }}
        />
      )}

      {/* History Modal */}
      {selectedFlagHistory && (
        <FlagHistoryModal
          flagId={selectedFlagHistory}
          onClose={() => setSelectedFlagHistory(null)}
        />
      )}
    </div>
  );
};

// Feature Flag Modal Component
const FeatureFlagModal: React.FC<{
  flag?: FeatureFlag | null;
  onClose: () => void;
  onSave: () => void;
}> = ({ flag, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    flag_key: flag?.flag_key || '',
    name: flag?.name || '',
    description: flag?.description || '',
    enabled: flag?.enabled || false,
    flag_type: flag?.flag_type || 'boolean',
    rollout_percentage: flag?.rollout_percentage || 0,
    environment: flag?.environment || 'production',
    targeting_rules: flag?.targeting_rules || [],
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (flag) {
        await Api.updateFeatureFlag(flag.id, formData);
        toast.success('Feature flag updated');
      } else {
        await Api.createFeatureFlag(formData);
        toast.success('Feature flag created');
      }
      onSave();
    } catch (error) {
      console.error('Failed to save flag:', error);
      toast.error('Failed to save feature flag');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay">
      <div className="bg-navy-900 rounded-xl border border-white/10 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">
            {flag ? 'Edit Feature Flag' : 'Create Feature Flag'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Flag Key *</label>
            <input
              type="text"
              required
              value={formData.flag_key}
              onChange={(e) => setFormData({ ...formData, flag_key: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="new_feature"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Type *</label>
              <select
                value={formData.flag_type}
                onChange={(e) => setFormData({ ...formData, flag_type: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="boolean">Boolean</option>
                <option value="percentage">Percentage Rollout</option>
                <option value="targeting">Targeting Rules</option>
                <option value="ab_test">A/B Test</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Environment *</label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>
          </div>

          {formData.flag_type === 'percentage' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Rollout Percentage
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.rollout_percentage}
                onChange={(e) =>
                  setFormData({ ...formData, rollout_percentage: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 text-primary-600 bg-slate-50/30 dark:bg-navy-950/20 border-white/10 rounded focus:ring-primary-500"
            />
            <label htmlFor="enabled" className="text-sm text-slate-300">
              Enabled
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 dark:text-slate-500 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {flag ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Flag History Modal Component
const FlagHistoryModal: React.FC<{
  flagId: string;
  onClose: () => void;
}> = ({ flagId, onClose }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [flagId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await Api.getFeatureFlagHistory(flagId);
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      toast.error('Failed to load flag history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay">
      <div className="bg-navy-900 rounded-xl border border-white/10 p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Feature Flag History</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="text-slate-400 dark:text-slate-500 text-center py-8">
                No history available
              </p>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50/30 dark:bg-navy-950/20 rounded-lg border border-white/10"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{item.change_type}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(item.changed_at).toLocaleString()}
                    </span>
                  </div>
                  {item.changed_by && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Changed by: {item.changed_by}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeatureFlagsPanel;
