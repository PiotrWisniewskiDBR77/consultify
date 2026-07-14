import { motion } from 'framer-motion';
import {
  ArrowRight,
  Briefcase,
  Check,
  ChevronDown,
  Clock3,
  FileCheck2,
  HelpCircle,
  LogIn,
  MessageCircle,
  ShieldCheck,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { MarketingLayout } from '@/components/Landing/MarketingLayout';

import { PARTNER_DOCS } from '../../config/partnerKnowledge';
import { ROUTES } from '../../routes/routeConfig';
import {
  PARTNER_BENEFITS,
  PARTNER_FAQS,
  PARTNER_TIERS,
  PartnerTier,
  TRUST_INDICATORS,
} from './partnerPricingData';

type JourneyStep = {
  title: string;
  description: string;
  detail: string;
  icon: React.ElementType;
};

const PROGRAM_JOURNEY: JourneyStep[] = [
  {
    title: 'Pozyskanie szansy',
    description: 'Partner otwiera rozmowę z klientem i kwalifikuje potrzebę transformacji.',
    detail:
      'Anna, materiały sprzedażowe i playbook pomagają skrócić czas od pierwszego kontaktu do discovery.',
    icon: Briefcase,
  },
  {
    title: 'Wspólny discovery i oferta',
    description:
      'Partner prowadzi rozmowy wspólnie z Consultify albo samodzielnie z naszym wsparciem.',
    detail:
      'Deal desk, case studies i struktura wdrożenia pomagają domknąć ofertę bez improwizacji.',
    icon: Users,
  },
  {
    title: 'Aktywacja partnera i klienta',
    description:
      'Po zaakceptowaniu ścieżki partner przechodzi ten sam flow aplikacyjny z LP i z produktu.',
    detail:
      'Onboarding, wybór tracku, payout readiness i aktywacja workspace są spięte jednym procesem.',
    icon: Workflow,
  },
  {
    title: 'Rozliczenie i wzrost',
    description:
      'Partner zarabia na sprzedaży, co-sellu i aktywacjach zgodnie z poziomem programu.',
    detail:
      'Program jest zaprojektowany pod przewidywalny wzrost: academy, certyfikacja, case pack i payout flow.',
    icon: ShieldCheck,
  },
];

export const PartnerPricingView: React.FC = () => {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const startApplication = useCallback(() => {
    navigate(ROUTES.PARTNER.PUBLIC_APPLY);
  }, [navigate]);

  const openPartnerLogin = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  const openContact = useCallback(() => {
    navigate(ROUTES.LEGAL.CONTACT);
  }, [navigate]);

  const openPartnerDocs = useCallback(() => {
    navigate(PARTNER_DOCS.overview.href);
  }, [navigate]);

  const openCaseStudy = useCallback(() => {
    navigate(PARTNER_DOCS.caseStudyOperations.href);
  }, [navigate]);

  const handleTierCta = useCallback(
    (tier: PartnerTier) => {
      if (tier.id === 'PLATINUM') {
        openContact();
        return;
      }
      startApplication();
    },
    [openContact, startApplication]
  );

  const priorityBenefits = useMemo(() => PARTNER_BENEFITS.slice(0, 6), []);

  return (
    <MarketingLayout>
      <div className="min-h-full bg-c-surface-raised">
        <section className="relative overflow-hidden bg-gradient-to-b from-c-accent-soft via-c-surface to-c-surface-raised px-6 pb-20 pt-14">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-c-accent-soft via-transparent to-transparent" />

          <div className="relative mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"
            >
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-c-accent-soft px-4 py-2 text-sm font-semibold text-c-accent">
                  <span className="h-2 w-2 rounded-full bg-c-text" />
                  Consultify Partner Program
                </span>

                <h1 className="mt-6 text-4xl font-black tracking-tight text-c-text md:text-5xl">
                  Program partnerski, który daje{' '}
                  <span className="text-c-accent">realny pipeline, wdrożenia i payout</span>
                </h1>

                <p className="mt-6 max-w-3xl text-lg leading-relaxed text-c-text-secondary">
                  To nie jest tylko listing partnerów. Otrzymujesz wspólną ścieżkę aplikacji,
                  playbook handlowy, academy, case pack, wsparcie deal-desk i model rozliczeń
                  dopasowany do wzrostu partnera.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    onClick={startApplication}
                    className="inline-flex items-center gap-2 rounded-full bg-c-accent px-6 py-3 text-sm font-bold text-white shadow-lg shadow-c-accent/30 transition hover:opacity-90"
                  >
                    Apply
                    <ArrowRight size={18} />
                  </button>
                  <button
                    onClick={openPartnerDocs}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-c-border px-6 py-3 text-sm font-bold text-c-text transition hover:border-c-accent/40 hover:bg-c-surface"
                  >
                    Odkrywaj program
                  </button>
                  <button
                    onClick={openPartnerLogin}
                    className="inline-flex items-center gap-2 rounded-full border border-c-border px-6 py-3 text-sm font-bold text-c-text-secondary transition hover:border-c-border-strong hover:bg-c-surface-raised dark:border-white/15 dark:text-white dark:hover:bg-white/5"
                  >
                    <LogIn size={16} />
                    Zaloguj się jako partner
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-c-accent/20 bg-c-surface/90 p-6 shadow-sm md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-c-accent">
                    Co dostajesz od dnia 1
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-3xl font-black text-c-text">1 flow</p>
                      <p className="mt-1 text-sm text-c-text-secondary">
                        Taka sama ścieżka wejścia z LP i z aplikacji.
                      </p>
                    </div>
                    <div>
                      <p className="text-3xl font-black text-c-text">do 20%</p>
                      <p className="mt-1 text-sm text-c-text-secondary">
                        Prowizji oraz progresji wraz z certyfikacją i aktywacją.
                      </p>
                    </div>
                    <div>
                      <p className="text-3xl font-black text-c-text">case pack</p>
                      <p className="mt-1 text-sm text-c-text-secondary">
                        Materiały, które pomagają domknąć discovery i ofertę.
                      </p>
                    </div>
                  </div>
                </div>

                {PROGRAM_JOURNEY.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.title}
                      className="rounded-2xl border border-c-border-subtle bg-c-surface p-5 shadow-sm"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-c-accent-soft text-c-accent">
                        <Icon size={20} />
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-c-text">{step.title}</h3>
                      <p className="mt-2 text-sm text-c-text-secondary">{step.description}</p>
                      <p className="mt-3 text-sm font-medium text-c-text-secondary">
                        {step.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto max-w-6xl rounded-3xl border border-c-border-subtle bg-c-surface p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-c-accent">
                  Proof + next step
                </p>
                <h2 className="mt-3 text-2xl font-black text-c-text">
                  Kanoniczne partner docs i wspólna ścieżka wejścia
                </h2>
                <p className="mt-3 max-w-3xl text-sm text-c-text-secondary">
                  Public docs są source of truth dla programu, activation, certification i case
                  studies. Niezależnie od tego, skąd partner startuje, kończy w tym samym
                  application flow.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={openPartnerDocs}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-c-border px-5 py-4 text-sm font-bold text-c-text-secondary transition hover:border-c-accent/40 hover:text-c-accent"
                >
                  Otwórz partner docs
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={openCaseStudy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-c-accent px-5 py-4 text-sm font-bold text-white transition hover:opacity-90"
                >
                  Zobacz case study
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-black text-c-text">
                Jak ten program pracuje w praktyce
              </h2>
              <p className="mx-auto mt-4 max-w-3xl text-c-text-secondary">
                Budujemy program pod partnera, który chce sprzedawać i wdrażać Consultify
                profesjonalnie, a nie tylko zbierać leady. Dlatego ścieżka łączy sales enablement,
                onboarding, certyfikację i payout readiness.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-4">
              {PROGRAM_JOURNEY.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className="rounded-2xl border border-c-border-subtle bg-c-surface p-6"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-c-accent-soft text-c-accent">
                        <Icon size={18} />
                      </div>
                      <span className="text-xs font-black uppercase tracking-[0.2em] text-c-text-secondary">
                        0{idx + 1}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-c-text">{step.title}</h3>
                    <p className="mt-2 text-sm text-c-text-secondary">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="partner-case-study" className="bg-c-surface px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 flex flex-col gap-4 text-center lg:text-left">
              <div className="inline-flex w-fit self-center rounded-full bg-c-success/10 px-4 py-2 text-sm font-semibold text-c-success lg:self-start">
                Case study partnera
              </div>
              <h2 className="text-3xl font-black text-c-text">
                Przykład korzyści w pracy partnera, nie tylko na slajdzie
              </h2>
              <p className="max-w-3xl text-c-text-secondary">
                Partner wprowadził Consultify do rozmowy z firmą produkcyjną, przeprowadził
                discovery w oparciu o frameworki oceny, a potem zbudował wspólną ofertę z
                Consultify. Klient szybciej przeszedł z diagnozy do roadmapy, a partner miał gotowy
                case do dalszej sprzedaży.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-c-border-subtle bg-c-surface-raised p-7">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-c-text-muted">
                  Partner motion
                </p>
                <h3 className="mt-3 text-2xl font-black text-c-text">
                  Od rozmowy sprzedażowej do aktywnego rolloutu
                </h3>
                <div className="mt-6 space-y-4 text-sm leading-7 text-c-text-secondary">
                  <p>
                    Partner rozpoczął od warsztatu z zarządem i kierownikami operacyjnymi. Dzięki
                    gotowym materiałom Consultify nie musiał budować narracji od zera.
                  </p>
                  <p>
                    W kolejnym kroku wspólnie przygotowano assessment, mapę problemów i plan pilota.
                    To skróciło czas dopięcia oferty oraz zwiększyło wiarygodność po stronie
                    klienta.
                  </p>
                  <p>
                    Po aktywacji partner wykorzystał academy i case pack do powtórzenia tego samego
                    modelu u kolejnych klientów, zamiast każdorazowo wymyślać proces od nowa.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                {[
                  'Krótszy czas od pierwszej rozmowy do warsztatu discovery',
                  'Mocniejsza oferta dzięki wspólnemu case pack i frameworkom',
                  'Powtarzalny model wdrożenia dla kolejnych klientów partnera',
                  'Jasna ścieżka aktywacji, academy i payout readiness',
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-c-border-subtle bg-c-surface p-5"
                  >
                    <div className="flex items-start gap-3">
                      <Check className="mt-0.5 text-c-success" size={18} />
                      <p className="text-sm font-medium text-c-text-secondary">{item}</p>
                    </div>
                  </div>
                ))}

                <button
                  onClick={openContact}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-navy-950 px-5 py-4 text-sm font-bold text-white transition hover:bg-navy-900 dark:bg-white dark:text-navy-950"
                >
                  Skontaktuj się, aby omówić pełny case
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-black text-c-text">Korzyści z partnerstwa</h2>
              <p className="mx-auto mt-4 max-w-2xl text-c-text-secondary">
                Program jest zbudowany tak, by partner mógł szybciej wejść na rynek, przejść przez
                aktywację i skalować współpracę bez ręcznego zszywania procesu.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {priorityBenefits.map((benefit, idx) => {
                const Icon = benefit.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.05 }}
                    className="rounded-2xl border border-c-border-subtle bg-c-surface p-6"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-c-accent-soft">
                      <Icon size={24} className="text-c-accent" />
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-c-text">{benefit.title}</h3>
                    <p className="mt-2 text-sm text-c-text-secondary">{benefit.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-c-surface-raised px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-black text-c-text">
                Start application: wspólna ścieżka z LP i z aplikacji
              </h2>
              <p className="mx-auto mt-4 max-w-3xl text-c-text-secondary">
                Każde wejście do programu prowadzi do tego samego procesu aplikacyjnego. Partner
                może przejść go samodzielnie, a jeśli potrzebuje niestandardowych warunków, ma od
                razu ścieżkę kontaktu do ustalenia modelu współpracy.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {[
                {
                  title: '1. Apply i utworzenie ścieżki',
                  description:
                    'Kliknięcie Apply przenosi partnera do tego samego flow onboardingowego niezależnie od miejsca wejścia.',
                  icon: FileCheck2,
                },
                {
                  title: '2. Automatyczna kwalifikacja',
                  description:
                    'Partner akceptuje warunki, wybiera track i uzupełnia dane potrzebne do aktywacji oraz dalszych rozliczeń.',
                  icon: Clock3,
                },
                {
                  title: '3. Kontakt i warunki specjalne',
                  description:
                    'Jeśli współpraca wymaga innego modelu, partner może od razu przejść do kontaktu z zespołem partnerskim.',
                  icon: MessageCircle,
                },
              ].map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className="rounded-2xl border border-c-border-subtle bg-c-surface p-6"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-c-accent-soft text-c-accent">
                      <Icon size={22} />
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-c-text">{step.title}</h3>
                    <p className="mt-2 text-sm text-c-text-secondary">{step.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={startApplication}
                className="inline-flex items-center gap-2 rounded-full bg-c-accent px-8 py-4 font-bold text-white shadow-lg shadow-c-accent/30 transition hover:opacity-90"
              >
                Start application
                <ArrowRight size={18} />
              </button>
              <button
                onClick={openContact}
                className="inline-flex items-center gap-2 rounded-full border-2 border-c-border px-8 py-4 font-bold text-c-text transition hover:border-c-accent/40 hover:bg-c-surface"
              >
                Ustal warunki współpracy
              </button>
            </div>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-black text-c-text">Poziomy programu</h2>
              <p className="mx-auto mt-4 max-w-2xl text-c-text-secondary">
                Poziomy nadal porządkują rozwój partnera, ale najpierw partner dostaje jeden, spójny
                flow wejścia i jasną ścieżkę wzrostu.
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
                    transition={{ duration: 0.5, delay: idx * 0.08 }}
                    className={`relative flex flex-col rounded-2xl p-6 ${
                      tier.highlight
                        ? 'z-10 scale-[1.02] bg-gradient-to-b from-primary-600 to-primary-700 text-white shadow-2xl shadow-primary-500/20 ring-4 ring-primary-500/50'
                        : 'border border-c-border-subtle bg-c-surface'
                    }`}
                  >
                    {tier.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-c-warning px-3 py-1 text-xs font-black uppercase tracking-wider text-navy-950 shadow-lg">
                          {tier.badge}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                          tier.highlight ? 'bg-white/20' : 'bg-c-accent-soft'
                        }`}
                      >
                        <Icon
                          size={24}
                          className={tier.highlight ? 'text-white' : 'text-c-accent'}
                        />
                      </div>
                      <div>
                        <h3
                          className={`text-xl font-black ${
                            tier.highlight ? 'text-white' : 'text-c-text'
                          }`}
                        >
                          {tier.name}
                        </h3>
                        <p
                          className={`text-xs ${
                            tier.highlight ? 'text-primary-200' : 'text-c-text-muted'
                          }`}
                        >
                          {tier.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-4xl font-black ${
                            tier.highlight ? 'text-white' : 'text-c-text'
                          }`}
                        >
                          {tier.commissionRate}%
                        </span>
                        <span
                          className={`text-sm ${
                            tier.highlight ? 'text-primary-200' : 'text-c-text-muted'
                          }`}
                        >
                          commission
                        </span>
                      </div>
                      <p
                        className={`mt-1 text-xs ${
                          tier.highlight ? 'text-primary-200' : 'text-c-text-muted'
                        }`}
                      >
                        Support SLA: {tier.supportSLA}
                      </p>
                    </div>

                    <p
                      className={`mt-4 text-sm ${
                        tier.highlight ? 'text-primary-100' : 'text-c-text-secondary'
                      }`}
                    >
                      {tier.description}
                    </p>

                    <ul className="mt-6 flex-1 space-y-2">
                      {tier.features.slice(0, 7).map((feature, index) => (
                        <li key={index} className="flex items-start gap-2">
                          {feature.included ? (
                            <Check
                              size={16}
                              className={`mt-0.5 flex-shrink-0 ${
                                tier.highlight ? 'text-primary-200' : 'text-c-success'
                              }`}
                            />
                          ) : (
                            <X
                              size={16}
                              className={`mt-0.5 flex-shrink-0 ${
                                tier.highlight ? 'text-primary-300/50' : 'text-c-text-secondary'
                              }`}
                            />
                          )}
                          <span
                            className={`text-xs ${
                              feature.included
                                ? tier.highlight
                                  ? 'text-primary-100'
                                  : 'text-c-text-secondary'
                                : tier.highlight
                                  ? 'text-primary-300/50'
                                  : 'text-c-text-muted'
                            } ${feature.highlight ? 'font-semibold' : ''}`}
                          >
                            {feature.name}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div
                      className={`mt-6 rounded-xl p-3 ${
                        tier.highlight ? 'bg-white/10' : 'bg-c-surface-raised'
                      }`}
                    >
                      <p
                        className={`mb-2 text-xs font-semibold uppercase tracking-wide ${
                          tier.highlight ? 'text-primary-200' : 'text-c-text-muted'
                        }`}
                      >
                        Wymagania
                      </p>
                      <div className="space-y-1">
                        {tier.requirements.map((req, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span
                              className={
                                tier.highlight ? 'text-primary-200' : 'text-c-text-secondary'
                              }
                            >
                              {req.label}
                            </span>
                            <span
                              className={`text-right font-semibold ${
                                tier.highlight ? 'text-white' : 'text-c-text'
                              }`}
                            >
                              {req.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleTierCta(tier)}
                      className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
                        tier.ctaVariant === 'primary'
                          ? 'bg-white text-primary-700 shadow-lg hover:bg-c-accent-soft'
                          : tier.ctaVariant === 'secondary'
                            ? 'bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800'
                            : 'border-2 border-c-border text-c-text hover:bg-c-surface-raised'
                      }`}
                    >
                      {tier.id === 'PLATINUM' ? 'Ustal warunki' : 'Start application'}
                      <ArrowRight size={16} />
                    </button>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-c-text-muted">
              {TRUST_INDICATORS.map((indicator, idx) => {
                const Icon = indicator.icon;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <Icon size={18} className="text-c-accent" />
                    <span>{indicator.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-black text-c-text">Najczęściej zadawane pytania</h2>
              <p className="mt-4 text-c-text-secondary">
                Masz scenariusz, który wymaga niestandardowych warunków?{' '}
                <button onClick={openContact} className="text-c-accent hover:underline">
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
                  className="overflow-hidden rounded-2xl border border-c-border-subtle bg-c-surface"
                >
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <HelpCircle size={20} className="mt-0.5 flex-shrink-0 text-c-accent" />
                      <span className="font-bold text-c-text">{faq.question}</span>
                    </div>
                    <ChevronDown
                      size={20}
                      className={`flex-shrink-0 text-c-text-muted transition-transform ${
                        expandedFaq === idx ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {expandedFaq === idx && (
                    <div className="border-t border-c-border-subtle p-4 pb-5 pt-4">
                      <p className="pl-8 text-sm text-c-text-secondary">{faq.answer}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-16">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-black text-white">Gotowy do wejścia do programu?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-primary-100">
              Możesz wystartować aplikację od razu albo porozmawiać z nami o warunkach współpracy,
              certyfikacji i wspólnym motion sprzedażowym.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={startApplication}
                className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-bold text-primary-700 shadow-lg transition hover:bg-c-accent-soft dark:bg-navy-900"
              >
                Start application
                <ArrowRight size={18} />
              </button>
              <button
                onClick={openContact}
                className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-8 py-4 font-bold text-white transition hover:bg-white/10"
              >
                Skontaktuj się z zespołem partnerskim
              </button>
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
};

export default PartnerPricingView;
