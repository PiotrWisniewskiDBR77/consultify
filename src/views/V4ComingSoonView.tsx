import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Bot,
  Brain,
  Calendar,
  Check,
  Cpu,
  ExternalLink,
  Globe,
  Handshake,
  Link2,
  Shield,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { apiGet, apiPost } from '../services/api/baseClient';

type ModuleKey = 'iris' | 'marketplace' | 'meeting';

interface ModuleConfig {
  title: string;
  badge: string;
  headline: string;
  description: string;
  features: { icon: React.ReactNode; title: string; description: string }[];
  highlights: { value: string; label: string }[];
  imageUrl: string;
  imageAlt: string;
  gradient: string;
  accentColor: string;
  lpUrl?: string;
  lpLabel?: string;
  bannerTitle?: string;
  bannerDescription?: string;
}

const MEETING_IMAGE =
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80&auto=format&fit=crop';
const IRIS_IMAGE =
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80&auto=format&fit=crop';
const MARKETPLACE_IMAGE =
  'https://images.unsplash.com/photo-1611078489935-0cb964de46d6?w=800&q=80&auto=format&fit=crop';

const IRIS_LP_URL = 'https://iris.dbr77.com';
const MARKETPLACE_LP_URL = 'https://marketplace.dbr77.com/marketplace';

const copyByModule: Record<ModuleKey, ModuleConfig> = {
  meeting: {
    title: 'Meeting Intelligence',
    badge: 'Wkrótce',
    headline: 'Zamień każde spotkanie w mierzalne rezultaty',
    description:
      'Przestań tracić kluczowe ustalenia podczas niekończących się spotkań. Meeting Intelligence wykorzystuje AI do przygotowania kontekstowych agend, rejestrowania decyzji w czasie rzeczywistym i automatycznego przekształcania ustaleń w śledzone zadania — by Twój zespół mniej czasu spędzał na spotkaniach, a więcej na realizacji.',
    features: [
      {
        icon: <Calendar size={20} />,
        title: 'Inteligentne przygotowanie',
        description:
          'AI analizuje kontekst projektu, wcześniejsze decyzje i otwarte punkty, by wygenerować precyzyjną agendę jeszcze przed rozpoczęciem spotkania.',
      },
      {
        icon: <Bot size={20} />,
        title: 'Teresa — AI moderator spotkań',
        description:
          'Teresa uczestniczy w spotkaniu jako konsultant AI, który zna kontekst Twojej organizacji, projektów i wcześniejszych ustaleń. Moderuje dyskusję, pilnuje agendy i na bieżąco podpowiada kluczowe dane i rekomendacje.',
      },
      {
        icon: <Target size={20} />,
        title: 'Automatyczne przypisanie zadań',
        description:
          'Ustalenia są natychmiast przekształcane w śledzone zadania z odpowiedzialnymi, terminami i powiązaniami projektowymi.',
      },
      {
        icon: <TrendingUp size={20} />,
        title: 'Analityka spotkań',
        description:
          'Śledź efektywność spotkań w czasie — szybkość podejmowania decyzji, realizację ustaleń i czas reakcji.',
      },
    ],
    highlights: [
      { value: '40%', label: 'Mniej czasu na spotkania' },
      { value: '95%', label: 'Rejestracja ustaleń' },
      { value: '3x', label: 'Szybsza realizacja' },
    ],
    imageUrl: MEETING_IMAGE,
    imageAlt: 'Zespół współpracujący na produktywnym spotkaniu',
    gradient: 'from-blue-600/20 via-indigo-600/10 to-purple-600/5',
    accentColor: 'blue',
    bannerTitle: 'Bądź na bieżąco z Meeting Intelligence',
    bannerDescription:
      'Twoja aktualna subskrypcja zapewni pełny dostęp. Powiadomimy Cię, gdy moduł będzie dostępny — bez dodatkowych działań.',
  },
  iris: {
    title: 'MCP IRIS',
    badge: 'Wkrótce',
    headline: 'Połącz Consultify bezpośrednio z systemami operacyjnymi zakładu',
    description:
      'MCP IRIS łączy doradztwo strategiczne z rzeczywistością operacyjną. Zintegruj się bezpośrednio z IRIS — natywnym systemem operacyjnym zakładu opartym na AI — by pobierać dane produkcyjne na żywo, wskaźniki OEE i parametry jakości do procesów transformacyjnych. Podejmuj decyzje oparte na rzeczywistych danych z fabryki, nie na założeniach.',
    features: [
      {
        icon: <Cpu size={20} />,
        title: 'Dane produkcyjne na żywo',
        description:
          'Połącz się z czujnikami IoT, systemami MES i SCADA przez IRIS, by wyświetlać wskaźniki KPI w czasie rzeczywistym w przestrzeni doradczej.',
      },
      {
        icon: <Brain size={20} />,
        title: 'Analiza wspierana AI',
        description:
          'Krzyżuj dane operacyjne z inicjatywami, by weryfikować wpływ, identyfikować wąskie gardła i priorytetyzować działania.',
      },
      {
        icon: <Shield size={20} />,
        title: 'Governance klasy Enterprise',
        description:
          'Kontrola dostępu oparta na rolach, pełne ścieżki audytowe i kontrola rezydencji danych — stworzone dla regulowanych branż.',
      },
      {
        icon: <Link2 size={20} />,
        title: 'Orkiestracja modułów',
        description:
          'Płynny przepływ danych między modułami IRIS (MES, QMS, CMMS, APS) a inicjatywami Consultify.',
      },
    ],
    highlights: [
      { value: '17', label: 'Wspieranych modułów IRIS' },
      { value: 'Real-time', label: 'Synchronizacja danych' },
      { value: 'SOC 2', label: 'Gotowość compliance' },
    ],
    imageUrl: IRIS_IMAGE,
    imageAlt: 'Automatyka przemysłowa i technologia produkcji',
    gradient: 'from-purple-600/20 via-violet-600/10 to-fuchsia-600/5',
    accentColor: 'purple',
    lpUrl: IRIS_LP_URL,
    lpLabel: 'Dowiedz się więcej o IRIS',
    bannerTitle: 'Poznaj pełne możliwości MCP IRIS',
    bannerDescription:
      'Odwiedź stronę produktu, by zobaczyć szczegóły integracji, architekturę i dostępne moduły.',
  },
  marketplace: {
    title: 'MCP Marketplace',
    badge: 'Wkrótce',
    headline: 'Zautomatyzuj zakupy maszyn i realizację wdrożeń',
    description:
      'MCP Marketplace łączy Twoje inicjatywy transformacyjne bezpośrednio z kuratorowanym ekosystemem dostawców automatyki przemysłowej. Od identyfikacji odpowiednich maszyn i integratorów po zarządzanie procesami zakupowymi — zautomatyzuj całą ścieżkę od decyzji strategicznej do wdrożenia na hali produkcyjnej.',
    features: [
      {
        icon: <ShoppingCart size={20} />,
        title: 'Inteligentne zakupy',
        description:
          'Rekomendacje dostawców dopasowane przez AI na podstawie Twoich wymagań, budżetu i harmonogramu wdrożenia.',
      },
      {
        icon: <Handshake size={20} />,
        title: 'Ekosystem dostawców',
        description:
          'Dostęp do kuratorowanej sieci producentów, integratorów systemowych i dostawców technologii — wszyscy zweryfikowani i ocenieni.',
      },
      {
        icon: <Zap size={20} />,
        title: 'Automatyzacja wdrożeń',
        description:
          'Od zapytania ofertowego do uruchomienia — zautomatyzowane przepływy zamawiania, harmonogramowania i śledzenia dostaw.',
      },
      {
        icon: <Globe size={20} />,
        title: 'Transparentna współpraca',
        description:
          'Wspólne przestrzenie projektowe z dostawcami, śledzenie statusu w czasie rzeczywistym i zintegrowane kanały komunikacji.',
      },
    ],
    highlights: [
      { value: '800+', label: 'Zweryfikowanych dostawców' },
      { value: '50%', label: 'Szybsze zakupy' },
      { value: 'End-to-end', label: 'Śledzenie wdrożeń' },
    ],
    imageUrl: MARKETPLACE_IMAGE,
    imageAlt: 'Roboty przemysłowe na linii produkcyjnej',
    gradient: 'from-emerald-600/20 via-teal-600/10 to-cyan-600/5',
    accentColor: 'emerald',
    lpUrl: MARKETPLACE_LP_URL,
    lpLabel: 'Dowiedz się więcej o Marketplace',
    bannerTitle: 'Poznaj pełne możliwości MCP Marketplace',
    bannerDescription:
      'Odwiedź stronę produktu, by zobaczyć katalog dostawców, proces zakupowy i dostępne integracje.',
  },
};

function resolveModuleKey(pathname: string): ModuleKey {
  if (pathname.includes('marketplace')) return 'marketplace';
  if (pathname.includes('mcp') || pathname.includes('iris')) return 'iris';
  if (pathname.includes('meeting')) return 'meeting';
  return 'iris';
}

const accentMap: Record<string, { badge: string; icon: string; highlight: string; button: string; buttonRegistered: string }> = {
  blue: {
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: 'text-blue-400',
    highlight: 'from-blue-500/10 to-blue-600/5 border-blue-500/10',
    button: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20',
    buttonRegistered: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  },
  purple: {
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    icon: 'text-purple-400',
    highlight: 'from-purple-500/10 to-purple-600/5 border-purple-500/10',
    button: 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20',
    buttonRegistered: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  },
  emerald: {
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: 'text-emerald-400',
    highlight: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/10',
    button: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20',
    buttonRegistered: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

export const V4ComingSoonView: React.FC = () => {
  const location = useLocation();
  const moduleKey = resolveModuleKey(location.pathname);
  const copy = copyByModule[moduleKey];
  const accent = accentMap[copy.accentColor];

  const [registeredModules, setRegisteredModules] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const isRegistered = registeredModules.has(moduleKey);
  const hasLpUrl = Boolean(copy.lpUrl);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<{ modules: string[] }>('/module-interest/my');
        if (!cancelled) setRegisteredModules(new Set(data.modules));
      } catch {
        // not critical
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRegister = useCallback(async () => {
    if (isRegistered || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await apiPost('/module-interest', { moduleKey });
      setRegisteredModules((prev) => new Set([...prev, moduleKey]));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch {
      // silent
    } finally {
      setIsSubmitting(false);
    }
  }, [moduleKey, isRegistered, isSubmitting]);

  const CTAButton: React.FC<{ size?: 'normal' | 'large' }> = ({ size = 'normal' }) => {
    const isLg = size === 'large';

    if (hasLpUrl) {
      return (
        <a
          href={copy.lpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={[
            'shrink-0 inline-flex items-center gap-2 rounded-lg font-medium transition-all duration-200',
            isLg ? 'px-6 py-3 text-sm' : 'px-5 py-2.5 text-sm',
            accent.button,
          ].join(' ')}
        >
          <ExternalLink size={isLg ? 16 : 14} />
          {copy.lpLabel || 'Dowiedz się więcej'}
        </a>
      );
    }

    return (
      <button
        onClick={handleRegister}
        disabled={isRegistered || isSubmitting}
        className={[
          'shrink-0 inline-flex items-center gap-2 rounded-lg font-medium transition-all duration-200',
          isLg ? 'px-6 py-3 text-sm' : 'px-5 py-2.5 text-sm',
          isRegistered ? accent.buttonRegistered : accent.button,
          isSubmitting ? 'opacity-70 cursor-wait' : isRegistered ? 'cursor-default' : 'cursor-pointer',
        ].join(' ')}
      >
        {isRegistered ? (
          <>
            <Check size={isLg ? 16 : 14} />
            Otrzymasz powiadomienie
          </>
        ) : (
          <>
            <Bell size={isLg ? 16 : 14} />
            {isSubmitting ? 'Rejestrowanie...' : 'Powiadom mnie o starcie'}
          </>
        )}
      </button>
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Success toast */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500 text-white text-sm font-medium shadow-lg"
            >
              <Check size={16} />
              Powiadomimy Cię, gdy {copy.title} będzie dostępny!
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        <motion.div
          initial="hidden"
          animate="visible"
          className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${copy.gradient} pointer-events-none`} />

          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Left: Content */}
            <div className="p-8 lg:p-10 flex flex-col justify-center">
              <motion.div variants={fadeUp} custom={0}>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border ${accent.badge}`}
                >
                  <Sparkles size={12} />
                  {copy.badge}
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                custom={1}
                className="mt-4 text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white leading-tight"
              >
                {copy.title}
              </motion.h1>

              <motion.p
                variants={fadeUp}
                custom={2}
                className="mt-2 text-lg text-slate-600 dark:text-slate-300 font-medium"
              >
                {copy.headline}
              </motion.p>

              <motion.p
                variants={fadeUp}
                custom={3}
                className="mt-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed"
              >
                {copy.description}
              </motion.p>

              {/* Highlights */}
              <motion.div variants={fadeUp} custom={4} className="mt-6 flex gap-6">
                {copy.highlights.map((h) => (
                  <div key={h.label}>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{h.value}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{h.label}</div>
                  </div>
                ))}
              </motion.div>

              {/* CTA Button in hero */}
              <motion.div variants={fadeUp} custom={5} className="mt-8">
                <CTAButton size="large" />
              </motion.div>
            </div>

            {/* Right: Image */}
            <motion.div
              variants={fadeUp}
              custom={2}
              className="relative hidden lg:block"
            >
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white/80 dark:to-navy-900/80 z-10 pointer-events-none" />
              <img
                src={copy.imageUrl}
                alt={copy.imageAlt}
                className="w-full h-full object-cover min-h-[360px]"
                loading="lazy"
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {copy.features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-6 hover:border-slate-300 dark:hover:border-navy-600 transition-all duration-200 hover:shadow-sm"
            >
              <div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${accent.highlight} border`}
              >
                <span className={accent.icon}>{feature.icon}</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom Banner */}
        <div className="mt-6 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 shrink-0 ${accent.icon}`}>
                {hasLpUrl ? <ExternalLink size={20} /> : <Bell size={20} />}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {copy.bannerTitle || `Bądź na bieżąco z ${copy.title}`}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {copy.bannerDescription ||
                    'Twoja aktualna subskrypcja zapewni pełny dostęp. Powiadomimy Cię, gdy moduł będzie dostępny — bez dodatkowych działań.'}
                </p>
              </div>
            </div>
            <CTAButton />
          </div>
        </div>
      </div>
    </div>
  );
};

export default V4ComingSoonView;
