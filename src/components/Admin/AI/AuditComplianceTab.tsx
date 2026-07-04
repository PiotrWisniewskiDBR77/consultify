/**
 * AuditComplianceTab - AI Audit & Compliance
 *
 * Tab 6 of the reorganized AI & Intelligence section
 * Includes: Settings Audit Log, Usage Audit Log, Security Events, Compliance Reports, Export Tools
 */

import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronDown,
  Copy,
  Download,
  Edit3,
  Eye,
  FileJson,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';
import { AuditLogViewer } from '../../AISettings';
import { CustomComplianceTemplateEditor } from './CustomComplianceTemplateEditor';

interface AuditEntry {
  id: string;
  timestamp: string;
  level: 'superadmin' | 'admin' | 'user';
  actorId: string;
  actorEmail?: string;
  actorRole: string;
  targetId: string;
  settingKey: string;
  oldValue: string;
  newValue: string;
  ipAddress?: string;
  userAgent?: string;
}

interface SecurityEvent {
  id: string;
  timestamp: string;
  type: 'pii_detected' | 'injection_attempt' | 'rate_limit' | 'access_denied' | 'budget_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  userEmail?: string;
  details: string;
  resolved: boolean;
}

interface ComplianceReport {
  id: string;
  name: string;
  standard: 'ISO21500' | 'PMBOK7' | 'PRINCE2' | 'GDPR' | 'SOC2';
  generatedAt: string;
  status: 'compliant' | 'partial' | 'non_compliant';
  findings: number;
}

interface CustomTemplate {
  id: string;
  name: string;
  description: string;
  basedOn: string | null;
  sectionsCount: number;
  checkpointsCount: number;
  createdAt: string;
  updatedAt: string;
}

export const AuditComplianceTab: React.FC = () => {
  const { currentOrganization } = useAppStore();
  const [activeSubTab, setActiveSubTab] = useState<
    'settings' | 'usage' | 'security' | 'compliance' | 'templates'
  >('settings');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('7d');

  // Mock data for demonstration
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [complianceReports, setComplianceReports] = useState<ComplianceReport[]>([]);

  // Custom templates state
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  useEffect(() => {
    loadSecurityEvents();
    loadComplianceReports();
    loadCustomTemplates();
  }, []);

  const loadCustomTemplates = async () => {
    if (!currentOrganization?.id) return;
    try {
      const response = await fetch(`/api/admin-data/custom-templates/${currentOrganization.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCustomTemplates(data);
      }
    } catch (error) {
      console.error('Error loading custom templates:', error);
    }
  };

  const loadSecurityEvents = async () => {
    if (!currentOrganization?.id) return;
    try {
      const response = await fetch(`/api/admin-data/security-events/${currentOrganization.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSecurityEvents(data);
      }
    } catch (error) {
      console.error('Error loading security events:', error);
    }
  };

  const loadComplianceReports = async () => {
    if (!currentOrganization?.id) return;
    try {
      const response = await fetch(`/api/admin-data/compliance-reports/${currentOrganization.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setComplianceReports(data);
      }
    } catch (error) {
      console.error('Error loading compliance reports:', error);
    }
  };

  const exportAuditLog = async (format: 'csv' | 'json') => {
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      let blob: Blob;
      let filename: string;

      if (format === 'csv') {
        blob = await Api.exportTenantAdminAuditLogs();
        filename = `audit-log-${stamp}.csv`;
      } else {
        const data = await Api.getTenantAdminAuditLogs();
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        filename = `audit-log-${stamp}.json`;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      toast.success(`Audit log exported as ${format.toUpperCase()}`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to export audit log');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-danger-500/20 text-danger-400 border-danger-500/30';
      case 'high':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'medium':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-500/20 text-slate-600 dark:text-slate-500 border-slate-500/30';
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'pii_detected':
        return <Eye size={16} />;
      case 'injection_attempt':
        return <AlertTriangle size={16} />;
      case 'rate_limit':
        return <Activity size={16} />;
      case 'access_denied':
        return <Lock size={16} />;
      case 'budget_exceeded':
        return <AlertTriangle size={16} />;
      default:
        return <Shield size={16} />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'compliant':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
            Compliant
          </span>
        );
      case 'partial':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400">
            Partial
          </span>
        );
      case 'non_compliant':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs bg-danger-500/20 text-danger-400">
            Non-Compliant
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header - DBR77 Compatible */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            <History className="text-warning-600 dark:text-amber-400" size={20} />
            Audit & Compliance
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            View audit logs, security events, and compliance reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-navy-900 dark:text-white text-sm"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <div className="flex gap-1">
            <button
              onClick={() => exportAuditLog('csv')}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-navy-900 dark:text-white rounded-lg text-sm border border-slate-200 dark:border-transparent"
            >
              <FileSpreadsheet size={16} />
              CSV
            </button>
            <button
              onClick={() => exportAuditLog('json')}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-navy-900 dark:text-white rounded-lg text-sm border border-slate-200 dark:border-transparent"
            >
              <FileJson size={16} />
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Sub-tabs - DBR77 Compatible */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-navy-700 pb-1">
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'settings'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <History size={14} className="inline mr-2" />
          Settings Changes
        </button>
        <button
          onClick={() => setActiveSubTab('usage')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'usage'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <Activity size={14} className="inline mr-2" />
          Usage Audit
        </button>
        <button
          onClick={() => setActiveSubTab('security')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'security'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <Shield size={14} className="inline mr-2" />
          Security Events
          {securityEvents.filter((e) => !e.resolved).length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-danger-500/20 text-danger-600 dark:text-danger-400 text-xs rounded-full">
              {securityEvents.filter((e) => !e.resolved).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('compliance')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'compliance'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <FileText size={14} className="inline mr-2" />
          Compliance Reports
        </button>
        <button
          onClick={() => setActiveSubTab('templates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'templates'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
          }`}
        >
          <Edit3 size={14} className="inline mr-2" />
          Custom Templates
        </button>
      </div>

      {/* Settings Audit Log - DBR77 Compatible */}
      {activeSubTab === 'settings' && currentOrganization && (
        <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
          <div className="p-4 border-b border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
                />
                <input
                  type="text"
                  placeholder="Search audit log..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-navy-900 dark:text-white text-sm focus:border-c-focus-solid outline-none"
                />
              </div>
            </div>
          </div>
          <AuditLogViewer
            targetId={currentOrganization.id}
            showFilters={true}
            showExport={false}
            limit={100}
          />
        </div>
      )}

      {/* Usage Audit Log - DBR77 Compatible */}
      {activeSubTab === 'usage' && (
        <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl p-8 text-center shadow-sm dark:shadow-none">
          <Activity className="w-12 h-12 text-slate-600 dark:text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-navy-900 dark:text-white">Usage Audit Log</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Detailed log of all AI requests and responses
          </p>
          <p className="text-xs text-primary-600 dark:text-primary-400 mt-4">
            Enable "Audit All AI Requests" in Features tab to start logging
          </p>
        </div>
      )}

      {/* Security Events - DBR77 Compatible */}
      {activeSubTab === 'security' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">
                Total Events
              </p>
              <p className="text-2xl font-bold text-navy-900 dark:text-white">
                {securityEvents.length}
              </p>
            </div>
            <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">
                Unresolved
              </p>
              <p className="text-2xl font-bold text-danger-600 dark:text-danger-400">
                {securityEvents.filter((e) => !e.resolved).length}
              </p>
            </div>
            <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">
                High/Critical
              </p>
              <p className="text-2xl font-bold text-warning-600 dark:text-amber-400">
                {
                  securityEvents.filter((e) => e.severity === 'high' || e.severity === 'critical')
                    .length
                }
              </p>
            </div>
            <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl p-4 shadow-sm dark:shadow-none">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">
                PII Detected
              </p>
              <p className="text-2xl font-bold text-warning-600 dark:text-amber-400">
                {securityEvents.filter((e) => e.type === 'pii_detected').length}
              </p>
            </div>
          </div>

          {/* Events List */}
          <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
            <div className="overflow-x-auto">
              <table /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */  className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-black/20 text-xs uppercase text-slate-600 dark:text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Event</th>
                    <th className="px-6 py-3">Severity</th>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {securityEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${getSeverityColor(event.severity).split(' ')[0]}`}
                          >
                            {getEventTypeIcon(event.type)}
                          </div>
                          <div>
                            <p className="font-medium text-navy-900 dark:text-white capitalize">
                              {event.type.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md truncate">
                              {event.details}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs border ${getSeverityColor(event.severity)}`}
                        >
                          {event.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {event.userEmail || '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs font-mono">
                        {new Date(event.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        {event.resolved ? (
                          <span className="flex items-center gap-1 text-success-600 dark:text-green-400 text-xs">
                            <CheckCircle size={14} /> Resolved
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-warning-600 dark:text-amber-400 text-xs">
                            <AlertTriangle size={14} /> Open
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Reports - DBR77 Compatible */}
      {activeSubTab === 'compliance' && (
        <div className="space-y-6">
          {/* Generate New Report */}
          <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl p-6 shadow-sm dark:shadow-none">
            <h3 className="font-semibold text-navy-900 dark:text-white mb-4">
              Generate Compliance Report
            </h3>
            <div className="flex gap-3 flex-wrap mb-6">
              {['ISO21500', 'PMBOK7', 'PRINCE2', 'GDPR', 'SOC2'].map((standard) => (
                <button
                  key={standard}
                  onClick={() => toast.success(`Generating ${standard} report...`)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-navy-900 dark:text-white rounded-lg text-sm font-medium transition-colors border border-slate-200 dark:border-transparent"
                >
                  <FileText size={14} className="inline mr-2" />
                  {standard}
                </button>
              ))}
            </div>

            {/* Export Options */}
            <div className="pt-4 border-t border-slate-200 dark:border-navy-700">
              <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                Export Format
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => toast.success('Exporting all reports as PDF...')}
                  className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm"
                >
                  <FileText size={16} />
                  Export All (PDF)
                </button>
                <button
                  onClick={() => toast.success('Exporting audit data as CSV...')}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-navy-900 dark:text-white rounded-lg text-sm"
                >
                  <FileSpreadsheet size={16} />
                  Raw Data (CSV)
                </button>
                <button
                  onClick={() => toast.success('Generating executive summary...')}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-navy-900 dark:text-white rounded-lg text-sm"
                >
                  <Download size={16} />
                  Executive Summary
                </button>
              </div>
            </div>
          </div>

          {/* Reports List */}
          <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700">
              <h3 className="font-semibold text-navy-900 dark:text-white">Recent Reports</h3>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-white/5">
              {complianceReports.map((report) => (
                <div
                  key={report.id}
                  className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      <FileText size={20} className="text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-navy-900 dark:text-white">{report.name}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {report.standard}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-500">•</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(report.generatedAt).toLocaleDateString()}
                        </span>
                        {report.findings > 0 && (
                          <>
                            <span className="text-xs text-slate-600 dark:text-slate-500">•</span>
                            <span className="text-xs text-warning-600 dark:text-amber-400">
                              {report.findings} findings
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getStatusBadge(report.status)}
                    <button className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-navy-900 dark:text-white rounded-lg text-sm flex items-center gap-2 border border-slate-200 dark:border-transparent">
                      <Download size={14} />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom Templates - DBR77 Compatible */}
      {activeSubTab === 'templates' && !showTemplateEditor && (
        <div className="space-y-6">
          {/* Header with Create Button */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-navy-900 dark:text-white">
                Custom Compliance Templates
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Create and manage custom compliance frameworks for your organization
              </p>
            </div>
            <button
              onClick={() => {
                setEditingTemplate(null);
                setShowTemplateEditor(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Create Template
            </button>
          </div>

          {/* Templates Grid */}
          {customTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customTemplates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl p-6 hover:border-primary-500/30 dark:hover:border-primary-500/30 transition-colors shadow-sm dark:shadow-none"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-navy-900 dark:text-white">{template.name}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {template.description}
                      </p>
                    </div>
                    {template.basedOn && (
                      <span className="px-2 py-1 bg-primary-500/20 text-primary-700 dark:text-primary-300 text-xs rounded">
                        Based on {template.basedOn}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-4">
                    <span>{template.sectionsCount} sections</span>
                    <span>•</span>
                    <span>{template.checkpointsCount} checkpoints</span>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-navy-700">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Updated {new Date(template.updatedAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingTemplate(template);
                          setShowTemplateEditor(true);
                        }}
                        className="p-2 text-slate-600 dark:text-slate-500 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => toast.success('Template duplicated')}
                        className="p-2 text-slate-600 dark:text-slate-500 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors"
                        title="Duplicate"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setCustomTemplates((prev) => prev.filter((t) => t.id !== template.id));
                          toast.success('Template deleted');
                        }}
                        className="p-2 text-slate-600 dark:text-slate-500 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-500/10 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 border-dashed rounded-xl p-12 text-center shadow-sm dark:shadow-none">
              <FileText size={48} className="mx-auto text-slate-600 dark:text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-2">
                No Custom Templates
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                Create a custom compliance framework tailored to your organization's needs
              </p>
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setShowTemplateEditor(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Create Your First Template
              </button>
            </div>
          )}
        </div>
      )}

      {/* Template Editor */}
      {activeSubTab === 'templates' && showTemplateEditor && currentOrganization && (
        <CustomComplianceTemplateEditor
          organizationId={currentOrganization.id}
          existingTemplate={editingTemplate}
          onSave={(template) => {
            if (editingTemplate) {
              setCustomTemplates((prev) =>
                prev.map((t) =>
                  t.id === template.id
                    ? {
                        ...t,
                        name: template.name,
                        description: template.description,
                        basedOn: template.basedOn,
                        sectionsCount: template.sections.length,
                        checkpointsCount: template.sections.reduce(
                          (sum, s) => sum + s.checkpoints.length,
                          0
                        ),
                        updatedAt: new Date().toISOString(),
                      }
                    : t
                )
              );
            } else {
              setCustomTemplates((prev) => [
                ...prev,
                {
                  id: template.id,
                  name: template.name,
                  description: template.description,
                  basedOn: template.basedOn,
                  sectionsCount: template.sections.length,
                  checkpointsCount: template.sections.reduce(
                    (sum, s) => sum + s.checkpoints.length,
                    0
                  ),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ]);
            }
            setShowTemplateEditor(false);
            setEditingTemplate(null);
          }}
          onClose={() => {
            setShowTemplateEditor(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
};

export default AuditComplianceTab;
