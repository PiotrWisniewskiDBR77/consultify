/**
 * BillingSubscriptionModule - Billing & Subscription Management
 * 
 * Features:
 * - Subscription details
 * - Usage statistics
 * - Billing history
 * - Payment methods management
 * - Invoice downloads
 * - Upgrade/downgrade options
 * - Usage limits display
 */

import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTranslation } from 'react-i18next';
import {
    CreditCard,
    Download,
    FileText,
    ArrowUpCircle,
    ArrowDownCircle,
    Plus,
    Trash2,
    Calendar,
    BarChart3,
    Loader2,
    Check,
    AlertCircle,
    Crown,
    Zap,
    Users
} from 'lucide-react';
import { Api } from '../../../services/api';
import { toast } from 'react-hot-toast';
import { InfoButton } from '../../shared/InfoButton';

interface BillingSubscriptionModuleProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

interface Subscription {
    plan: string;
    status: 'active' | 'trialing' | 'past_due' | 'cancelled';
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
}

interface UsageStats {
    users: { used: number; limit: number };
    projects: { used: number; limit: number };
    storage: { used: number; limit: number; unit: string };
    aiTokens: { used: number; limit: number };
}

interface Invoice {
    id: string;
    date: string;
    amount: number;
    status: string;
    downloadUrl: string;
}

interface PaymentMethod {
    id: string;
    type: 'card' | 'paypal' | 'bank';
    last4?: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    isDefault: boolean;
}

const plans = [
    { id: 'free', name: 'Free', price: 0, features: ['5 users', '3 projects', '1GB storage', '10K AI tokens'] },
    { id: 'pro', name: 'Professional', price: 29, features: ['25 users', 'Unlimited projects', '50GB storage', '500K AI tokens'] },
    { id: 'business', name: 'Business', price: 79, features: ['100 users', 'Unlimited projects', '500GB storage', '2M AI tokens', 'Priority support'] },
    { id: 'enterprise', name: 'Enterprise', price: null, features: ['Unlimited users', 'Unlimited everything', 'Custom integrations', 'Dedicated support', 'SLA'] }
];

export const BillingSubscriptionModule: React.FC<BillingSubscriptionModuleProps> = ({
    currentUser,
    onUpdateUser
}) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [usage, setUsage] = useState<UsageStats | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'payment' | 'usage'>('overview');

    useEffect(() => {
        loadData();
    }, [currentUser.id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [subRes, usageRes, invoicesRes, paymentRes] = await Promise.all([
                Api.get('/api/billing/subscription').catch(() => ({ data: null })),
                Api.get('/api/billing/usage').catch(() => ({ data: null })),
                Api.get('/api/billing/invoices').catch(() => ({ data: [] })),
                Api.get('/api/billing/payment-methods').catch(() => ({ data: [] }))
            ]);

            // Use real API data
            if (subRes.data) {
                setSubscription(subRes.data);
            } else {
                setSubscription(null);
            }

            if (usageRes.data) {
                setUsage(usageRes.data);
            } else {
                setUsage(null);
            }

            if (invoicesRes.data) {
                setInvoices(invoicesRes.data);
            } else {
                setInvoices([]);
            }

            if (paymentRes.data) {
                setPaymentMethods(paymentRes.data);
            } else {
                setPaymentMethods([]);
            }

        } catch (error) {
            console.error('Error loading billing data:', error);
        } finally {
            setLoading(false);
        }
    };

    const UsageBar: React.FC<{ used: number; limit: number; label: string; unit?: string }> = ({ used, limit, label, unit = '' }) => {
        const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
        const isUnlimited = limit < 0;

        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{label}</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                        {used.toLocaleString()}{unit} {isUnlimited ? '(unlimited)' : `/ ${limit.toLocaleString()}${unit}`}
                    </span>
                </div>
                {!isUnlimited && (
                    <div className="h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-emerald-600" />
            </div>
        );
    }

    const currentPlan = plans.find(p => p.id === subscription?.plan);

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            <InfoButton cardId="settings-billing" position="top-right" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <CreditCard size={28} className="text-emerald-500" />
                        Billing & Subscription
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Manage your subscription and billing
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-4">
                {[
                    { id: 'overview', label: 'Overview', icon: Crown },
                    { id: 'usage', label: 'Usage', icon: BarChart3 },
                    { id: 'invoices', label: 'Invoices', icon: FileText },
                    { id: 'payment', label: 'Payment', icon: CreditCard }
                ].map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <>
                    {/* Current Plan */}
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-emerald-100">Current Plan</p>
                                <h3 className="text-3xl font-bold mt-1">{currentPlan?.name}</h3>
                                <p className="text-emerald-100 mt-2">
                                    Renews on {new Date(subscription?.currentPeriodEnd || '').toLocaleDateString()}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-4xl font-bold">${currentPlan?.price || 0}</p>
                                <p className="text-emerald-100">/month</p>
                            </div>
                        </div>
                    </div>

                    {/* Plan Comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {plans.map(plan => (
                            <div
                                key={plan.id}
                                className={`p-4 rounded-xl border-2 ${plan.id === subscription?.plan
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold text-slate-900 dark:text-white">{plan.name}</h4>
                                    {plan.id === subscription?.plan && (
                                        <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">Current</span>
                                    )}
                                </div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                                    {plan.price !== null ? `$${plan.price}/mo` : 'Custom'}
                                </p>
                                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                    {plan.features.map((f, i) => (
                                        <li key={i} className="flex items-center gap-2">
                                            <Check size={14} className="text-emerald-500" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                {plan.id !== subscription?.plan && (
                                    <button
                                        className="w-full mt-4 py-2 px-4 border border-emerald-500 text-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-sm font-medium transition-colors"
                                    >
                                        {plans.indexOf(plan) > plans.findIndex(p => p.id === subscription?.plan) ? 'Upgrade' : 'Downgrade'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Usage Tab */}
            {activeTab === 'usage' && usage && (
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 space-y-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Current Usage</h3>

                    <div className="space-y-6">
                        <UsageBar used={usage.users.used} limit={usage.users.limit} label="Team Members" />
                        <UsageBar used={usage.projects.used} limit={usage.projects.limit} label="Projects" />
                        <UsageBar used={usage.storage.used} limit={usage.storage.limit} label="Storage" unit={` ${usage.storage.unit}`} />
                        <UsageBar used={usage.aiTokens.used} limit={usage.aiTokens.limit} label="AI Tokens" />
                    </div>

                    <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            Need more resources? <button className="underline font-medium">Upgrade your plan</button>
                        </p>
                    </div>
                </div>
            )}

            {/* Invoices Tab */}
            {activeTab === 'invoices' && (
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10">
                        <h3 className="font-semibold text-slate-900 dark:text-white">Billing History</h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {invoices.map(invoice => (
                            <div key={invoice.id} className="px-6 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <FileText size={20} className="text-slate-400" />
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            Invoice {invoice.id}
                                        </p>
                                        <p className="text-sm text-slate-500">{new Date(invoice.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-slate-900 dark:text-white font-medium">${invoice.amount}</span>
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${invoice.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                        {invoice.status}
                                    </span>
                                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg">
                                        <Download size={16} className="text-slate-500" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Payment Tab */}
            {activeTab === 'payment' && (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-900 dark:text-white">Payment Methods</h3>
                            <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg">
                                <Plus size={16} />
                                Add Method
                            </button>
                        </div>

                        <div className="space-y-3">
                            {paymentMethods.map(method => (
                                <div
                                    key={method.id}
                                    className={`p-4 rounded-lg border-2 ${method.isDefault
                                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                                            : 'border-slate-200 dark:border-white/10'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <CreditCard size={24} className="text-slate-400" />
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {method.brand} •••• {method.last4}
                                                </p>
                                                <p className="text-sm text-slate-500">
                                                    Expires {method.expiryMonth}/{method.expiryYear}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {method.isDefault && (
                                                <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">Default</span>
                                            )}
                                            <button className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BillingSubscriptionModule;

