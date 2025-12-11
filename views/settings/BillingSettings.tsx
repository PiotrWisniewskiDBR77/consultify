import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { User } from '../../types';
import { CreditCard, Cpu, Globe } from 'lucide-react';

interface BillingSettingsProps {
    currentUser: User;
}

export const BillingSettings: React.FC<BillingSettingsProps> = ({ currentUser }) => {
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
