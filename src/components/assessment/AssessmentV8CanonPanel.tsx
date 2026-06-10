import { ArrowRight, Bot, FileCheck2, FolderOutput, Microscope, ShieldCheck } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type AssessmentV8CanonMode = 'catalog' | 'session';

interface AssessmentV8CanonPanelProps {
  mode: AssessmentV8CanonMode;
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

const COPY: Record<'en' | 'pl', Record<AssessmentV8CanonMode, LocalizedCopy>> = {
  en: {
    catalog: {
      badge: 'Assessment v8 canon',
      title: 'One assessment family with one shared workbench',
      subtitle:
        'Choose a methodology, collect evidence, score responsibly, and move findings into governed downstream action.',
      journeyTitle: 'Canonical assessment journey',
      contractTitle: 'Shared assessment contract',
      journey: [
        {
          id: 'method',
          title: 'Choose the right methodology',
          description: 'DRD, SIRI, ADMA, and adjacent frameworks sit inside one assessment family.',
          icon: Microscope,
        },
        {
          id: 'evidence',
          title: 'Collect answers and evidence',
          description:
            'The workbench captures scored inputs, notes, and supporting evidence in one runtime.',
          icon: FileCheck2,
        },
        {
          id: 'ai',
          title: 'Interpret with governed AI',
          description:
            'AI helps with interpretation while methodology authority and evidence stay explicit.',
          icon: Bot,
        },
        {
          id: 'promote',
          title: 'Promote findings downstream',
          description: 'Assessment outcomes convert into tools, initiatives, reports, and outputs.',
          icon: FolderOutput,
        },
      ],
      contract: [
        'Methodology selection, evidence capture, and scoring happen inside one shared grammar.',
        'AI assists interpretation without pretending to replace method authority.',
        'Completed assessments keep a clear path into downstream governed work.',
      ],
      downstreamLabel: 'Promote into',
      downstream: ['Tools', 'Initiatives', 'Reports', 'Outputs'],
    },
    session: {
      badge: 'Shared workbench',
      title: 'This assessment runs inside the shared workbench model',
      subtitle:
        'Capture evidence, score by method, use AI carefully, and finalize only when the diagnostic record is ready.',
      journeyTitle: 'Workbench checkpoints',
      contractTitle: 'What stays governed here',
      journey: [
        {
          id: 'answers',
          title: 'Answers and evidence stay together',
          description: 'The record keeps observations, notes, and scoring context in one place.',
          icon: FileCheck2,
        },
        {
          id: 'scoring',
          title: 'Scoring follows the method',
          description:
            'Interpretation is grounded in the assessment family rather than ad hoc judgment.',
          icon: ShieldCheck,
        },
        {
          id: 'promotion',
          title: 'Promotion starts from completed findings',
          description:
            'Downstream reports and initiatives inherit the assessment source and its evidence.',
          icon: FolderOutput,
        },
      ],
      contract: [
        'Evidence and scoring remain visible before any promotion step.',
        'AI guidance supports interpretation but does not override method discipline.',
        'Downstream actions stay linked to this assessment session.',
      ],
      downstreamLabel: 'Assessment bridge',
      downstream: ['Report', 'Initiative', 'Tool follow-up', 'Output'],
    },
  },
  pl: {
    catalog: {
      badge: 'Kanon Assessment v8',
      title: 'Jedna rodzina assessmentow z jednym wspolnym workbenchem',
      subtitle:
        'Uzytkownik wybiera metode, zbiera evidence, ocenia wynik w jednym runtime i promuje wnioski do dalszego dzialania.',
      journeyTitle: 'Kanoniczna sciezka assessmentu',
      contractTitle: 'Wspolny kontrakt assessmentu',
      journey: [
        {
          id: 'method',
          title: 'Wybierz wlasciwa metodologie',
          description:
            'DRD, SIRI, ADMA i kolejne frameworki naleza do jednej rodziny assessmentowej.',
          icon: Microscope,
        },
        {
          id: 'evidence',
          title: 'Zbieraj odpowiedzi i evidence',
          description: 'Workbench laczy odpowiedzi, scoring, notatki i dowody w jednym runtime.',
          icon: FileCheck2,
        },
        {
          id: 'ai',
          title: 'Interpretuj z governed AI',
          description:
            'AI pomaga w interpretacji, ale autorytet metody i evidence pozostaja jawne.',
          icon: Bot,
        },
        {
          id: 'promote',
          title: 'Promuj wyniki downstream',
          description: 'Wnioski assessmentu przechodza do tools, inicjatyw, raportow i outputow.',
          icon: FolderOutput,
        },
      ],
      contract: [
        'Wybor metodologii, evidence i scoring dzialaja w jednej wspolnej gramatyce.',
        'AI wspiera interpretacje, ale nie udaje autorytetu metody.',
        'Zakonczony assessment ma jasna sciezke do dalszej, zarzadzanej pracy.',
      ],
      downstreamLabel: 'Promuj do',
      downstream: ['Tools', 'Inicjatywy', 'Raporty', 'Outputy'],
    },
    session: {
      badge: 'Shared workbench',
      title: 'Ta sesja dziala w modelu wspolnego workbencha',
      subtitle:
        'Zbieraj evidence, oceniaj zgodnie z metoda, korzystaj z AI ostroznie i finalizuj dopiero gdy zapis diagnozy jest gotowy.',
      journeyTitle: 'Punkty kontrolne workbencha',
      contractTitle: 'Co pozostaje tu zarzadzane',
      journey: [
        {
          id: 'answers',
          title: 'Odpowiedzi i evidence sa razem',
          description:
            'Rekord sesji utrzymuje obserwacje, notatki i kontekst scoringu w jednym miejscu.',
          icon: FileCheck2,
        },
        {
          id: 'scoring',
          title: 'Scoring podaza za metoda',
          description:
            'Interpretacja jest zakotwiczona w rodzinie assessmentu, a nie w ad hoc judgment.',
          icon: ShieldCheck,
        },
        {
          id: 'promotion',
          title: 'Promocja startuje z zamknietych wnioskow',
          description: 'Raporty i inicjatywy dziedzicza zrodlo assessmentu oraz jego evidence.',
          icon: FolderOutput,
        },
      ],
      contract: [
        'Evidence i scoring pozostaja widoczne przed kazdym krokiem promocji.',
        'Wsparcie AI pomaga interpretowac wynik, ale nie nadpisuje dyscypliny metody.',
        'Dzialania downstream pozostaja powiazane z ta sesja assessmentu.',
      ],
      downstreamLabel: 'Most assessmentu',
      downstream: ['Raport', 'Inicjatywa', 'Follow-up tool', 'Output'],
    },
  },
};

export const AssessmentV8CanonPanel: React.FC<AssessmentV8CanonPanelProps> = ({
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
