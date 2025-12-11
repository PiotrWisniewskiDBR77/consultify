
import React, { useState, useEffect, useCallback } from 'react';
import { Api } from '../../services/api';
import { translations } from '../../translations';
import { CheckCircle, XCircle, Clock, Search, Key, RefreshCw, UserCheck, Shield, Plus, Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const SuperAdminAccessRequestsView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'requests' | 'codes'>('requests');
    const [requests, setRequests] = useState<any[]>([]);
    const [codes, setCodes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Code Generation State
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [newCodeData, setNewCodeData] = useState({
        code: '',
        role: 'USER',
        maxUses: 100,
        expiresAt: '' // Optional
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [reqs, accessCodes] = await Promise.all([
                Api.getAccessRequests(),
                Api.getAccessCodes()
            ]);
            setRequests(reqs);
            setCodes(accessCodes);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load access data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleApprove = async (id: string) => {
        setProcessingId(id);
        try {
            await Api.approveAccessRequest(id);
            toast.success('Access request approved');
            fetchData();
        } catch (err: any) {
            toast.error(err.message || 'Failed to approve request');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: string) => {
        const reason = prompt('Enter rejection reason:');
        if (reason === null) return; // Cancelled

        setProcessingId(id);
        try {
            await Api.rejectAccessRequest(id, reason);
            toast.success('Access request rejected');
            fetchData();
        } catch (err: any) {
            toast.error(err.message || 'Failed to reject request');
        } finally {
            setProcessingId(null);
        }
    };

    const handleGenerateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await Api.generateAccessCode(newCodeData);
            toast.success('Access code generated');
            setShowCodeModal(false);
            setNewCodeData({ code: '', role: 'USER', maxUses: 100, expiresAt: '' });
            fetchData();
        } catch (err: any) {
            toast.error(err.message || 'Failed to generate code');
        }
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        toast.success('Code copied to clipboard');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Access Control</h1>
                    <p className="text-slate-400 text-sm">Manage incoming organization requests and access codes.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'requests' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Requests
                        {requests.filter(r => r.status === 'pending').length > 0 && (
                            <span className="ml-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">{requests.filter(r => r.status === 'pending').length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('codes')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'codes' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Access Codes
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'requests' ? (
                <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center">
                        <h3 className="font-semibold text-white">Pending Requests</h3>
                        <button onClick={fetchData} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-navy-950 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="p-4 font-medium">Date</th>
                                <th className="p-4 font-medium">Organization</th>
                                <th className="p-4 font-medium">Contact</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading requests...</td></tr>
                            ) : requests.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-500">No access requests found.</td></tr>
                            ) : (
                                requests.map(req => (
                                    <tr key={req.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-slate-500 text-xs">{new Date(req.requested_at).toLocaleString()}</td>
                                        <td className="p-4 text-white font-medium">{req.organization_name}</td>
                                        <td className="p-4">
                                            <div className="text-white">{req.first_name} {req.last_name}</div>
                                            <div className="text-slate-500 text-xs">{req.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${req.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                                    req.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            {req.status === 'pending' && (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleApprove(req.id)}
                                                        disabled={processingId === req.id}
                                                        className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded transition-colors disabled:opacity-50"
                                                        title="Approve"
                                                    >
                                                        <CheckCircle size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(req.id)}
                                                        disabled={processingId === req.id}
                                                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors disabled:opacity-50"
                                                        title="Reject"
                                                    >
                                                        <XCircle size={18} />
                                                    </button>
                                                </div>
                                            )}
                                            {req.status === 'rejected' && req.rejection_reason && (
                                                <span className="text-xs text-red-400 italic" title={req.rejection_reason}>Reason: {req.rejection_reason}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowCodeModal(true)}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                            <Plus size={16} /> Generate New Code
                        </button>
                    </div>

                    <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-navy-950 text-slate-400 text-xs uppercase tracking-wider">
                                    <th className="p-4 font-medium">Code</th>
                                    <th className="p-4 font-medium">Target Role</th>
                                    <th className="p-4 font-medium">Usage</th>
                                    <th className="p-4 font-medium">Expires</th>
                                    <th className="p-4 font-medium">Created By</th>
                                    <th className="p-4 font-medium text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm">
                                {loading ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading codes...</td></tr>
                                ) : codes.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-500">No access codes generated yet.</td></tr>
                                ) : (
                                    codes.map(code => (
                                        <tr key={code.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <code className="bg-navy-950 px-2 py-1 rounded text-blue-400 font-mono text-xs border border-blue-500/20">{code.code}</code>
                                                    <button onClick={() => copyCode(code.code)} className="text-slate-500 hover:text-white transition-colors">
                                                        <Copy size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-300 font-medium text-xs">{code.role}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-24 h-1.5 bg-navy-950 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500"
                                                            style={{ width: `${Math.min(100, (code.current_uses / code.max_uses) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-slate-400">{code.current_uses} / {code.max_uses}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-500 text-xs">
                                                {code.expires_at ? new Date(code.expires_at).toLocaleDateString() : 'Never'}
                                            </td>
                                            <td className="p-4 text-slate-500 text-xs">
                                                {code.created_by_email || 'Super Admin'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button className="text-slate-500 hover:text-red-400 transition-colors">
                                                    <XCircle size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Generate Code Modal */}
            {showCodeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Key size={20} className="text-purple-500" /> Generate Access Code
                            </h3>
                            <button onClick={() => setShowCodeModal(false)} className="text-slate-400 hover:text-white">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleGenerateCode} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Custom Code (Optional)</label>
                                <input
                                    type="text"
                                    value={newCodeData.code}
                                    onChange={e => setNewCodeData({ ...newCodeData, code: e.target.value.toUpperCase() })}
                                    placeholder="Leave empty for random"
                                    className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-purple-500 outline-none text-sm placeholder:text-slate-600"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Max Uses</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={newCodeData.maxUses}
                                        onChange={e => setNewCodeData({ ...newCodeData, maxUses: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-purple-500 outline-none text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
                                    <select
                                        value={newCodeData.role}
                                        onChange={e => setNewCodeData({ ...newCodeData, role: e.target.value })}
                                        className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-purple-500 outline-none text-sm"
                                    >
                                        <option value="USER">User (Standard)</option>
                                        <option value="ADMIN">Admin</option>
                                        <option value="CEO">CEO</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Expires At (Optional)</label>
                                <input
                                    type="date"
                                    value={newCodeData.expiresAt}
                                    onChange={e => setNewCodeData({ ...newCodeData, expiresAt: e.target.value })}
                                    className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-purple-500 outline-none text-sm"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCodeModal(false)}
                                    className="flex-1 py-2 bg-transparent border border-white/10 hover:bg-white/5 rounded text-slate-300 text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 rounded text-white text-sm font-medium shadow-lg shadow-purple-900/20 transition-colors"
                                >
                                    Generate Code
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
