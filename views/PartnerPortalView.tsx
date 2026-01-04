import { BookOpen, CreditCard, LayoutDashboard, Link, Users } from 'lucide-react';
import React from 'react';

import { AppView } from '../types';

const sections = [
    {
        view: AppView.PARTNER_PROVIDER_HOME,
        title: 'Provider Home',
        description: 'Przyspiesz onboarding partnerów: checklisty aktywacji, weryfikacja tax/bank i plan szkoleń.',
        bullets: ['Co-sell & deal registration', 'Tax & banking setup', 'Academy micro-learning'],
        callToAction: 'Zobacz status',
        icon: LayoutDashboard,
    },
    {
        view: AppView.PARTNER_DASHBOARD,
        title: 'Dashboard',
        description: 'Metryki shared selling, planowanych płatności i adopcji narzędzi.',
        bullets: ['HubSpot deals tracker', 'Commission estimate', 'Usage score'],
        callToAction: 'Otwórz dashboard',
        icon: CreditCard,
    },
    {
        view: AppView.PARTNER_CLIENT_ACCESS,
        title: 'Client Access Manager',
        description: 'Zarządzaj dostępem pracowników do kont klientów jednym kliknięciem.',
        bullets: ['Widok klientów i pracowników', 'Link do żądania dostępu', 'Filtry ról'],
        callToAction: 'Zarządzaj dostępem',
        icon: Users,
    },
    {
        view: AppView.PARTNER_COMMISSION,
        title: 'Commission',
        description: 'Śledź wypłaty, żądaj potwierdzeń i zgłaszaj zapytania o revenue share.',
        bullets: ['Statements & payments', 'Partner commission form', 'FAQ revenue share'],
        callToAction: 'Zgłoś prowizję',
        icon: CreditCard,
    },
    {
        view: AppView.PARTNER_DIRECTORY,
        title: 'Directory Profile',
        description: 'Wypełnij profil firmy, usługi, regiony i języki, by pozyskiwać leady.',
        bullets: ['Profile preview', 'Budgets & industries', 'Automatic review capture'],
        callToAction: 'Aktualizuj profil',
        icon: Link,
    },
    {
        view: AppView.PARTNER_RESOURCES,
        title: 'Resources',
        description: 'Video series, materiały szkoleniowe i kontakt z Partner Development Managerem.',
        bullets: ['Partner Training Academy', 'Commission inquiries', 'Community Slack'],
        callToAction: 'Otwórz zasoby',
        icon: BookOpen,
    },
];

const sharedSellingStats = [
    { label: 'HubSpot deals created', value: '04', caption: 'wk. 01' },
    { label: 'Sourced inflight deals', value: '02', caption: 'wk. 01' },
    { label: 'Closed won', value: '01', caption: 'Q1 2026' },
];

const commissionStatements = [
    { label: 'Q4’25 statement', status: 'Pending', amount: '$12,450', date: 'Dec 28, 2025' },
    { label: 'Q3’25 payment', status: 'Paid', amount: '$9,250', date: 'Oct 15, 2025' },
];

const clientList = [
    { name: 'DigitalFinance Inc.', status: 'Awaiting approval', region: 'EMEA' },
    { name: 'Nordic Energy', status: 'Active access', region: 'EMEA' },
];

const employeeList = [
    { name: 'Agata Zaguła', status: 'Deactivated', access: 'N/A' },
    { name: 'Aleksandra Markiewicz', status: 'Active', access: 'Client Admin' },
];

const resourceCards = [
    {
        title: 'Partner Training Academy',
        body: 'Kursy dotyczące co-sellingu, cross-sellingu i tworzenia ofert.',
        view: AppView.PARTNER_RESOURCES,
        label: 'Otwórz academy',
    },
    {
        title: 'Partner Commission Inquiry',
        body: 'Formularz zgłoszenia prowizji oraz informacje o terminach płatności.',
        view: AppView.PARTNER_COMMISSION,
        label: 'Złóż zgłoszenie',
    },
    {
        title: 'Solutions Directory',
        body: 'Wyświetl swój profil w katalogu i zwiększ zasięg rekomendacji.',
        view: AppView.PARTNER_DIRECTORY,
        label: 'Zobacz podgląd',
    },
];

const partnerBenefits = [
    {
        title: 'Co-selling razem z Consultify AI',
        body: 'Wspólne szanse dealowe pod eskalacją, pełen widok pipeline’u i mechanizmy automatycznego przypisywania prowizji.',
    },
    {
        title: 'Meta-PMO compliance',
        body: 'Każde działanie mapujemy na ISO 21500 / PMBOK 7 / PRINCE2 oraz odpowiedni obszar (np. BENEFITS_REALIZATION, PERFORMANCE_MONITORING).',
    },
    {
        title: 'Partner Development',
        body: 'Akademia, formularze commission, zasoby i dedykowany PDM w jednym hubie.',
    },
];

const collaborationSteps = [
    {
        title: 'Onboarding & verification',
        detail: 'Weryfikacja tax/bank, podpisanie umowy, przypisanie ról (PROJECT_ROLE).',
    },
    {
        title: 'Shared selling rhythm',
        detail: 'Wspólna generacja dealów, wspólna pipeline review, weekly commitment.',
    },
    {
        title: 'Governance & reporting',
        detail: 'Audit trail dla decyzji, escalations, SLA payout + standards mapping w systemach CO-SELL/COMMISSION.',
    },
];

const partnershipPrinciples = [
    'Aktualizujemy profilu katalogu w Solutions Directory co najmniej raz na kwartał, aby zachować aktualne budżety i capability.',
    'Każda propozycja dealowa ma wyznaczonego Decision Ownera i Stage Gate, zgodnie z PMO domain GOVERNANCE_DECISION_MAKING.',
    'Commission tickets, statements i payouts są zgłaszane przez platformę, a finanse rozliczają się w standardzie 30 dni SLA.',
    'Dzielimy się insightami o benefitach dla klientów, łącząc RISK_ISSUE_MANAGEMENT z BENEFITS_REALIZATION dla pełnej widoczności wartości.',
];

interface PartnerPortalViewProps {
    currentSection: AppView;
    onNavigate: (view: AppView) => void;
}

export const PartnerPortalView: React.FC<PartnerPortalViewProps> = ({ currentSection, onNavigate }) => {
    const activeSection = sections.find((section) => section.view === currentSection) || sections[0];

    return (
        <div className="min-h-full bg-slate-50 dark:bg-navy-950 py-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
                <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-8 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-white/5 dark:bg-navy-900/60">
                    <div className="text-slate-500 dark:text-slate-400">Partner Portal</div>
                    <h1 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white">
                        Zbuduj program partnerski w stylu HubSpot
                    </h1>
                    <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
                        Umożliw partnerom zgłaszanie klientów, współdzielenie umów i dostęp do zasobów. Kopiujemy
                        sprawdzony flow HubSpot: landing, dashboard, commision, katalog usług i community.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            onClick={() => onNavigate(AppView.PARTNER_PROVIDER_HOME)}
                            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/40 transition hover:bg-brand-dark"
                        >
                            Startuj partner hub
                        </button>
                        <button
                            onClick={() => onNavigate(AppView.PARTNER_DIRECTORY)}
                            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                        >
                            Zobacz katalog partnerów
                        </button>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        {sections.slice(0, 3).map((section) => (
                            <div
                                key={section.view}
                                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-white/5 dark:bg-navy-900/40 dark:text-slate-300"
                            >
                                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-white">
                                    <section.icon size={16} />
                                    {section.title}
                                </div>
                                <p className="mt-2 text-xs">{section.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <section className="grid gap-4 md:grid-cols-3">
                    {partnerBenefits.map((benefit) => (
                        <article
                            key={benefit.title}
                            className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/5 dark:bg-navy-900/60"
                        >
                            <h3 className="text-sm font-semibold text-navy-900 dark:text-white">{benefit.title}</h3>
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">{benefit.body}</p>
                        </article>
                    ))}
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm dark:border-white/5 dark:bg-navy-900/60">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Jak działa współpraca</h3>
                        <span className="text-xs uppercase tracking-wide text-slate-400">Kolejne etapy</span>
                    </div>
                    <ol className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
                        {collaborationSteps.map((step, idx) => (
                            <li key={step.title} className="flex gap-3">
                                <span className="font-semibold text-brand">{idx + 1}.</span>
                                <div>
                                    <p className="font-semibold text-navy-900 dark:text-white">{step.title}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{step.detail}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-white/5 dark:bg-navy-900/60">
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Zasady współpracy</h3>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Partnerzy pracują w oparciu o Meta-PMO Framework: każdy etap dealu ma przypisane domeny PMO i śledzimy mappingi
                        ISO 21500 / PMBOK 7 / PRINCE2.
                    </p>
                    <ul className="mt-4 grid gap-3 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-2">
                        {partnershipPrinciples.map((principle) => (
                            <li key={principle} className="flex items-start gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-white/5 dark:bg-navy-950/40">
                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand" />
                                {principle}
                            </li>
                        ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <button
                            onClick={() => onNavigate(AppView.PARTNER_PROVIDER_HOME)}
                            className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark"
                        >
                            Startuj partner hub
                        </button>
                        <button
                            onClick={() => onNavigate(AppView.PARTNER_RESOURCES)}
                            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
                        >
                            Poznaj zasoby
                        </button>
                    </div>
                </section>

                <div className="grid gap-6 md:grid-cols-2">
                    {sections.map((section) => {
                        const isActive = section.view === activeSection.view;
                        return (
                            <section
                                key={section.view}
                                className={`rounded-2xl border ${
                                    isActive
                                        ? 'border-brand bg-white dark:bg-navy-900'
                                        : 'border-slate-200 bg-white/70 dark:border-white/5 dark:bg-navy-900/60'
                                } p-5 shadow-sm transition hover:border-brand`}
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                                        {section.title}
                                    </h3>
                                    <section.icon size={20} className="text-slate-400" />
                                </div>
                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{section.description}</p>
                                <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                                    {section.bullets.map((item) => (
                                        <li key={item} className="flex items-center gap-2">
                                            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    type="button"
                                    onClick={() => onNavigate(section.view)}
                                    className="mt-4 text-sm font-semibold text-brand hover:underline"
                                >
                                    {section.callToAction}
                                </button>
                            </section>
                        );
                    })}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/5 dark:bg-navy-900/60">
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Shared selling</h3>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {sharedSellingStats.map((item) => (
                                <div
                                    key={item.label}
                                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center dark:border-white/5 dark:bg-navy-950/40"
                                >
                                    <div className="text-sm text-slate-500 dark:text-slate-400">{item.label}</div>
                                    <div className="mt-2 text-3xl font-bold text-navy-900 dark:text-white">
                                        {item.value}
                                    </div>
                                    <div className="text-xs text-slate-400 dark:text-slate-500">{item.caption}</div>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3">
                            {commissionStatements.map((statement) => (
                                <div
                                    key={statement.label}
                                    className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3 text-sm dark:border-white/5"
                                >
                                    <div>
                                        <p className="font-semibold text-slate-900 dark:text-white">
                                            {statement.label}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{statement.date}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {statement.amount}
                                        </p>
                                        <p className="text-xs text-slate-500">{statement.status}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/5 dark:bg-navy-900/60">
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Client Access Manager</h3>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Clients</p>
                            <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                {clientList.map((client) => (
                                    <li
                                        key={client.name}
                                        className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 dark:border-white/5"
                                    >
                                        <div>
                                            <p className="font-semibold text-slate-900 dark:text-white">
                                                {client.name}
                                            </p>
                                            <p className="text-xs text-slate-400">{client.region}</p>
                                        </div>
                                        <span className="text-xs text-brand">{client.status}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Employees</p>
                            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                {employeeList.map((employee) => (
                                    <li key={employee.name} className="flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-slate-900 dark:text-white">
                                                {employee.name}
                                            </p>
                                            <p className="text-xs text-slate-400">{employee.access}</p>
                                        </div>
                                        <span className="text-xs text-slate-500">{employee.status}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button
                            type="button"
                            onClick={() => onNavigate(AppView.PARTNER_CLIENT_ACCESS)}
                            className="w-full rounded-2xl border border-brand/60 px-3 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5"
                        >
                            Get access link
                        </button>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/5 dark:bg-navy-900/60">
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                            Directory profile snapshot
                        </h3>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            Wypełnij informacje o firmie, opis, budżety i regiony. Każdy profil trafia do katalogu
                            Solutions Directory.
                        </p>
                        <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                            <li className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-white/5">
                                <span>Company size</span>
                                <span className="font-semibold text-slate-900 dark:text-white">11-50</span>
                            </li>
                            <li className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-white/5">
                                <span>Regions</span>
                                <span className="font-semibold text-slate-900 dark:text-white">EMEA, APAC</span>
                            </li>
                            <li className="flex items-center justify-between">
                                <span>Languages</span>
                                <span className="font-semibold text-slate-900 dark:text-white">English, Polish</span>
                            </li>
                        </ul>
                        <button
                            type="button"
                            onClick={() => onNavigate(AppView.PARTNER_DIRECTORY)}
                            className="mt-4 rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
                        >
                            Edytuj profil katalogu
                        </button>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/5 dark:bg-navy-900/60">
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                            Partner Commission Inquiry
                        </h3>
                        <form className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                            <label className="block space-y-1">
                                <span className="text-xs uppercase tracking-wide text-slate-500">Your name</span>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:ring-0 dark:border-white/5 dark:bg-navy-900 dark:text-white"
                                    placeholder="Imię i nazwisko"
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs uppercase tracking-wide text-slate-500">Email</span>
                                <input
                                    type="email"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:ring-0 dark:border-white/5 dark:bg-navy-900 dark:text-white"
                                    placeholder="partner@consultify.com"
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs uppercase tracking-wide text-slate-500">Ticket type</span>
                                <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:ring-0 dark:border-white/5 dark:bg-navy-900 dark:text-white">
                                    <option>Commission inquiry</option>
                                    <option>Payment update</option>
                                    <option>Other</option>
                                </select>
                            </label>
                            <button
                                type="button"
                                onClick={() => onNavigate(AppView.PARTNER_COMMISSION)}
                                className="w-full rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
                            >
                                Wyślij zgłoszenie
                            </button>
                        </form>
                    </div>
                </div>
                <div className="grid gap-5 lg:grid-cols-3">
                    {resourceCards.map((card) => (
                        <article
                            key={card.title}
                            className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/5 dark:bg-navy-900/60"
                        >
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                {card.title}
                            </div>
                            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{card.body}</p>
                            <button
                                type="button"
                                onClick={() => onNavigate(card.view)}
                                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
                            >
                                {card.label}
                            </button>
                        </article>
                    ))}
                </div>

                <div className="rounded-2xl border border-brand/40 bg-brand/5 p-6 text-slate-800 dark:text-white">
                    <h3 className="text-xl font-semibold">Odkryj poziomy partnerstwa</h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
                        Poznaj nasze cztery poziomy partnerstwa: Bronze, Silver, Gold i Platinum. Każdy poziom oferuje
                        progresywne korzyści — od 10% do 20% prowizji, co-sell leads i dedykowane wsparcie.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <button
                            onClick={() => onNavigate(AppView.PARTNER_PRICING)}
                            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark"
                        >
                            Zobacz cennik partnerski
                        </button>
                        <button
                            onClick={() => onNavigate(AppView.PARTNER_PROVIDER_HOME)}
                            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand/40 dark:border-white/20 dark:bg-transparent dark:text-white"
                        >
                            Otwórz hub partnerów
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PartnerPortalView;
