/**
 * Approval Workflows View
 *
 * Manages approval workflows and pending requests.
 */

import {
    AlertTriangle,
    Check,
    Clock,
    Edit2,
    GitBranch,
    Loader2,
    Play,
    Plus,
    RefreshCw,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Card, CardWithHeader } from '../../../components/Admin/shared/Card';
import { Api } from '../../../services/api';

interface ApprovalWorkflow {
    id: string;
    name: string;
    description: string;
    resource_type: string;
    triggerConditions: any;
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
    approvers: any[];
    requestData: any;
    created_at: string;
}

const ApprovalWorkflowsView: React.FC = () => {
    const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
    const [requests, setRequests] = useState<ApprovalRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'workflows' | 'requests'>('workflows');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        resourceType: 'organization',
        approvers: '',
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [workflowsData, requestsData] = await Promise.all([
                Api.getApprovalWorkflows(),
                Api.getApprovalRequests(),
            ]);
            setWorkflows(workflowsData);
            setRequests(requestsData);
        } catch (err: any) {
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        try {
            setSaving(true);
            await Api.createApprovalWorkflow({
                name: formData.name,
                description: formData.description,
                resourceType: formData.resourceType,
                approvers: formData.approvers
                    .split(',')
                    .map((a) => a.trim())
                    .filter(Boolean),
                triggerConditions: {},
            });
            await loadData();
            setShowCreateModal(false);
            setFormData({ name: '', description: '', resourceType: 'organization', approvers: '' });
        } catch (err: any) {
            setError(err.message || 'Failed to create workflow');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteWorkflow = async (id: string) => {
        if (!confirm('Are you sure you want to delete this workflow?')) return;
        try {
            await Api.deleteApprovalWorkflow(id);
            setWorkflows((prev) => prev.filter((w) => w.id !== id));
        } catch (err: any) {
            setError(err.message || 'Failed to delete workflow');
        }
    };

    const handleApprove = async (requestId: string) => {
        try {
            setActionLoading(requestId);
            await Api.approveRequest(requestId);
            setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: 'approved' } : r)));
        } catch (err: any) {
            setError(err.message || 'Failed to approve request');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (requestId: string) => {
        try {
            setActionLoading(requestId);
            await Api.rejectRequest(requestId);
            setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: 'rejected' } : r)));
        } catch (err: any) {
            setError(err.message || 'Failed to reject request');
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">Approved</span>;
            case 'rejected':
                return <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs">Rejected</span>;
            default:
                return <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs">Pending</span>;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <GitBranch className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Workflows</p>
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
                            <p className="text-sm text-slate-400">Pending Requests</p>
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
                            <p className="text-sm text-slate-400">Approved</p>
                            <p className="text-xl font-semibold">
                                {requests.filter((r) => r.status === 'approved').length}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <X className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Rejected</p>
                            <p className="text-xl font-semibold">
                                {requests.filter((r) => r.status === 'rejected').length}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Error Alert */}
            {error && (
                <Card variant="bordered" className="p-4 border-red-500/30 bg-red-500/5">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-5 h-5" />
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-sm hover:text-red-300">
                            Dismiss
                        </button>
                    </div>
                </Card>
            )}

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-700">
                <button
                    onClick={() => setActiveTab('workflows')}
                    className={`pb-3 px-1 text-sm font-medium transition-colors ${
                        activeTab === 'workflows'
                            ? 'text-indigo-400 border-b-2 border-indigo-400'
                            : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    Workflows ({workflows.length})
                </button>
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`pb-3 px-1 text-sm font-medium transition-colors ${
                        activeTab === 'requests'
                            ? 'text-indigo-400 border-b-2 border-indigo-400'
                            : 'text-slate-400 hover:text-slate-200'
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
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    {activeTab === 'workflows' && (
                        <button
                            onClick={() => setShowCreateModal(true)}
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
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Name</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                                        Resource Type
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                                        Approvers
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Created</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workflows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-slate-400">
                                            No workflows configured
                                        </td>
                                    </tr>
                                ) : (
                                    workflows.map((workflow) => (
                                        <tr
                                            key={workflow.id}
                                            className="border-b border-slate-700/50 hover:bg-slate-800/50"
                                        >
                                            <td className="py-3 px-4">
                                                <div>
                                                    <p className="font-medium">{workflow.name}</p>
                                                    <p className="text-sm text-slate-400">{workflow.description}</p>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="px-2 py-1 bg-slate-700 rounded text-xs">
                                                    {workflow.resource_type}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-1">
                                                    <Users className="w-4 h-4 text-slate-400" />
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
                                                    <span className="px-2 py-1 bg-slate-600 text-slate-300 rounded text-xs">
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-300">
                                                {new Date(workflow.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleDeleteWorkflow(workflow.id)}
                                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
                </CardWithHeader>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
                <CardWithHeader title="Approval Requests" subtitle={`${requests.length} requests`}>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Workflow</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                                        Requester
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Resource</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Created</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-slate-400">
                                            No approval requests
                                        </td>
                                    </tr>
                                ) : (
                                    requests.map((request) => (
                                        <tr
                                            key={request.id}
                                            className="border-b border-slate-700/50 hover:bg-slate-800/50"
                                        >
                                            <td className="py-3 px-4">
                                                <p className="font-medium">{request.workflow_name}</p>
                                            </td>
                                            <td className="py-3 px-4 text-sm">{request.requester_email}</td>
                                            <td className="py-3 px-4">
                                                <div>
                                                    <span className="px-2 py-1 bg-slate-700 rounded text-xs">
                                                        {request.resource_type}
                                                    </span>
                                                    <p className="text-xs text-slate-400 mt-1 truncate max-w-[150px]">
                                                        {request.resource_id}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">{getStatusBadge(request.status)}</td>
                                            <td className="py-3 px-4 text-sm text-slate-300">
                                                {new Date(request.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {request.status === 'pending' && (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleApprove(request.id)}
                                                            disabled={actionLoading === request.id}
                                                            className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
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
                                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
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
                </CardWithHeader>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card variant="elevated" className="w-full max-w-md p-6">
                        <h3 className="text-lg font-semibold mb-4">Create Approval Workflow</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Workflow name"
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Workflow description"
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm h-20 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Resource Type</label>
                                <select
                                    value={formData.resourceType}
                                    onChange={(e) => setFormData({ ...formData, resourceType: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                                >
                                    <option value="organization">Organization</option>
                                    <option value="user">User</option>
                                    <option value="billing">Billing</option>
                                    <option value="api_key">API Key</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">
                                    Approvers (comma-separated emails)
                                </label>
                                <input
                                    type="text"
                                    value={formData.approvers}
                                    onChange={(e) => setFormData({ ...formData, approvers: e.target.value })}
                                    placeholder="admin@example.com, manager@example.com"
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
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
                                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={saving || !formData.name}
                                className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 rounded-lg disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Create
                            </button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default ApprovalWorkflowsView;


