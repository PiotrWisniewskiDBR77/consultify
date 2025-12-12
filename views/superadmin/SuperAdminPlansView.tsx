import React, { useState, useEffect } from 'react';
import { Package, DollarSign, Database, Plus, Edit2, Trash2, Save, X, Check, Users, Building2 } from 'lucide-react';
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
    features?: string; // JSON string
    is_active: number;
    created_at: string;
}

interface UserLicensePlan {
    id: string;
    name: string;
    price_monthly: number;
    features?: string; // JSON string
    is_active: number;
    created_at: string;
}

type PlanType = 'organization' | 'user';

export const SuperAdminPlansView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<PlanType>('organization');
    const [orgPlans, setOrgPlans] = useState<SubscriptionPlan[]>([]);
    const [userPlans, setUserPlans] = useState<UserLicensePlan[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);

    // Form Data - Union type or partial
    const [orgFormData, setOrgFormData] = useState<Partial<SubscriptionPlan>>({});
    const [userFormData, setUserFormData] = useState<Partial<UserLicensePlan>>({});

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const [orgData, userData] = await Promise.all([
                Api.get('/billing/admin/plans'),
                Api.get('/billing/admin/user-plans')
            ]);
            setOrgPlans(Array.isArray(orgData) ? orgData : []);
            setUserPlans(Array.isArray(userData) ? userData : []);
        } catch (error) {
            console.error('Failed to fetch plans:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (activeTab === 'organization') {
                const endpoint = '/billing/admin/plans';
                if (editingId) {
                    await Api.put(`${endpoint}/${editingId}`, orgFormData);
                } else {
                    await Api.post(endpoint, orgFormData);
                }
            } else {
                const endpoint = '/billing/admin/user-plans';
                if (editingId) {
                    await Api.put(`${endpoint}/${editingId}`, userFormData);
                } else {
                    await Api.post(endpoint, userFormData);
                }
            }
            await fetchPlans();
            resetForm();
        } catch (error) {
            console.error('Failed to save plan:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to deactivate this plan?')) return;
        try {
            const endpoint = activeTab === 'organization'
                ? `/billing/admin/plans/${id}`
                : `/billing/admin/user-plans/${id}`;
            await Api.delete(endpoint);
            await fetchPlans();
        } catch (error) {
            console.error('Failed to delete plan:', error);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setShowNewForm(false);
        setOrgFormData({});
        setUserFormData({});
    };

    const handleNewPlan = () => {
        setShowNewForm(true);
        setEditingId(null);
        if (activeTab === 'organization') {
            setOrgFormData({
                name: '',
                price_monthly: 0,
                token_limit: 100000,
                storage_limit_gb: 5,
                token_overage_rate: 0.015,
                storage_overage_rate: 0.10,
                features: '{}'
            });
        } else {
            setUserFormData({
                name: '',
                price_monthly: 0,
                features: '{}'
            });
        }
    };

    const handleEdit = (plan: any) => {
        setEditingId(plan.id);
        setShowNewForm(false); // Close new form if open
        if (activeTab === 'organization') {
            setOrgFormData({ ...plan });
        } else {
            setUserFormData({ ...plan });
        }
    };

    if (loading && !orgPlans.length && !userPlans.length) {
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
                        Pricing & Licenses
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Manage organization subscriptions and user seat licenses
                    </p>
                </div>
                <button
                    onClick={handleNewPlan}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New {activeTab === 'organization' ? 'Plan' : 'License'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => { setActiveTab('organization'); resetForm(); }}
                    className={`pb-2 px-4 font-medium flex items-center gap-2 ${activeTab === 'organization'
                            ? 'text-indigo-600 border-b-2 border-indigo-600'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                >
                    <Building2 className="w-4 h-4" />
                    Organization Plans
                </button>
                <button
                    onClick={() => { setActiveTab('user'); resetForm(); }}
                    className={`pb-2 px-4 font-medium flex items-center gap-2 ${activeTab === 'user'
                            ? 'text-indigo-600 border-b-2 border-indigo-600'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                >
                    <Users className="w-4 h-4" />
                    User Licenses
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* New Form Card */}
                {showNewForm && (
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 border-2 border-dashed border-indigo-300 dark:border-indigo-600">
                        {activeTab === 'organization' ? (
                            <OrgPlanForm
                                formData={orgFormData}
                                setFormData={setOrgFormData}
                                onSave={handleSave}
                                onCancel={resetForm}
                                saving={saving}
                                isNew
                            />
                        ) : (
                            <UserPlanForm
                                formData={userFormData}
                                setFormData={setUserFormData}
                                onSave={handleSave}
                                onCancel={resetForm}
                                saving={saving}
                                isNew
                            />
                        )}
                    </div>
                )}

                {/* List Items */}
                {(activeTab === 'organization' ? orgPlans : userPlans).map((plan: any) => (
                    <div
                        key={plan.id}
                        className={`relative rounded-xl p-6 transition-all ${plan.is_active
                                ? 'bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700'
                                : 'bg-gray-100 dark:bg-gray-800/50 opacity-60'
                            }`}
                    >
                        {editingId === plan.id ? (
                            activeTab === 'organization' ? (
                                <OrgPlanForm
                                    formData={orgFormData}
                                    setFormData={setOrgFormData}
                                    onSave={handleSave}
                                    onCancel={resetForm}
                                    saving={saving}
                                />
                            ) : (
                                <UserPlanForm
                                    formData={userFormData}
                                    setFormData={setUserFormData}
                                    onSave={handleSave}
                                    onCancel={resetForm}
                                    saving={saving}
                                />
                            )
                        ) : (
                            <PlanCard
                                plan={plan}
                                type={activeTab}
                                onEdit={() => handleEdit(plan)}
                                onDelete={() => handleDelete(plan.id)}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Subcomponents ---

const OrgPlanForm = ({ formData, setFormData, onSave, onCancel, saving, isNew }: any) => (
    <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isNew ? 'New Organization Plan' : 'Edit Plan'}
        </h3>
        <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input-field w-full mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Price ($)</label>
                <input type="number" value={formData.price_monthly || 0} onChange={e => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) })} className="input-field w-full mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
            <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tokens</label>
                <input type="number" value={formData.token_limit || 0} onChange={e => setFormData({ ...formData, token_limit: parseInt(e.target.value) })} className="input-field w-full mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Storage (GB)</label>
                <input type="number" value={formData.storage_limit_gb || 0} onChange={e => setFormData({ ...formData, storage_limit_gb: parseFloat(e.target.value) })} className="input-field w-full mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
            <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Stripe ID</label>
                <input type="text" value={formData.stripe_price_id || ''} onChange={e => setFormData({ ...formData, stripe_price_id: e.target.value })} className="input-field w-full mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
        </div>
        <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Features (JSON)</label>
            <textarea
                value={typeof formData.features === 'string' ? formData.features : JSON.stringify(formData.features || {}, null, 2)}
                onChange={e => {
                    try {
                        // Just store as string to allow editing, validate on backend or messy parse here
                        setFormData({ ...formData, features: e.target.value });
                    } catch (err) { }
                }}
                className="input-field w-full mt-1 p-2 rounded border h-24 font-mono text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
        </div>
        <FormActions onSave={onSave} onCancel={onCancel} saving={saving} />
    </div>
);

const UserPlanForm = ({ formData, setFormData, onSave, onCancel, saving, isNew }: any) => (
    <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isNew ? 'New User License' : 'Edit License'}
        </h3>
        <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input-field w-full mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        </div>
        <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Price ($)</label>
            <input type="number" value={formData.price_monthly || 0} onChange={e => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) })} className="input-field w-full mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        </div>
        <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Features (JSON)</label>
            <textarea
                value={typeof formData.features === 'string' ? formData.features : JSON.stringify(formData.features || {}, null, 2)}
                onChange={e => setFormData({ ...formData, features: e.target.value })}
                className="input-field w-full mt-1 p-2 rounded border h-24 font-mono text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
        </div>
        <FormActions onSave={onSave} onCancel={onCancel} saving={saving} />
    </div>
);

const FormActions = ({ onSave, onCancel, saving }: any) => (
    <div className="flex gap-2 pt-2">
        <button onClick={onSave} disabled={saving} className="flex-1 flex items-center justify-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
            {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <><Save className="w-4 h-4" /> Save</>}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
        </button>
    </div>
);

const PlanCard = ({ plan, type, onEdit, onDelete }: any) => (
    <>
        <div className="absolute top-4 right-4">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${plan.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600'}`}>
                {plan.is_active ? 'Active' : 'Inactive'}
            </span>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
        <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">${plan.price_monthly}</span>
            <span className="text-gray-500">/mo</span>
        </div>

        {type === 'organization' && (
            <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2"><Database className="w-4 h-4" /> {plan.token_limit?.toLocaleString() ?? 0} tokens</div>
                <div className="flex items-center gap-2"><Package className="w-4 h-4" /> {plan.storage_limit_gb ?? 0} GB storage</div>
            </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono overflow-hidden h-12">
                {typeof plan.features === 'string' ? plan.features.substring(0, 100) : JSON.stringify(plan.features || {})}
            </div>
        </div>

        <div className="mt-6 flex gap-2">
            <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                <Edit2 className="w-4 h-4" /> Edit
            </button>
            <button onClick={onDelete} className="px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    </>
);

export default SuperAdminPlansView;
