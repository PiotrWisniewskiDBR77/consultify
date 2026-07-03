/**
 * AuditLogViewer Component
 *
 * Table with filters for viewing AI settings changes.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Download,
  Filter,
  History,
  RefreshCw,
  Search,
  Settings,
  User,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../../services/api';
import { AISettingsAuditEntry } from '../../types';

interface AuditLogViewerProps {
  level?: 'superadmin' | 'admin' | 'user';
  targetId?: string;
  limit?: number;
  showFilters?: boolean;
  showExport?: boolean;
  className?: string;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  level,
  targetId,
  limit = 50,
  showFilters = true,
  showExport = false,
  className = '',
}) => {
  const [entries, setEntries] = useState<AISettingsAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterLevel, setFilterLevel] = useState<string>(level || '');
  const [filterSearch, setFilterSearch] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const fetchAuditLog = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterLevel) params.append('level', filterLevel);
      if (targetId) params.append('targetId', targetId);
      params.append('limit', limit.toString());

      const response = await fetch(`/api/ai-settings/audit?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch audit log');

      const data = await response.json();
      // The endpoint returns an array of entries, but tolerate the legacy
      // { entries: [...] } / { rows: [...] } envelope too. Normalize snake_case
      // DB columns into the camelCase shape the table renders.
      const rawList: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.entries)
          ? data.entries
          : Array.isArray(data?.rows)
            ? data.rows
            : [];
      const normalized: AISettingsAuditEntry[] = rawList.map((row: any) => ({
        id: row.id,
        timestamp: row.timestamp ?? row.created_at ?? '',
        level: row.level,
        actorId: row.actorId ?? row.actor_id ?? '',
        actorRole: row.actorRole ?? row.actor_role ?? '',
        targetId: row.targetId ?? row.target_id ?? '',
        settingKey: row.settingKey ?? row.setting_key ?? '',
        oldValue: row.oldValue ?? row.old_value ?? null,
        newValue: row.newValue ?? row.new_value ?? null,
        ipAddress: row.ipAddress ?? row.ip_address ?? null,
        userAgent: row.userAgent ?? row.user_agent ?? null,
      }));
      setEntries(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLog();
  }, [filterLevel, targetId, limit]);

  const filteredEntries = entries.filter((entry) => {
    if (filterSearch) {
      const search = filterSearch.toLowerCase();
      return (
        entry.settingKey.toLowerCase().includes(search) ||
        entry.actorId.toLowerCase().includes(search) ||
        JSON.stringify(entry.newValue).toLowerCase().includes(search)
      );
    }
    return true;
  });

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getLevelColor = (lvl: string) => {
    switch (lvl) {
      case 'superadmin':
        return 'text-danger-400 bg-danger-500/10';
      case 'admin':
        return 'text-amber-400 bg-amber-500/10';
      case 'user':
        return 'text-primary-400 bg-primary-500/10';
      default:
        return 'text-slate-600 dark:text-slate-500 bg-slate-50 dark:bg-navy-800/300/10';
    }
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Level', 'Actor', 'Setting', 'Old Value', 'New Value'];
    const rows = filteredEntries.map((e) => [
      e.timestamp,
      e.level,
      e.actorId,
      e.settingKey,
      formatValue(e.oldValue),
      formatValue(e.newValue),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-settings-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary-400" />
          <h3 className="font-semibold text-white">Settings Audit Log</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            ({filteredEntries.length} entries)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {showExport && (
            <button
              onClick={exportToCSV}
              className="p-2 text-slate-600 dark:text-slate-500 hover:text-white transition-colors"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={fetchAuditLog}
            disabled={loading}
            className="p-2 text-slate-600 dark:text-slate-500 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {showFilters && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`
                                p-2 rounded transition-colors
                                ${
                                  showFilterPanel
                                    ? 'bg-primary-500/20 text-primary-400'
                                    : 'text-slate-600 dark:text-slate-500 hover:text-white'
                                }
                            `}
            >
              <Filter className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilterPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
                <input
                  type="text"
                  placeholder="Search settings..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="
                                        w-full pl-9 pr-4 py-2 rounded-lg
                                        bg-slate-700/50 border border-slate-600/50
                                        text-white placeholder-slate-500
                                        focus:outline-none focus:border-primary-500/50
                                    "
                />
                {filterSearch && (
                  <button
                    onClick={() => setFilterSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Level Filter */}
              {!level && (
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="
                                        px-3 py-2 rounded-lg
                                        bg-slate-700/50 border border-slate-600/50
                                        text-white
                                        focus:outline-none focus:border-primary-500/50
                                    "
                >
                  <option value="">All levels</option>
                  <option value="superadmin">SuperAdmin</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-lg bg-danger-500/10 border border-danger-500/30 text-danger-300 text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && !entries.length && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-800/30 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !filteredEntries.length && (
        <div className="text-center py-8">
          <History className="w-12 h-12 text-slate-600 dark:text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-500">No audit entries found</p>
        </div>
      )}

      {/* Entries List */}
      <div className="space-y-2">
        {filteredEntries.map((entry, index) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            className="
                            p-3 rounded-lg
                            bg-slate-800/30 border border-slate-700/50
                            hover:bg-slate-800/50 transition-colors
                        "
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Top row */}
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`
                                        text-xs px-2 py-0.5 rounded-full font-medium
                                        ${getLevelColor(entry.level)}
                                    `}
                  >
                    {entry.level}
                  </span>
                  <span className="text-white font-medium">{entry.settingKey}</span>
                </div>

                {/* Value change */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                    {formatValue(entry.oldValue)}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                  <span className="text-emerald-400 truncate max-w-[150px]">
                    {formatValue(entry.newValue)}
                  </span>
                </div>
              </div>

              {/* Meta */}
              <div className="flex-shrink-0 text-right">
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(entry.timestamp)}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <User className="w-3 h-3" />
                  <span className="truncate max-w-[100px]">{entry.actorRole}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AuditLogViewer;
