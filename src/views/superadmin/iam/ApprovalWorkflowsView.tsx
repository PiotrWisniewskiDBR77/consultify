/**
 * Approval Workflows View
 *
 * Manages approval workflows and pending requests.
 */

import {
  AlertTriangle,
  Check,
  Clock,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Card, CardWithHeader } from '../../../components/Admin/shared/Card';
import { LoadingState } from '../../../components/ui/primitives';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';

interface ApprovalWorkflow {
  id: string;
  name: string;
  description: string;
  resource_type: string;
  triggerConditions: Record<string, unknown>;
  approvers: string[];
  isActive: boolean;
  created_at: string;
}

interface ApprovalRequest {
  id: string;
  workflow_id: string;
  workflow_name: string;
  resource_type: string;
  resource_id: string;
  requester_id: string;
  requester_email: string;
  status: string;
  current_step: number;
  approvers: Array<Record<string, unknown> | string>;
  requestData: Record<string, unknown>;
  created_at: string;
}

interface ApprovalSnapshot {
  workflows: ApprovalWorkflow[];
  requests: ApprovalRequest[];
}

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

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

const getCreatedWorkflowId = (result: unknown) => {
  if (!isRecord(result)) return '';
  const data = isRecord(result.data) ? result.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const workflow = isRecord(result.workflow) ? result.workflow : null;
  return String(
    result.id ||
      workflow?.id ||
      data?.id ||
      (isRecord(data?.workflow) ? data.workflow.id : '') ||
      nestedData?.id ||
      (isRecord(nestedData?.workflow) ? nestedData.workflow.id : '') ||
      ''
  );
};

const ApprovalWorkflowsView: React.FC = () => {
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'workflows' | 'requests'>('workflows');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [workflowPendingDelete, setWorkflowPendingDelete] = useState<ApprovalWorkflow | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    resourceType: 'organization',
    approvers: '',
  });

  const loadData = useCallback(async (): Promise<ApprovalSnapshot | null> => {
    try {
      setLoading(true);
      setLoadError(null);
      setError(null);
      const [workflowsData, requestsData] = await Promise.all([
        Api.getApprovalWorkflows(),
        Api.getApprovalRequests(),
      ]);
      if (!hasListShape(workflowsData, ['workflows', 'items'])) {
        throw new Error('Approval workflows response was not a list');
      }
      if (!hasListShape(requestsData, ['requests', 'items'])) {
        throw new Error('Approval requests response was not a list');
      }
      const snapshot = {
        workflows: getListPayload<ApprovalWorkflow>(workflowsData, ['workflows', 'items']),
        requests: getListPayload<ApprovalRequest>(requestsData, ['requests', 'items']),
      };
      setWorkflows(snapshot.workflows);
      setRequests(snapshot.requests);
      return snapshot;
    } catch (err: unknown) {
      setWorkflows([]);
      setRequests([]);
      setLoadError(normalizeApiErrorMessage(err, 'Failed to load approval workflows'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreate = async () => {
    try {
      setSaving(true);
      setError(null);
      const result = await Api.createApprovalWorkflow({
        name: formData.name,
        description: formData.description,
        resourceType: formData.resourceType,
        approvers: formData.approvers
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        triggerConditions: {},
      });
      const createdId = getCreatedWorkflowId(result);
      if (!createdId) {
        throw new Error('Approval workflow creation response was incomplete');
      }
      const refreshed = await loadData();
      if (!refreshed?.workflows.some((workflow) => workflow.id === createdId)) {
        throw new Error('Approval workflow creation was not confirmed by the server');
      }
      setShowCreateModal(false);
      setFormData({ name: '', description: '', resourceType: 'organization', approvers: '' });
    } catch (err: unknown) {
      setError(normalizeApiErrorMessage(err, 'Failed to create workflow'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    try {
      setError(null);
      await Api.deleteApprovalWorkflow(id);
      const refreshed = await loadData();
      if (!refreshed || refreshed.workflows.some((workflow) => workflow.id === id)) {
        throw new Error('Approval workflow deletion was not confirmed by the server');
      }
      setWorkflowPendingDelete(null);
    } catch (err: unknown) {
      setError(normalizeApiErrorMessage(err, 'Failed to delete workflow'));
    }
  };

  const isRequestDecisionConfirmed = (
    snapshot: ApprovalSnapshot | null,
    requestId: string,
    expectedStatus: 'approved' | 'rejected'
  ) => {
    if (!snapshot) return false;
    const request = snapshot.requests.find((candidate) => candidate.id === requestId);
    return !request || request.status === expectedStatus;
  };

  const handleApprove = async (requestId: string) => {
    try {
      setActionLoading(requestId);
      setError(null);
      await Api.approveRequest(requestId);
      const refreshed = await loadData();
      if (!isRequestDecisionConfirmed(refreshed, requestId, 'approved')) {
        throw new Error('Approval request approval was not confirmed by the server');
      }
    } catch (err: unknown) {
      setError(normalizeApiErrorMessage(err, 'Failed to approve request'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setActionLoading(requestId);
      setError(null);
      await Api.rejectRequest(requestId);
      const refreshed = await loadData();
      if (!isRequestDecisionConfirmed(refreshed, requestId, 'rejected')) {
        throw new Error('Approval request rejection was not confirmed by the server');
      }
    } catch (err: unknown) {
      setError(normalizeApiErrorMessage(err, 'Failed to reject request'));
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 bg-danger-500/10 text-danger-400 rounded text-xs">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs">Pending</span>
        );
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {!loadError && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <GitBranch className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-500">Workflows</p>
                <p className="text-xl font-semibold">{workflows.length}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-500">Pending Requests</p>
                <p className="text-xl font-semibold">
                  {requests.filter((r) => r.status === 'pending').length}
                </p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Check className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-500">Approved</p>
                <p className="text-xl font-semibold">
                  {requests.filter((r) => r.status === 'approved').length}
                </p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-danger-500/10 rounded-lg">
                <X className="w-5 h-5 text-danger-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-500">Rejected</p>
                <p className="text-xl font-semibold">
                  {requests.filter((r) => r.status === 'rejected').length}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Card variant="bordered" className="p-4 border-danger-500/30 bg-danger-500/5">
          <div role="alert" className="flex items-center gap-2 text-danger-400">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-sm hover:text-danger-300"
            >
              Dismiss
            </button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-c-border">
        <button
          onClick={() => setActiveTab('workflows')}
          className={`pb-3 px-1 text-sm font-medium transition-colors ${
            activeTab === 'workflows'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200'
          }`}
        >
          Workflows ({workflows.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 px-1 text-sm font-medium transition-colors ${
            activeTab === 'requests'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200'
          }`}
        >
          Requests ({requests.length})
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {activeTab === 'workflows' ? 'Approval Workflows' : 'Approval Requests'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {activeTab === 'workflows' && (
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!!loadError}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Workflow
            </button>
          )}
        </div>
      </div>

      {/* Workflows Tab */}
      {activeTab === 'workflows' && (
        <CardWithHeader title="Workflows" subtitle={`${workflows.length} workflows configured`}>
          {loadError ? (
            <div className="p-6">
              <DegradedState title="Approval workflows unavailable" description={loadError} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full"
              >
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Resource Type
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Approvers
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Created
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workflows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-8 text-slate-600 dark:text-slate-400"
                      >
                        No workflows configured
                      </td>
                    </tr>
                  ) : (
                    workflows.map((workflow) => (
                      <tr
                        key={workflow.id}
                        className="border-b border-slate-200/60 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{workflow.name}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-500">
                              {workflow.description}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-c-surface-raised rounded text-xs">
                            {workflow.resource_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4 text-slate-600 dark:text-slate-500" />
                            <span className="text-sm">
                              {workflow.approvers?.length || 0} approvers
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {workflow.isActive ? (
                            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded text-xs">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {formatDate(workflow.created_at)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setWorkflowPendingDelete(workflow)}
                              className="p-2 text-danger-400 hover:bg-danger-500/10 rounded-lg transition-colors"
                              aria-label={`Delete approval workflow ${workflow.name}`}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardWithHeader>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <CardWithHeader title="Approval Requests" subtitle={`${requests.length} requests`}>
          {loadError ? (
            <div className="p-6">
              <DegradedState title="Approval requests unavailable" description={loadError} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Workflow
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Requester
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Resource
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Created
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-8 text-slate-600 dark:text-slate-400"
                      >
                        No approval requests
                      </td>
                    </tr>
                  ) : (
                    requests.map((request) => (
                      <tr
                        key={request.id}
                        className="border-b border-slate-200/60 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="py-3 px-4">
                          <p className="font-medium">{request.workflow_name}</p>
                        </td>
                        <td className="py-3 px-4 text-sm">{request.requester_email}</td>
                        <td className="py-3 px-4">
                          <div>
                            <span className="px-2 py-1 bg-c-surface-raised rounded text-xs">
                              {request.resource_type}
                            </span>
                            <p className="text-xs text-slate-600 dark:text-slate-500 mt-1 truncate max-w-[150px]">
                              {request.resource_id}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(request.status)}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {formatDate(request.created_at)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {request.status === 'pending' && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApprove(request.id)}
                                disabled={actionLoading === request.id}
                                className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
                                aria-label={`Approve request ${request.id}`}
                                title="Approve"
                              >
                                {actionLoading === request.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleReject(request.id)}
                                disabled={actionLoading === request.id}
                                className="p-2 text-danger-400 hover:bg-danger-500/10 rounded-lg transition-colors disabled:opacity-50"
                                aria-label={`Reject request ${request.id}`}
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardWithHeader>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card variant="elevated" className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Create Approval Workflow</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Workflow name"
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Workflow description"
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm h-20 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  Resource Type
                </label>
                <select
                  value={formData.resourceType}
                  onChange={(e) => setFormData({ ...formData, resourceType: e.target.value })}
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                >
                  <option value="organization">Organization</option>
                  <option value="user">User</option>
                  <option value="billing">Billing</option>
                  <option value="api_key">API Key</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  Approvers (comma-separated emails)
                </label>
                <input
                  type="text"
                  value={formData.approvers}
                  onChange={(e) => setFormData({ ...formData, approvers: e.target.value })}
                  placeholder="admin@example.com, manager@example.com"
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({
                    name: '',
                    description: '',
                    resourceType: 'organization',
                    approvers: '',
                  });
                }}
                className="px-4 py-2 text-sm bg-c-surface-raised hover:bg-slate-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formData.name}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 rounded-lg disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Create
              </button>
            </div>
          </Card>
        </div>
      )}
      {workflowPendingDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card variant="elevated" className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-3">Delete approval workflow?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              This will delete <span className="font-medium">{workflowPendingDelete.name}</span>.
              The workflow list must confirm the removal before the action is treated as successful.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setWorkflowPendingDelete(null)}
                className="px-4 py-2 text-sm bg-c-surface-raised hover:bg-slate-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteWorkflow(workflowPendingDelete.id)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-danger-600 hover:bg-danger-700 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
                Delete Workflow
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ApprovalWorkflowsView;
