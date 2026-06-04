import {
  ArrowRight,
  Bot,
  FolderOutput,
  Library,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type ToolsV8CanonMode = 'catalog' | 'session';

interface ToolsV8CanonPanelProps {
  mode: ToolsV8CanonMode;
  compact?: boolean;
  className?: string;
}

type LocalizedCopy = {
  badge: string;
  title: string;
  subtitle: string;
  journeyTitle: string;
  contractTitle: string;
  journey: Array<{
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
  }>;
  contract: string[];
  downstreamLabel: string;
  downstream: string[];
};

const COPY: Record<'en' | 'pl', Record<ToolsV8CanonMode, LocalizedCopy>> = {
  en: {
    catalog: {
      badge: 'Tools v8 canon',
      title: 'One library -> session -> outputs journey',
      subtitle:
        'Discover tools clearly, start a governed session, and promote results into durable downstream work.',
      journeyTitle: 'Canonical user journey',
      contractTitle: 'AI-governed runtime contract',
      journey: [
        {
          id: 'library',
          title: 'Discover the library',
          description:
            'Browse strategic, operational, digital, and assessment tools in one catalog.',
          icon: Library,
        },
        {
          id: 'session',
          title: 'Bind context and start a session',
          description: 'Open a tool with explicit intent, scope, inputs, and assumptions.',
          icon: Workflow,
        },
        {
          id: 'ai',
          title: 'Use AI through propose / accept',
          description:
            'AI assists inside the session while review, missing items, and approvals stay visible.',
          icon: Bot,
        },
        {
          id: 'outputs',
          title: 'Finalize and promote outputs',
          description:
            'Turn the result into initiatives, reports, presentations, and reusable knowledge.',
          icon: FolderOutput,
        },
      ],
      contract: [
        'AI suggests work inside the session and does not bypass the workflow.',
        'Assumptions, missing items, and review signals stay visible before finalization.',
        'Every output keeps source lineage back to the tool session.',
      ],
      downstreamLabel: 'Downstream bridge',
      downstream: ['Initiatives', 'Reports', 'Presentations', 'Ideas'],
    },
    session: {
      badge: 'Governed runtime',
      title: 'This session follows the canonical tools runtime',
      subtitle:
        'Capture intent, review AI suggestions inside the flow, then finalize once the evidence is ready.',
      journeyTitle: 'Runtime checkpoints',
      contractTitle: 'What stays governed here',
      journey: [
        {
          id: 'define',
          title: 'Define the consulting intent',
          description: 'The session starts with explicit goal, scope, and audience.',
          icon: Workflow,
        },
        {
          id: 'assist',
          title: 'Accept AI suggestions deliberately',
          description: 'AI proposals remain visible and can be accepted or rejected step by step.',
          icon: Sparkles,
        },
        {
          id: 'promote',
          title: 'Promote only finalized results',
          description:
            'Outputs are created after review so downstream work inherits the right source.',
          icon: ShieldCheck,
        },
      ],
      contract: [
        'AI works through propose / accept, not hidden mutation.',
        'Review and missing-item checks stay in the session before lock.',
        'Outputs remain linked to this session for downstream traceability.',
      ],
      downstreamLabel: 'Promote into',
      downstream: ['Initiative', 'Report', 'Presentation', 'Idea'],
    },
  },
  pl: {
    catalog: {
      badge: 'Kanon Tools v8',
      title: 'Jedna droga: biblioteka -> sesja -> outputy',
      subtitle:
        'Uzytkownik ma jeden czytelny katalog narzedzi, jedna zarzadzana sesje i jedno przejscie do trwalej pracy downstream.',
      journeyTitle: 'Kanoniczna sciezka uzytkownika',
      contractTitle: 'Kontrakt runtime z governance AI',
      journey: [
        {
          id: 'library',
          title: 'Odkryj biblioteke',
          description:
            'Przegladaj narzedzia strategiczne, operacyjne, cyfrowe i assessmenty w jednym katalogu.',
          icon: Library,
        },
        {
          id: 'session',
          title: 'Podepnij kontekst i startuj sesje',
          description:
            'Kazda praca startuje z jawnym celem, zakresem, danymi wejsciowymi i zalozeniami.',
          icon: Workflow,
        },
        {
          id: 'ai',
          title: 'Pracuj z AI przez propose / accept',
          description: 'AI pomaga w sesji, ale review, braki i akceptacja pozostaja widoczne.',
          icon: Bot,
        },
        {
          id: 'outputs',
          title: 'Finalizuj i promuj outputy',
          description:
            'Wynik przechodzi do inicjatyw, raportow, prezentacji i wiedzy wielokrotnego uzytku.',
          icon: FolderOutput,
        },
      ],
      contract: [
        'AI proponuje ruchy w sesji i nie omija workflow.',
        'Zalozenia, brakujace elementy i sygnaly review sa widoczne przed finalizacja.',
        'Kazdy output zachowuje lineage do sesji narzedzia.',
      ],
      downstreamLabel: 'Most downstream',
      downstream: ['Inicjatywy', 'Raporty', 'Prezentacje', 'Pomysly'],
    },
    session: {
      badge: 'Governed runtime',
      title: 'Ta sesja dziala wedlug kanonicznego runtime Tools',
      subtitle:
        'Najpierw zapisujesz intencje, potem oceniasz sugestie AI w flow, a finalizacje robisz dopiero gdy evidence jest gotowe.',
      journeyTitle: 'Punkty kontrolne runtime',
      contractTitle: 'Co pozostaje tu zarzadzane',
      journey: [
        {
          id: 'define',
          title: 'Zdefiniuj intencje konsultingowa',
          description: 'Sesja startuje od jawnego celu, zakresu i odbiorcy.',
          icon: Workflow,
        },
        {
          id: 'assist',
          title: 'Akceptuj sugestie AI swiadomie',
          description:
            'Propozycje AI pozostaja widoczne i mozna je przyjmowac lub odrzucac krok po kroku.',
          icon: Sparkles,
        },
        {
          id: 'promote',
          title: 'Promuj tylko finalne wyniki',
          description: 'Outputy powstaja po review, aby dalsza praca dziedziczyla poprawne zrodlo.',
          icon: ShieldCheck,
        },
      ],
      contract: [
        'AI dziala przez propose / accept, a nie przez ukryte mutacje.',
        'Review i kontrola brakow pozostaja w sesji przed lockiem.',
        'Outputy pozostaja podpiete do tej sesji dla traceability downstream.',
      ],
      downstreamLabel: 'Promuj do',
      downstream: ['Inicjatywa', 'Raport', 'Prezentacja', 'Pomysl'],
    },
  },
};

export const ToolsV8CanonPanel: React.FC<ToolsV8CanonPanelProps> = ({
  mode,
  compact = false,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';
  const copy = COPY[lang][mode];

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
            <ShieldCheck size={14} />
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
          className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1.3fr_0.9fr]'}`}
        >
          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              {copy.journeyTitle}
            </div>
            <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
              {copy.journey.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.id}
                    className="rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
                        <Icon size={18} />
                      </div>
                      {index < copy.journey.length - 1 ? (
                        <ArrowRight size={14} className="text-slate-600 dark:text-slate-400" />
                      ) : null}
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                      {step.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {step.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-navy-700 bg-slate-50/90 dark:bg-navy-950/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              {copy.contractTitle}
            </div>
            <div className="space-y-3">
              {copy.contract.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-slate-200/80 dark:border-navy-700 bg-white dark:bg-navy-900 p-3"
                >
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <ShieldCheck size={14} />
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-primary-200 dark:border-primary-500/20 bg-primary-50/70 dark:bg-primary-500/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-700 dark:text-primary-300">
                {copy.downstreamLabel}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {copy.downstream.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm dark:bg-navy-900 dark:text-slate-200"
                  >
                    <FolderOutput size={12} />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
