import React, { useState, useEffect } from 'react';
import { Key, Copy, Check, X, Plus, Calendar, Users, Shield, Trash2 } from 'lucide-react';
import { Api } from '../services/api';

interface AccessCode {
    id: string;
    code: string;
    role: string;
    max_uses: number;
    current_uses: number;
    expires_at: string | null;
    is_active: number;
    created_at: string;
    created_by_email: string;
    first_name: string;
    last_name: string;
}

interface AdminAccessControlViewProps {
    organizationId: string;
}

export const AdminAccessControlView: React.FC<AdminAccessControlViewProps> = ({ organizationId }) => {
    const [codes, setCodes] = useState<AccessCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        role: 'USER',
        maxUses: 1,
        expiresInDays: 7
    });

    useEffect(() => {
        loadCodes();
    }, [organizationId]);

    const loadCodes = async () => {
        try {
            setLoading(true);
            const data = await Api.getAccessCodes(organizationId);
            setCodes(data);
        } catch (err) {
            console.error('Failed to load access codes:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const result = await Api.generateAccessCode({
                organizationId,
                role: formData.role,
                maxUses: formData.maxUses,
                expiresInDays: formData.expiresInDays
            });

            setShowCreateForm(false);
            setFormData({ role: 'USER', maxUses: 1, expiresInDays: 7 });
            await loadCodes();

            // Auto-copy the generated code
            navigator.clipboard.writeText(result.code.code);
            setCopiedCode(result.code.code);
            setTimeout(() => setCopiedCode(null), 3000);
        } catch (err: any) {
            alert(err.message || 'Failed to generate access code');
        }
    };

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const handleDeactivateCode = async (id: string) => {
        if (!confirm('Are you sure you want to deactivate this code?')) return;

        try {
            await Api.deactivateAccessCode(id);
            await loadCodes();
        } catch (err: any) {
            alert(err.message || 'Failed to deactivate code');
        }
    };

    const isCodeExpired = (expiresAt: string | null) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    const isCodeMaxedOut = (code: AccessCode) => {
        return code.max_uses !== -1 && code.current_uses >= code.max_uses;
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
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-navy-900 dark:text-white">Access Control</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Generate and manage access codes for your organization
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                >
                    {showCreateForm ? <X size={18} /> : <Plus size={18} />}
                    {showCreateForm ? 'Cancel' : 'Generate Code'}
                </button>
            </div>

            {/* Create Form */}
            {showCreateForm && (
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">Generate New Access Code</h3>
                    <form onSubmit={handleGenerateCode} className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                                    Role
                                </label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white"
                                >
                                    <option value="USER">User</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                                    Max Uses (-1 = unlimited)
                                </label>
                                <input
                                    type="number"
                                    value={formData.maxUses}
                                    onChange={e => setFormData({ ...formData, maxUses: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                                    Expires In (days)
                                </label>
                                <input
                                    type="number"
                                    value={formData.expiresInDays}
                                    onChange={e => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
                        >
                            Generate Code
                        </button>
                    </form>
                </div>
            )}

            {/* Codes List */}
            <div className="grid gap-4">
                {codes.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg">
                        <Key className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={48} />
                        <p className="text-slate-500 dark:text-slate-400">No access codes yet</p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                            Generate your first code to invite users
                        </p>
                    </div>
                ) : (
                    codes.map(code => {
                        const expired = isCodeExpired(code.expires_at);
                        const maxedOut = isCodeMaxedOut(code);
                        const isValid = code.is_active && !expired && !maxedOut;

                        return (
                            <div
                                key={code.id}
                                className={`bg-white dark:bg-navy-900 border rounded-lg p-5 transition-all ${isValid
                                        ? 'border-green-200 dark:border-green-900/30'
                                        : 'border-slate-200 dark:border-white/10 opacity-60'
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        {/* Code Display */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="bg-slate-100 dark:bg-navy-950 px-4 py-2 rounded-lg font-mono text-lg font-bold text-navy-900 dark:text-white border-2 border-slate-200 dark:border-white/10">
                                                {code.code}
                                            </div>
                                            <button
                                                onClick={() => handleCopyCode(code.code)}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                                title="Copy code"
                                            >
                                                {copiedCode === code.code ? (
                                                    <Check className="text-green-600" size={18} />
                                                ) : (
                                                    <Copy className="text-slate-400" size={18} />
                                                )}
                                            </button>
                                            {isValid && (
                                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium rounded">
                                                    Active
                                                </span>
                                            )}
                                            {!isValid && (
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium rounded">
                                                    {!code.is_active ? 'Deactivated' : expired ? 'Expired' : 'Maxed Out'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Code Details */}
                                        <div className="grid grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mb-1">
                                                    <Shield size={14} />
                                                    Role
                                                </div>
                                                <div className="font-medium text-navy-900 dark:text-white">
                                                    {code.role}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mb-1">
                                                    <Users size={14} />
                                                    Usage
                                                </div>
                                                <div className="font-medium text-navy-900 dark:text-white">
                                                    {code.current_uses} / {code.max_uses === -1 ? '∞' : code.max_uses}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mb-1">
                                                    <Calendar size={14} />
                                                    Expires
                                                </div>
                                                <div className="font-medium text-navy-900 dark:text-white">
                                                    {code.expires_at
                                                        ? new Date(code.expires_at).toLocaleDateString()
                                                        : 'Never'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 dark:text-slate-400 mb-1">Created By</div>
                                                <div className="font-medium text-navy-900 dark:text-white">
                                                    {code.first_name} {code.last_name}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {code.is_active && (
                                        <button
                                            onClick={() => handleDeactivateCode(code.id)}
                                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                                            title="Deactivate code"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
