/**
 * CommissionView
 *
 * Commission portal with AI-powered intelligence and PMO compliance
 * Aligned with BENEFITS_REALIZATION PMO domain
 */

import React, { useCallback, useState } from 'react';
import { ChartBar, FileText, HelpCircle, Send } from 'lucide-react';

import { SplitLayout } from '../../components/layout/SplitLayout';
import { CommissionIntelligence } from '../../components/Partner/CommissionIntelligence';
import { PMODomainBadge } from '../../components/Partner/EcosystemAnalytics';
import { usePartnerEcosystem } from '../../hooks/usePartnerEcosystem';
import { AppView } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { PARTNER_PMO_MAPPING } from './types';

const inquiryTypes = ['Commission inquiry', 'Payment update', 'Statement question', 'Other'];

export const CommissionView: React.FC = () => {
    const { setCurrentView } = useAppStore();
    const { deals, statements, loading, submitCommissionInquiry } = usePartnerEcosystem();
    const [selectedType, setSelectedType] = useState(inquiryTypes[0]);
    const [inquiryMessage, setInquiryMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const navigate = useCallback((view: AppView) => () => setCurrentView(view), [setCurrentView]);

    const handleSubmitInquiry = useCallback(async () => {
        if (!inquiryMessage.trim()) return;

        setIsSubmitting(true);
        try {
            await submitCommissionInquiry(selectedType, inquiryMessage);
            setInquiryMessage('');
            // Show success toast
        } catch (err) {
            // Show error toast
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedType, inquiryMessage, submitCommissionInquiry]);

    const handleViewDeal = useCallback((dealId: string) => {
        console.log('[Partner] View deal:', dealId);
        // Open deal detail modal or navigate
    }, []);

    return (
        <SplitLayout
            title="Commission Portal"
            subtitle="AI-powered commission intelligence z PMO compliance"
            currentView={AppView.PARTNER_COMMISSION}
        >
            <div className="space-y-6 overflow-y-auto px-6 py-4">
                {/* Commission Intelligence */}
                <CommissionIntelligence
                    deals={deals}
                    statements={statements}
                    onViewDeal={handleViewDeal}
                    onSubmitInquiry={() => document.getElementById('inquiry-form')?.scrollIntoView({ behavior: 'smooth' })}
                />

                {/* Statements Section */}
                <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 dark:border-white/5 dark:bg-navy-900/60">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/10">
                                <FileText size={20} className="text-slate-600 dark:text-slate-300" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-navy-900 dark:text-white">Commission Statements</h3>
                                <p className="text-xs text-slate-500">Historical statements and payouts</p>
                            </div>
                        </div>
                        <PMODomainBadge mapping={PARTNER_PMO_MAPPING.COMMISSION_SETTLEMENT} />
                    </div>

                    <div className="space-y-3">
                        {statements.map((statement) => (
                            <div
                                key={statement.id}
                                className="flex items-center justify-between rounded-2xl border border-slate-100 p-4 dark:border-white/5"
                            >
                                <div>
                                    <div className="font-semibold text-navy-900 dark:text-white">{statement.period}</div>
                                    <div className="text-xs text-slate-500">
                                        {statement.deals.length} deal{statement.deals.length !== 1 ? 's' : ''}
                                        {statement.paidAt && ` · Paid ${new Date(statement.paidAt).toLocaleDateString()}`}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="font-semibold text-navy-900 dark:text-white">
                                            ${statement.totalAmount.toLocaleString()}
                                        </div>
                                        <div className={`text-xs ${
                                            statement.status === 'PAID'
                                                ? 'text-emerald-500'
                                                : statement.status === 'APPROVED'
                                                  ? 'text-blue-500'
                                                  : 'text-amber-500'
                                        }`}>
                                            {statement.status}
                                        </div>
                                    </div>
                                    <button className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand/30 dark:border-white/10 dark:text-slate-300">
                                        View
                                    </button>
                                </div>
                            </div>
                        ))}

                        {statements.length === 0 && (
                            <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-navy-950/40">
                                No commission statements yet
                            </div>
                        )}
                    </div>
                </div>

                {/* Inquiry Form */}
                <div
                    id="inquiry-form"
                    className="rounded-3xl border border-slate-200 bg-white/90 p-6 dark:border-white/5 dark:bg-navy-900/60"
                >
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
                            <ChartBar size={20} className="text-brand" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-navy-900 dark:text-white">Commission Inquiry</h3>
                            <p className="text-xs text-slate-500">Submit questions about statements or payments</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Inquiry Type
                            </label>
                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-navy-900 dark:text-white"
                            >
                                {inquiryTypes.map((type) => (
                                    <option key={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Message
                            </label>
                            <textarea
                                rows={4}
                                value={inquiryMessage}
                                onChange={(e) => setInquiryMessage(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-navy-900 dark:text-white"
                                placeholder="Describe your inquiry about commission, payments, or statements..."
                            />
                        </div>

                        <button
                            onClick={handleSubmitInquiry}
                            disabled={isSubmitting || !inquiryMessage.trim()}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Send size={16} />
                            {isSubmitting ? 'Submitting...' : 'Submit Inquiry'}
                        </button>
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-6 dark:border-white/5 dark:bg-navy-900/40">
                    <div className="mb-4 flex items-center gap-2">
                        <HelpCircle size={18} className="text-slate-400" />
                        <h3 className="font-semibold text-navy-900 dark:text-white">Commission FAQ</h3>
                    </div>

                    <div className="space-y-4 text-sm">
                        <FaqItem
                            question="Jak działa process payouts?"
                            answer="Commission statements są generowane kwartalnie. Po zamknięciu kwartału, Finance Team weryfikuje wszystkie deals i generuje statement. Payout następuje w ciągu 30 dni od approval."
                        />
                        <FaqItem
                            question="Co zrobić jeśli kwota jest nieprawidłowa?"
                            answer="Użyj formularza inquiry powyżej, wybierając 'Statement question'. Dołącz numer statement i szczegóły rozbieżności. Finance Team odpowie w ciągu 2 dni roboczych."
                        />
                        <FaqItem
                            question="Jak są mapowane deals do PMO standards?"
                            answer="Każdy deal registration jest automatycznie mapowany do GOVERNANCE_DECISION_MAKING (ISO 21500 Clause 4.3.4), a commission settlement do BENEFITS_REALIZATION (Clause 4.4.1)."
                        />
                    </div>

                    <button
                        onClick={navigate(AppView.PARTNER_RESOURCES)}
                        className="mt-4 text-sm font-semibold text-brand hover:underline"
                    >
                        View All FAQs →
                    </button>
                </div>
            </div>
        </SplitLayout>
    );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface FaqItemProps {
    question: string;
    answer: string;
}

const FaqItem: React.FC<FaqItemProps> = ({ question, answer }) => (
    <div className="rounded-2xl bg-white p-4 dark:bg-navy-900/60">
        <div className="font-semibold text-navy-900 dark:text-white">{question}</div>
        <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">{answer}</div>
    </div>
);

export default CommissionView;
