import React, { useState, useEffect } from 'react';
import { UserPlus, CheckCircle, XCircle, Clock, Mail, Building2, Shield } from 'lucide-react';
import { Api } from '../../services/api';

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

    useEffect(() => {
        loadRequests();
    }, [statusFilter]);

    const loadRequests = async () => {
        try {
            setLoading(true);
            const data = await Api.getAccessRequests(statusFilter);
            setRequests(data);
        } catch (err) {
            console.error('Failed to load access requests:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedRequest || !approvalPassword) {
            alert('Please provide a password for the new account');
            return;
        }

        try {
            await Api.approveAccessRequest(selectedRequest.id, approvalPassword, approvalRole);
            setShowApprovalDialog(false);
            setSelectedRequest(null);
            setApprovalPassword('');
            await loadRequests();
            alert('Access request approved successfully!');
        } catch (err: any) {
            alert(err.message || 'Failed to approve request');
        }
    };

    const handleReject = async () => {
        if (!selectedRequest) return;

        try {
            await Api.rejectAccessRequest(selectedRequest.id, rejectionReason);
            setShowRejectDialog(false);
            setSelectedRequest(null);
            setRejectionReason('');
            await loadRequests();
            alert('Access request rejected');
        } catch (err: any) {
            alert(err.message || 'Failed to reject request');
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return <Clock className="text-yellow-600 dark:text-yellow-400" size={20} />;
            case 'approved':
                return <CheckCircle className="text-green-600 dark:text-green-400" size={20} />;
            case 'rejected':
                return <XCircle className="text-red-600 dark:text-red-400" size={20} />;
            default:
                return <Clock className="text-slate-400" size={20} />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
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
                {['pending', 'approved', 'rejected', 'all'].map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${statusFilter === status
                                ? 'bg-purple-600 text-white'
                                : 'bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                            }`}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                ))}
            </div>

            {/* Requests List */}
            <div className="space-y-3">
                {requests.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg">
                        <UserPlus className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={48} />
                        <p className="text-slate-500 dark:text-slate-400">No {statusFilter} requests</p>
                    </div>
                ) : (
                    requests.map(request => (
                        <div
                            key={request.id}
                            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg p-5"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        {getStatusIcon(request.status)}
                                        <div>
                                            <h3 className="font-semibold text-navy-900 dark:text-white">
                                                {request.first_name} {request.last_name}
                                            </h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                {new Date(request.requested_at).toLocaleString()}
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
                                                {request.email}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mb-1">
                                                <Building2 size={14} />
                                                Organization
                                            </div>
                                            <div className="font-medium text-navy-900 dark:text-white">
                                                {request.organization_name}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mb-1">
                                                <Shield size={14} />
                                                Requested Role
                                            </div>
                                            <div className="font-medium text-navy-900 dark:text-white">
                                                {request.requested_role}
                                            </div>
                                        </div>
                                    </div>

                                    {request.rejection_reason && (
                                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
                                            <p className="text-sm text-red-700 dark:text-red-400">
                                                <strong>Rejection Reason:</strong> {request.rejection_reason}
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
                                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-2"
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

            {/* Approval Dialog */}
            {showApprovalDialog && selectedRequest && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-navy-900 rounded-lg max-w-md w-full p-6 border border-slate-200 dark:border-white/10">
                        <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4">
                            Approve Access Request
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                            Approving request for <strong>{selectedRequest.first_name} {selectedRequest.last_name}</strong> to create organization "<strong>{selectedRequest.organization_name}</strong>"
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                                    Assign Role
                                </label>
                                <select
                                    value={approvalRole}
                                    onChange={e => setApprovalRole(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white"
                                >
                                    <option value="USER">User</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                                    Initial Password
                                </label>
                                <input
                                    type="password"
                                    value={approvalPassword}
                                    onChange={e => setApprovalPassword(e.target.value)}
                                    placeholder="Set account password"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white"
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    User can change this later in their settings
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleApprove}
                                className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium"
                            >
                                Approve
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
                    <div className="bg-white dark:bg-navy-900 rounded-lg max-w-md w-full p-6 border border-slate-200 dark:border-white/10">
                        <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4">
                            Reject Access Request
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                            Rejecting request from <strong>{selectedRequest.first_name} {selectedRequest.last_name}</strong>
                        </p>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                                Reason (optional)
                            </label>
                            <textarea
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                placeholder="Provide a reason for rejection..."
                                rows={3}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white resize-none"
                            />
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleReject}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-medium"
                            >
                                Reject
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
