import {
  ArrowRight,
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  Handshake,
  Rocket,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * BecomePartnerView — Partner Recruitment Landing Page
 *
 * Public-facing page inviting potential partners to join the TechnoLex
 * consulting ecosystem. Links back to main landing page and partner portal.
 */

export const BecomePartnerView: React.FC = () => {
  const navigate = useNavigate();

  const handleApplyClick = () => {
    // Navigate to partner registration or contact
    navigate('/register');
  };

  const handleLearnMoreClick = () => {
    navigate('/');
  };

  const benefits = [
    {
      icon: TrendingUp,
      title: 'Zwiększ Przychody',
      description:
        'Dostęp do innowacyjnej platformy AI, która pozwala skalować Twoje usługi doradcze.',
      color: 'brand',
    },
    {
      icon: Users,
      title: 'Buduj Relacje',
      description: 'Dołącz do sieci ekspertów i konsultantów transformacji cyfrowej.',
      color: 'blue',
    },
    {
      icon: Award,
      title: 'Certyfikacja',
      description: 'Zdobądź oficjalną certyfikację TechnoLex i wyróżnij się na rynku.',
      color: 'purple',
    },
    {
      icon: Rocket,
      title: 'Wsparcie Technologiczne',
      description: 'Pełne zaplecze technologiczne i metodyczne do prowadzenia projektów.',
      color: 'emerald',
    },
  ];

  const partnerTypes = [
    {
      icon: Briefcase,
      title: 'Konsultant Niezależny',
      description: 'Dla ekspertów prowadzących własną praktykę doradczą.',
      features: ['Elastyczne zaangażowanie', 'Własny portfel klientów', 'Prowizje od wdrożeń'],
    },
    {
      icon: Building2,
      title: 'Firma Konsultingowa',
      description: 'Dla firm szukających przewagi technologicznej.',
      features: ['Integracja z procesami', 'Szkolenia dla zespołu', 'Dedykowany opiekun'],
    },
    {
      icon: Handshake,
      title: 'Partner Strategiczny',
      description: 'Dla organizacji chcących głębokiej współpracy.',
      features: ['Ekskluzywny dostęp', 'Współtworzenie roadmapy', 'White-label możliwości'],
    },
  ];

  const processSteps = [
    { step: 1, title: 'Aplikuj', description: 'Wypełnij krótki formularz zgłoszeniowy' },
    { step: 2, title: 'Rozmowa', description: 'Poznajemy Twoje potrzeby i cele' },
    { step: 3, title: 'Onboarding', description: 'Szkolenie i dostęp do platformy' },
    { step: 4, title: 'Współpraca', description: 'Rozpoczynasz projekty z klientami' },
  ];

  return (
    <div className="min-h-screen bg-navy-950 text-white selection:bg-brand-500/30 overflow-x-hidden relative">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-5%] right-[-10%] w-[50%] h-[50%] bg-brand-600/15 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] left-[20%] w-[30%] h-[30%] bg-blue-600/8 rounded-full blur-[100px]" />
      </div>

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-6 backdrop-blur-sm bg-navy-950/80">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 group cursor-pointer"
          >
            <div className="h-10 px-3 rounded bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/20 group-hover:shadow-brand-600/40 transition-all duration-500">
              <span className="text-white font-bold text-sm tracking-tight">TL</span>
            </div>
            <span className="text-xl font-bold tracking-[0.2em] text-white/90 group-hover:text-white transition-colors duration-500">
              TECHNOLEX
            </span>
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/partner')}
              className="hidden md:flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              <Shield size={16} className="text-brand-400" />
              Portal Partnera
            </button>
            <button
              onClick={handleApplyClick}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm rounded-xl transition-all duration-300 shadow-lg shadow-brand-600/20 hover:shadow-brand-600/40"
            >
              Dołącz Teraz
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-28 pb-20 px-6">
        {/* HERO SECTION */}
        <section className="max-w-5xl mx-auto text-center mb-24 animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-600/10 border border-brand-500/20 mb-8">
            <Sparkles size={16} className="text-brand-400" />
            <span className="text-sm font-medium text-brand-300">Program Partnerski TechnoLex</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-8 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            Zostań Partnerem <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
              Przyszłości Doradztwa
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-white/60 font-light max-w-3xl mx-auto mb-12 leading-relaxed">
            Dołącz do ekskluzywnej sieci konsultantów wykorzystujących AI do transformacji
            strategicznej. Wspólnie zmieniamy sposób, w jaki organizacje podejmują kluczowe decyzje.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleApplyClick}
              className="group relative inline-flex items-center gap-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-lg px-8 py-4 rounded-xl shadow-[0_0_50px_-12px_rgba(124,58,237,0.5)] hover:shadow-[0_0_60px_-12px_rgba(124,58,237,0.7)] active:scale-[0.98] transition-all duration-500 overflow-hidden"
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
              Poznaj TechnoLex
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

        {/* BENEFITS SECTION */}
        <section className="max-w-6xl mx-auto mb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Korzyści dla Partnerów</h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              Współpraca z TechnoLex otwiera nowe możliwości rozwoju Twojej praktyki doradczej.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className={`glass-card p-6 rounded-xl group hover:bg-${benefit.color}-600/5 transition-all duration-500 border-white/5`}
              >
                <benefit.icon
                  className={`text-${benefit.color}-400 mb-4 group-hover:scale-110 transition-transform duration-500`}
                  size={32}
                />
                <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PARTNER TYPES SECTION */}
        <section className="max-w-6xl mx-auto mb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Modele Współpracy</h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              Wybierz model partnerstwa dopasowany do Twoich potrzeb i skali działalności.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {partnerTypes.map((type, index) => (
              <div
                key={index}
                className="glass-panel p-8 rounded-xl border border-white/10 hover:border-brand-500/30 transition-all duration-500 group"
              >
                <div className="w-14 h-14 rounded-xl bg-brand-600/20 flex items-center justify-center mb-6 group-hover:bg-brand-600/30 transition-colors">
                  <type.icon size={28} className="text-brand-400" />
                </div>
                <h3 className="text-xl font-bold mb-3">{type.title}</h3>
                <p className="text-white/50 mb-6">{type.description}</p>
                <ul className="space-y-2">
                  {type.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-center gap-2 text-sm text-white/70">
                      <CheckCircle2 size={16} className="text-brand-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
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
                <div className="glass-card p-6 rounded-xl text-center border border-white/5 hover:border-brand-500/20 transition-all duration-300">
                  <div className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
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
        <section className="max-w-3xl mx-auto text-center py-16 px-8 glass-panel rounded-xl border border-white/10">
          <BadgeCheck size={48} className="text-brand-400 mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Gotowy na Nowy Rozdział?</h2>
          <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
            Dołącz do grona partnerów TechnoLex i razem zdefiniujmy przyszłość inteligentnego
            doradztwa strategicznego.
          </p>
          <button
            onClick={handleApplyClick}
            className="group relative inline-flex items-center gap-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xl px-10 p-4 rounded-xl shadow-[0_0_50px_-12px_rgba(124,58,237,0.5)] hover:shadow-[0_0_60px_-12px_rgba(124,58,237,0.7)] active:scale-[0.98] transition-all duration-500 overflow-hidden"
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

      {/* FOOTER */}
      <footer className="relative z-10 py-12 px-6 border-t border-white/5 bg-navy-950/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500"
          >
            <div className="h-6 px-2 rounded bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-[10px] tracking-tight">TL</span>
            </div>
            <span className="text-sm font-bold tracking-[0.2em] text-white">TECHNOLEX</span>
          </button>

          <div className="flex items-center gap-8 text-xs font-semibold text-white/30 tracking-widest uppercase">
            <a href="/privacy" className="hover:text-brand-400 transition-colors">
              Prywatność
            </a>
            <a href="/terms" className="hover:text-brand-400 transition-colors">
              Regulamin
            </a>
            <a href="/" className="hover:text-brand-400 transition-colors">
              Strona Główna
            </a>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-[0.4em]">
            <Shield size={12} className="mb-0.5" />
            Zabezpieczone przez DBR77 Governance
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BecomePartnerView;
