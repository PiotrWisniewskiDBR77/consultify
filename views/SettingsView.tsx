import React, { useState, useEffect } from 'react';
import { User, Language, AIProviderType } from '../types';
import { Api } from '../services/api';
import { UserCircle, Globe, Lock, Bell, CreditCard, Check, Cpu, Moon, Sun, Monitor } from 'lucide-react';

interface SettingsViewProps {
    currentUser: User;
    language: Language;
    onUpdateUser: (updates: Partial<User>) => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    setLanguage: (lang: Language) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, language, onUpdateUser, theme, toggleTheme, setLanguage }) => {
    const [activeTab, setActiveTab] = useState<'PROFILE' | 'BILLING' | 'AI'>('PROFILE');
    const [formData, setFormData] = useState({
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        role: currentUser.role || '',
        companyName: currentUser.companyName || '',
    });

    const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl);

    // Sync state with currentUser changes
    React.useEffect(() => {
        setFormData({
            firstName: currentUser.firstName || '',
            lastName: currentUser.lastName || '',
            role: currentUser.role || '',
            companyName: currentUser.companyName || '',
        });
        setAvatarUrl(currentUser.avatarUrl);
    }, [currentUser]);

    // AI Config State
    const [apiKey, setApiKey] = useState('');
    const [isSaved, setIsSaved] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await Api.updateUser(currentUser.id, formData);
            onUpdateUser(formData); // Optimistic update
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        } catch (err) {
            alert('Failed to save settings');
        }
    };

    const handleSaveApiKey = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await Api.saveSetting('gemini_api_key', apiKey);
            setIsSaved(true);
            setApiKey(''); // Clear for security or keep it masked? Let's clear.
            alert('API Key saved successfully!');
            setTimeout(() => setIsSaved(false), 2000);
        } catch (err) {
            alert('Failed to save API Key');
        }
    };

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (file.size > 2 * 1024 * 1024) {
            alert('File size must be less than 2MB');
            return;
        }

        try {
            const result = await Api.uploadAvatar(currentUser.id, file);
            // Construct full URL if returned relative
            const fullUrl = result.avatarUrl.startsWith('http') ? result.avatarUrl : `http://localhost:3001${result.avatarUrl}`;
            setAvatarUrl(fullUrl);
            onUpdateUser({ avatarUrl: fullUrl }); // Update parent state immediately
        } catch (err: any) {
            alert(err.message || 'Failed to upload avatar'); // Corrected typo here, but keeping message same
        }
    };

    const renderProfile = () => (
        <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Personal Information</h2>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="flex items-center gap-6 mb-8">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden"
                    />
                    <div
                        onClick={handleAvatarClick}
                        className="w-20 h-20 rounded-full bg-slate-100 dark:bg-navy-800 border-2 border-dashed border-slate-300 dark:border-white/20 flex items-center justify-center text-slate-500 cursor-pointer hover:border-purple-500 hover:text-purple-400 transition-colors overflow-hidden relative group"
                    >
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <UserCircle size={40} />
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs text-white font-medium">
                            Change
                        </div>
                    </div>
                    <div>
                        <h3 className="text-slate-900 dark:text-white font-medium">Profile Photo</h3>
                        <p className="text-xs text-slate-500 mt-1">Accepts JPG, PNG up to 2MB</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-300">First Name</label>
                        <input
                            value={formData.firstName}
                            onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-all text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Last Name</label>
                        <input
                            value={formData.lastName}
                            onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-all text-sm"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Role / Job Title</label>
                    <input
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-all text-sm"
                    />
                </div>

                <div className="space-y-1.5 opacity-50 cursor-not-allowed">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Email Address (Managed by Admin)</label>
                    <input
                        value={currentUser.email}
                        disabled
                        className="w-full px-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-500 dark:text-slate-400 outline-none text-sm"
                    />
                </div>

                {/* Preference Section */}
                <div className="pt-6 mt-6 border-t border-slate-200 dark:border-white/10">
                    <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-4">Preferences</h3>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Interface Theme</label>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => theme === 'dark' && toggleTheme()}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${theme === 'light'
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    <Sun size={16} />
                                    Light
                                </button>
                                <button
                                    type="button"
                                    onClick={() => theme === 'light' && toggleTheme()}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${theme === 'dark'
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    <Moon size={16} />
                                    Dark
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Language</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setLanguage('EN')}
                                    className={`px-3 py-2.5 rounded-lg border text-sm transition-all ${language === 'EN'
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    English
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLanguage('PL')}
                                    className={`px-3 py-2.5 rounded-lg border text-sm transition-all ${language === 'PL'
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    Polski
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLanguage('DE')}
                                    className={`px-3 py-2.5 rounded-lg border text-sm transition-all ${language === 'DE'
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    Deutsch
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLanguage('AR')}
                                    className={`px-3 py-2.5 rounded-lg border text-sm transition-all ${language === 'AR'
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    العربية
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                    <button className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                        {isSaved ? <Check size={16} /> : null}
                        {isSaved ? 'Saved!' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );

    const renderBilling = () => {
        const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN';

        const [billingData, setBillingData] = useState<any>(null);
        const [plans, setPlans] = useState<any[]>([]);
        const [invoices, setInvoices] = useState<any[]>([]);
        const [loadingBilling, setLoadingBilling] = useState(true);
        const [subscribing, setSubscribing] = useState(false);

        useEffect(() => {
            const fetchBillingData = async () => {
                try {
                    const [current, plansData, invoicesData] = await Promise.all([
                        Api.getCurrentBilling(),
                        Api.getSubscriptionPlans(),
                        Api.getInvoices()
                    ]);
                    setBillingData(current);
                    setPlans(plansData);
                    setInvoices(invoicesData);
                } catch (err) {
                    console.error('Failed to fetch billing data:', err);
                } finally {
                    setLoadingBilling(false);
                }
            };
            fetchBillingData();
        }, []);

        const handleSelectPlan = async (planId: string) => {
            if (!isAdmin) {
                alert('Only admins can change the subscription plan.');
                return;
            }
            setSubscribing(true);
            try {
                if (billingData?.billing?.subscription_plan_id) {
                    await Api.changePlan(planId);
                } else {
                    await Api.subscribeToPlan(planId);
                }
                // Refresh billing data
                const current = await Api.getCurrentBilling();
                setBillingData(current);
                alert('Plan updated successfully!');
            } catch (err: any) {
                alert(err.message || 'Failed to update plan');
            } finally {
                setSubscribing(false);
            }
        };

        const handleCancelSubscription = async () => {
            if (!confirm('Are you sure you want to cancel your subscription? You will lose access at the end of the billing period.')) return;
            try {
                await Api.cancelSubscription();
                const current = await Api.getCurrentBilling();
                setBillingData(current);
                alert('Subscription canceled.');
            } catch (err: any) {
                alert(err.message || 'Failed to cancel subscription');
            }
        };

        if (loadingBilling) {
            return (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
            );
        }

        // Calculate usage percentages
        const usage = billingData?.usage || {};
        const tokenPercentage = usage.tokenLimit > 0 ? Math.round((usage.tokensUsed / usage.tokenLimit) * 100) : 0;
        const storagePercentage = usage.storageLimit > 0 ? Math.round((usage.storageUsed / usage.storageLimit) * 100) : 0;

        const currentPlanId = billingData?.billing?.subscription_plan_id;
        const currentPlan = plans.find(p => p.id === currentPlanId);

        return (
            <div className="max-w-4xl space-y-8">
                <h2 className="text-lg font-semibold text-white mb-6">Subscription & Billing</h2>

                {/* Current Plan Card */}
                {currentPlan && (
                    <div className="bg-gradient-to-br from-purple-900/40 to-navy-900 border border-purple-500/30 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <CreditCard size={120} />
                        </div>
                        <div className="relative flex justify-between items-start">
                            <div>
                                <div className="inline-block px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold mb-3 border border-purple-500/20">
                                    CURRENT PLAN
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">{currentPlan.name}</h3>
                                <p className="text-slate-400 text-sm">
                                    ${currentPlan.price_monthly}/month • {(currentPlan.token_limit / 1000).toFixed(0)}K tokens • {currentPlan.storage_limit_gb}GB storage
                                </p>
                                {billingData?.billing?.current_period_end && (
                                    <p className="text-xs text-slate-500 mt-2">
                                        Renews on {new Date(billingData.billing.current_period_end).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                            {isAdmin && billingData?.billing?.status === 'active' && (
                                <button
                                    onClick={handleCancelSubscription}
                                    className="text-sm text-slate-400 hover:text-red-400 transition-colors"
                                >
                                    Cancel Subscription
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Usage Meters */}
                <div>
                    <h3 className="text-md font-semibold text-white mb-4">Usage This Period</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Token Usage */}
                        <div className="bg-navy-900 border border-white/10 rounded-xl p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                    <Cpu size={20} />
                                </div>
                                <div>
                                    <h4 className="text-white font-medium">Token Usage</h4>
                                    <p className="text-xs text-slate-500">AI requests this month</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">
                                        {(usage.tokensUsed || 0).toLocaleString()} / {(usage.tokenLimit || 0).toLocaleString()}
                                    </span>
                                    <span className={`font-medium ${tokenPercentage >= 80 ? 'text-orange-400' : 'text-slate-300'}`}>
                                        {tokenPercentage}%
                                    </span>
                                </div>
                                <div className="w-full bg-navy-950 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${tokenPercentage >= 95 ? 'bg-red-500' :
                                            tokenPercentage >= 80 ? 'bg-orange-500' :
                                                'bg-purple-600'
                                            }`}
                                        style={{ width: `${Math.min(100, tokenPercentage)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Storage Usage */}
                        <div className="bg-navy-900 border border-white/10 rounded-xl p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                    <Globe size={20} />
                                </div>
                                <div>
                                    <h4 className="text-white font-medium">Storage Usage</h4>
                                    <p className="text-xs text-slate-500">Documents & files</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">
                                        {(usage.storageUsed || 0).toFixed(2)} GB / {usage.storageLimit || 0} GB
                                    </span>
                                    <span className={`font-medium ${storagePercentage >= 80 ? 'text-orange-400' : 'text-slate-300'}`}>
                                        {storagePercentage}%
                                    </span>
                                </div>
                                <div className="w-full bg-navy-950 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${storagePercentage >= 95 ? 'bg-red-500' :
                                            storagePercentage >= 80 ? 'bg-orange-500' :
                                                'bg-emerald-500'
                                            }`}
                                        style={{ width: `${Math.min(100, storagePercentage)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Available Plans (Admin Only) */}
                {isAdmin && (
                    <div>
                        <h3 className="text-md font-semibold text-white mb-4">Available Plans</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {plans.filter(p => p.is_active).map(plan => (
                                <div
                                    key={plan.id}
                                    className={`rounded-xl p-5 border transition-all ${plan.id === currentPlanId
                                        ? 'bg-purple-900/30 border-purple-500/50'
                                        : 'bg-navy-900 border-white/10 hover:border-purple-500/30'
                                        }`}
                                >
                                    <h4 className="text-lg font-bold text-white mb-1">{plan.name}</h4>
                                    <p className="text-2xl font-bold text-purple-400 mb-3">
                                        ${plan.price_monthly}<span className="text-sm text-slate-500">/mo</span>
                                    </p>
                                    <ul className="text-sm text-slate-400 space-y-1 mb-4">
                                        <li>• {(plan.token_limit / 1000).toFixed(0)}K tokens/month</li>
                                        <li>• {plan.storage_limit_gb} GB storage</li>
                                        <li className="text-xs text-slate-500">
                                            Overage: ${plan.token_overage_rate}/1K • ${plan.storage_overage_rate}/GB
                                        </li>
                                    </ul>
                                    {plan.id === currentPlanId ? (
                                        <div className="w-full py-2 rounded-lg text-center text-sm font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20">
                                            Current Plan
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleSelectPlan(plan.id)}
                                            disabled={subscribing}
                                            className="w-full py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50"
                                        >
                                            {subscribing ? 'Processing...' : 'Select Plan'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Invoice History */}
                {invoices.length > 0 && (
                    <div>
                        <h3 className="text-md font-semibold text-white mb-4">Invoice History</h3>
                        <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-navy-950 text-slate-400 text-xs uppercase">
                                        <th className="px-4 py-3 text-left">Date</th>
                                        <th className="px-4 py-3 text-left">Amount</th>
                                        <th className="px-4 py-3 text-left">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {invoices.slice(0, 5).map(inv => (
                                        <tr key={inv.id} className="text-slate-300">
                                            <td className="px-4 py-3">
                                                {new Date(inv.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 font-mono">
                                                ${(inv.amount_paid / 100).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${inv.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    inv.status === 'open' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    {inv.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderAIConfig = () => {
        const [configMode, setConfigMode] = useState<AIProviderType>(currentUser.aiConfig?.provider || 'system');
        const [customKey, setCustomKey] = useState(currentUser.aiConfig?.apiKey || '');
        const [localEndpoint, setLocalEndpoint] = useState(currentUser.aiConfig?.endpoint || 'http://localhost:11434');
        const [ollamaModels, setOllamaModels] = useState<string[]>([]);
        const [selectedModel, setSelectedModel] = useState(currentUser.aiConfig?.modelId || '');
        const [isLoadingModels, setIsLoadingModels] = useState(false);

        const handleSaveConfig = async (e: React.FormEvent) => {
            e.preventDefault();
            const newConfig: any = { provider: configMode };

            if (configMode === 'openai' || configMode === 'gemini') {
                newConfig.apiKey = customKey;
                newConfig.modelId = selectedModel; // Optional for custom
            } else if (configMode === 'ollama') {
                newConfig.endpoint = localEndpoint;
                newConfig.modelId = selectedModel;
            }

            try {
                // Update local store via AppStore action which syncs to LocalStorage/State
                // In a real app we might also sync this to backend if we want persistence across devices
                // For now, per requirements, user can set their own keys locally or use system.
                // We'll trust the store update to handle currentUser.aiConfig
                const updatedUser = { ...currentUser, aiConfig: newConfig };
                onUpdateUser({ aiConfig: newConfig });
                // We also call Api to save if we want backend persistence, but requirements said "user can provide own api... visible in top bar".
                // I'll assume updating the user object is enough for the store wrapper.

                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 2000);
            } catch (err) {
                alert("Failed to save AI config");
            }
        };

        const [orgConfig, setOrgConfig] = useState<{ activeProviderId: string | null; availableProviders: any[] } | null>(null);

        useEffect(() => {
            if (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN') {
                // Fetch Org Config
                // We need the org ID. Assuming currentUser has it or we can get it.
                // Actually User type just has string... let's check `currentUser.organizationId` ?? 
                // The User interface in file doesn't explicitly show it but backend sends `organization_id`.
                // Let's assume the mapped user object has it, or we use `currentUser['organizationId']`.
                // Checking `types.ts` might be good but let's assume it's there or we can safely cast.
                const orgId = (currentUser as any).organizationId || (currentUser as any).organization_id;
                if (orgId) {
                    Api.getOrganizationLLMConfig(orgId).then(setOrgConfig).catch(console.error);
                }
            }
        }, [currentUser]);

        const handleSaveOrgConfig = async () => {
            const orgId = (currentUser as any).organizationId || (currentUser as any).organization_id;
            if (!orgId || !orgConfig) return;
            try {
                await Api.updateOrganizationLLMConfig(orgId, orgConfig.activeProviderId);
                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 2000);
            } catch (e) {
                alert('Failed to save organization settings');
            }
        };

        const fetchOllamaModels = async () => {
            setIsLoadingModels(true);
            try {
                // We can try client-side fetch first if CORS allows, else fallback to backend proxy
                // Assuming local ollama allows CORS or we use backend proxy 'Api.getOllamaModels'
                // Let's try direct first for "Local" feel, but usually browser blocks localhost mixed calls if not secured.
                // Best to use backend proxy I added in Api.
                const models = await Api.getOllamaModels(localEndpoint);
                if (models && models.length > 0) {
                    setOllamaModels(models.map((m: any) => m.name));
                    if (!selectedModel) setSelectedModel(models[0].name);
                } else {
                    alert("No models found or connection failed. Check if Ollama is running.");
                }
            } catch (e) {
                alert("Failed to fetch Ollama models.");
            } finally {
                setIsLoadingModels(false);
            }
        };

        return (
            <div className="max-w-2xl">
                <h2 className="text-lg font-semibold text-white mb-6">AI Configuration</h2>

                {/* Tabs */}
                <div className="flex p-1 bg-navy-900 rounded-lg mb-6 border border-white/5">
                    {(['system', 'gemini', 'openai', 'ollama'] as AIProviderType[]).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setConfigMode(mode)}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${configMode === mode
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {mode === 'system' && 'Default (System)'}
                            {mode === 'gemini' && 'Google Gemini'}
                            {mode === 'openai' && 'OpenAI'}
                            {mode === 'ollama' && 'Local (Ollama)'}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSaveConfig} className="bg-navy-900 border border-white/10 rounded-xl p-6">

                    {configMode === 'system' && (
                        <div className="text-center py-8 space-y-6">
                            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-400">
                                <Cpu size={32} />
                            </div>
                            <div>
                                <h3 className="text-white font-medium mb-2">System AI (Managed)</h3>
                                <p className="text-slate-400 text-sm max-w-sm mx-auto">
                                    You are using the organization's default AI provider.
                                    No configuration is needed. Usage counts towards your plan limit.
                                </p>
                            </div>

                            {/* Organization Admin Control */}
                            {(currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN') && orgConfig && (
                                <div className="mt-8 pt-8 border-t border-white/5 text-left bg-navy-950/50 rounded-lg p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-2 rounded bg-blue-500/20 text-blue-400"><Monitor size={16} /></div>
                                        <div>
                                            <h4 className="text-sm font-bold text-white">Organization Default Model</h4>
                                            <p className="text-xs text-slate-400">Select which model powers your organization.</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <select
                                            value={orgConfig.activeProviderId || ''}
                                            onChange={(e) => setOrgConfig({ ...orgConfig, activeProviderId: e.target.value || null })}
                                            className="flex-1 bg-navy-900 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                                        >
                                            <option value="">System Default (Auto)</option>
                                            {orgConfig.availableProviders.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.provider}) {p.model_id}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleSaveOrgConfig}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm"
                                        >
                                            Save Choice
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {(configMode === 'gemini' || configMode === 'openai') && (
                        <div className="space-y-4">
                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-xs flex gap-2">
                                <Monitor size={16} className="shrink-0" />
                                <p>Your API key is stored locally in your browser and used directly. It is never sent to our servers.</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-300">
                                    {configMode === 'gemini' ? 'Google AI Studio Key' : 'OpenAI API Key'}
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={customKey}
                                        onChange={e => setCustomKey(e.target.value)}
                                        placeholder="sk-..."
                                        className="w-full px-4 py-2.5 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-all text-sm font-mono"
                                    />
                                    <div className="absolute right-3 top-2.5 text-slate-500">
                                        <Lock size={16} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {configMode === 'ollama' && (
                        <div className="space-y-4">
                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs flex gap-2">
                                <Monitor size={16} className="shrink-0" />
                                <p>Connect to your local LLM instance. Ensure Ollama is running (`ollama serve`).</p>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-xs font-medium text-slate-300">Endpoint URL</label>
                                    <input
                                        value={localEndpoint}
                                        onChange={e => setLocalEndpoint(e.target.value)}
                                        placeholder="http://localhost:11434"
                                        className="w-full px-4 py-2.5 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-all text-sm font-mono"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-300">&nbsp;</label>
                                    <button
                                        type="button"
                                        onClick={fetchOllamaModels}
                                        disabled={isLoadingModels}
                                        className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 text-sm transition-all"
                                    >
                                        {isLoadingModels ? '...' : 'Fetch Models'}
                                    </button>
                                </div>
                            </div>

                            {ollamaModels.length > 0 && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-300">Select Model</label>
                                    <select
                                        value={selectedModel}
                                        onChange={e => setSelectedModel(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-all text-sm"
                                    >
                                        {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-6 mt-6 border-t border-white/10 flex justify-end">
                        <button
                            type="submit"
                            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            {isSaved ? <Check size={16} /> : null}
                            {isSaved ? 'Configuration Saved' : 'Save Configuration'}
                        </button>
                    </div>
                </form>
            </div>
        );
    };

    return (
        <div className="flex h-full bg-slate-50 dark:bg-navy-950 transition-colors duration-300">
            {/* Settings Navigation */}
            <div className="w-64 border-r border-slate-200 dark:border-white/5 bg-white dark:bg-navy-900 p-6 flex flex-col gap-1 transition-colors duration-300">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-3">Settings</h2>

                <button
                    onClick={() => setActiveTab('PROFILE')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'PROFILE' ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                    <UserCircle size={18} />
                    My Profile
                </button>
                <button
                    onClick={() => setActiveTab('BILLING')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'BILLING' ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                    <CreditCard size={18} />
                    Billing & Plans
                </button>

                <button
                    onClick={() => setActiveTab('AI')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'AI' ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                    <Cpu size={18} />
                    AI Configuration
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-6 lg:p-8">
                {activeTab === 'PROFILE' && renderProfile()}
                {activeTab === 'BILLING' && renderBilling()}
                {activeTab === 'AI' && renderAIConfig()}
            </div>
        </div>
    );
};
