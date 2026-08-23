/**
 * SettingsHistory - Audit log of all settings changes
 */

import { ChevronDown, Clock, History, RotateCcw, Search } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Banner } from '@/components/shared/Banner';
import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { User } from '../../../types';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState } from '../../Admin/AdminState';

interface SettingsHistoryProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface HistoryEntry {
  id: string;
  category: string;
  setting: string;
  action: 'created' | 'updated' | 'deleted' | 'restored';
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  device?: string;
  ipAddress?: string;
}

export const SettingsHistory: React.FC<SettingsHistoryProps> = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const categories = [
    'Profile',
    'Security',
    'Privacy',
    'AI',
    'Notifications',
    'Integrations',
    'Appearance',
  ];

  const loadData = useCallback(async (): Promise<HistoryEntry[] | null> => {
    try {
      setLoading(true);
      setLoadError(null);
      const days =
        dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
      const response = await Api.getSettingsHistory(
        selectedCategory !== 'all' ? selectedCategory : undefined,
        days
      );

      if (response?.entries) {
        const nextEntries = response.entries as HistoryEntry[];
        setEntries(nextEntries);
        return nextEntries;
      }
      throw new Error('Settings history response was missing entries');
    } catch (error: unknown) {
      setLoadError(normalizeApiErrorMessage(error, 'Failed to load settings history'));
      setEntries([]);
      return null;
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedCategory]);

  useEffect(() => {
    void loadData();
  }, [currentUser.id, loadData]);

  const handleRestore = async (entry: HistoryEntry) => {
    if (!entry.oldValue) return;
    if (!window.confirm(`Restore "${entry.setting}" to "${entry.oldValue}"?`)) return;

    try {
      setActionError(null);
      const response = await Api.restoreSettingsEntry(entry.id);
      if (response?.success === false) {
        throw new Error('Settings restore was rejected by the server');
      }
      const refreshed = await loadData();
      if (!refreshed) {
        throw new Error('Settings history refresh after restore was not confirmed by the server');
      }
      toast.success(`Restored ${entry.setting} to previous value`);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to restore setting');
      setActionError(message);
      toast.error(message);
    }
  };

  const filteredEntries = entries.filter((e) => {
    const matchesSearch =
      e.setting.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || e.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created':
        return 'text-green-600 bg-green-100 dark:bg-green-500/20';
      case 'updated':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-500/20';
      case 'deleted':
        return 'text-danger-600 bg-danger-100 dark:bg-danger-500/20';
      case 'restored':
        return 'text-c-accent bg-c-accent-soft dark:bg-c-accent-soft';
      default:
        return 'text-c-text-secondary bg-c-surface-raised';
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in relative">
      <div>
        <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
          <History size={28} className="text-amber-500" />
          Settings History
        </h2>
        <p className="text-c-text-muted text-sm mt-1">View and restore previous settings changes</p>
      </div>

      {loadError && <DegradedState title="Settings history unavailable" description={loadError} />}

      {actionError && <Banner variant="danger" title={actionError} />}

      {!loadError && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-secondary"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search changes..."
                className="w-full pl-10 pr-4 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d' | 'all')}
              className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>

          {/* History List */}
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl overflow-hidden">
            {filteredEntries.length === 0 ? (
              <div className="p-8 text-center text-c-text-muted">
                <History size={48} className="mx-auto mb-3 opacity-50" />
                <p>No settings changes found</p>
              </div>
            ) : (
              <div className="divide-y divide-c-border-subtle dark:divide-white/10">
                {filteredEntries.map((entry) => (
                  <div key={entry.id} className="hover:bg-c-surface-raised dark:hover:bg-navy-950">
                    <button
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      className="w-full p-4 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center">
                            <Clock size={14} className="text-c-text-secondary" />
                            <span className="text-xs text-c-text-muted mt-1">
                              {formatTime(entry.timestamp)}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(entry.action)}`}
                              >
                                {entry.action}
                              </span>
                              <span className="px-2 py-0.5 bg-c-surface-raised rounded-full text-xs text-c-text-secondary">
                                {entry.category}
                              </span>
                            </div>
                            <p className="font-medium text-c-text mt-1">{entry.setting}</p>
                          </div>
                        </div>
                        <ChevronDown
                          size={16}
                          className={`text-c-text-secondary transition-transform ${expandedId === entry.id ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </button>

                    {expandedId === entry.id && (
                      <div className="px-4 pb-4 pt-0">
                        <div className="ml-[76px] p-4 bg-c-surface-raised rounded-lg space-y-3">
                          {entry.oldValue && (
                            <div className="flex gap-4">
                              <span className="text-sm text-c-text-muted w-20">Before:</span>
                              <span className="text-sm text-danger-600 dark:text-danger-400 line-through">
                                {entry.oldValue}
                              </span>
                            </div>
                          )}
                          {entry.newValue && (
                            <div className="flex gap-4">
                              <span className="text-sm text-c-text-muted w-20">After:</span>
                              <span className="text-sm text-green-600 dark:text-green-400">
                                {entry.newValue}
                              </span>
                            </div>
                          )}
                          <div className="flex gap-4 pt-2 border-t border-c-border-subtle dark:border-navy-700">
                            <span className="text-sm text-c-text-muted w-20">Device:</span>
                            <span className="text-sm text-c-text-secondary">{entry.device}</span>
                          </div>
                          <div className="flex gap-4">
                            <span className="text-sm text-c-text-muted w-20">IP:</span>
                            <span className="text-sm text-c-text-secondary">{entry.ipAddress}</span>
                          </div>
                          <div className="flex gap-4">
                            <span className="text-sm text-c-text-muted w-20">Time:</span>
                            <span className="text-sm text-c-text-secondary">
                              {formatTimestamp(entry.timestamp)}
                            </span>
                          </div>

                          {entry.oldValue && (
                            <button
                              onClick={() => handleRestore(entry)}
                              className="flex items-center gap-2 mt-3 px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-lg"
                            >
                              <RotateCcw size={14} />
                              Restore Previous Value
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-c-text">{entries.length}</p>
              <p className="text-sm text-c-text-muted">Total Changes</p>
            </div>
            <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-c-text">
                {new Set(entries.map((e) => e.category)).size}
              </p>
              <p className="text-sm text-c-text-muted">Categories</p>
            </div>
            <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-c-text">
                {
                  entries.filter((e) => new Date(e.timestamp) > new Date(Date.now() - 86400000))
                    .length
                }
              </p>
              <p className="text-sm text-c-text-muted">Today</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SettingsHistory;
