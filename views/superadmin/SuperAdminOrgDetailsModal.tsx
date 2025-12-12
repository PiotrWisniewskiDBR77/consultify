import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { X, Building, CreditCard, Users, FileText, CheckCircle, AlertCircle, Calendar, BarChart } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Organization {
    id: string;
    name: string;
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'blocked' | 'trial';
    created_at: string;
    user_count: number;
    discount_percent?: number;
}

interface SuperAdminOrgDetailsModalProps {
    org: Organization;
    onClose: () => void;
    onUpdate: () => void;
}

export const SuperAdminOrgDetailsModal: React.FC<SuperAdminOrgDetailsModalProps> = ({ org, onClose, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'billing' | 'users'>('general');
    const [loading, setLoading] = useState(false);
    const [billingDetails, setBillingDetails] = useState<any>(null);
    const [editingOrg, setEditingOrg] = useState<Organization>(org);

    // Fetch billing details when tab changes to billing
    useEffect(() => {
        if (activeTab === 'billing' && !billingDetails) {
            fetchBillingDetails();
        }
    }, [activeTab]);

    const fetchBillingDetails = async () => {
        setLoading(true);
        try {
            const data = await Api.getOrganizationBillingDetails(org.id);
            setBillingDetails(data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load billing details');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGeneral = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await Api.updateOrganization(org.id, {
                plan: editingOrg.plan,
                status: editingOrg.status,
                discount_percent: editingOrg.discount_percent
            });
            toast.success('Organization updated');
            onUpdate();
        } catch (err) {
            toast.error('Failed to update organization');
        }
    };

    const renderGeneralTab = () => (
        <form onSubmit={handleSaveGeneral} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Organization Name</label>
                    <input disabled value={editingOrg.name} className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-slate-500" />
                    <p className="text-xs text-slate-600 mt-1">ID: {editingOrg.id}</p>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Created At</label>
                    <input disabled value={new Date(org.created_at).toLocaleDateString()} className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-slate-500" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Plan</label>
                    <select
                        value={editingOrg.plan}
                        onChange={e => setEditingOrg({ ...editingOrg, plan: e.target.value as any })}
                        className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                    >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                    <select
                        value={editingOrg.status}
                        onChange={e => setEditingOrg({ ...editingOrg, status: e.target.value as any })}
                        className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                    >
                        <option value="active">Active</option>
                        <option value="trial">Trial</option>
                        <option value="blocked">Blocked</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Discount (%)</label>
                <div className="flex items-center gap-4">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        value={editingOrg.discount_percent || 0}
                        onChange={e => setEditingOrg({ ...editingOrg, discount_percent: parseInt(e.target.value) || 0 })}
                        className="w-32 px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                    />
                    <p className="text-xs text-slate-500">Discount applied to all future invoices.</p>
                </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end">
                <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium shadow-lg shadow-blue-500/20 transition-all">
                    Save Changes
                </button>
            </div>
        </form>
    );

    const renderBillingTab = () => {
        if (loading) return <div className="p-8 text-center text-slate-500">Loading billing details...</div>;
        if (!billingDetails) return <div className="p-8 text-center text-slate-500">No billing details available.</div>;

        const { billing, usage, invoices } = billingDetails;

        return (
            <div className="space-y-6">
                {/* Subscription Card */}
                <div className="bg-navy-950 rounded-lg p-5 border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400"><CreditCard size={20} /></div>
                            <div>
                                <h4 className="text-sm font-semibold text-white">Current Subscription</h4>
                                <p className="text-xs text-slate-400">{billing.plan_name || org.plan?.toUpperCase() || '-'} Plan</p>
                            </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${billing.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {billing.status}
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="bg-navy-900 rounded p-3">
                            <p className="text-slate-500 text-xs mb-1">Monthly Cost</p>
                            <p className="font-medium text-white">${billing.price_monthly || 0}</p>
                        </div>
                        <div className="bg-navy-900 rounded p-3">
                            <p className="text-slate-500 text-xs mb-1">Billing Email</p>
                            <p className="font-medium text-white truncate">{billing.billing_email || '-'}</p>
                        </div>
                        <div className="bg-navy-900 rounded p-3">
                            <p className="text-slate-500 text-xs mb-1">Next Invoice</p>
                            <p className="font-medium text-white">{billing.current_period_end ? new Date(billing.current_period_end).toLocaleDateString() : '-'}</p>
                        </div>
                    </div>
                </div>

                {/* Usage Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-navy-950 rounded-lg p-5 border border-white/5">
                        <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <BarChart size={16} className="text-blue-400" /> Token Usage
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-400">Used</span>
                                    <span className="text-white font-medium">{usage?.tokens_used?.toLocaleString() || 0}</span>
                                </div>
                                <div className="w-full bg-navy-900 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, (usage?.tokens_used / (usage?.tokens_included || 1)) * 100)}%` }} />
                                </div>
                                <div className="flex justify-between text-xs mt-1 text-slate-500">
                                    <span>Limit: {usage?.tokens_included?.toLocaleString() || 'Unlimited'}</span>
                                    <span>{((usage?.tokens_used / (usage?.tokens_included || 1)) * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-navy-950 rounded-lg p-5 border border-white/5">
                        <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <CreditCard size={16} className="text-purple-400" /> Overage
                        </h4>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm border-b border-white/5 pb-2">
                                <span className="text-slate-400">Tokens Overage</span>
                                <span className="text-white">{usage?.tokens_overage?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm pt-1">
                                <span className="text-slate-400">Estimated Cost</span>
                                <span className="text-green-400 font-bold">${usage?.overage_amount?.toFixed(2) || '0.00'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Invoices List */}
                <div className="bg-navy-950 rounded-lg border border-white/5 overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/5 bg-navy-900/50 flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                            <FileText size={16} className="text-slate-400" /> Invoice History
                        </h4>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-navy-900 text-slate-500 text-xs uppercase sticky top-0">
                                <tr>
                                    <th className="p-3 font-medium">Date</th>
                                    <th className="p-3 font-medium">Amount</th>
                                    <th className="p-3 font-medium">Status</th>
                                    <th className="p-3 font-medium text-right">PDF</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-xs">
                                {invoices && invoices.length > 0 ? (
                                    invoices.map((inv: any) => (
                                        <tr key={inv.id} className="hover:bg-white/5">
                                            <td className="p-3 text-slate-300">{new Date(inv.created_at).toLocaleDateString()}</td>
                                            <td className="p-3 text-white font-medium">${inv.amount_due?.toFixed(2)}</td>
                                            <td className="p-3">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${inv.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {inv.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                {inv.pdf_url ? (
                                                    <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline">Download</a>
                                                ) : <span className="text-slate-600">-</span>}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={4} className="p-4 text-center text-slate-500">No invoices found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-navy-900 border border-white/10 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-navy-950 rounded-t-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                            <Building size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{org.name}</h2>
                            <p className="text-sm text-slate-400">Organization Settings & Billing</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="border-b border-white/10 px-6 bg-navy-900">
                    <div className="flex items-center gap-8">
                        {[
                            { id: 'general', label: 'General Info', icon: <Building size={16} /> },
                            { id: 'billing', label: 'Billing & Settlement', icon: <CreditCard size={16} /> },
                            { id: 'users', label: 'Users & Access', icon: <Users size={16} /> },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`py-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === tab.id
                                    ? 'border-blue-500 text-white'
                                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700'
                                    }`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 bg-navy-900">
                    {activeTab === 'general' && renderGeneralTab()}
                    {activeTab === 'billing' && renderBillingTab()}
                    {activeTab === 'users' && (
                        <div className="text-center py-12 text-slate-500">
                            <Users size={48} className="mx-auto mb-4 opacity-50" />
                            <p>User management is available in the "Users" section of the sidebar.</p>
                            <p className="text-xs mt-2">Filter by this organization to manage its users.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
