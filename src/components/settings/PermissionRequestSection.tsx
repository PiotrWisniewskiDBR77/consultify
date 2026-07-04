/**
 * PermissionRequestSection - Request permissions/limit changes
 *
 * Features:
 * - Request form for different permission types
 * - History of past requests
 * - Status tracking (Pending, Approved, Rejected, Cancelled)
 * - Cancel pending requests
 */

import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Clock,
  Database,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  Shield,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed';
import { LoadingState, StatusChip } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import {
  PermissionRequest,
  PermissionRequestPriority,
  PermissionRequestType,
  User,
} from '../../types';

interface PermissionRequestSectionProps {
  currentUser: User;
}

const REQUEST_TYPES: {
  value: PermissionRequestType;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    value: 'ROLE_CHANGE',
    label: 'Role Change',
    icon: Shield,
    description: 'Request upgrade from User to Admin role',
  },
  {
    value: 'TOKEN_LIMIT',
    label: 'AI Token Limit',
    icon: Zap,
    description: 'Request increase in AI token allocation',
  },
  {
    value: 'STORAGE_LIMIT',
    label: 'Storage Limit',
    icon: Database,
    description: 'Request additional storage space',
  },
  {
    value: 'FEATURE_ACCESS',
    label: 'Feature Access',
    icon: FileText,
    description: 'Request access to premium features',
  },
];

const PRIORITY_OPTIONS: { value: PermissionRequestPriority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: 'text-c-text-muted' },
  { value: 'NORMAL', label: 'Normal', color: 'text-blue-500' },
  { value: 'HIGH', label: 'High', color: 'text-amber-500' },
  { value: 'URGENT', label: 'Urgent', color: 'text-danger-500' },
];

const STATUS_CONFIG = {
  PENDING: {
    icon: Clock,
    color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-500/10',
    label: 'Pending',
  },
  APPROVED: {
    icon: CheckCircle,
    color: 'text-green-500 bg-green-50 dark:bg-green-500/10',
    label: 'Approved',
  },
  REJECTED: {
    icon: XCircle,
    color: 'text-danger-500 bg-danger-50 dark:bg-danger-500/10',
    label: 'Rejected',
  },
  CANCELLED: {
    icon: X,
    color: 'text-c-text-secondary bg-c-surface-raised',
    label: 'Cancelled',
  },
};

export const PermissionRequestSection: React.FC<PermissionRequestSectionProps> = ({
  currentUser,
}) => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    requestType: '' as PermissionRequestType | '',
    currentValue: '',
    requestedValue: '',
    justification: '',
    priority: 'NORMAL' as PermissionRequestPriority,
  });

  // Fetch user's requests
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getPermissionRequests();
      setRequests(data);
    } catch (error) {
      console.error('Failed to fetch permission requests:', error);
      toast.error(t('settings.permissions.fetchError', 'Failed to load requests'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.requestType) {
      toast.error(t('settings.permissions.selectType', 'Please select a request type'));
      return;
    }

    if (!formData.justification.trim()) {
      toast.error(t('settings.permissions.provideJustification', 'Please provide a justification'));
      return;
    }

    try {
      setSubmitting(true);
      await Api.createPermissionRequest({
        requestType: formData.requestType,
        currentValue: formData.currentValue || getCurrentValue(formData.requestType),
        requestedValue: formData.requestedValue,
        justification: formData.justification,
        priority: formData.priority,
      });

      toast.success(t('settings.permissions.submitted', 'Request submitted successfully'));
      setShowForm(false);
      setFormData({
        requestType: '',
        currentValue: '',
        requestedValue: '',
        justification: '',
        priority: 'NORMAL',
      });
      fetchRequests();
    } catch (error: any) {
      toast.error(
        error.message || t('settings.permissions.submitError', 'Failed to submit request')
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Get current value based on request type
  const getCurrentValue = (type: PermissionRequestType): string => {
    switch (type) {
      case 'ROLE_CHANGE':
        return currentUser.role || 'USER';
      case 'TOKEN_LIMIT':
        return currentUser.tokenLimit?.toString() || '100000';
      case 'STORAGE_LIMIT':
        return '5GB'; // Default, should come from org limits
      case 'FEATURE_ACCESS':
        return 'Standard';
      default:
        return '';
    }
  };

  // Cancel a pending request
  const handleCancel = async (requestId: string) => {
    try {
      await Api.cancelPermissionRequest(requestId);
      toast.success(t('settings.permissions.cancelled', 'Request cancelled'));
      fetchRequests();
    } catch (error) {
      toast.error(t('settings.permissions.cancelError', 'Failed to cancel request'));
    }
  };

  // Get pending request count
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-c-text">
            {t('settings.permissions.title', 'Permission Requests')}
          </h3>
          <p className="text-sm text-c-text-muted mt-1">
            {t(
              'settings.permissions.subtitle',
              'Request changes to your role, limits, or feature access'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchRequests}
            className="p-2 rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
            title="Refresh"
          >
            <RefreshCw
              size={18}
              className={`text-c-text-muted ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
            >
              <Send size={16} />
              {t('settings.permissions.newRequest', 'New Request')}
            </button>
          )}
        </div>
      </div>

      {/* New Request Form */}
      {showForm && (
        <div className="bg-c-surface border border-c-border-subtle dark:border-navy-700 rounded-xl p-6 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
              {t('settings.permissions.createRequest', 'Create New Request')}
            </h4>
            <button
              onClick={() => setShowForm(false)}
              className="p-1.5 rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
            >
              <X size={18} className="text-c-text-muted" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Request Type Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-c-text-secondary">
                {t('settings.permissions.requestType', 'Request Type')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {REQUEST_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = formData.requestType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          requestType: type.value,
                          currentValue: getCurrentValue(type.value),
                        })
                      }
                      className={`
                                                p-4 rounded-lg border-2 text-left transition-all
                                                ${
                                                  isSelected
                                                    ? 'border-c-border-strong bg-c-surface-raised'
                                                    : 'border-c-border-subtle dark:border-navy-700 hover:border-c-border-strong dark:hover:border-c-border'
                                                }
                                            `}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${isSelected ? 'bg-c-surface-raised' : 'bg-c-surface-raised'}`}
                        >
                          <Icon
                            size={18}
                            className={
                              isSelected ? 'text-c-text-secondary' : 'text-c-text-muted'
                            }
                          />
                        </div>
                        <div>
                          <p
                            className={`font-medium ${isSelected ? 'text-c-text' : 'text-c-text-secondary'}`}
                          >
                            {type.label}
                          </p>
                          <p className="text-xs text-c-text-muted">
                            {type.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current & Requested Values */}
            {formData.requestType && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-c-text-secondary">
                    {t('settings.permissions.currentValue', 'Current Value')}
                  </label>
                  <input
                    type="text"
                    value={formData.currentValue}
                    disabled
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text-secondary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-c-text-secondary">
                    {t('settings.permissions.requestedValue', 'Requested Value')}
                  </label>
                  <input
                    type="text"
                    value={formData.requestedValue}
                    onChange={(e) => setFormData({ ...formData, requestedValue: e.target.value })}
                    placeholder={
                      formData.requestType === 'ROLE_CHANGE' ? 'ADMIN' : 'Enter value...'
                    }
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
                  />
                </div>
              </div>
            )}

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-c-text-secondary">
                {t('settings.permissions.priority', 'Priority')}
              </label>
              <div className="flex gap-2">
                {PRIORITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: option.value })}
                    className={`
                                            px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                                            ${
                                              formData.priority === option.value
                                                ? `${option.color} bg-current/10 ring-2 ring-current/30`
                                                : 'text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
                                            }
                                        `}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Justification */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-c-text-secondary">
                {t('settings.permissions.justification', 'Justification')} *
              </label>
              <textarea
                value={formData.justification}
                onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                placeholder={t(
                  'settings.permissions.justificationPlaceholder',
                  'Explain why you need this change...'
                )}
                rows={4}
                className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none resize-none"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-c-border-subtle dark:border-navy-700">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-c-border-subtle dark:border-navy-700 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting || !formData.requestType}
                className="flex items-center gap-2 px-6 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {t('settings.permissions.submit', 'Submit Request')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Request History */}
      <div className="bg-c-surface border border-c-border-subtle dark:border-navy-700 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-c-border-subtle dark:border-navy-700 flex items-center justify-between">
          <h4 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
            {t('settings.permissions.history', 'Request History')}
          </h4>
          {pendingCount > 0 && <StatusChip tone="warning" label={`${pendingCount} pending`} />}
        </div>

        {loading ? (
          <LoadingState variant="spinner" />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title={t('settings.permissions.noRequests', 'No permission requests yet')}
            action={{
              label: t('settings.permissions.createFirst', 'Create your first request'),
              onClick: () => setShowForm(true),
            }}
          />
        ) : (
          <div className="divide-y divide-c-border-subtle dark:divide-white/5">
            {requests.map((request) => {
              const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.PENDING;
              const StatusIcon = status.icon;
              const typeConfig = REQUEST_TYPES.find((t) => t.value === request.requestType);
              const TypeIcon = typeConfig?.icon || FileText;

              return (
                <div
                  key={request.id}
                  className="px-6 py-4 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-c-surface-raised">
                        <TypeIcon size={18} className="text-c-text-secondary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-c-text">
                            {typeConfig?.label || request.requestType}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                          >
                            <StatusIcon size={12} />
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-c-text-muted mt-1">
                          {request.currentValue} → {request.requestedValue || 'N/A'}
                        </p>
                        {request.justification && (
                          <p className="text-sm text-c-text-secondary mt-2 line-clamp-2">
                            {request.justification}
                          </p>
                        )}
                        {request.adminNotes && request.status !== 'PENDING' && (
                          <div className="mt-2 p-2 bg-c-surface-raised rounded text-sm text-c-text-secondary">
                            <span className="font-medium">Admin notes:</span> {request.adminNotes}
                          </div>
                        )}
                        <p className="text-xs text-c-text-secondary mt-2">
                          {new Date(request.createdAt).toLocaleDateString()} at{' '}
                          {new Date(request.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    {request.status === 'PENDING' && (
                      <button
                        onClick={() => handleCancel(request.id)}
                        className="text-sm text-danger-500 hover:text-danger-600 font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-100 dark:border-blue-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">
              {t('settings.permissions.infoTitle', 'How does this work?')}
            </p>
            <p className="text-blue-600 dark:text-blue-400">
              {t(
                'settings.permissions.infoText',
                'Your request will be reviewed by an administrator. You will receive a notification once a decision is made. Typical review time is 1-2 business days.'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionRequestSection;
