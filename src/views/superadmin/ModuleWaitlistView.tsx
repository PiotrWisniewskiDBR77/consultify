/**
 * ModuleWaitlistView - SuperAdmin view for module interest/waitlist
 *
 * Shows which users have registered interest in upcoming modules
 * (Meeting Intelligence, MCP IRIS, MCP Marketplace).
 */

import { Bell, Brain, Calendar, Download, Package, RefreshCw, Search, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet } from '../../services/api/baseClient';
import { StandardTable, type TableColumn, type TableRow } from '../../components/standard/StandardTable';

interface InterestRecord {
  id: string;
  user_id: string;
  org_id: string | null;
  module_key: string;
  user_email: string | null;
  user_name: string | null;
  org_name: string | null;
  created_at: string;
}

interface ModuleStat {
  module_key: string;
  count: number;
}

const MODULE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  meeting: {
    label: 'Meeting Intelligence',
    icon: <Calendar size={16} />,
    color: 'bg-blue-500/10 text-blue-500',
  },
  iris: {
    label: 'MCP IRIS',
    icon: <Brain size={16} />,
    color: 'bg-primary-500/10 text-primary-500',
  },
  marketplace: {
    label: 'MCP Marketplace',
    icon: <Package size={16} />,
    color: 'bg-emerald-500/10 text-emerald-500',
  },
};

export const ModuleWaitlistView: React.FC = () => {
  const [interests, setInterests] = useState<InterestRecord[]>([]);
  const [stats, setStats] = useState<ModuleStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModule, setFilterModule] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ interests: InterestRecord[]; stats: ModuleStat[] }>(
        '/module-interest/admin/all'
      );
      setInterests(data.interests);
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch module interest data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredInterests = useMemo(() => {
    let result = interests;
    if (filterModule !== 'all') {
      result = result.filter((r) => r.module_key === filterModule);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          (r.user_email && r.user_email.toLowerCase().includes(q)) ||
          (r.user_name && r.user_name.toLowerCase().includes(q)) ||
          (r.org_name && r.org_name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [interests, filterModule, searchQuery]);

  const totalCount = interests.length;
  const uniqueOrgs = useMemo(
    () => new Set(interests.filter((r) => r.org_id).map((r) => r.org_id)).size,
    [interests]
  );

  const handleExportCSV = () => {
    const header = 'Module,User Name,Email,Organization,Registered At\n';
    const rows = filteredInterests
      .map(
        (r) =>
          `"${MODULE_META[r.module_key]?.label || r.module_key}","${r.user_name || ''}","${r.user_email || ''}","${r.org_name || ''}","${new Date(r.created_at).toLocaleDateString()}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `module-waitlist-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const waitlistColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'module',
        label: 'Module',
        render: (row: TableRow) => {
          const meta = MODULE_META[row.module_key] || {
            label: row.module_key,
            icon: <Bell size={14} />,
            color: 'bg-slate-500/10 text-slate-500',
          };
          return (
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${meta.color}`}
            >
              {meta.icon}
              {meta.label}
            </span>
          );
        },
      },
      {
        id: 'user',
        label: 'User',
        render: (row: TableRow) => (
          <span className="text-slate-900 dark:text-white font-medium">
            {row.user_name || '—'}
          </span>
        ),
      },
      {
        id: 'email',
        label: 'Email',
        render: (row: TableRow) => (
          <span className="text-slate-600 dark:text-slate-300">{row.user_email || '—'}</span>
        ),
      },
      {
        id: 'organization',
        label: 'Organization',
        render: (row: TableRow) => (
          <span className="text-slate-600 dark:text-slate-300">{row.org_name || '—'}</span>
        ),
      },
      {
        id: 'registered',
        label: 'Registered',
        render: (row: TableRow) => (
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            {new Date(row.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ),
      },
    ],
    []
  );

  const waitlistRows: TableRow[] = useMemo(
    () => filteredInterests.map((record) => ({ ...record })),
    [filteredInterests]
  );

  return (
    <div className="p-6 overflow-y-auto h-full space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total */}
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Bell size={14} />
            <span className="text-xs font-medium uppercase tracking-wider">Total Signups</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalCount}</div>
        </div>

        {/* Unique Orgs */}
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Users size={14} />
            <span className="text-xs font-medium uppercase tracking-wider">Organizations</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{uniqueOrgs}</div>
        </div>

        {/* Per module */}
        {['meeting', 'iris', 'marketplace'].map((key) => {
          const meta = MODULE_META[key];
          const stat = stats.find((s) => s.module_key === key);
          return (
            <div
              key={key}
              className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4"
            >
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <span className={meta.color}>{meta.icon}</span>
                <span className="text-xs font-medium uppercase tracking-wider">{meta.label}</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {stat?.count || 0}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              placeholder="Search by name, email, org..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 w-64"
            />
          </div>

          {/* Module filter */}
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value="all">All Modules</option>
            <option value="meeting">Meeting Intelligence</option>
            <option value="iris">MCP IRIS</option>
            <option value="marketplace">MCP Marketplace</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filteredInterests.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-hidden">
        <StandardTable
          columns={waitlistColumns}
          data={waitlistRows}
          loading={loading}
          empty={{
            title:
              interests.length === 0
                ? 'No interest registrations yet'
                : 'No results matching your filters',
            icon: Bell,
          }}
          persistKey="superadmin.moduleWaitlist"
          canvasClassName="p-0"
        />

        {/* Footer */}
        {filteredInterests.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-800 text-xs text-slate-500 dark:text-slate-400">
            Showing {filteredInterests.length} of {interests.length} registrations
          </div>
        )}
      </div>
    </div>
  );
};
