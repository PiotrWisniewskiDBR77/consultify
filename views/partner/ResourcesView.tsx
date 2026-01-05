import { BookOpen, HelpCircle, MessageCircle, Video } from 'lucide-react';
import React from 'react';

import { SplitLayout } from '../../components/layout/SplitLayout';
import { AppView } from '../../types';

const resourceCards = [
    {
        title: 'Partner Training Academy',
        body: 'Microlesson co-selling, cross-selling i pobieranie leadów z katalogu.',
    },
    {
        title: 'Partner Commission Inquiry',
        body: 'Formularz zgłoszeniowy + instructions do finance team.',
    },
    {
        title: 'Solutions Directory',
        body: 'Materiały do uzupełnienia profilu, KPI i referencje.',
    },
];

const communitySupport = [
    'Community Slack: #partner-ops',
    'Partner Development Manager (PDM) - biweekly office hours',
    'Resource center: handbook + template library',
];

export const ResourcesView: React.FC = () => {
    return (
        <SplitLayout
            title="Resources & Community"
            subtitle="Video serie, formularze i kontakt z PDM. Wszystko w jednym miejscu."
            currentView={AppView.PARTNER_RESOURCES}
            hideSidebar
        >
            <div className="space-y-6 px-6 py-4">
                <div className="grid gap-4 md:grid-cols-3">
                    {resourceCards.map((card) => (
                        <article
                            key={card.title}
                            className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/5 dark:bg-navy-900/60"
                        >
                            <div className="flex items-center gap-2 text-sm font-semibold text-navy-900 dark:text-white">
                                <BookOpen size={16} />
                                {card.title}
                            </div>
                            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{card.body}</p>
                            <button className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                                Explore →
                            </button>
                        </article>
                    ))}
                </div>

                <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm dark:border-white/5 dark:bg-navy-900/60">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                        <Video size={16} />
                        Video series
                    </div>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                        Regularne serie: intro do partnerstwa, co-sell scripts, compliance & finance readiness.
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {['Intro hero', 'Co-sell scripts', 'Revenue intelligence'].map((item) => (
                            <div
                                key={item}
                                className="rounded-2xl border border-slate-100 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/5 dark:bg-navy-950/40"
                            >
                                {item}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/5 dark:bg-navy-900/60">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                        <HelpCircle size={16} />
                        Partner docs & forms
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Wszystkie formularze (Payout, Deal Registration, Tax & Bank) są dostępne w jednym miejscu i
                        zawierają checklisty zgodne z PMO domain SCOPE_CHANGE_CONTROL.
                    </p>
                    <div className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                            <BookOpen size={14} />
                            Deal registration (z notyfikacją do PDM i PMO_LEAD)
                        </div>
                        <div className="flex items-center gap-2">
                            <BookOpen size={14} />
                            Commission inquiry (ISO 21500 / PMBOK mapping, 30 dni payout SLA)
                        </div>
                        <div className="flex items-center gap-2">
                            <BookOpen size={14} />
                            Tax & banking checklist (FIN compliance, risk review)
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm dark:border-white/5 dark:bg-navy-900/60">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                        <MessageCircle size={16} />
                        Community & help
                    </div>
                    <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                        {communitySupport.map((item) => (
                            <li key={item} className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                                {item}
                            </li>
                        ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
                            Request partner docs
                        </button>
                        <button className="rounded-2xl bg-brand px-3 py-2 text-xs font-semibold text-white">
                            Talk to PDM
                        </button>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/5 dark:bg-navy-900/60">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                        <MessageCircle size={16} />
                        Community & support
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        {communitySupport.map((item) => (
                            <li key={item} className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                                {item}
                            </li>
                        ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
                            Request partner docs
                        </button>
                        <button className="rounded-2xl bg-brand px-3 py-2 text-xs font-semibold text-white">
                            Talk to PDM
                        </button>
                    </div>
                </section>
            </div>
        </SplitLayout>
    );
};

export default ResourcesView;
