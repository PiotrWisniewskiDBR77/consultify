// components/PMO/AuditTrailViewer.tsx
// Audit Trail Viewer for PMO Standards Compliance

import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  Search,
  Shield,
  User,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { useDemoSession } from '../../hooks/useDemoSession';
import { Api } from '../../services/api';

interface AuditEntry {
  id: string;
  projectId: string;
  pmoDomainId: string;
  pmoPhase: string;
  objectType: string;
  objectId: string;
  action: string;
  actorId: string;
  actorName?: string;
  iso21500Mapping: string;
  pmbokMapping: string;
  prince2Mapping: string;
  createdAt: string;
  details?: Record<string, any>;
}

interface AuditTrailViewerProps {
  projectId: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  GOVERNANCE_DECISION_MAKING:
    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  SCOPE_CHANGE_CONTROL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  SCHEDULE_MILESTONES: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  RESOURCE_RESPONSIBILITY: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  RISK_ISSUE_MANAGEMENT: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  PERFORMANCE_REPORTING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  created: <CheckCircle size={14} className="text-green-500" />,
  updated: <Clock size={14} className="text-blue-500" />,
  deleted: <AlertCircle size={14} className="text-danger-500" />,
  approved: <Shield size={14} className="text-primary-500" />,
  rejected: <AlertCircle size={14} className="text-amber-500" />,
};

export const AuditTrailViewer: React.FC<AuditTrailViewerProps> = ({ projectId }) => {
  const { isDemo } = useDemoSession();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('week');

  useEffect(() => {
    fetchAuditTrail();
  }, [projectId, dateRange]);

  const fetchAuditTrail = async () => {
    try {
      setLoading(true);
      const data = await Api.get(
        `/pmo-domains/projects/${projectId}/audit-trail?range=${dateRange}`
      );
      setEntries(data.entries || []);
    } catch (err) {
      console.error('Failed to fetch audit trail:', err);
      if (isDemo) {
        setEntries([
          {
            id: 'demo-1',
            projectId,
            pmoDomainId: 'GOVERNANCE_DECISION_MAKING',
            pmoPhase: 'Initiation',
            objectType: 'DECISION',
            objectId: 'd-1',
            action: 'approved',
            actorId: 'user-1',
            actorName: 'John Smith',
            iso21500Mapping: 'Governance Decision (Clause 4.3.4)',
            pmbokMapping: 'Project Decision / Authorization',
            prince2Mapping: 'Project Board Decision',
            createdAt: new Date().toISOString(),
            details: { decision: 'Approve Phase 1 Budget', value: '€250,000' },
          },
          {
            id: 'demo-2',
            projectId,
            pmoDomainId: 'SCOPE_CHANGE_CONTROL',
            pmoPhase: 'Execution',
            objectType: 'CHANGE_REQUEST',
            objectId: 'cr-1',
            action: 'created',
            actorId: 'user-2',
            actorName: 'Anna Kowalska',
            iso21500Mapping: 'Change Request (Clause 4.4.23)',
            pmbokMapping: 'Change Request',
            prince2Mapping: 'Request for Change (RFC)',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            details: { title: 'Extend pilot timeline by 2 weeks', impact: 'Medium' },
          },
          {
            id: 'demo-3',
            projectId,
            pmoDomainId: 'SCHEDULE_MILESTONES',
            pmoPhase: 'Planning',
            objectType: 'ROADMAP',
            objectId: 'rm-1',
            action: 'updated',
            actorId: 'user-1',
            actorName: 'John Smith',
            iso21500Mapping: 'Project Schedule (Clause 4.4.10)',
            pmbokMapping: 'Project Schedule',
            prince2Mapping: 'Project Plan / Stage Plan',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            details: { change: 'Resequenced Q2 initiatives' },
          },
        ]);
      } else {
        setEntries([]);
        toast.error('Failed to load audit trail');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedEntries(newExpanded);
  };

  const exportAuditTrail = async () => {
    try {
      toast.error('Export not available yet');
    } catch (err) {
      toast.error('Failed to export audit trail');
    }
  };

  const filteredEntries = entries.filter((entry) => {
    if (
      searchTerm &&
      !entry.objectType.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !entry.action.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !entry.actorName?.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
    if (selectedDomain && entry.pmoDomainId !== selectedDomain) return false;
    if (selectedAction && entry.action !== selectedAction) return false;
    return true;
  });

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const uniqueDomains = Array.from(new Set(entries.map((e) => e.pmoDomainId)));
  const uniqueActions = Array.from(new Set(entries.map((e) => e.action)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <FileText size={24} className="text-primary-500" />
            Audit Trail
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Complete history of all PMO actions with standards mapping
          </p>
        </div>
        <button
          onClick={exportAuditTrail}
          className="flex items-center gap-2 px-4 py-2 bg-c-text text-c-bg dark:bg-c-text rounded-lg hover:opacity-90 transition-opacity"
        >
          <Download size={16} />
          Export Report
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
          />
          <input
            type="text"
            placeholder="Search entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Date Range */}
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as 'today' | 'week' | 'month' | 'all')}
          className="px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
          <option value="all">All time</option>
        </select>

        {/* Domain Filter */}
        <select
          value={selectedDomain || ''}
          onChange={(e) => setSelectedDomain(e.target.value || null)}
          className="px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Domains</option>
          {uniqueDomains.map((domain) => (
            <option key={domain} value={domain}>
              {domain.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        {/* Action Filter */}
        <select
          value={selectedAction || ''}
          onChange={(e) => setSelectedAction(e.target.value || null)}
          className="px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Actions</option>
          {uniqueActions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="text-2xl font-bold text-navy-900 dark:text-white">{entries.length}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Entries</div>
        </div>
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="text-2xl font-bold text-green-600">
            {entries.filter((e) => e.action === 'approved').length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Approvals</div>
        </div>
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="text-2xl font-bold text-blue-600">
            {entries.filter((e) => e.action === 'created').length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Created</div>
        </div>
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="text-2xl font-bold text-primary-600">{uniqueDomains.length}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Domains</div>
        </div>
      </div>

      {/* Entries List */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading audit trail...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            <FileText size={32} className="mx-auto mb-2 opacity-50" />
            No audit entries found
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-white/5">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                <div
                  className="p-4 flex items-start gap-4 cursor-pointer"
                  onClick={() => toggleExpand(entry.id)}
                >
                  <button className="mt-1 text-slate-600 dark:text-slate-500">
                    {expandedEntries.has(entry.id) ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      {ACTION_ICONS[entry.action] || <Clock size={14} />}
                      <span className="font-medium text-navy-900 dark:text-white">
                        {entry.objectType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-600 dark:text-slate-500">•</span>
                      <span className="text-sm text-slate-600 dark:text-slate-300 capitalize">
                        {entry.action}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${DOMAIN_COLORS[entry.pmoDomainId] || 'bg-slate-100'}`}
                      >
                        {entry.pmoDomainId?.split('_')[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {entry.actorName || 'Unknown'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatTime(entry.createdAt)}
                      </span>
                      <span>Phase: {entry.pmoPhase}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedEntries.has(entry.id) && (
                  <div className="px-12 pb-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {/* Standards Mapping */}
                    <div className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-4">
                      <h4 className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <BookOpen size={12} />
                        PMO Standards Mapping
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-[10px] text-slate-600 dark:text-slate-500 uppercase mb-1">
                            ISO 21500:2021
                          </div>
                          <div className="text-navy-900 dark:text-white">
                            {entry.iso21500Mapping}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-600 dark:text-slate-500 uppercase mb-1">
                            PMBOK 7th Ed
                          </div>
                          <div className="text-navy-900 dark:text-white">{entry.pmbokMapping}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-600 dark:text-slate-500 uppercase mb-1">
                            PRINCE2
                          </div>
                          <div className="text-navy-900 dark:text-white">
                            {entry.prince2Mapping}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Details */}
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <div className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-4">
                        <h4 className="text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider mb-3">
                          Action Details
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          {Object.entries(entry.details).map(([key, value]) => (
                            <div key={key}>
                              <div className="text-[10px] text-slate-600 dark:text-slate-500 uppercase mb-1">
                                {key}
                              </div>
                              <div className="text-navy-900 dark:text-white">{String(value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditTrailViewer;
