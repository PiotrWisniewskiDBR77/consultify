import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Building2,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  Rocket,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { MarketingLayout } from '@/components/Landing/MarketingLayout';
import { ROUTES } from '@/routes/routeConfig';

/**
 * BecomePartnerView — Partner Recruitment Landing Page
 *
 * Public-facing page inviting potential partners to join the Consultify
 * PMO + AI ecosystem. Links back to main landing page and partner portal.
 */

export const BecomePartnerView: React.FC = () => {
  const navigate = useNavigate();

  const handleApplyClick = () => {
    navigate(ROUTES.PARTNER.ONBOARDING);
  };

  const handleLearnMoreClick = () => {
    navigate(ROUTES.WELCOME);
  };

  const benefits = [
    {
      icon: Rocket,
      title: 'Platforma PMO + AI',
      description:
        'Dostęp do zaawansowanej platformy łączącej standardy PMO z możliwościami sztucznej inteligencji.',
      color: 'violet',
    },
    {
      icon: GraduationCap,
      title: 'Certyfikacje PMO',
      description:
        'Szkolenia ISO 21500, PMBOK 7, PRINCE2 oraz specjalistyczne assessmenty (DRD, SIRI, ADMA).',
      color: 'blue',
    },
    {
      icon: CreditCard,
      title: 'Portal Rozliczeń',
      description:
        'Transparentny system zarządzania licencjami, fakturami i rabatami partnerskimi.',
      color: 'emerald',
    },
    {
      icon: BookOpen,
      title: 'Materiały i Szablony',
      description:
        'Dostęp do materiałów marketingowych, szablonów PMO, case studies i dokumentacji.',
      color: 'purple',
    },
  ];

  const partnershipTiers = [
    {
      icon: Users,
      title: 'Registered',
      description: 'Dla rozpoczynających współpracę',
      requirements: ['Rejestracja', 'Podstawowe szkolenie'],
      benefits: ['10% rabat', 'Dostęp do materiałów', 'Wsparcie email'],
      color: 'slate',
    },
    {
      icon: Award,
      title: 'Certified',
      description: 'Dla doświadczonych konsultantów',
      requirements: ['Egzamin certyfikacyjny', 'Min. 3 projekty'],
      benefits: ['12% rabat', 'Logo partnera', 'Dedykowane wsparcie', 'Listing w katalogu'],
      color: 'violet',
    },
    {
      icon: Target,
      title: 'Premier',
      description: 'Dla partnerów strategicznych',
      requirements: ['10+ projektów', 'Case study', 'Referencje'],
      benefits: ['14% rabat', 'Dedykowany opiekun', 'Co-marketing', 'Wczesny dostęp do nowości'],
      color: 'emerald',
    },
  ];

  const processSteps = [
    { step: 1, title: 'Aplikuj', description: 'Wypełnij formularz partnerski' },
    { step: 2, title: 'Poznajmy się', description: 'Rozmowa o potrzebach i celach' },
    { step: 3, title: 'Onboarding', description: 'Szkolenie i dostęp do platformy' },
    { step: 4, title: 'Rozwijaj się', description: 'Wspólne projekty i rozwój' },
  ];

  return (
    <MarketingLayout>
      <div className="min-h-[calc(100vh-3.5rem)] bg-navy-950 text-white selection:bg-violet-500/30 overflow-x-hidden relative">
        {/* Background Atmosphere */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-5%] right-[-10%] w-[50%] h-[50%] bg-violet-600/15 rounded-full blur-[150px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-[40%] left-[20%] w-[30%] h-[30%] bg-blue-600/8 rounded-full blur-[100px]" />
        </div>

        <main className="relative z-10 pt-16 pb-20 px-6">
          {/* HERO SECTION */}
          <section className="max-w-5xl mx-auto text-center mb-24 animate-fade-in">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-600/10 border border-violet-500/20 mb-8">
              <Sparkles size={16} className="text-violet-400" />
              <span className="text-sm font-medium text-violet-300">
                Program Partnerski Consultify
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-8 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Dołącz do <br className="hidden md:block" />
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                Programu Partnerskiego Consultify
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-white/60 font-light max-w-3xl mx-auto mb-12 leading-relaxed">
              Dołącz do sieci partnerów wykorzystujących Consultify do transformacji cyfrowej
              organizacji. Profesjonalne standardy PMO połączone z mocą sztucznej inteligencji.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleApplyClick}
                className="group relative inline-flex items-center gap-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-lg px-8 py-4 rounded-xl shadow-[0_0_50px_-12px_rgba(124,58,237,0.5)] hover:shadow-[0_0_60px_-12px_rgba(124,58,237,0.7)] active:scale-[0.98] transition-all duration-500 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <span>Aplikuj o Partnerstwo</span>
                <ArrowRight
                  className="group-hover:translate-x-1 transition-transform duration-300"
                  size={20}
                />
              </button>

              <button
                onClick={handleLearnMoreClick}
                className="inline-flex items-center gap-2 text-white/60 hover:text-white font-medium text-lg px-6 py-4 rounded-xl hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-all duration-300"
              >
                Poznaj Consultify
                <ArrowRight size={18} />
              </button>

              <button
                onClick={() => navigate(ROUTES.PARTNER.LANDING)}
                className="inline-flex items-center gap-2 text-white/60 hover:text-white font-medium text-lg px-6 py-4 rounded-xl hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-all duration-300"
              >
                <Shield size={18} className="text-violet-400" />
                Mam już konto partnera
              </button>
            </div>
          </section>

          {/* BENEFITS SECTION */}
          <section className="max-w-6xl mx-auto mb-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Co Zyskujesz jako Partner</h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                Współpraca z Consultify otwiera nowe możliwości rozwoju Twojej praktyki doradczej.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className={`bg-navy-900/30 backdrop-blur-sm p-6 rounded-xl group hover:bg-${benefit.color}-600/5 transition-all duration-500 border border-white/5 hover:border-${benefit.color}-500/20 overflow-hidden relative`}
                >
                  <benefit.icon
                    className={`text-${benefit.color}-400 mb-4 group-hover:scale-110 transition-transform duration-500 relative z-10`}
                    size={32}
                  />
                  <h3 className="text-lg font-semibold mb-2 relative z-10">{benefit.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed relative z-10">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* PARTNERSHIP TIERS SECTION */}
          <section className="max-w-6xl mx-auto mb-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Poziomy Partnerstwa</h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                Wybierz poziom dopasowany do Twoich celów. Awansuj wraz z rozwojem współpracy.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {partnershipTiers.map((tier, index) => (
                <div
                  key={index}
                  className={`bg-navy-900/30 backdrop-blur-sm p-8 rounded-xl border transition-all duration-500 group ${
                    tier.title === 'Certified'
                      ? 'border-violet-500/30 shadow-lg shadow-violet-500/10'
                      : 'border-white/10 hover:border-violet-500/20'
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-xl bg-${tier.color}-600/20 flex items-center justify-center mb-6 group-hover:bg-${tier.color}-600/30 transition-colors`}
                  >
                    <tier.icon size={28} className={`text-${tier.color}-400`} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{tier.title}</h3>
                  <p className="text-white/50 text-sm mb-6">{tier.description}</p>

                  <div className="mb-6">
                    <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">
                      Wymagania
                    </h4>
                    <ul className="space-y-1.5">
                      {tier.requirements.map((req, rIndex) => (
                        <li key={rIndex} className="flex items-start gap-2 text-sm text-white/60">
                          <CheckCircle2 size={14} className="mt-0.5 text-white/30 flex-shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">
                      Korzyści
                    </h4>
                    <ul className="space-y-1.5">
                      {tier.benefits.map((benefit, bIndex) => (
                        <li key={bIndex} className="flex items-start gap-2 text-sm text-white/70">
                          <CheckCircle2
                            size={14}
                            className={`mt-0.5 text-${tier.color}-400 flex-shrink-0`}
                          />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* PROCESS SECTION */}
          <section className="max-w-4xl mx-auto mb-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Jak Dołączyć?</h2>
              <p className="text-white/50 text-lg">
                Prosty proces w 4 krokach do rozpoczęcia współpracy.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {processSteps.map((item, index) => (
                <div key={index} className="relative">
                  <div className="bg-navy-900/30 backdrop-blur-sm p-6 rounded-xl text-center border border-white/5 hover:border-violet-500/20 transition-all duration-300">
                    <div className="w-12 h-12 rounded-full bg-violet-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                      {item.step}
                    </div>
                    <h4 className="font-semibold mb-2">{item.title}</h4>
                    <p className="text-white/50 text-sm">{item.description}</p>
                  </div>
                  {index < processSteps.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2">
                      <ArrowRight size={16} className="text-white/20" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* FINAL CTA SECTION */}
          <section className="max-w-3xl mx-auto text-center py-16 px-8 bg-navy-900/30 backdrop-blur-sm rounded-xl border border-white/10">
            <BadgeCheck size={48} className="text-violet-400 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Gotowy na Współpracę?</h2>
            <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
              Dołącz do grona partnerów Consultify i wspólnie dostarczajmy profesjonalne rozwiązania
              PMO + AI dla organizacji w transformacji.
            </p>
            <button
              onClick={handleApplyClick}
              className="group relative inline-flex items-center gap-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xl px-10 py-4 rounded-xl shadow-[0_0_50px_-12px_rgba(124,58,237,0.5)] hover:shadow-[0_0_60px_-12px_rgba(124,58,237,0.7)] active:scale-[0.98] transition-all duration-500 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <span>Rozpocznij Aplikację</span>
              <ArrowRight
                className="group-hover:translate-x-2 transition-transform duration-500"
                size={24}
              />
            </button>
            <p className="mt-6 text-white/30 text-sm">Bez zobowiązań • Odpowiemy w ciągu 24h</p>
          </section>
        </main>
      </div>
    </MarketingLayout>
  );
};

export default BecomePartnerView;
