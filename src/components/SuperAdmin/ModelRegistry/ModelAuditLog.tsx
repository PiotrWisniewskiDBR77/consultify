import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Edit,
  FileText,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '../../../services/funnelAnalytics';
import type { ModelAuditEntry } from './types';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const ACTION_ICONS: Record<ModelAuditEntry['action'], React.ReactNode> = {
  created: <Plus size={14} className="text-emerald-400" />,
  updated: <Edit size={14} className="text-blue-400" />,
  deleted: <Trash2 size={14} className="text-red-400" />,
  assignment_changed: <Settings size={14} className="text-amber-400" />,
  fallback_used: <AlertTriangle size={14} className="text-orange-400" />,
};

const ACTION_STYLES: Record<ModelAuditEntry['action'], string> = {
  created: 'bg-emerald-500/10 text-emerald-400',
  updated: 'bg-blue-500/10 text-blue-400',
  deleted: 'bg-red-500/10 text-red-400',
  assignment_changed: 'bg-amber-500/10 text-amber-400',
  fallback_used: 'bg-orange-500/10 text-orange-400',
};

const ENTITY_ICONS: Record<ModelAuditEntry['entityType'], React.ReactNode> = {
  model: <Database size={14} className="text-indigo-400" />,
  assignment: <Shield size={14} className="text-purple-400" />,
  policy: <FileText size={14} className="text-cyan-400" />,
};

export const ModelAuditLog: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<ModelAuditEntry[]>([]);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterEntityType, setFilterEntityType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/llm/audit-log', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data?.entries) ? data.entries : [];
        setEntries(
          rows.map((r: any) => ({
            id: String(r.id || ''),
            action: r.action || 'updated',
            entityType: r.entity_type || 'model',
            entityId: String(r.entity_id || ''),
            changedBy: String(r.changed_by || ''),
            changedAt: String(r.changed_at || ''),
            changes: r.changes || {},
          }))
        );
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || 'Failed to load audit log');
        setEntries([]);
      }
      trackFunnelEvent('model_audit_log_viewed' as any);
    } catch {
      toast.error('Failed to load audit log');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const filteredEntries = entries.filter((entry) => {
    const matchesAction = !filterAction || entry.action === filterAction;
    const matchesEntity = !filterEntityType || entry.entityType === filterEntityType;
    const matchesSearch =
      !searchTerm ||
      entry.entityId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.changedBy.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDateFrom = !dateFrom || new Date(entry.changedAt) >= new Date(dateFrom);
    const matchesDateTo = !dateTo || new Date(entry.changedAt) <= new Date(dateTo + 'T23:59:59');
    return matchesAction && matchesEntity && matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock size={24} className="text-indigo-500" />
            {t('modelRegistry.audit.title', 'Model Audit Log')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'modelRegistry.audit.description',
              'Timeline of all model registry configuration changes'
            )}
          </p>
        </div>
        <button
          onClick={loadEntries}
          className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="text-sm text-slate-500 dark:text-slate-400">Total Changes</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{entries.length}</div>
        </div>
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="text-sm text-emerald-400">Created</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {entries.filter((e) => e.action === 'created').length}
          </div>
        </div>
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="text-sm text-blue-400">Updated</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {entries.filter((e) => e.action === 'updated').length}
          </div>
        </div>
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="text-sm text-amber-400">Assignment Changes</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {entries.filter((e) => e.action === 'assignment_changed').length}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by entity or user..."
            className="w-full pl-10 pr-4 h-9 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400"
          />
        </div>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="h-9 px-3 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
        >
          <option value="">All Actions</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="deleted">Deleted</option>
          <option value="assignment_changed">Assignment Changed</option>
          <option value="fallback_used">Fallback Used</option>
        </select>
        <select
          value={filterEntityType}
          onChange={(e) => setFilterEntityType(e.target.value)}
          className="h-9 px-3 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
        >
          <option value="">All Entities</option>
          <option value="model">Model</option>
          <option value="assignment">Assignment</option>
          <option value="policy">Policy</option>
        </select>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 h-9 border rounded-lg text-sm transition-colors ${
            showFilters
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Filter size={14} />
          Dates
        </button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-navy-900/50 rounded-xl border border-slate-200 dark:border-navy-700">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-9 px-3 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-9 px-3 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
            />
          </div>
        </div>
      )}

      {/* Entries */}
      <div className="space-y-2">
        {filteredEntries.length === 0 ? (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-12 text-center text-slate-500 dark:text-slate-400">
            <FileText size={32} className="mx-auto mb-3 opacity-40" />
            <p>No audit entries match your filters</p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isExpanded = expandedEntry === entry.id;
            return (
              <div
                key={entry.id}
                className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-navy-900/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${ACTION_STYLES[entry.action].split(' ')[0]}`}>
                      {ACTION_ICONS[entry.action]}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_STYLES[entry.action]}`}
                        >
                          {entry.action.replace('_', ' ')}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          {ENTITY_ICONS[entry.entityType]}
                          {entry.entityType}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                        {entry.entityId}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <User size={12} />
                        {entry.changedBy}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <Clock size={12} />
                        {formatDate(entry.changedAt)}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={16} className="text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-200 dark:border-navy-700">
                    <div className="mt-4 space-y-2">
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Changes
                      </h4>
                      <div className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-3 space-y-2">
                        {Object.entries(entry.changes).map(([key, change]) => (
                          <div key={key} className="flex items-center gap-3 text-sm">
                            <span className="text-slate-500 dark:text-slate-400 font-mono text-xs min-w-[120px]">
                              {key}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-xs font-mono">
                                {change.from === null ? 'null' : JSON.stringify(change.from)}
                              </span>
                              <span className="text-slate-400">→</span>
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-xs font-mono">
                                {change.to === null ? 'null' : JSON.stringify(change.to)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      Full timestamp: {new Date(entry.changedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ModelAuditLog;
