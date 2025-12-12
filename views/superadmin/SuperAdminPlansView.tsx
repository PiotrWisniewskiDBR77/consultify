import React, { useState, useEffect } from 'react';
import { Package, DollarSign, Database, Plus, Edit2, Trash2, Save, X, Check } from 'lucide-react';
import { Api } from '../../services/api';

interface SubscriptionPlan {
    id: string;
    name: string;
    price_monthly: number;
    token_limit: number;
    storage_limit_gb: number;
    token_overage_rate: number;
    storage_overage_rate: number;
    stripe_price_id: string | null;
    is_active: number;
    created_at: string;
}

export const SuperAdminPlansView: React.FC = () => {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [formData, setFormData] = useState<Partial<SubscriptionPlan>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const data = await Api.get('/billing/admin/plans');
            setPlans(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch plans:', error);
            setPlans([]);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (plan: SubscriptionPlan) => {
        setEditingId(plan.id);
        setFormData(plan);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setFormData({});
    };

    const handleSave = async () => {
        if (!editingId && !showNewForm) return;
        setSaving(true);
        try {
            if (editingId) {
                await Api.put(`/billing/admin/plans/${editingId}`, formData);
            } else {
                await Api.post('/billing/admin/plans', formData);
            }
            await fetchPlans();
            setEditingId(null);
            setShowNewForm(false);
            setFormData({});
        } catch (error) {
            console.error('Failed to save plan:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to deactivate this plan?')) return;
        try {
            await Api.delete(`/billing/admin/plans/${id}`);
            await fetchPlans();
        } catch (error) {
            console.error('Failed to delete plan:', error);
        }
    };

    const handleNewPlan = () => {
        setShowNewForm(true);
        setFormData({
            name: '',
            price_monthly: 0,
            token_limit: 100000,
            storage_limit_gb: 5,
            token_overage_rate: 0.015,
            storage_overage_rate: 0.10
        });
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
        return num.toString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Package className="w-6 h-6 text-indigo-600" />
                        Subscription Plans
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Manage pricing tiers and limits
                    </p>
                </div>
                <button
                    onClick={handleNewPlan}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Plan
                </button>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* New Plan Form */}
                {showNewForm && (
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 border-2 border-dashed border-indigo-300 dark:border-indigo-600">
                        <PlanForm
                            formData={formData}
                            setFormData={setFormData}
                            onSave={handleSave}
                            onCancel={() => { setShowNewForm(false); setFormData({}); }}
                            saving={saving}
                            isNew
                        />
                    </div>
                )}

                {/* Existing Plans */}
                {plans.map(plan => (
                    <div
                        key={plan.id}
                        className={`relative rounded-xl p-6 transition-all ${plan.is_active
                            ? 'bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700'
                            : 'bg-gray-100 dark:bg-gray-800/50 opacity-60'
                            }`}
                    >
                        {editingId === plan.id ? (
                            <PlanForm
                                formData={formData}
                                setFormData={setFormData}
                                onSave={handleSave}
                                onCancel={handleCancelEdit}
                                saving={saving}
                            />
                        ) : (
                            <>
                                {/* Status Badge */}
                                <div className="absolute top-4 right-4">
                                    {plan.is_active ? (
                                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                                            Active
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-full">
                                            Inactive
                                        </span>
                                    )}
                                </div>

                                {/* Plan Header */}
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {plan.name}
                                </h3>
                                <div className="mt-2 flex items-baseline gap-1">
                                    <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                                        ${plan.price_monthly}
                                    </span>
                                    <span className="text-gray-500">/month</span>
                                </div>

                                {/* Limits */}
                                <div className="mt-4 space-y-3">
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                        <Database className="w-4 h-4" />
                                        <span>{formatNumber(plan.token_limit)} tokens</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                        <Package className="w-4 h-4" />
                                        <span>{plan.storage_limit_gb} GB storage</span>
                                    </div>
                                </div>

                                {/* Overage Rates */}
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Overage Rates:</p>
                                    <div className="text-sm text-gray-600 dark:text-gray-300">
                                        <p>${plan.token_overage_rate}/1K tokens</p>
                                        <p>${plan.storage_overage_rate}/GB storage</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="mt-6 flex gap-2">
                                    <button
                                        onClick={() => handleEdit(plan)}
                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(plan.id)}
                                        className="px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

interface PlanFormProps {
    formData: Partial<SubscriptionPlan>;
    setFormData: (data: Partial<SubscriptionPlan>) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
    isNew?: boolean;
}

const PlanForm: React.FC<PlanFormProps> = ({ formData, setFormData, onSave, onCancel, saving, isNew }) => {
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isNew ? 'New Plan' : 'Edit Plan'}
            </h3>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Plan Name
                </label>
                <input
                    type="text"
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Price/Month ($)
                    </label>
                    <input
                        type="number"
                        value={formData.price_monthly || 0}
                        onChange={e => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Token Limit
                    </label>
                    <input
                        type="number"
                        value={formData.token_limit || 0}
                        onChange={e => setFormData({ ...formData, token_limit: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Storage (GB)
                    </label>
                    <input
                        type="number"
                        value={formData.storage_limit_gb || 0}
                        onChange={e => setFormData({ ...formData, storage_limit_gb: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Token Overage $/1K
                    </label>
                    <input
                        type="number"
                        step="0.001"
                        value={formData.token_overage_rate || 0}
                        onChange={e => setFormData({ ...formData, token_overage_rate: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Storage Overage ($/GB)
                </label>
                <input
                    type="number"
                    step="0.01"
                    value={formData.storage_overage_rate || 0}
                    onChange={e => setFormData({ ...formData, storage_overage_rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Stripe Price ID
                </label>
                <input
                    type="text"
                    value={formData.stripe_price_id || ''}
                    onChange={e => setFormData({ ...formData, stripe_price_id: e.target.value })}
                    placeholder="price_..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            <div className="flex gap-2 pt-2">
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                    {saving ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            Save
                        </>
                    )}
                </button>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default SuperAdminPlansView;
