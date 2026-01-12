/**
 * PaymentMethodsPanel - Manage payment methods with Stripe Elements
 *
 * Features:
 * - List saved payment methods
 * - Add new card via Stripe Elements
 * - Set default payment method
 * - Remove payment methods
 */

import { AlertCircle, Check, CreditCard, Loader2, Plus, Shield, Star, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { AddCardModal } from './AddCardModal';

interface PaymentMethod {
    id: string;
    stripe_payment_method_id: string;
    type: string;
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    holder_name: string | null;
    is_default: number;
    created_at: string;
}

interface PaymentMethodsPanelProps {
    organizationId?: string;
    onPaymentMethodAdded?: () => void;
    compact?: boolean;
}

const getBrandIcon = (brand: string): string => {
    const brandIcons: Record<string, string> = {
        visa: '💳 Visa',
        mastercard: '💳 Mastercard',
        amex: '💳 Amex',
        discover: '💳 Discover',
        diners: '💳 Diners',
        jcb: '💳 JCB',
        unionpay: '💳 UnionPay',
    };
    return brandIcons[brand?.toLowerCase()] || '💳 Card';
};

const getBrandColor = (brand: string): string => {
    const brandColors: Record<string, string> = {
        visa: 'bg-blue-500',
        mastercard: 'bg-orange-500',
        amex: 'bg-indigo-500',
        discover: 'bg-amber-500',
        default: 'bg-slate-500',
    };
    return brandColors[brand?.toLowerCase()] || brandColors.default;
};

export const PaymentMethodsPanel: React.FC<PaymentMethodsPanelProps> = ({ onPaymentMethodAdded, compact = false }) => {
    const { t } = useTranslation();
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [settingDefault, setSettingDefault] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);

    const fetchPaymentMethods = useCallback(async () => {
        try {
            setLoading(true);
            const data = await Api.getPaymentMethods();
            setPaymentMethods(data.paymentMethods || []);
        } catch (error) {
            console.error('Failed to fetch payment methods:', error);
            toast.error(t('billing.paymentMethods.fetchError', 'Failed to load payment methods'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchPaymentMethods();
    }, [fetchPaymentMethods]);

    const handleSetDefault = async (paymentMethodId: string) => {
        try {
            setSettingDefault(paymentMethodId);
            await Api.setDefaultPaymentMethod(paymentMethodId);
            toast.success(t('billing.paymentMethods.defaultSet', 'Default payment method updated'));
            await fetchPaymentMethods();
        } catch (error) {
            console.error('Failed to set default payment method:', error);
            toast.error(t('billing.paymentMethods.defaultError', 'Failed to update default'));
        } finally {
            setSettingDefault(null);
        }
    };

    const handleRemove = async (paymentMethodId: string) => {
        if (
            !confirm(t('billing.paymentMethods.removeConfirm', 'Are you sure you want to remove this payment method?'))
        ) {
            return;
        }

        try {
            setRemoving(paymentMethodId);
            await Api.removePaymentMethod(paymentMethodId);
            toast.success(t('billing.paymentMethods.removed', 'Payment method removed'));
            await fetchPaymentMethods();
        } catch (error) {
            console.error('Failed to remove payment method:', error);
            toast.error(t('billing.paymentMethods.removeError', 'Failed to remove payment method'));
        } finally {
            setRemoving(null);
        }
    };

    const handleCardAdded = () => {
        setShowAddModal(false);
        fetchPaymentMethods();
        onPaymentMethodAdded?.();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-purple-500" />
                        {t('billing.paymentMethods.title', 'Payment Methods')}
                    </h3>
                    {!compact && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {t('billing.paymentMethods.description', 'Manage your saved payment methods')}
                        </p>
                    )}
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    {t('billing.paymentMethods.add', 'Add Card')}
                </button>
            </div>

            {/* Security Note */}
            {!compact && (
                <div className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                    <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                        {t(
                            'billing.paymentMethods.securityNote',
                            'Your payment information is securely processed by Stripe. We never store your full card details.',
                        )}
                    </p>
                </div>
            )}

            {/* Payment Methods List */}
            {paymentMethods.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                    <CreditCard className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 mb-4">
                        {t('billing.paymentMethods.empty', 'No payment methods saved')}
                    </p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                        {t('billing.paymentMethods.addFirst', 'Add Your First Card')}
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {paymentMethods.map((pm) => (
                        <div
                            key={pm.id}
                            className={`p-4 rounded-xl border transition-all ${
                                pm.is_default
                                    ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30'
                                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/30'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {/* Card Brand Icon */}
                                    <div
                                        className={`w-12 h-8 ${getBrandColor(pm.brand)} rounded-md flex items-center justify-center text-white text-xs font-bold uppercase`}
                                    >
                                        {pm.brand?.slice(0, 4) || 'CARD'}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-slate-900 dark:text-white">
                                                •••• •••• •••• {pm.last4}
                                            </p>
                                            {pm.is_default === 1 && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">
                                                    <Star className="w-3 h-3" />
                                                    {t('billing.paymentMethods.default', 'Default')}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {pm.holder_name && `${pm.holder_name} • `}
                                            {t('billing.paymentMethods.expires', 'Expires')}{' '}
                                            {pm.exp_month?.toString().padStart(2, '0')}/{pm.exp_year}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {pm.is_default !== 1 && (
                                        <button
                                            onClick={() => handleSetDefault(pm.id)}
                                            disabled={settingDefault === pm.id}
                                            className="px-3 py-1.5 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {settingDefault === pm.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                t('billing.paymentMethods.setDefault', 'Set Default')
                                            )}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleRemove(pm.id)}
                                        disabled={removing === pm.id}
                                        className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {removing === pm.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Card Modal */}
            {showAddModal && <AddCardModal onClose={() => setShowAddModal(false)} onSuccess={handleCardAdded} />}
        </div>
    );
};

export default PaymentMethodsPanel;

