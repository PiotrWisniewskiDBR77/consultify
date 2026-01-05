import { motion } from 'framer-motion';
import { Award, Globe, Key, Lock, Server, ShieldCheck } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * TrustStrip - Horizontal trust badges strip for landing page
 * Shows compliance and security badges for global markets:
 * - US/Canada: SOC2, CCPA
 * - Europe: GDPR
 * - Arab countries (GCC): Regional compliance, PDPL
 * - Japan: APPI
 */
export const TrustStrip: React.FC = () => {
    const { t } = useTranslation();

    // Primary compliance badges - globally recognized
    const badges = [
        {
            icon: Award,
            label: t('landing.compliance.badges.iso27001', 'ISO 27001'),
            shortLabel: 'ISO 27001',
            color: 'text-sky-500',
            bgColor: 'bg-sky-500/10',
            borderColor: 'border-sky-500/20',
        },
        {
            icon: Lock,
            label: t('landing.compliance.badges.soc2', 'SOC2 Type II'),
            shortLabel: 'SOC2',
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/20',
        },
        {
            icon: ShieldCheck,
            label: t('landing.compliance.badges.gdpr', 'GDPR'),
            shortLabel: 'GDPR',
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-500/10',
            borderColor: 'border-emerald-500/20',
        },
        {
            icon: Key,
            label: t('landing.compliance.badges.encryption', 'AES-256'),
            shortLabel: 'AES-256',
            color: 'text-amber-500',
            bgColor: 'bg-amber-500/10',
            borderColor: 'border-amber-500/20',
        },
    ];

    // Regional data residency options
    const regions = [
        { flag: '🇪🇺', name: 'EU', label: t('landing.compliance.regions.eu', 'Europe') },
        { flag: '🇺🇸', name: 'US', label: t('landing.compliance.regions.us', 'North America') },
        { flag: '🇸🇦', name: 'GCC', label: t('landing.compliance.regions.gcc', 'Middle East') },
        { flag: '🇯🇵', name: 'JP', label: t('landing.compliance.regions.jp', 'Japan') },
    ];

    return (
        <section className="py-10 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-navy-900/50 dark:via-navy-950 dark:to-navy-900/50 border-y border-slate-200 dark:border-white/10">
            <div className="max-w-7xl mx-auto px-6">
                {/* Section Label */}
                <div className="text-center mb-6">
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                        {t('landing.compliance.label', 'Enterprise-Grade Security & Compliance')}
                    </span>
                </div>

                {/* Compliance Badges Grid */}
                <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mb-8">
                    {badges.map((badge, idx) => {
                        const Icon = badge.icon;
                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: idx * 0.1 }}
                                viewport={{ once: true }}
                                className={`
                                    flex items-center gap-3 px-5 py-3 
                                    rounded-xl border ${badge.borderColor} ${badge.bgColor}
                                    transition-all duration-300
                                    hover:scale-105 hover:shadow-lg
                                `}
                            >
                                <div className={`p-2 rounded-lg ${badge.bgColor}`}>
                                    <Icon size={20} className={badge.color} strokeWidth={2.5} />
                                </div>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 hidden sm:inline">
                                    {badge.label}
                                </span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 sm:hidden">
                                    {badge.shortLabel}
                                </span>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Data Residency Options */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                    viewport={{ once: true }}
                    className="flex flex-col items-center gap-4"
                >
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Globe size={14} className="text-purple-500" />
                        <span className="font-medium">
                            {t('landing.compliance.dataResidency', 'Data Residency Options:')}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        {regions.map((region, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white/50 dark:bg-white/5 rounded-full border border-slate-200 dark:border-white/10 text-xs"
                            >
                                <span className="text-base">{region.flag}</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{region.name}</span>
                                <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">
                                    ({region.label})
                                </span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Additional Trust Text */}
                <div className="text-center mt-6">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t(
                            'landing.compliance.dataNote',
                            'Your data stays in your chosen region • No AI training on your data • Full regulatory compliance',
                        )}
                    </p>
                </div>
            </div>
        </section>
    );
};
