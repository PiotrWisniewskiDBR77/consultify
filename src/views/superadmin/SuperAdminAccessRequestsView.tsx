import { Building2, CheckCircle, Clock, Mail, Shield, UserPlus, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../components/Admin/AdminState';
import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';

interface AccessRequest {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  organization_name: string;
  requested_role: string;
  status: string;
  request_type: string;
  requested_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const normalizeRequest = (request: AccessRequest): AccessRequest => ({
  ...request,
  status: asText(request.status, 'pending').toLowerCase(),
});

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;

  return (
    'data' in value ||
    keys.some((key) => key in value) ||
    Boolean(data && keys.some((key) => key in data))
  );
};

const asText = (value: unknown, fallback = 'Unknown') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

export const SuperAdminAccessRequestsView: React.FC = () => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalPassword, setApprovalPassword] = useState('');
  const [approvalRole, setApprovalRole] = useState('ADMIN');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const loadRequests = useCallback(async (): Promise<AccessRequest[] | null> => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await Api.getAccessRequests();
      const normalized = getListPayload<AccessRequest>(data, [
        'requests',
        'accessRequests',
        'items',
      ]).map(normalizeRequest);
      if (!hasListShape(data, ['requests', 'accessRequests', 'items'])) {
        throw new Error('Access requests response was not a list');
      }
      setRequests(normalized);
      return normalized;
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load access requests');
      setRequests([]);
      setLoadError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      setProcessing(true);
      setActionError(null);
      const requestId = selectedRequest.id;
      await Api.approveAccessRequest(selectedRequest.id, approvalPassword, approvalRole);
      const refreshed = await loadRequests();
      if (!refreshed) {
        throw new Error('Access request approval could not be confirmed by read-back');
      }
      const updatedRequest = refreshed?.find((request) => request.id === requestId);
      if (updatedRequest && updatedRequest.status !== 'approved') {
        throw new Error('Access request approval was not confirmed by the server');
      }
      setShowApprovalDialog(false);
      setSelectedRequest(null);
      setApprovalPassword('');
      toast.success('Access request approved');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to approve request');
      setActionError(message);
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    try {
      setProcessing(true);
      setActionError(null);
      const requestId = selectedRequest.id;
      await Api.rejectAccessRequest(selectedRequest.id, rejectionReason);
      const refreshed = await loadRequests();
      if (!refreshed) {
        throw new Error('Access request rejection could not be confirmed by read-back');
      }
      const updatedRequest = refreshed?.find((request) => request.id === requestId);
      if (updatedRequest && updatedRequest.status !== 'rejected') {
        throw new Error('Access request rejection was not confirmed by the server');
      }
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectionReason('');
      toast.success('Access request rejected');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to reject request');
      setActionError(message);
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  const visibleRequests =
    statusFilter === 'all'
      ? requests
      : requests.filter((request) => request.status === statusFilter);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="text-yellow-600 dark:text-yellow-400" size={20} />;
      case 'approved':
        return <CheckCircle className="text-green-600 dark:text-green-400" size={20} />;
      case 'rejected':
        return <XCircle className="text-danger-600 dark:text-danger-400" size={20} />;
      default:
        return <Clock className="text-slate-400" size={20} />;
    }
  };

  const formatRequestedAt = (value?: string | null) => {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white">Access Requests</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review and approve requests to join organizations
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['pending', 'approved', 'rejected', 'all'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            disabled={Boolean(loadError)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === status
                ? 'bg-c-text text-c-bg'
                : 'bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-c-border-subtle hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {loadError && <DegradedState title="Access requests unavailable" description={loadError} />}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300"
        >
          {actionError}
        </div>
      )}

      {/* Requests List */}
      {!loadError && (
        <div className="space-y-3">
          {visibleRequests.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-navy-900 border border-slate-200 dark:border-c-border-subtle rounded-lg">
              <UserPlus className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={48} />
              <p className="text-slate-500 dark:text-slate-400">No {statusFilter} requests</p>
            </div>
          ) : (
            visibleRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-c-border-subtle rounded-lg p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {getStatusIcon(request.status)}
                      <div>
                        <h3 className="font-semibold text-navy-900 dark:text-white">
                          {asText(request.first_name)} {asText(request.last_name, '')}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {formatRequestedAt(request.requested_at)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mb-1">
                          <Mail size={14} />
                          Email
                        </div>
                        <div className="font-medium text-navy-900 dark:text-white">
                          {asText(request.email)}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mb-1">
                          <Building2 size={14} />
                          Organization
                        </div>
                        <div className="font-medium text-navy-900 dark:text-white">
                          {asText(request.organization_name)}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mb-1">
                          <Shield size={14} />
                          Requested Role
                        </div>
                        <div className="font-medium text-navy-900 dark:text-white">
                          {asText(request.requested_role)}
                        </div>
                      </div>
                    </div>

                    {request.rejection_reason && (
                      <div className="mt-3 p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-900/30 rounded-lg">
                        <p className="text-sm text-danger-700 dark:text-danger-400">
                          <strong>Rejection Reason:</strong> {asText(request.rejection_reason)}
                        </p>
                      </div>
                    )}
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowApprovalDialog(true);
                          setApprovalRole('ADMIN');
                        }}
                        aria-label={`Approve access request ${request.id}`}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <CheckCircle size={18} />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowRejectDialog(true);
                        }}
                        aria-label={`Reject access request ${request.id}`}
                        className="px-4 py-2 bg-danger-600 hover:bg-danger-500 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <XCircle size={18} />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Approval Dialog */}
      {showApprovalDialog && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-900 rounded-lg max-w-md w-full p-6 border border-slate-200 dark:border-c-border-subtle">
            <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4">
              Approve Access Request
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              Approving request for{' '}
              <strong>
                {asText(selectedRequest.first_name)} {asText(selectedRequest.last_name, '')}
              </strong>{' '}
              to create organization "<strong>{asText(selectedRequest.organization_name)}</strong>"
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Assign Role
                </label>
                <select
                  value={approvalRole}
                  onChange={(e) => setApprovalRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded-lg text-navy-900 dark:text-white"
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Initial Password (optional)
                </label>
                <input
                  type="password"
                  value={approvalPassword}
                  onChange={(e) => setApprovalPassword(e.target.value)}
                  placeholder="Set account password"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded-lg text-navy-900 dark:text-white"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Leave empty when approving an organization-only access request.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleApprove}
                disabled={processing}
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium disabled:opacity-60"
              >
                {processing ? 'Approving...' : 'Approve'}
              </button>
              <button
                onClick={() => {
                  setShowApprovalDialog(false);
                  setApprovalPassword('');
                }}
                className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-900 rounded-lg max-w-md w-full p-6 border border-slate-200 dark:border-c-border-subtle">
            <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4">
              Reject Access Request
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              Rejecting request from{' '}
              <strong>
                {asText(selectedRequest.first_name)} {asText(selectedRequest.last_name, '')}
              </strong>
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Reason (optional)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide a reason for rejection..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded-lg text-navy-900 dark:text-white resize-none"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleReject}
                disabled={processing}
                className="flex-1 py-2 bg-danger-600 hover:bg-danger-500 text-white rounded-lg transition-colors font-medium disabled:opacity-60"
              >
                {processing ? 'Rejecting...' : 'Reject'}
              </button>
              <button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectionReason('');
                }}
                className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
