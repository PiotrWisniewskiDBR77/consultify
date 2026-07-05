import { CheckCircle2, Monitor, Smartphone, TabletSmartphone, Wifi } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface MobileV8ScopePanelProps {
  compact?: boolean;
  className?: string;
}

type Locale = 'en' | 'pl';

interface MobileCopy {
  badge: string;
  title: string;
  subtitle: string;
  matrixTitle: string;
  boundaryTitle: string;
  matrix: Array<{ id: string; title: string; description: string }>;
  boundaries: string[];
}

const COPY: Record<Locale, MobileCopy> = {
  en: {
    badge: 'Mobile V8 scope',
    title: 'A credible mobile support promise',
    subtitle:
      'Consultify should clearly separate mobile-first daily flows, mobile-safe review flows, and desktop-only workspaces instead of claiming generic responsiveness.',
    matrixTitle: 'Mobile support matrix',
    boundaryTitle: 'PWA and device boundaries',
    matrix: [
      {
        id: 'first',
        title: 'Mobile-first',
        description:
          'Navigation, chat, approvals, alerts, and quick review actions should work well on phones.',
      },
      {
        id: 'safe',
        title: 'Mobile-safe',
        description:
          'Settings, status checks, and bounded admin reviews can be supported responsively without full desktop parity.',
      },
      {
        id: 'desktop',
        title: 'Desktop-only',
        description:
          'Dense builders, deep workbenches, and complex editing remain desktop territory until explicitly upgraded.',
      },
    ],
    boundaries: [
      'PWA is a future path, not a promise of native or offline parity today.',
      'Mobile support should prioritize review and action-on-the-go before full authoring parity.',
      'Support claims must stay explicit by flow instead of relying on vague responsive coverage.',
    ],
  },
  pl: {
    badge: 'Mobile V8 scope',
    title: 'Wiarygodna obietnica wsparcia mobile',
    subtitle:
      'Consultify powinno jasno rozdzielac mobile-first daily flows, mobile-safe review flows i desktop-only workspaces zamiast deklarowac ogolna responsywnosc.',
    matrixTitle: 'Macierz wsparcia mobile',
    boundaryTitle: 'Granice PWA i urzadzen',
    matrix: [
      {
        id: 'first',
        title: 'Mobile-first',
        description:
          'Nawigacja, chat, approvals, alerty i szybkie akcje review powinny dobrze dzialac na telefonach.',
      },
      {
        id: 'safe',
        title: 'Mobile-safe',
        description:
          'Settings, status checks i bounded admin reviews moga byc wspierane responsywnie bez pelnej parytetowej wersji desktop.',
      },
      {
        id: 'desktop',
        title: 'Desktop-only',
        description:
          'Gestsze buildery, glebokie workbenche i zlozona edycja pozostaja domena desktopu, dopoki nie zostana jawnie podniesione.',
      },
    ],
    boundaries: [
      'PWA jest kierunkiem na przyszlosc, a nie obietnica natywnej lub offline parity juz teraz.',
      'Wsparcie mobile powinno priorytetyzowac review i action-on-the-go przed pelna parytetowa authoring.',
      'Deklaracje wsparcia musza byc jawne per flow, a nie oparte o ogolna responsywnosc.',
    ],
  },
};

export const MobileV8ScopePanel: React.FC<MobileV8ScopePanelProps> = ({
  compact = false,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const locale: Locale = i18n.language?.startsWith('pl') ? 'pl' : 'en';
  const copy = COPY[locale];
  const icons = [Smartphone, TabletSmartphone, Monitor];

  return (
    <section
      className={[
        'rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-white/90 dark:bg-navy-900/80 shadow-sm',
        compact ? 'p-4' : 'p-6 lg:p-8',
        className,
      ].join(' ')}
    >
      <div className={`flex ${compact ? 'flex-col gap-4' : 'flex-col gap-6'}`}>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-200/80 dark:border-primary-500/20 bg-primary-50 dark:bg-primary-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary-700 dark:text-primary-300">
            <Wifi size={14} />
            {copy.badge}
          </div>
          <h2
            className={`mt-3 font-semibold tracking-tight text-slate-900 dark:text-white ${compact ? 'text-lg' : 'text-2xl lg:text-3xl'}`}
          >
            {copy.title}
          </h2>
          <p
            className={`mt-2 max-w-3xl text-slate-600 dark:text-slate-400 ${compact ? 'text-sm' : 'text-base'}`}
          >
            {copy.subtitle}
          </p>
        </div>

        <div
          className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1.25fr_1fr]'}`}
        >
          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              {copy.matrixTitle}
            </div>
            <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
              {copy.matrix.map((item, index) => {
                const Icon = icons[index] || CheckCircle2;
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-4"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
                      <Icon size={16} />
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {item.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              {copy.boundaryTitle}
            </div>
            <div className="space-y-3">
              {copy.boundaries.map((boundary) => (
                <div
                  key={boundary}
                  className="flex items-start gap-3 rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-3"
                >
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <CheckCircle2 size={14} />
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{boundary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
