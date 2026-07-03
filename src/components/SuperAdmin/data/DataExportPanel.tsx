/**
 * DataExportPanel - Data Export Management
 *
 * Features:
 * - Export request form
 * - Export history
 * - Download links (with expiry)
 */

import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';
import { ReadOnlyState } from '../../Admin/AdminState';

interface ExportRequest {
  id: string;
  organization_id: string;
  organization_name?: string;
  user_id: string;
  requester_email?: string;
  requester_first_name?: string;
  export_type: 'full' | 'partial' | 'gdpr';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  include_data: string[];
  exclude_data: string[];
  file_url?: string;
  file_size?: number;
  file_expires_at?: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
}

const DATA_TYPES = [
  { id: 'users', label: 'Users', description: 'User accounts and profiles' },
  { id: 'projects', label: 'Projects', description: 'Projects and initiatives' },
  { id: 'tasks', label: 'Tasks', description: 'Tasks and assignments' },
  { id: 'documents', label: 'Documents', description: 'Uploaded documents and files' },
  { id: 'audit_logs', label: 'Audit Logs', description: 'Activity and audit logs' },
  { id: 'ai_conversations', label: 'AI Conversations', description: 'AI chat history' },
  { id: 'settings', label: 'Settings', description: 'Organization settings' },
  { id: 'billing', label: 'Billing', description: 'Invoices and subscriptions' },
];

const dataExportWorkflowUnavailableReason =
  'SuperAdmin data exports are disabled until this panel is reconciled with the audited bulk-export workflow that requires confirmation and audit evidence.';

export const DataExportPanel: React.FC = () => {
  const [requests, setRequests] = useState<ExportRequest[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOrgId, setFilterOrgId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<{
    exportType: 'full' | 'partial';
    includeData: string[];
    excludeData: string[];
  }>({
    exportType: 'full',
    includeData: DATA_TYPES.map((d) => d.id),
    excludeData: [],
  });
  const creating = false;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const orgsResult = await Api.getOrganizations().catch(() => []);
      setOrganizations(orgsResult || []);
      setRequests([]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateExport = async () => {
    toast.error(dataExportWorkflowUnavailableReason);
  };

  const handleCancelRequest = async (_requestId: string) => {
    toast.error(dataExportWorkflowUnavailableReason);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit++;
    }
    return `${size.toFixed(1)} ${units[unit]}`;
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
      pending: {
        icon: <Clock size={14} />,
        bg: 'bg-slate-500/20',
        text: 'text-slate-600 dark:text-slate-500',
      },
      processing: {
        icon: <Loader2 size={14} className="animate-spin" />,
        bg: 'bg-blue-500/20',
        text: 'text-blue-400',
      },
      completed: {
        icon: <CheckCircle2 size={14} />,
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
      },
      failed: { icon: <XCircle size={14} />, bg: 'bg-danger-500/20', text: 'text-danger-400' },
      expired: { icon: <AlertTriangle size={14} />, bg: 'bg-amber-500/20', text: 'text-amber-400' },
    };
    const config = configs[status] || configs.pending;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
      >
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getExportTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      full: 'bg-primary-500/20 text-primary-400',
      partial: 'bg-blue-500/20 text-blue-400',
      gdpr: 'bg-emerald-500/20 text-emerald-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[type] || colors.full}`}>
        {type.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={filterOrgId}
            onChange={(e) => setFilterOrgId(e.target.value)}
            disabled
            title={dataExportWorkflowUnavailableReason}
            className="px-4 py-2.5 bg-c-surface-raised border border-white/10 rounded-lg text-c-text focus:border-primary-500/50 outline-none"
          >
            <option value="">All Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            disabled
            title={dataExportWorkflowUnavailableReason}
            className="px-4 py-2.5 bg-c-surface-raised border border-white/10 rounded-lg text-c-text focus:border-primary-500/50 outline-none"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 bg-c-surface-raised hover:bg-c-surface-raised rounded-lg transition-colors"
          >
            <RefreshCw
              size={18}
              className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            disabled
            title={dataExportWorkflowUnavailableReason}
            className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-white font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={18} />
            Request Export
          </button>
        </div>
      </div>

      {/* Export Requests List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : requests.length === 0 ? (
        <div className="py-6">
          <ReadOnlyState
            title="Data export workflow unavailable"
            description={dataExportWorkflowUnavailableReason}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusBadge(request.status)}
                    {getExportTypeBadge(request.export_type)}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-500 mb-3">
                    {request.organization_name && (
                      <span className="flex items-center gap-1.5">
                        <Building2 size={14} />
                        {request.organization_name}
                      </span>
                    )}
                    {request.requester_email && (
                      <span className="flex items-center gap-1.5">
                        <User size={14} />
                        {request.requester_first_name || request.requester_email}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} />
                      Created {new Date(request.created_at).toLocaleString()}
                    </span>
                    {request.file_size && (
                      <span className="flex items-center gap-1.5">
                        <HardDrive size={12} />
                        {formatFileSize(request.file_size)}
                      </span>
                    )}
                    {request.file_expires_at && (
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <Clock size={12} />
                        Expires {new Date(request.file_expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {request.error_message && (
                    <p className="mt-2 text-sm text-danger-400">{request.error_message}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {request.status === 'completed' && request.file_url && (
                    <button
                      type="button"
                      disabled
                      title={dataExportWorkflowUnavailableReason}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download size={16} />
                      Download
                    </button>
                  )}
                  {['pending', 'processing'].includes(request.status) && (
                    <button
                      onClick={() => handleCancelRequest(request.id)}
                      disabled
                      className="p-2 text-danger-400 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      title={dataExportWorkflowUnavailableReason}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Export Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-c-surface border border-white/10 rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-c-text mb-6">Request Data Export</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Export Type</label>
                <div className="flex gap-3">
                  {(['full', 'partial'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, exportType: type }))}
                      className={`flex-1 px-4 py-2.5 rounded-lg border transition-colors ${
                        formData.exportType === type
                          ? 'bg-primary-500/20 border-primary-500/50 text-primary-400'
                          : 'bg-c-surface-raised border-white/10 text-slate-600 dark:text-slate-500 hover:border-white/20'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Include Data
                </label>
                <div className="max-h-64 overflow-y-auto bg-c-surface-raised/50 rounded-lg p-3 space-y-2">
                  {DATA_TYPES.map((dataType) => (
                    <label
                      key={dataType.id}
                      className="flex items-start gap-3 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={formData.includeData.includes(dataType.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData((prev) => ({
                              ...prev,
                              includeData: [...prev.includeData, dataType.id],
                            }));
                          } else {
                            setFormData((prev) => ({
                              ...prev,
                              includeData: prev.includeData.filter((d) => d !== dataType.id),
                            }));
                          }
                        }}
                        className="w-4 h-4 mt-0.5 rounded border-slate-600 bg-c-surface-raised text-primary-500"
                      />
                      <div>
                        <span className="text-sm text-slate-600 group-hover:text-white">
                          {dataType.label}
                        </span>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {dataType.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2.5 bg-c-surface-raised hover:bg-c-surface-raised rounded-lg text-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateExport}
                disabled={creating || formData.includeData.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
              >
                {creating ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <FileArchive size={18} />
                )}
                Request Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataExportPanel;
