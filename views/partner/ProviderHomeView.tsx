/**
 * ProviderHomeView
 *
 * Partner onboarding hub with trust progression and academy
 * Aligned with Consultify's Trust Progression Model
 */

import { BookOpen, CheckCircle2, ClipboardCheck, Layers, Rocket, Shield } from 'lucide-react';
import React, { useCallback } from 'react';

import { SplitLayout } from '../../components/layout/SplitLayout';
import { AcademyProgress } from '../../components/Partner/AcademyProgress';
import { TrustProgressionIndicator } from '../../components/Partner/TrustProgressionIndicator';
import { usePartnerEcosystem } from '../../hooks/usePartnerEcosystem';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

interface ReadinessCardProps {
    label: string;
    value: string;
    status: 'good' | 'pending' | 'warning' | 'info';
}

const onboardingSteps = [
    { label: 'Zaakceptuj partner agreement', status: 'done', phase: 'G3_ONBOARDING' },
    { label: 'Zweryfikuj tax & banking details', status: 'pending', phase: 'G3_ONBOARDING' },
    { label: 'Ustaw cel co-sell & revenue target', status: 'pending', phase: 'G4_ACTIVATION' },
    { label: 'Przejdź academy readiness', status: 'pending', phase: 'G2_QUALIFICATION' },
];

const readinessStatus: ReadinessCardProps[] = [
    { label: 'Co-sell enabled', value: '85%', status: 'good' },
    { label: 'Tax verification', value: 'Submitted', status: 'pending' },
    { label: 'Banking setup', value: 'Pending documents', status: 'warning' },
    { label: 'Academy progress', value: '25%', status: 'info' },
];

export const ProviderHomeView: React.FC = () => {
    const { setCurrentView } = useAppStore();
    const { trustProgression, currentTrustPhase, academyModules, certifications, loading, completeAcademyModule } =
        usePartnerEcosystem();

    const handleNavigate = useCallback((view: AppView) => () => setCurrentView(view), [setCurrentView]);

    const handleStartModule = useCallback((moduleId: string) => {
        // In production, navigate to module or open modal
        console.log('[Partner] Starting module:', moduleId);
    }, []);

    return (
        <SplitLayout
            title="Provider Home"
            subtitle="Onboarding hub, trust progression i academy w jednym widoku"
            currentView={AppView.PARTNER_PROVIDER_HOME}
        >
            <div className="space-y-6 overflow-y-auto px-6 py-4">
                {/* Trust Progression */}
                <TrustProgressionIndicator trustProgression={trustProgression} currentPhase={currentTrustPhase} />

                {/* Readiness Status Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {readinessStatus.map((item) => (
                        <ReadinessCard key={item.label} {...item} />
                    ))}
                </div>

                {/* Onboarding Checklist */}
                <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 dark:border-white/5 dark:bg-navy-900/60">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                            <ClipboardCheck size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-navy-900 dark:text-white">Checklista aktywacji</h3>
                            <p className="text-xs text-slate-500">
                                Ukończ wszystkie kroki, aby odblokować pełne funkcje
                            </p>
                        </div>
                    </div>

                    <ul className="space-y-3">
                        {onboardingSteps.map((step) => (
                            <li
                                key={step.label}
                                className={`flex items-center justify-between rounded-2xl border p-4 ${
                                    step.status === 'done'
                                        ? 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5'
                                        : 'border-slate-100 bg-slate-50/50 dark:border-white/5 dark:bg-navy-950/20'
                                }`}
                            >
                                <span className="flex items-center gap-3">
                                    <CheckCircle2
                                        size={20}
                                        className={
                                            step.status === 'done'
                                                ? 'text-emerald-500'
                                                : 'text-slate-300 dark:text-slate-600'
                                        }
                                    />
                                    <span
                                        className={
                                            step.status === 'done'
                                                ? 'text-emerald-700 dark:text-emerald-400'
                                                : 'text-navy-900 dark:text-white'
                                        }
                                    >
                                        {step.label}
                                    </span>
                                </span>
                                <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${
                                        step.status === 'done'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                                    }`}
                                >
                                    {step.status}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Academy Progress */}
                <AcademyProgress
                    modules={academyModules}
                    certifications={certifications}
                    onStartModule={handleStartModule}
                />

                {/* Quick Actions */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <QuickActionCard
                        icon={<Layers size={20} />}
                        title="Co-sell Setup"
                        description="Zaproś account executive i rozpocznij deal registration"
                        actionLabel="Configure Co-sell"
                        onClick={handleNavigate(AppView.PARTNER_DASHBOARD)}
                    />
                    <QuickActionCard
                        icon={<Shield size={20} />}
                        title="Compliance Check"
                        description="Zweryfikuj tax, banking i agreement status"
                        actionLabel="View Status"
                        onClick={handleNavigate(AppView.PARTNER_DIRECTORY)}
                    />
                    <QuickActionCard
                        icon={<Rocket size={20} />}
                        title="First Deal"
                        description="Zarejestruj pierwszy deal i rozpocznij tracking"
                        actionLabel="Register Deal"
                        onClick={handleNavigate(AppView.PARTNER_COMMISSION)}
                    />
                </div>

                {/* CTA Banner */}
                <div className="rounded-3xl border border-brand/30 bg-gradient-to-r from-brand/5 to-purple-500/5 p-6 dark:from-brand/10 dark:to-purple-500/10">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                                Gotowy na następny krok?
                            </h3>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                Ukończ onboarding i odblokuj pełny dostęp do Partner Portal
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={handleNavigate(AppView.PARTNER_COMMISSION)}
                                className="rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark"
                            >
                                View Commission
                            </button>
                            <button
                                onClick={handleNavigate(AppView.PARTNER_DIRECTORY)}
                                className="rounded-2xl border border-brand/30 bg-white px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/5 dark:bg-navy-900"
                            >
                                Complete Profile
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </SplitLayout>
    );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const ReadinessCard: React.FC<ReadinessCardProps> = ({ label, value, status }) => {
    const statusColors = {
        good: 'text-emerald-600 dark:text-emerald-400',
        pending: 'text-amber-600 dark:text-amber-400',
        warning: 'text-red-600 dark:text-red-400',
        info: 'text-blue-600 dark:text-blue-400',
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-white/5 dark:bg-navy-900/60">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
            <div className={`mt-2 text-2xl font-bold ${statusColors[status]}`}>{value}</div>
        </div>
    );
};

interface QuickActionCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    actionLabel: string;
    onClick: () => void;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({ icon, title, description, actionLabel, onClick }) => (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/5 dark:bg-navy-900/60">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {icon}
        </div>
        <h4 className="font-semibold text-navy-900 dark:text-white">{title}</h4>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        <button onClick={onClick} className="mt-4 text-sm font-semibold text-brand hover:underline">
            {actionLabel} →
        </button>
    </div>
);

export default ProviderHomeView;
