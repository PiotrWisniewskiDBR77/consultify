import { BookOpen, ChevronRight, CreditCard, LayoutDashboard, Link, Users } from 'lucide-react';
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
        title: 'Co-selling razem z Consultinity AI',
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
        <div className="min-h-full bg-slate-100 dark:bg-navy-950 py-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
                <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-navy-800 dark:bg-navy-900">
                    <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                        Partner Portal
                    </div>
                    <h1 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white">
                        Zbuduj program partnerski w stylu HubSpot
                    </h1>
                    <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
                        Umożliw partnerom zgłaszanie klientów, współdzielenie umów i dostęp do zasobów. Kopiujemy
                        sprawdzony flow HubSpot: landing, dashboard, commision, katalog usług i community.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <button
                            onClick={() => onNavigate(AppView.PARTNER_PROVIDER_HOME)}
                            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98]"
                        >
                            Startuj partner hub
                        </button>
                        <button
                            onClick={() => onNavigate(AppView.PARTNER_DIRECTORY)}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-300 dark:border-navy-600 dark:text-slate-300 dark:hover:border-violet-500/50 active:scale-[0.98]"
                        >
                            Zobacz katalog partnerów
                        </button>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        {sections.slice(0, 3).map((section) => (
                            <div
                                key={section.view}
                                className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-300"
                            >
                                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-white">
                                    <section.icon size={16} className="text-brand" />
                                    {section.title}
                                </div>
                                <p className="mt-2 text-xs leading-relaxed">{section.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <section className="grid gap-4 md:grid-cols-3">
                    {partnerBenefits.map((benefit) => (
                        <article
                            key={benefit.title}
                            className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-navy-800 dark:bg-navy-900"
                        >
                            <h3 className="text-sm font-semibold text-navy-900 dark:text-white">{benefit.title}</h3>
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-300 leading-relaxed">
                                {benefit.body}
                            </p>
                        </article>
                    ))}
                </section>

                <section className="rounded-xl border border-slate-200/60 bg-gradient-to-b from-slate-50 to-white p-6 shadow-sm dark:border-navy-800 dark:from-navy-900 dark:to-navy-900">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Jak działa współpraca</h3>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Kolejne etapy
                        </span>
                    </div>
                    <ol className="mt-6 space-y-6 text-sm text-slate-600 dark:text-slate-300">
                        {collaborationSteps.map((step, idx) => (
                            <li key={step.title} className="flex gap-4">
                                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-brand/10 text-brand font-bold text-sm">
                                    {idx + 1}
                                </span>
                                <div>
                                    <p className="font-semibold text-navy-900 dark:text-white">{step.title}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{step.detail}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>

                <section className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-navy-800 dark:bg-navy-900">
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Zasady współpracy</h3>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Partnerzy pracują w oparciu o Meta-PMO Framework: każdy etap dealu ma przypisane domeny PMO i
                        śledzimy mappingi ISO 21500 / PMBOK 7 / PRINCE2.
                    </p>
                    <ul className="mt-4 grid gap-3 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-2">
                        {partnershipPrinciples.map((principle) => (
                            <li
                                key={principle}
                                className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800"
                            >
                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand flex-shrink-0" />
                                <span className="leading-relaxed">{principle}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            onClick={() => onNavigate(AppView.PARTNER_PROVIDER_HOME)}
                            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 active:scale-[0.98]"
                        >
                            Startuj partner hub
                        </button>
                        <button
                            onClick={() => onNavigate(AppView.PARTNER_RESOURCES)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-violet-300 dark:border-navy-600 dark:text-slate-300 dark:hover:border-violet-500/50 active:scale-[0.98]"
                        >
                            Poznaj zasoby
                        </button>
                    </div>
                </section>

                <div className="grid gap-4 md:grid-cols-2">
                    {sections.map((section) => {
                        const isActive = section.view === activeSection.view;
                        return (
                            <section
                                key={section.view}
                                className={`rounded-xl border ${
                                    isActive
                                        ? 'border-violet-300 bg-white dark:border-violet-600/50 dark:bg-navy-900 ring-2 ring-violet-100 dark:ring-violet-900/30'
                                        : 'border-slate-200/60 bg-white dark:border-navy-800 dark:bg-navy-900'
                                } p-5 shadow-sm transition-all hover:border-violet-300 dark:hover:border-violet-600/50 hover:shadow-md active:scale-[0.99]`}
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                                        {section.title}
                                    </h3>
                                    <section.icon size={20} className={isActive ? 'text-brand' : 'text-slate-400'} />
                                </div>
                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {section.description}
                                </p>
                                <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                                    {section.bullets.map((item) => (
                                        <li key={item} className="flex items-center gap-2">
                                            <span className="h-1 w-1 rounded-full bg-brand" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    type="button"
                                    onClick={() => onNavigate(section.view)}
                                    className="mt-6 text-sm font-bold text-brand hover:underline flex items-center gap-1"
                                >
                                    {section.callToAction}
                                    <ChevronRight size={14} />
                                </button>
                            </section>
                        );
                    })}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900">
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Shared selling</h3>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {sharedSellingStats.map((item) => (
                                <div
                                    key={item.label}
                                    className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center dark:border-navy-700 dark:bg-navy-800"
                                >
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        {item.label}
                                    </div>
                                    <div className="mt-2 text-3xl font-bold text-navy-900 dark:text-white">
                                        {item.value}
                                    </div>
                                    <div className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-tighter">
                                        {item.caption}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-2">
                            {commissionStatements.map((statement) => (
                                <div
                                    key={statement.label}
                                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-800"
                                >
                                    <div>
                                        <p className="font-semibold text-slate-900 dark:text-white">
                                            {statement.label}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5">{statement.date}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-navy-900 dark:text-white">
                                            {statement.amount}
                                        </p>
                                        <span
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                                                statement.status === 'Paid'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20'
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20'
                                            }`}
                                        >
                                            {statement.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900">
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Client Access Manager</h3>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Clients</p>
                            <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                {clientList.map((client) => (
                                    <li
                                        key={client.name}
                                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 dark:border-navy-700 dark:bg-navy-800"
                                    >
                                        <div>
                                            <p className="font-semibold text-slate-900 dark:text-white">
                                                {client.name}
                                            </p>
                                            <p className="text-[10px] text-slate-400 uppercase font-medium">
                                                {client.region}
                                            </p>
                                        </div>
                                        <span className="text-[10px] font-bold text-brand uppercase tracking-wider">
                                            {client.status}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Employees</p>
                            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                {employeeList.map((employee) => (
                                    <li key={employee.name} className="flex items-center justify-between px-1">
                                        <div>
                                            <p className="font-semibold text-slate-900 dark:text-white">
                                                {employee.name}
                                            </p>
                                            <p className="text-[10px] text-slate-400 uppercase font-medium">
                                                {employee.access}
                                            </p>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            {employee.status}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button
                            type="button"
                            onClick={() => onNavigate(AppView.PARTNER_CLIENT_ACCESS)}
                            className="w-full rounded-lg border border-violet-200 px-3 py-2.5 text-sm font-semibold text-violet-700 transition-all hover:bg-violet-50 active:scale-[0.98] dark:border-violet-700/50 dark:text-violet-400 dark:hover:bg-violet-900/20"
                        >
                            Get access link
                        </button>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900 flex flex-col">
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                            Directory profile snapshot
                        </h3>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            Wypełnij informacje o firmie, opis, budżety i regiony. Każdy profil trafia do katalogu
                            Solutions Directory.
                        </p>
                        <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300 flex-1">
                            <li className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-navy-700">
                                <span className="text-slate-500 dark:text-slate-400">Company size</span>
                                <span className="font-semibold text-slate-900 dark:text-white">11-50</span>
                            </li>
                            <li className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-navy-700">
                                <span className="text-slate-500 dark:text-slate-400">Regions</span>
                                <span className="font-semibold text-slate-900 dark:text-white">EMEA, APAC</span>
                            </li>
                            <li className="flex items-center justify-between">
                                <span className="text-slate-500 dark:text-slate-400">Languages</span>
                                <span className="font-semibold text-slate-900 dark:text-white">English, Polish</span>
                            </li>
                        </ul>
                        <button
                            type="button"
                            onClick={() => onNavigate(AppView.PARTNER_DIRECTORY)}
                            className="mt-6 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 active:scale-[0.98] shadow-sm"
                        >
                            Edytuj profil katalogu
                        </button>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900">
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                            Partner Commission Inquiry
                        </h3>
                        <form className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                            <label className="block space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1">
                                    Your name
                                </span>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all dark:border-navy-700 dark:bg-navy-800 dark:text-white"
                                    placeholder="Imię i nazwisko"
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1">
                                    Email
                                </span>
                                <input
                                    type="email"
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all dark:border-navy-700 dark:bg-navy-800 dark:text-white"
                                    placeholder="partner@consultinity.com"
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1">
                                    Ticket type
                                </span>
                                <select className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all dark:border-navy-700 dark:bg-navy-800 dark:text-white">
                                    <option>Commission inquiry</option>
                                    <option>Payment update</option>
                                    <option>Other</option>
                                </select>
                            </label>
                            <button
                                type="button"
                                onClick={() => onNavigate(AppView.PARTNER_COMMISSION)}
                                className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 active:scale-[0.98] shadow-sm mt-1"
                            >
                                Wyślij zgłoszenie
                            </button>
                        </form>
                    </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                    {resourceCards.map((card) => (
                        <article
                            key={card.title}
                            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900 flex flex-col hover:border-violet-300 dark:hover:border-violet-600/50 transition-colors"
                        >
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {card.title}
                            </div>
                            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex-1">
                                {card.body}
                            </p>
                            <button
                                type="button"
                                onClick={() => onNavigate(card.view)}
                                className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline"
                            >
                                {card.label}
                                <ChevronRight size={14} />
                            </button>
                        </article>
                    ))}
                </div>

                <div className="rounded-xl border border-violet-200 bg-violet-50 p-6 text-slate-800 dark:border-violet-700/50 dark:bg-violet-900/20 dark:text-white flex flex-col md:flex-row items-center gap-4">
                    <div className="flex-1">
                        <h3 className="text-xl font-bold">Odkryj poziomy partnerstwa</h3>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-200 leading-relaxed">
                            Poznaj nasze cztery poziomy partnerstwa: Bronze, Silver, Gold i Platinum. Każdy poziom
                            oferuje progresywne korzyści — od 10% do 20% prowizji, co-sell leads i dedykowane wsparcie.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3 flex-shrink-0">
                        <button
                            onClick={() => onNavigate(AppView.PARTNER_PRICING)}
                            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98]"
                        >
                            Zobacz cennik partnerski
                        </button>
                        <button
                            onClick={() => onNavigate(AppView.PARTNER_PROVIDER_HOME)}
                            className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-300 dark:border-navy-600 dark:bg-navy-800 dark:text-white dark:hover:border-violet-500/50 active:scale-[0.98]"
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
