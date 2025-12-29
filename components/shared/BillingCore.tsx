import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { Api } from '../../services/api';
import { CreditCard, Globe, Cpu, UserCircle, TrendingUp, Package, DollarSign } from 'lucide-react';

export interface BillingCoreProps {
    mode: 'user' | 'org-admin' | 'platform';
    currentUser?: User;
    organizationId?: string;
    showCurrentPlan?: boolean;
    showUsageMeters?: boolean;
    showAvailablePlans?: boolean;
    showInvoices?: boolean;
    showUserLicense?: boolean;
    className?: string;
}

interface BillingData {
    billing?: {
        subscription_plan_id?: string;
        status?: string;
        current_period_end?: string;
    };
    usage?: {
        tokensUsed?: number;
        tokenLimit?: number;
        storageUsed?: number;
        storageLimit?: number;
    };
}

interface Plan {
    id: string;
    name: string;
    price_monthly: number;
    token_limit: number;
    storage_limit_gb: number;
    token_overage_rate: number;
    storage_overage_rate: number;
    features?: string;
    is_active: boolean;
}

interface Invoice {
    id: string;
    created_at: string;
    amount_paid: number;
    status: string;
}

// Reusable Usage Meter Component
export const UsageMeter: React.FC<{
    title: string;
    subtitle: string;
    used: number;
    limit: number;
    formatUsed?: (val: number) => string;
    formatLimit?: (val: number) => string;
    icon: React.ReactNode;
    colorClass: string;
}> = ({ title, subtitle, used, limit, formatUsed, formatLimit, icon, colorClass }) => {
    const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;
    const usedStr = formatUsed ? formatUsed(used) : used.toLocaleString();
    const limitStr = formatLimit ? formatLimit(limit) : limit.toLocaleString();
    
    return (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center`}>
                    {icon}
                </div>
                <div>
                    <h4 className="text-slate-800 dark:text-white font-medium">{title}</h4>
                    <p className="text-xs text-slate-500">{subtitle}</p>
                </div>
            </div>
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">
                        {usedStr} / {limitStr}
                    </span>
                    <span className={`font-medium ${percentage >= 80 ? 'text-orange-500 dark:text-orange-400' : 'text-slate-600 dark:text-slate-300'}`}>
                        {percentage}%
                    </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-navy-950 rounded-full h-2.5 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${
                            percentage >= 95 ? 'bg-red-500' :
                            percentage >= 80 ? 'bg-orange-500' :
                            'bg-purple-600'
                        }`}
                        style={{ width: `${Math.min(100, percentage)}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

// Plan Card Component
export const PlanCard: React.FC<{
    plan: Plan;
    isCurrentPlan: boolean;
    onSelect?: (planId: string) => void;
    isSelecting?: boolean;
    canSelect?: boolean;
}> = ({ plan, isCurrentPlan, onSelect, isSelecting, canSelect = true }) => {
    return (
        <div
            className={`rounded-xl p-5 border transition-all ${
                isCurrentPlan
                    ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-500/50'
                    : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/30'
            }`}
        >
            <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-1">{plan.name}</h4>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-3">
                ${plan.price_monthly}<span className="text-sm text-slate-500">/mo</span>
            </p>
            <ul className="text-sm text-slate-400 space-y-1 mb-4">
                <li>• {(plan.token_limit / 1000).toFixed(0)}K tokens/month</li>
                <li>• {plan.storage_limit_gb} GB storage</li>
                <li className="text-xs text-slate-500">
                    Overage: ${plan.token_overage_rate}/1K • ${plan.storage_overage_rate}/GB
                </li>
            </ul>

            {/* Plan Features */}
            {plan.features && (() => {
                try {
                    const feats = JSON.parse(plan.features);
                    const entries = Object.entries(feats);
                    if (entries.length === 0) return null;
                    return (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 mb-4">
                            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
                                {entries.map(([key, val]) => (
                                    <li key={key} className="flex justify-between items-start">
                                        <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                                        <span className="text-slate-700 dark:text-slate-200 font-medium text-right max-w-[50%] break-words">
                                            {String(val) === 'true' ? 'Yes' : String(val) === 'false' ? 'No' : String(val)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                } catch (e) { return null; }
            })()}
            
            {isCurrentPlan ? (
                <div className="w-full py-2 rounded-lg text-center text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
                    Current Plan
                </div>
            ) : canSelect && onSelect ? (
                <button
                    onClick={() => onSelect(plan.id)}
                    disabled={isSelecting}
                    className="w-full py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50"
                >
                    {isSelecting ? 'Processing...' : 'Select Plan'}
                </button>
            ) : null}
        </div>
    );
};

// Invoice Table Component
export const InvoiceTable: React.FC<{
    invoices: Invoice[];
    limit?: number;
}> = ({ invoices, limit = 5 }) => {
    if (invoices.length === 0) return null;
    
    return (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-slate-50 dark:bg-navy-950 text-slate-500 dark:text-slate-400 text-xs uppercase">
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Amount</th>
                        <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {invoices.slice(0, limit).map(inv => (
                        <tr key={inv.id} className="text-slate-700 dark:text-slate-300">
                            <td className="px-4 py-3">
                                {new Date(inv.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 font-mono">
                                ${(inv.amount_paid / 100).toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    inv.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
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
    );
};

// Main BillingCore Component
export const BillingCore: React.FC<BillingCoreProps> = ({
    mode,
    currentUser,
    organizationId,
    showCurrentPlan = true,
    showUsageMeters = true,
    showAvailablePlans = true,
    showInvoices = true,
    showUserLicense = false,
    className = ''
}) => {
    const [billingData, setBillingData] = useState<BillingData | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [userPlans, setUserPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [subscribing, setSubscribing] = useState(false);

    const canManagePlans = mode === 'org-admin' || mode === 'platform';

    useEffect(() => {
        const fetchBillingData = async () => {
            try {
                const [current, plansData, invoicesData] = await Promise.all([
                    Api.getCurrentBilling().catch(() => null),
                    Api.getSubscriptionPlans().catch(() => []),
                    Api.getInvoices().catch(() => [])
                ]);
                setBillingData(current);
                setPlans(plansData);
                setInvoices(invoicesData);
            } catch (err) {
                console.error('Failed to fetch billing data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchBillingData();
        
        // Fetch user plans for license display
        if (showUserLicense) {
            Api.getUserPlans().then(setUserPlans).catch(err => console.error('Failed to fetch user plans', err));
        }
    }, [showUserLicense]);

    const handleSelectPlan = async (planId: string) => {
        if (!canManagePlans) {
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    const usage = billingData?.usage || {};
    const tokenPercentage = (usage.tokenLimit || 0) > 0 ? Math.round(((usage.tokensUsed || 0) / (usage.tokenLimit || 1)) * 100) : 0;
    const currentPlanId = billingData?.billing?.subscription_plan_id;
    const currentPlan = plans.find(p => p.id === currentPlanId);
    const userLicenseId = currentUser?.licensePlanId;
    const userLicense = userPlans.find(p => p.id === userLicenseId);

    return (
        <div className={`space-y-8 ${className}`}>
            {/* User License Card */}
            {showUserLicense && currentUser && (
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <UserCircle size={24} />
                            </div>
                            <div>
                                <h3 className="text-slate-800 dark:text-white font-semibold text-lg">Your User License</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">
                                    {userLicense ? userLicense.name : 'Standard License'}
                                    {userLicense && <span className="text-slate-500 ml-2">(${userLicense.price_monthly}/mo)</span>}
                                </p>
                            </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            userLicense 
                                ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' 
                                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5'
                        }`}>
                            {userLicense ? 'Active' : 'Default'}
                        </span>
                    </div>
                </div>
            )}

            {/* Current Plan Card */}
            {showCurrentPlan && currentPlan && (
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
                        {canManagePlans && billingData?.billing?.status === 'active' && (
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
            {showUsageMeters && (
                <div>
                    <h3 className="text-md font-semibold text-slate-800 dark:text-white mb-4">Usage This Period</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <UsageMeter
                            title="Token Usage"
                            subtitle="AI requests this month"
                            used={usage.tokensUsed || 0}
                            limit={usage.tokenLimit || 0}
                            icon={<Cpu size={20} className="text-indigo-600 dark:text-indigo-400" />}
                            colorClass="bg-indigo-100 dark:bg-indigo-500/20"
                        />
                        <UsageMeter
                            title="Storage Usage"
                            subtitle="Documents & files"
                            used={usage.storageUsed || 0}
                            limit={usage.storageLimit || 0}
                            formatUsed={(val) => `${val.toFixed(2)} GB`}
                            formatLimit={(val) => `${val} GB`}
                            icon={<Globe size={20} className="text-emerald-600 dark:text-emerald-400" />}
                            colorClass="bg-emerald-100 dark:bg-emerald-500/20"
                        />
                    </div>
                </div>
            )}

            {/* Available Plans */}
            {showAvailablePlans && canManagePlans && (
                <div>
                    <h3 className="text-md font-semibold text-slate-800 dark:text-white mb-4">Available Plans</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {plans.filter(p => p.is_active).map(plan => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                isCurrentPlan={plan.id === currentPlanId}
                                onSelect={handleSelectPlan}
                                isSelecting={subscribing}
                                canSelect={canManagePlans}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Invoices */}
            {showInvoices && invoices.length > 0 && (
                <div>
                    <h3 className="text-md font-semibold text-slate-800 dark:text-white mb-4">Invoice History</h3>
                    <InvoiceTable invoices={invoices} />
                </div>
            )}
        </div>
    );
};

export default BillingCore;

