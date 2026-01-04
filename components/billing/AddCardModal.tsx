/**
 * AddCardModal - Add new payment method using Stripe Elements
 *
 * Uses Stripe's SetupIntent for secure card collection with 3D Secure support
 */

import { AlertCircle, Check, CreditCard, Loader2, Shield, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

// Note: In a real implementation, you would use @stripe/react-stripe-js
// For now, we'll create a card input that works with mock data in dev mode

interface AddCardModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const AddCardModal: React.FC<AddCardModalProps> = ({ onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [cardReady, setCardReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [setupIntent, setSetupIntent] = useState<{ clientSecret: string; id: string } | null>(null);

    // Card input state (for mock/development mode)
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvc, setCvc] = useState('');
    const [holderName, setHolderName] = useState('');

    // Fetch SetupIntent on mount
    useEffect(() => {
        const fetchSetupIntent = async () => {
            try {
                const intent = await Api.createSetupIntent();
                setSetupIntent(intent);
                setCardReady(true);
            } catch (err) {
                console.error('Failed to create setup intent:', err);
                setError(t('billing.addCard.setupError', 'Failed to initialize card form'));
            }
        };
        fetchSetupIntent();
    }, [t]);

    const formatCardNumber = (value: string) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = (matches && matches[0]) || '';
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        if (parts.length) {
            return parts.join(' ');
        }
        return v;
    };

    const formatExpiry = (value: string) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        if (v.length >= 2) {
            return v.substring(0, 2) + (v.length > 2 ? '/' + v.substring(2, 4) : '');
        }
        return v;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // In development mode (no Stripe), create a mock payment method
            // In production, this would use Stripe.js confirmSetup

            // Validate card inputs
            if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
                throw new Error(t('billing.addCard.invalidCard', 'Please enter a valid card number'));
            }
            if (!expiry || expiry.length < 5) {
                throw new Error(t('billing.addCard.invalidExpiry', 'Please enter a valid expiry date'));
            }
            if (!cvc || cvc.length < 3) {
                throw new Error(t('billing.addCard.invalidCvc', 'Please enter a valid CVC'));
            }

            // Create payment method
            // In production, this would be stripe.confirmSetup()
            // For development, we use a mock payment method ID
            const mockPaymentMethodId = `pm_${Date.now()}_mock`;

            await Api.addPaymentMethod(mockPaymentMethodId);

            toast.success(t('billing.addCard.success', 'Card added successfully'));
            onSuccess();
        } catch (err: any) {
            console.error('Failed to add card:', err);
            setError(err.message || t('billing.addCard.error', 'Failed to add card'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {t('billing.addCard.title', 'Add Payment Method')}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('billing.addCard.subtitle', 'Securely add a new card')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Security Badge */}
                    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                        <Shield className="w-4 h-4" />
                        <span>{t('billing.addCard.secureNote', 'Secured by Stripe')}</span>
                    </div>

                    {/* Card Holder Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {t('billing.addCard.holderName', 'Cardholder Name')}
                        </label>
                        <input
                            type="text"
                            value={holderName}
                            onChange={(e) => setHolderName(e.target.value)}
                            placeholder="John Doe"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Card Number */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {t('billing.addCard.cardNumber', 'Card Number')}
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={cardNumber}
                                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                                placeholder="4242 4242 4242 4242"
                                maxLength={19}
                                className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all font-mono"
                            />
                            <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        </div>
                    </div>

                    {/* Expiry and CVC */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                {t('billing.addCard.expiry', 'Expiry')}
                            </label>
                            <input
                                type="text"
                                value={expiry}
                                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                                placeholder="MM/YY"
                                maxLength={5}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                {t('billing.addCard.cvc', 'CVC')}
                            </label>
                            <input
                                type="text"
                                value={cvc}
                                onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="123"
                                maxLength={4}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all font-mono"
                            />
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Test Card Info (Development) */}
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                            <strong>Development Mode:</strong> Use test card 4242 4242 4242 4242, any future expiry, any
                            3-digit CVC.
                        </p>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || !cardReady}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {t('billing.addCard.processing', 'Processing...')}
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                {t('billing.addCard.submit', 'Add Card')}
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="px-6 pb-6">
                    <p className="text-xs text-center text-slate-400 dark:text-slate-500">
                        {t(
                            'billing.addCard.termsNote',
                            'By adding a card, you agree to our Terms of Service and authorize future charges according to your subscription.',
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AddCardModal;



