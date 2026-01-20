/**
 * CustomReportsTab - Analytics > Custom Reports
 * NEW: Report builder and scheduled reports
 */

import {
  BarChart2,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit,
  Eye,
  FileBarChart,
  FileDown,
  Filter,
  Grid,
  LayoutGrid,
  List,
  Mail,
  MoreVertical,
  PieChart,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Star,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

interface Report {
  id: string;
  name: string;
  description: string;
  type: 'usage' | 'cost' | 'performance' | 'custom';
  schedule: 'manual' | 'daily' | 'weekly' | 'monthly' | null;
  lastRun: string | null;
  nextRun: string | null;
  createdBy: string;
  createdAt: string;
  isFavorite: boolean;
  format: 'pdf' | 'excel' | 'csv';
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: Report['type'];
  icon: React.ReactNode;
}

export const CustomReportsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      // Mock data - replace with API call
      const mockReports: Report[] = [
        {
          id: '1',
          name: 'Monthly AI Usage Summary',
          description: 'Comprehensive monthly report of all AI usage across organizations',
          type: 'usage',
          schedule: 'monthly',
          lastRun: '2026-01-01T00:00:00Z',
          nextRun: '2026-02-01T00:00:00Z',
          createdBy: 'Admin',
          createdAt: '2025-06-15T00:00:00Z',
          isFavorite: true,
          format: 'pdf',
        },
        {
          id: '2',
          name: 'Weekly Cost Analysis',
          description: 'Detailed cost breakdown by provider, model, and organization',
          type: 'cost',
          schedule: 'weekly',
          lastRun: '2026-01-13T00:00:00Z',
          nextRun: '2026-01-20T00:00:00Z',
          createdBy: 'Admin',
          createdAt: '2025-08-20T00:00:00Z',
          isFavorite: true,
          format: 'excel',
        },
        {
          id: '3',
          name: 'Daily Performance Metrics',
          description: 'Latency, throughput, and error rates across all providers',
          type: 'performance',
          schedule: 'daily',
          lastRun: '2026-01-19T00:00:00Z',
          nextRun: '2026-01-20T00:00:00Z',
          createdBy: 'System',
          createdAt: '2025-09-10T00:00:00Z',
          isFavorite: false,
          format: 'csv',
        },
        {
          id: '4',
          name: 'Executive AI Dashboard',
          description: 'High-level KPIs and trends for executive review',
          type: 'custom',
          schedule: 'monthly',
          lastRun: '2026-01-01T00:00:00Z',
          nextRun: '2026-02-01T00:00:00Z',
          createdBy: 'Admin',
          createdAt: '2025-10-05T00:00:00Z',
          isFavorite: true,
          format: 'pdf',
        },
        {
          id: '5',
          name: 'Organization Usage Breakdown',
          description: 'Per-organization usage and cost allocation report',
          type: 'usage',
          schedule: 'manual',
          lastRun: '2026-01-15T00:00:00Z',
          nextRun: null,
          createdBy: 'Admin',
          createdAt: '2025-11-20T00:00:00Z',
          isFavorite: false,
          format: 'excel',
        },
      ];
      setReports(mockReports);
    } catch (err) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const templates: ReportTemplate[] = [
    {
      id: 't1',
      name: 'Usage Report',
      description: 'Track AI usage patterns and trends',
      type: 'usage',
      icon: <TrendingUp size={24} className="text-blue-500" />,
    },
    {
      id: 't2',
      name: 'Cost Report',
      description: 'Analyze costs and budget allocation',
      type: 'cost',
      icon: <PieChart size={24} className="text-emerald-500" />,
    },
    {
      id: 't3',
      name: 'Performance Report',
      description: 'Monitor latency and reliability metrics',
      type: 'performance',
      icon: <BarChart2 size={24} className="text-purple-500" />,
    },
    {
      id: 't4',
      name: 'Custom Report',
      description: 'Build a report from scratch',
      type: 'custom',
      icon: <Grid size={24} className="text-amber-500" />,
    },
  ];

  const getTypeBadge = (type: Report['type']) => {
    const styles = {
      usage: 'bg-blue-500/10 text-blue-500',
      cost: 'bg-emerald-500/10 text-emerald-500',
      performance: 'bg-purple-500/10 text-purple-500',
      custom: 'bg-amber-500/10 text-amber-500',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[type]}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const getScheduleBadge = (schedule: Report['schedule']) => {
    if (!schedule || schedule === 'manual') {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-slate-500/10 text-slate-500">
          Manual
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-500/10 text-indigo-500">
        {schedule.charAt(0).toUpperCase() + schedule.slice(1)}
      </span>
    );
  };

  const toggleFavorite = (reportId: string) => {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, isFavorite: !r.isFavorite } : r))
    );
  };

  const runReport = (reportId: string) => {
    toast.success('Report generation started');
  };

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !filterType || report.type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileBarChart size={24} className="text-indigo-500" />
            Custom Reports
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create, schedule, and manage AI analytics reports
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={16} />
          New Report
        </button>
      </div>

      {/* Quick Templates */}
      <div className="grid grid-cols-4 gap-4">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-4 p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors text-left group"
          >
            <div className="p-3 bg-slate-100 dark:bg-navy-900 rounded-lg group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 transition-colors">
              {template.icon}
            </div>
            <div className="flex-1">
              <div className="font-medium text-slate-900 dark:text-white">{template.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{template.description}</div>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reports..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
          >
            <option value="">All Types</option>
            <option value="usage">Usage</option>
            <option value="cost">Cost</option>
            <option value="performance">Performance</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-navy-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Reports Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getTypeBadge(report.type)}
                  {getScheduleBadge(report.schedule)}
                </div>
                <button
                  onClick={() => toggleFavorite(report.id)}
                  className={`p-1 rounded ${report.isFavorite ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                >
                  <Star size={16} fill={report.isFavorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{report.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
                {report.description}
              </p>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-4">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {report.lastRun
                    ? `Last: ${new Date(report.lastRun).toLocaleDateString()}`
                    : 'Never run'}
                </span>
                <span className="uppercase">{report.format}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => runReport(report.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Play size={14} />
                  Run
                </button>
                <button className="p-2 bg-slate-100 dark:bg-navy-700 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-600 transition-colors">
                  <Download size={16} className="text-slate-500 dark:text-slate-400" />
                </button>
                <button className="p-2 bg-slate-100 dark:bg-navy-700 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-600 transition-colors">
                  <Edit size={16} className="text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-navy-700">
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Report
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Type
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Schedule
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Last Run
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Format
                </th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
              {filteredReports.map((report) => (
                <tr
                  key={report.id}
                  className="hover:bg-slate-50 dark:hover:bg-navy-900/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFavorite(report.id)}
                        className={report.isFavorite ? 'text-amber-500' : 'text-slate-300'}
                      >
                        <Star size={14} fill={report.isFavorite ? 'currentColor' : 'none'} />
                      </button>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">{report.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {report.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getTypeBadge(report.type)}</td>
                  <td className="px-6 py-4">{getScheduleBadge(report.schedule)}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {report.lastRun ? new Date(report.lastRun).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="uppercase text-xs font-medium text-slate-500 dark:text-slate-400">
                      {report.format}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => runReport(report.id)}
                        className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg text-indigo-500"
                      >
                        <Play size={16} />
                      </button>
                      <button className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg text-slate-400">
                        <Download size={16} />
                      </button>
                      <button className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg text-slate-400">
                        <Edit size={16} />
                      </button>
                      <button className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <FileBarChart size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No reports found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {searchTerm || filterType
              ? 'Try adjusting your filters'
              : 'Create your first report to get started'}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
          >
            Create Report
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomReportsTab;
