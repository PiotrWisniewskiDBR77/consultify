/**
 * PartnerPricingView
 *
 * Partner pricing landing page presenting partnership tiers (Bronze/Silver/Gold/Platinum),
 * commission structures, co-sell benefits, and advancement requirements.
 * Inspired by HubSpot partner program pages.
 *
 * PMO Standards: Each tier maps to relevant PMO domain (ISO 21500 / PMBOK 7 / PRINCE2)
 */

import { motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, HelpCircle, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';
import {
    PARTNER_BENEFITS,
    PARTNER_FAQS,
    PARTNER_TIERS,
    PartnerTier,
    TRUST_INDICATORS,
} from './partnerPricingData';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const PartnerPricingView: React.FC = () => {
    const { setCurrentView } = useAppStore();
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

    const handleNavigate = useCallback(
        (view: AppView) => () => setCurrentView(view),
        [setCurrentView],
    );

    const handleCtaClick = useCallback(
        (tier: PartnerTier) => {
            if (tier.id === 'PLATINUM') {
                // For Platinum, go to resources to contact PDM
                setCurrentView(AppView.PARTNER_RESOURCES);
            } else {
                // For other tiers, go to provider home to start onboarding
                setCurrentView(AppView.PARTNER_PROVIDER_HOME);
            }
        },
        [setCurrentView],
    );

    return (
        <div className="min-h-full bg-slate-50 dark:bg-navy-950">
            {/* Hero Section */}
            <section className="relative overflow-hidden bg-gradient-to-b from-purple-50 via-white to-slate-50 px-6 pb-16 pt-12 dark:from-navy-900 dark:via-navy-950 dark:to-navy-950">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent dark:from-purple-900/20" />
                
                <div className="relative mx-auto max-w-5xl text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                            <span className="h-2 w-2 rounded-full bg-purple-500" />
                            Partner Program
                        </span>

                        <h1 className="mt-6 text-4xl font-black tracking-tight text-navy-950 dark:text-white md:text-5xl">
                            Rozwijaj biznes{' '}
                            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                razem z Consultify
                            </span>
                        </h1>

                        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                            Dołącz do ekosystemu partnerów Consultify i uzyskaj dostęp do co-sell leads,
                            prowizji do 20%, dedykowanego wsparcia i narzędzi zgodnych z PMO standards.
                        </p>

                        <div className="mt-8 flex flex-wrap justify-center gap-4">
                            <button
                                onClick={handleNavigate(AppView.PARTNER_PROVIDER_HOME)}
                                className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/30 transition hover:bg-purple-500"
                            >
                                Rozpocznij współpracę
                                <ArrowRight size={18} />
                            </button>
                            <button
                                onClick={handleNavigate(AppView.PARTNER_LANDING)}
                                className="inline-flex items-center gap-2 rounded-full border-2 border-slate-300 px-6 py-3 text-sm font-bold text-navy-950 transition hover:border-purple-300 hover:bg-white dark:border-white/20 dark:text-white dark:hover:bg-white/5"
                            >
                                Poznaj program
                            </button>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Pricing Tiers */}
            <section className="px-6 py-16">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-12 text-center">
                        <h2 className="text-3xl font-black text-navy-950 dark:text-white">
                            Wybierz poziom partnerstwa
                        </h2>
                        <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
                            Każdy poziom oferuje progresywne korzyści. Awansuj automatycznie
                            spełniając wymagania programu.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {PARTNER_TIERS.map((tier, idx) => {
                            const Icon = tier.icon;
                            return (
                                <motion.div
                                    key={tier.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                                    className={`relative flex flex-col rounded-3xl p-6 ${
                                        tier.highlight
                                            ? 'bg-gradient-to-b from-purple-600 to-purple-700 text-white ring-4 ring-purple-500/50 shadow-2xl shadow-purple-500/20 scale-[1.02] z-10'
                                            : 'bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10'
                                    }`}
                                >
                                    {tier.badge && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-navy-950 shadow-lg">
                                                {tier.badge}
                                            </span>
                                        </div>
                                    )}

                                    {/* Header */}
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                                                tier.highlight
                                                    ? 'bg-white/20'
                                                    : 'bg-purple-100 dark:bg-purple-900/30'
                                            }`}
                                        >
                                            <Icon
                                                size={24}
                                                className={
                                                    tier.highlight
                                                        ? 'text-white'
                                                        : 'text-purple-600 dark:text-purple-400'
                                                }
                                            />
                                        </div>
                                        <div>
                                            <h3
                                                className={`text-xl font-black ${
                                                    tier.highlight
                                                        ? 'text-white'
                                                        : 'text-navy-950 dark:text-white'
                                                }`}
                                            >
                                                {tier.name}
                                            </h3>
                                            <p
                                                className={`text-xs ${
                                                    tier.highlight
                                                        ? 'text-purple-200'
                                                        : 'text-slate-500 dark:text-slate-400'
                                                }`}
                                            >
                                                {tier.subtitle}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Commission Rate */}
                                    <div className="mt-6">
                                        <div className="flex items-baseline gap-1">
                                            <span
                                                className={`text-4xl font-black ${
                                                    tier.highlight
                                                        ? 'text-white'
                                                        : 'text-navy-950 dark:text-white'
                                                }`}
                                            >
                                                {tier.commissionRate}%
                                            </span>
                                            <span
                                                className={`text-sm ${
                                                    tier.highlight
                                                        ? 'text-purple-200'
                                                        : 'text-slate-500 dark:text-slate-400'
                                                }`}
                                            >
                                                commission
                                            </span>
                                        </div>
                                        <p
                                            className={`mt-1 text-xs ${
                                                tier.highlight
                                                    ? 'text-purple-200'
                                                    : 'text-slate-500 dark:text-slate-400'
                                            }`}
                                        >
                                            Support SLA: {tier.supportSLA}
                                        </p>
                                    </div>

                                    {/* Description */}
                                    <p
                                        className={`mt-4 text-sm ${
                                            tier.highlight
                                                ? 'text-purple-100'
                                                : 'text-slate-600 dark:text-slate-400'
                                        }`}
                                    >
                                        {tier.description}
                                    </p>

                                    {/* Features */}
                                    <ul className="mt-6 flex-1 space-y-2">
                                        {tier.features.slice(0, 8).map((feature, fIdx) => (
                                            <li key={fIdx} className="flex items-start gap-2">
                                                {feature.included ? (
                                                    <Check
                                                        size={16}
                                                        className={`mt-0.5 flex-shrink-0 ${
                                                            tier.highlight
                                                                ? 'text-purple-200'
                                                                : 'text-green-500'
                                                        }`}
                                                    />
                                                ) : (
                                                    <X
                                                        size={16}
                                                        className={`mt-0.5 flex-shrink-0 ${
                                                            tier.highlight
                                                                ? 'text-purple-300/50'
                                                                : 'text-slate-300 dark:text-slate-600'
                                                        }`}
                                                    />
                                                )}
                                                <span
                                                    className={`text-xs ${
                                                        feature.included
                                                            ? tier.highlight
                                                                ? 'text-purple-100'
                                                                : 'text-slate-700 dark:text-slate-300'
                                                            : tier.highlight
                                                              ? 'text-purple-300/50'
                                                              : 'text-slate-400 dark:text-slate-500'
                                                    } ${feature.highlight ? 'font-semibold' : ''}`}
                                                >
                                                    {feature.name}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Requirements */}
                                    <div
                                        className={`mt-6 rounded-xl p-3 ${
                                            tier.highlight
                                                ? 'bg-white/10'
                                                : 'bg-slate-50 dark:bg-navy-950'
                                        }`}
                                    >
                                        <p
                                            className={`mb-2 text-xs font-semibold uppercase tracking-wide ${
                                                tier.highlight
                                                    ? 'text-purple-200'
                                                    : 'text-slate-500 dark:text-slate-400'
                                            }`}
                                        >
                                            Wymagania
                                        </p>
                                        <div className="space-y-1">
                                            {tier.requirements.map((req, rIdx) => (
                                                <div
                                                    key={rIdx}
                                                    className="flex items-center justify-between text-xs"
                                                >
                                                    <span
                                                        className={
                                                            tier.highlight
                                                                ? 'text-purple-200'
                                                                : 'text-slate-600 dark:text-slate-400'
                                                        }
                                                    >
                                                        {req.label}
                                                    </span>
                                                    <span
                                                        className={`font-semibold ${
                                                            tier.highlight
                                                                ? 'text-white'
                                                                : 'text-navy-950 dark:text-white'
                                                        }`}
                                                    >
                                                        {req.value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* CTA */}
                                    <button
                                        onClick={() => handleCtaClick(tier)}
                                        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
                                            tier.ctaVariant === 'primary'
                                                ? 'bg-white text-purple-700 hover:bg-purple-50 shadow-lg'
                                                : tier.ctaVariant === 'secondary'
                                                  ? 'bg-purple-600 text-white hover:bg-purple-500'
                                                  : 'border-2 border-slate-300 dark:border-white/20 text-navy-950 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        {tier.cta}
                                        <ArrowRight size={16} />
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Trust Indicators */}
                    <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-slate-500 dark:text-slate-400">
                        {TRUST_INDICATORS.map((indicator, idx) => {
                            const Icon = indicator.icon;
                            return (
                                <div key={idx} className="flex items-center gap-2">
                                    <Icon size={18} className="text-purple-500" />
                                    <span>{indicator.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="bg-white px-6 py-16 dark:bg-navy-900/50">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-12 text-center">
                        <h2 className="text-3xl font-black text-navy-950 dark:text-white">
                            Korzyści z partnerstwa
                        </h2>
                        <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
                            Dołącz do ekosystemu i skorzystaj z pełnego wsparcia w rozwijaniu biznesu
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {PARTNER_BENEFITS.map((benefit, idx) => {
                            const Icon = benefit.icon;
                            return (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-navy-900"
                                >
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                                        <Icon size={24} className="text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <h3 className="mt-4 text-lg font-bold text-navy-950 dark:text-white">
                                        {benefit.title}
                                    </h3>
                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                                        {benefit.description}
                                    </p>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="px-6 py-16">
                <div className="mx-auto max-w-3xl">
                    <div className="mb-12 text-center">
                        <h2 className="text-3xl font-black text-navy-950 dark:text-white">
                            Najczęściej zadawane pytania
                        </h2>
                        <p className="mt-4 text-slate-600 dark:text-slate-400">
                            Masz więcej pytań?{' '}
                            <button
                                onClick={handleNavigate(AppView.PARTNER_RESOURCES)}
                                className="text-purple-600 hover:underline"
                            >
                                Skontaktuj się z nami
                            </button>
                        </p>
                    </div>

                    <div className="space-y-4">
                        {PARTNER_FAQS.map((faq, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.05 }}
                                className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-navy-900"
                            >
                                <button
                                    onClick={() =>
                                        setExpandedFaq(expandedFaq === idx ? null : idx)
                                    }
                                    className="flex w-full items-center justify-between p-5 text-left"
                                >
                                    <div className="flex items-start gap-3">
                                        <HelpCircle
                                            size={20}
                                            className="mt-0.5 flex-shrink-0 text-purple-500"
                                        />
                                        <span className="font-bold text-navy-950 dark:text-white">
                                            {faq.question}
                                        </span>
                                    </div>
                                    <ChevronDown
                                        size={20}
                                        className={`flex-shrink-0 text-slate-400 transition-transform ${
                                            expandedFaq === idx ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>
                                {expandedFaq === idx && (
                                    <div className="border-t border-slate-100 px-5 pb-5 pt-4 dark:border-white/5">
                                        <p className="pl-8 text-sm text-slate-600 dark:text-slate-400">
                                            {faq.answer}
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-16">
                <div className="mx-auto max-w-4xl text-center">
                    <h2 className="text-3xl font-black text-white">
                        Gotowy do współpracy?
                    </h2>
                    <p className="mx-auto mt-4 max-w-xl text-purple-100">
                        Dołącz do programu partnerskiego Consultify i rozwijaj swój biznes
                        z dostępem do narzędzi, leadów i prowizji do 20%.
                    </p>
                    <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                        <button
                            onClick={handleNavigate(AppView.PARTNER_PROVIDER_HOME)}
                            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-bold text-purple-700 shadow-lg transition hover:bg-purple-50"
                        >
                            Rozpocznij teraz
                            <ArrowRight size={18} />
                        </button>
                        <button
                            onClick={handleNavigate(AppView.PARTNER_RESOURCES)}
                            className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-8 py-4 font-bold text-white transition hover:bg-white/10"
                        >
                            Porozmawiaj z PDM
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default PartnerPricingView;

