/**
 * DataRequestManager - GDPR data request management component
 *
 * Features:
 * - Request list with status (Pending, In Progress, Completed, Rejected)
 * - Request types: Export, Delete, Access, Rectification
 * - Actions: Approve, Reject, Complete
 * - Timeline view for request history
 * - Auto-completion settings
 *
 * Design: Data table with status badges and action buttons
 */

import {
  AlertCircle,
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  HelpCircle,
  MoreVertical,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Avatar } from '../../ui/primitives/Avatar';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Request types
export type DataRequestType = 'export' | 'delete' | 'access' | 'rectification';
export type DataRequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

// Data request
export interface DataRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userAvatar?: string;
  type: DataRequestType;
  status: DataRequestStatus;
  reason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  deadline?: string;
  assignedTo?: string;
  notes?: string;
  dataIncluded?: string[];
}

// Auto-completion settings
export interface AutoCompletionSettings {
  enabled: boolean;
  autoExport: boolean;
  autoDelete: boolean;
  exportDelayDays: number;
  deleteDelayDays: number;
}

interface DataRequestManagerProps {
  requests: DataRequest[];
  autoSettings: AutoCompletionSettings;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string, reason: string) => void;
  onComplete?: (requestId: string) => void;
  onAssign?: (requestId: string, userId: string) => void;
  onDownload?: (requestId: string) => void;
  onUpdateAutoSettings?: (settings: AutoCompletionSettings) => void;
  className?: string;
}

export const DataRequestManager: React.FC<DataRequestManagerProps> = ({
  requests,
  autoSettings,
  onApprove,
  onReject,
  onComplete,
  onAssign,
  onDownload,
  onUpdateAutoSettings,
  className,
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<DataRequestStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<DataRequestType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [showAutoSettings, setShowAutoSettings] = useState(false);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (filter !== 'all' && req.status !== filter) return false;
      if (typeFilter !== 'all' && req.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          req.userEmail.toLowerCase().includes(query) ||
          req.userName.toLowerCase().includes(query) ||
          req.id.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [requests, filter, typeFilter, searchQuery]);

  // Get status badge
  const getStatusBadge = (status: DataRequestStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
            <Clock size={12} />
            {t('admin.compliance.dataRequests.pending', 'Pending')}
          </span>
        );
      case 'in_progress':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
            <RefreshCw size={12} />
            {t('admin.compliance.dataRequests.inProgress', 'In Progress')}
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
            <Check size={12} />
            {t('admin.compliance.dataRequests.completed', 'Completed')}
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-full">
            <X size={12} />
            {t('admin.compliance.dataRequests.rejected', 'Rejected')}
          </span>
        );
    }
  };

  // Get type icon and label
  const getTypeInfo = (type: DataRequestType) => {
    switch (type) {
      case 'export':
        return {
          icon: Download,
          label: t('admin.compliance.dataRequests.export', 'Data Export'),
          color: 'text-blue-600 dark:text-blue-400',
        };
      case 'delete':
        return {
          icon: Trash2,
          label: t('admin.compliance.dataRequests.delete', 'Data Deletion'),
          color: 'text-rose-600 dark:text-rose-400',
        };
      case 'access':
        return {
          icon: Eye,
          label: t('admin.compliance.dataRequests.access', 'Data Access'),
          color: 'text-violet-600 dark:text-violet-400',
        };
      case 'rectification':
        return {
          icon: FileText,
          label: t('admin.compliance.dataRequests.rectification', 'Data Rectification'),
          color: 'text-amber-600 dark:text-amber-400',
        };
    }
  };

  // Calculate days remaining
  const getDaysRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Count by status
  const statusCounts = useMemo(() => {
    return requests.reduce(
      (acc, req) => {
        acc[req.status] = (acc[req.status] || 0) + 1;
        return acc;
      },
      {} as Record<DataRequestStatus, number>
    );
  }, [requests]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          className={cn(
            'p-4 rounded-xl border cursor-pointer transition-all',
            filter === 'pending'
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
              : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 hover:border-amber-300'
          )}
          onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.compliance.dataRequests.pending', 'Pending')}
            </span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {statusCounts.pending || 0}
          </p>
        </div>

        <div
          className={cn(
            'p-4 rounded-xl border cursor-pointer transition-all',
            filter === 'in_progress'
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
              : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 hover:border-blue-300'
          )}
          onClick={() => setFilter(filter === 'in_progress' ? 'all' : 'in_progress')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.compliance.dataRequests.inProgress', 'In Progress')}
            </span>
            <RefreshCw size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {statusCounts.in_progress || 0}
          </p>
        </div>

        <div
          className={cn(
            'p-4 rounded-xl border cursor-pointer transition-all',
            filter === 'completed'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
              : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 hover:border-emerald-300'
          )}
          onClick={() => setFilter(filter === 'completed' ? 'all' : 'completed')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.compliance.dataRequests.completed', 'Completed')}
            </span>
            <Check size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {statusCounts.completed || 0}
          </p>
        </div>

        <div
          className={cn(
            'p-4 rounded-xl border cursor-pointer transition-all',
            filter === 'rejected'
              ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700'
              : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 hover:border-rose-300'
          )}
          onClick={() => setFilter(filter === 'rejected' ? 'all' : 'rejected')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.compliance.dataRequests.rejected', 'Rejected')}
            </span>
            <X size={16} className="text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {statusCounts.rejected || 0}
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(
              'admin.compliance.dataRequests.searchPlaceholder',
              'Search by email, name, or ID...'
            )}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as DataRequestType | 'all')}
            className="px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
          >
            <option value="all">{t('admin.compliance.dataRequests.allTypes', 'All Types')}</option>
            <option value="export">{t('admin.compliance.dataRequests.export', 'Export')}</option>
            <option value="delete">{t('admin.compliance.dataRequests.delete', 'Delete')}</option>
            <option value="access">{t('admin.compliance.dataRequests.access', 'Access')}</option>
            <option value="rectification">
              {t('admin.compliance.dataRequests.rectification', 'Rectification')}
            </option>
          </select>

          <Button
            variant="outline"
            onClick={() => setShowAutoSettings(!showAutoSettings)}
            icon={<Settings size={16} />}
          >
            {t('admin.compliance.dataRequests.autoSettings', 'Auto Settings')}
          </Button>
        </div>
      </div>

      {/* Auto-completion Settings */}
      {showAutoSettings && onUpdateAutoSettings && (
        <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
          <h4 className="font-medium text-navy-900 dark:text-white mb-4 flex items-center gap-2">
            <Settings size={18} />
            {t('admin.compliance.dataRequests.autoCompletion', 'Auto-completion Settings')}
          </h4>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-navy-900 dark:text-white">
                  {t('admin.compliance.dataRequests.enableAuto', 'Enable Auto-completion')}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t(
                    'admin.compliance.dataRequests.enableAutoDesc',
                    'Automatically process requests after the deadline'
                  )}
                </p>
              </div>
              <button
                onClick={() =>
                  onUpdateAutoSettings({
                    ...autoSettings,
                    enabled: !autoSettings.enabled,
                  })
                }
                className={cn(
                  'relative w-12 h-6 rounded-full transition-colors',
                  autoSettings.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-navy-600'
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 w-4 h-4 bg-white dark:bg-navy-900 rounded-full shadow transition-transform',
                    autoSettings.enabled ? 'left-7' : 'left-1'
                  )}
                />
              </button>
            </div>

            {autoSettings.enabled && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-navy-900 dark:text-white">
                      {t(
                        'admin.compliance.dataRequests.autoExport',
                        'Auto-complete Export Requests'
                      )}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t(
                        'admin.compliance.dataRequests.autoExportDesc',
                        'Automatically generate and send export files'
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      onUpdateAutoSettings({
                        ...autoSettings,
                        autoExport: !autoSettings.autoExport,
                      })
                    }
                    className={cn(
                      'relative w-12 h-6 rounded-full transition-colors',
                      autoSettings.autoExport ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-navy-600'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1 w-4 h-4 bg-white dark:bg-navy-900 rounded-full shadow transition-transform',
                        autoSettings.autoExport ? 'left-7' : 'left-1'
                      )}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <label className="text-sm text-slate-600 dark:text-slate-400">
                    {t('admin.compliance.dataRequests.exportDelay', 'Export delay (days):')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={autoSettings.exportDelayDays}
                    onChange={(e) =>
                      onUpdateAutoSettings({
                        ...autoSettings,
                        exportDelayDays: parseInt(e.target.value) || 7,
                      })
                    }
                    className="w-20 px-3 py-1 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Request List */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <Archive size={48} className="mx-auto mb-4 text-slate-300 dark:text-navy-600" />
            <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-2">
              {t('admin.compliance.dataRequests.noRequests', 'No requests found')}
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              {t(
                'admin.compliance.dataRequests.noRequestsDesc',
                'When users submit data requests, they will appear here.'
              )}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-navy-700">
            {filteredRequests.map((request) => {
              const typeInfo = getTypeInfo(request.type);
              const TypeIcon = typeInfo.icon;
              const isExpanded = expandedRequest === request.id;
              const daysRemaining = request.deadline ? getDaysRemaining(request.deadline) : null;

              return (
                <div key={request.id}>
                  <div
                    className="p-4 hover:bg-slate-50 dark:hover:bg-navy-900 cursor-pointer"
                    onClick={() => setExpandedRequest(isExpanded ? null : request.id)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Expand Icon */}
                      <span className="text-slate-400 dark:text-slate-500">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>

                      {/* Type Icon */}
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                          request.type === 'export' && 'bg-blue-100 dark:bg-blue-900/30',
                          request.type === 'delete' && 'bg-rose-100 dark:bg-rose-900/30',
                          request.type === 'access' && 'bg-violet-100 dark:bg-violet-900/30',
                          request.type === 'rectification' && 'bg-amber-100 dark:bg-amber-900/30'
                        )}
                      >
                        <TypeIcon size={20} className={typeInfo.color} />
                      </div>

                      {/* User Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar name={request.userName} src={request.userAvatar} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-navy-900 dark:text-white truncate">
                            {request.userName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {request.userEmail}
                          </p>
                        </div>
                      </div>

                      {/* Type Label */}
                      <div className="hidden sm:block">
                        <span className={cn('text-sm font-medium', typeInfo.color)}>
                          {typeInfo.label}
                        </span>
                      </div>

                      {/* Status */}
                      {getStatusBadge(request.status)}

                      {/* Deadline */}
                      {daysRemaining !== null && request.status === 'pending' && (
                        <span
                          className={cn(
                            'text-xs font-medium',
                            daysRemaining <= 3
                              ? 'text-rose-600'
                              : daysRemaining <= 7
                                ? 'text-amber-600'
                                : 'text-slate-500 dark:text-slate-400'
                          )}
                        >
                          {daysRemaining > 0 ? `${daysRemaining}d left` : 'Overdue'}
                        </span>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {request.status === 'pending' && onApprove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onApprove(request.id);
                            }}
                            className="text-emerald-600"
                          >
                            <Check size={16} />
                          </Button>
                        )}
                        {request.status === 'completed' &&
                          request.type === 'export' &&
                          onDownload && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDownload(request.id);
                              }}
                            >
                              <Download size={16} />
                            </Button>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-slate-50 dark:bg-navy-900">
                      <div className="pl-10 pt-4 space-y-4">
                        {/* Request Details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500 dark:text-slate-400">Request ID</p>
                            <p className="font-mono text-navy-900 dark:text-white">{request.id}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400">Created</p>
                            <p className="text-navy-900 dark:text-white">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          {request.deadline && (
                            <div>
                              <p className="text-slate-500 dark:text-slate-400">Deadline</p>
                              <p className="text-navy-900 dark:text-white">
                                {new Date(request.deadline).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                          {request.completedAt && (
                            <div>
                              <p className="text-slate-500 dark:text-slate-400">Completed</p>
                              <p className="text-navy-900 dark:text-white">
                                {new Date(request.completedAt).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Reason */}
                        {request.reason && (
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                              Reason
                            </p>
                            <p className="text-sm text-navy-900 dark:text-white bg-white dark:bg-navy-800 p-3 rounded-lg">
                              {request.reason}
                            </p>
                          </div>
                        )}

                        {/* Data Included */}
                        {request.dataIncluded && request.dataIncluded.length > 0 && (
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                              Data Included
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {request.dataIncluded.map((item) => (
                                <span
                                  key={item}
                                  className="px-2 py-1 text-xs bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        {request.status === 'pending' && (
                          <div className="flex gap-2 pt-2">
                            {onApprove && (
                              <Button size="sm" onClick={() => onApprove(request.id)}>
                                <Check size={14} />
                                Approve
                              </Button>
                            )}
                            {onReject && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onReject(request.id, 'Rejected by admin')}
                              >
                                <X size={14} />
                                Reject
                              </Button>
                            )}
                          </div>
                        )}
                        {request.status === 'in_progress' && onComplete && (
                          <div className="flex gap-2 pt-2">
                            <Button size="sm" onClick={() => onComplete(request.id)}>
                              <Check size={14} />
                              Mark Complete
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataRequestManager;
