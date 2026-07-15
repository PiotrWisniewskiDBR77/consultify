import { ArrowRight, CheckCircle2, FileText, HelpCircle, Lightbulb, Target } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useHelpSidePanel } from '@/contexts/HelpContext';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';
import { TEXT_L1 } from '@/styles/typography';

import {
  type NModeAction,
  type NModePropertyField,
  type NModeSection,
  NModeShell,
} from '../shared/NModeLayout';
import { DynamicSwotLibraryGraphic } from './DynamicSwotLibraryGraphic';
import { GrowthPathsLibraryGraphic } from './GrowthPathsLibraryGraphic';
import { MarketForcesLibraryGraphic } from './MarketForcesLibraryGraphic';
import { PortfolioPriorityLibraryGraphic } from './PortfolioPriorityLibraryGraphic';
import { RiskUncertaintyLibraryGraphic } from './RiskUncertaintyLibraryGraphic';

type KnownTool = Awaited<ReturnType<typeof Api.getKnownTool>>['tool'];

export function KnownToolDetailView(props: {
  toolType: string;
  onClose: () => void;
  onSessionCreated: (sessionId: string, toolType: string, name: string) => void;
}) {
  const { toolType, onClose, onSessionCreated } = props;
  const { i18n, t } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';
  const isPolish = lang === 'pl';
  const { currentProjectId } = useAppStore();
  const {
    setOpen: setHelpOpen,
    setActiveTab: setHelpTab,
    setKnowledgeModuleIdOverride,
  } = useHelpSidePanel();

  const { mode, setMode } = usePresentationMode({ entityType: 'tool', syncURL: false });

  const [activeSection, setActiveSection] = useState<string>('goal');
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<KnownTool | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await Api.getKnownTool(toolType, { lang });
        if (!alive) return;
        setTool(res.tool);
        trackFunnelEvent('known_tool_viewed', { toolType });
      } catch (e: any) {
        if (!alive) return;
        toast.error(e?.message || 'Failed to load tool');
        setTool(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [toolType, lang]);

  const openKb = () => {
    setKnowledgeModuleIdOverride(toolType);
    setHelpTab('knowledge');
    setHelpOpen(true);
    trackFunnelEvent('tool_kb_opened', { toolType });
  };

  const startSession = async () => {
    if (!tool) return;
    if (!tool.isActive) {
      toast.error(t('discoveryToolsMain.knownToolDetailView.thisToolIsNotActiveYet'));
      return;
    }
    try {
      setStarting(true);
      trackFunnelEvent('tool_session_started_from_library', { toolType: tool.toolType });
      const created = await Api.createToolSession({
        toolType: tool.toolType,
        name: `${tool.name} — Session`,
        projectId: currentProjectId || null,
      });
      onSessionCreated(created.id, tool.toolType, tool.name);
      toast.success(t('discoveryToolsMain.knownToolDetailView.toolSessionCreated'));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to start tool session');
    } finally {
      setStarting(false);
    }
  };

  const properties: NModePropertyField[] = useMemo(() => {
    const category = tool?.libraryCategory || '-';
    return [
      {
        id: 'toolType',
        label: { en: 'Tool type', pl: 'Typ narzędzia' },
        type: 'text',
        value: tool?.toolType || toolType,
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'category',
        label: { en: 'Category', pl: 'Kategoria' },
        type: 'text',
        value: category,
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'stage',
        label: { en: 'Consulting stage', pl: 'Etap konsultingowy' },
        type: 'text',
        value: t('discoveryToolsMain.knownToolDetailView.learnTheTool'),
        onChange: () => {},
        readOnly: true,
      },
    ];
  }, [isPolish, tool, toolType]);

  const actions: NModeAction[] = useMemo(
    () => [
      {
        id: 'start',
        label: { en: 'Start session', pl: 'Startuj sesję' },
        icon: ArrowRight,
        variant: 'success',
        onClick: startSession,
        disabled: starting || !tool || !tool.isActive,
        loading: starting,
        title: {
          en: 'Create a tool session and start working',
          pl: 'Utwórz sesję narzędzia i rozpocznij pracę',
        },
      },
      {
        id: 'help',
        label: { en: 'How to / Knowledge base', pl: 'How to / Baza wiedzy' },
        icon: HelpCircle,
        variant: 'neutral',
        onClick: openKb,
        disabled: !tool,
      },
    ],
    [tool, starting, toolType]
  );

  const sections: NModeSection[] = useMemo(() => {
    const bullets = (items: string[] | undefined) => {
      const safe = Array.isArray(items) ? items : [];
      if (safe.length === 0) {
        return (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Ta sekcja zostanie uzupełniona w kolejnych iteracjach.'
              : 'This section will be expanded in upcoming iterations.'}
          </div>
        );
      }
      return (
        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          {safe.map((v, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary-400" />
              <span>{v}</span>
            </li>
          ))}
        </ul>
      );
    };

    const chipRow = (items: string[] | undefined) => {
      const safe = Array.isArray(items) ? items : [];
      if (safe.length === 0) return null;
      return (
        <div className="flex flex-wrap gap-2">
          {safe.map((v, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/60 dark:bg-navy-900/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-navy-700"
            >
              {v}
            </span>
          ))}
        </div>
      );
    };

    const caseGrid = (
      cases: Array<{
        title: string;
        context: string;
        question: string;
        evidence: string[];
        aiDraft: string;
        approvedUse: string;
        outcome: string;
      }>
    ) => (
      <div className="grid gap-4 lg:grid-cols-3">
        {cases.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30"
          >
            <div className={TEXT_L1}>{t('discoveryToolsMain.knownToolDetailView.case')}</div>
            <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {item.title}
            </h3>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t('discoveryToolsMain.knownToolDetailView.context')}
                </span>
                {item.context}
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t('discoveryToolsMain.knownToolDetailView.question')}
                </span>
                {item.question}
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t('discoveryToolsMain.knownToolDetailView.evidence')}
                </span>
                {item.evidence.join(' ')}
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t('discoveryToolsMain.knownToolDetailView.aIDraft')}
                </span>
                {item.aiDraft}
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t('discoveryToolsMain.knownToolDetailView.afterApproval')}
                </span>
                {item.approvedUse}
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t('discoveryToolsMain.knownToolDetailView.outcome')}
                </span>
                {item.outcome}
              </div>
            </div>
          </div>
        ))}
      </div>
    );

    const goalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-500">
            {t('discoveryToolsMain.knownToolDetailView.toolPositioning')}
          </div>
          <div className="mt-3 text-lg font-semibold leading-tight text-slate-900 dark:text-slate-100">
            {isPolish
              ? 'Dynamic SWOT nie służy do wypełnienia macierzy. Służy do zamiany rozproszonej rozmowy strategicznej w decyzję, napięcia i ruchy gotowe do dalszego użycia.'
              : 'Dynamic SWOT is not meant to fill a matrix. It is meant to turn a fragmented strategic conversation into a decision, tensions, and moves ready for downstream use.'}
          </div>
          <div className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'To narzędzie typu conversation-first, structure-backed. Najpierw ustawia pytanie strategiczne i porządkuje evidence z wnętrza firmy oraz z rynku. Dopiero potem buduje macierz, wyciąga napięcia, układa rekomendowane ruchy i przygotowuje materiał, który może przejść do raportu, prezentacji, inicjatyw lub dalszej pracy decyzyjnej.'
              : 'This is a conversation-first, structure-backed tool. It frames the strategic question and structures evidence from inside the company and the market first. Only then does it build the matrix, surface tensions, sequence recommended moves, and prepare material that can feed a report, presentation, initiatives, or further decision work.'}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              {t('discoveryToolsMain.knownToolDetailView.whatTheToolActuallyDoes')}
            </div>
            {bullets(
              isPolish
                ? [
                    'oddziela sygnały ważne od szumu, opinii i marketingowych ogólników',
                    'ustawia wspólny obraz sytuacji wewnętrznej i zewnętrznej',
                    'zamienia klasyczny SWOT w logikę napięć, trade-offów i decyzji',
                    'prowadzi od diagnozy do rekomendowanego ruchu oraz outputów',
                  ]
                : [
                    'separates the critical signals from noise, opinion, and generic statements',
                    'builds one shared picture of internal and external reality',
                    'turns classic SWOT into tension, trade-off, and decision logic',
                    'takes the user from diagnosis to a recommended move and downstream outputs',
                  ]
            )}
          </div>
          <div className="rounded-2xl border border-danger-200/70 bg-danger-500/5 p-4 dark:border-danger-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-danger-700 dark:text-danger-300">
              {t('discoveryToolsMain.knownToolDetailView.whatThisToolIsNot')}
            </div>
            {bullets(
              isPolish
                ? [
                    'nie jest szkolnym ćwiczeniem polegającym na zapełnieniu czterech pól',
                    'nie jest miejscem na wrzucenie wszystkiego bez oceny jakości evidence',
                    'nie jest narzędziem do udawania decyzji, gdy pytanie strategiczne nadal jest nieostre',
                    'nie jest końcowym artefaktem, tylko źródłem dla dalszych materiałów i przejścia do działania',
                  ]
                : [
                    'it is not a classroom exercise about filling four boxes',
                    'it is not a dump for everything without assessing evidence quality',
                    'it is not a way to fake a decision when the strategic question is still vague',
                    'it is not the final deliverable, but the source for deliverables and execution',
                  ]
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              {t('discoveryToolsMain.knownToolDetailView.whenToUse')}
            </div>
            {bullets(
              isPolish
                ? [
                    'gdy zarząd lub zespół ma dużo sygnałów, ale nie ma jednej logiki decyzji',
                    'gdy trzeba połączyć realia firmy z rynkiem i nazwać, co naprawdę zmienia kierunek',
                    'gdy decyzja jest ważna, ale sytuacja nadal wygląda jak zbiór luźnych obserwacji',
                    'gdy wynik ma przejść dalej do raportu, decka, inicjatywy albo materiału decyzyjnego',
                  ]
                : [
                    'when leadership has many signals but no single decision logic',
                    'when internal reality must be confronted with the market and translated into what truly changes the direction',
                    'when the decision matters but the situation still looks like disconnected observations',
                    'when the result must feed a report, deck, initiative, or decision brief',
                  ]
            )}
          </div>
          <div className="rounded-2xl border border-danger-200/70 bg-danger-500/5 p-4 dark:border-danger-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-danger-700 dark:text-danger-300">
              {t('discoveryToolsMain.knownToolDetailView.whenNotToStartWithSWOT')}
            </div>
            {bullets(
              isPolish
                ? [
                    'gdy najpierw trzeba zrozumieć makrootoczenie, trendy i regulacje: wtedy najpierw PESTEL',
                    'gdy główne pytanie dotyczy struktury branży i sił konkurencyjnych: wtedy najpierw Five Forces',
                    'gdy decyzja jest już podjęta i potrzeba jedynie planu wykonawczego: wtedy lepsze jest planowanie inicjatyw',
                    'gdy zespół chce wyłącznie pozytywnego języka mobilizacyjnego bez pracy na ryzykach i słabościach',
                  ]
                : [
                    'when the first job is to understand macro trends, context, or regulation: start with PESTEL',
                    'when the core question is industry structure and competitive pressure: start with Five Forces',
                    'when the decision has already been made and only execution planning is needed: use initiative planning instead',
                    'when the team wants only positive mobilization language without working through risk and weakness',
                  ]
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('discoveryToolsMain.knownToolDetailView.whatToPrepareBeforeStarting')}
            </div>
            {bullets(
              isPolish
                ? [
                    'konkretne pytanie strategiczne, które naprawdę wymaga decyzji',
                    'zakres, horyzont czasu, success signal i najważniejsze constraints',
                    'znane sygnały wewnętrzne i zewnętrzne, nawet jeśli są jeszcze niepełne',
                    'pliki, linki, benchmarki, notatki z rozmów albo wcześniejsze analizy',
                  ]
                : [
                    'a concrete strategic question that truly needs a decision',
                    'scope, time horizon, success signal, and the key constraints',
                    'known internal and external signals, even if still incomplete',
                    'files, links, benchmarks, interview notes, or prior analyses',
                  ]
            )}
          </div>
          <div className="rounded-2xl border border-primary-200/70 bg-primary-500/5 p-4 dark:border-primary-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
              {isPolish
                ? 'Co sprawia, że SWOT jest tutaj dynamiczny'
                : 'What makes the SWOT dynamic here'}
            </div>
            {chipRow(
              isPolish
                ? ['Mission brief', 'Evidence-first', 'Tensions', 'Recommended moves', 'Outputs']
                : ['Mission brief', 'Evidence-first', 'Tensions', 'Recommended moves', 'Outputs']
            )}
            <div className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {isPolish
                ? 'Klasyczna macierz jest tylko etapem pośrodku. Dynamiczna wersja wymusza najpierw lepsze ustawienie pytania, potem higienę sygnałów i evidence, a następnie przejście do TOWS-owej logiki połączeń, napięć i ruchów strategicznych.'
                : 'The classical matrix is only the middle step. The dynamic version forces stronger framing first, then signal and evidence hygiene, and only then moves into TOWS-style connection logic, tensions, and strategic moves.'}
            </div>
          </div>
        </div>

        <DynamicSwotLibraryGraphic isPolish={isPolish} variant="process" />
      </div>
    );

    const processSteps = [
      {
        id: 1,
        title: t('discoveryToolsMain.knownToolDetailView.missionBrief'),
        oneLiner: isPolish
          ? 'Ustaw pytanie decyzyjne, zakres i success signal'
          : 'Frame the decision question, scope, and success signal',
        items: isPolish
          ? [
              'nazwij decyzję, która naprawdę ma zostać podjęta',
              'ustal zakres, horyzont czasu, success signal i constraints',
              'odróżnij temat sesji od wszystkiego, co jest dziś poza zakresem',
            ]
          : [
              'name the decision that truly needs to be made',
              'set the scope, time horizon, success signal, and constraints',
              'separate the session topic from everything that is out of scope today',
            ],
        note: isPolish
          ? 'Jakość całej sesji zależy od jakości pytania otwierającego. Jeśli punkt wyjścia jest mglisty, macierz będzie tylko ładnie uporządkowanym chaosem.'
          : 'The quality of the full session depends on the opening question. If the brief is vague, the matrix becomes only well-organized chaos.',
        accent: 'bg-navy-900',
        tone: 'from-primary-500/12 to-crimson-700/5',
      },
      {
        id: 2,
        title: t('discoveryToolsMain.knownToolDetailView.signalsEvidence'),
        oneLiner: isPolish
          ? 'Zbierz fakty, obserwacje i hipotezy z wnętrza firmy i rynku'
          : 'Collect facts, observations, and hypotheses from inside and outside',
        items: isPolish
          ? [
              'zbierz sygnały z rozmów, materiałów, plików, linków i benchmarków',
              'oznacz, czy wpis jest faktem, obserwacją czy hipotezą',
              'rozdziel sygnały wewnętrzne od zewnętrznych i skróć je do jednej tezy',
            ]
          : [
              'collect signals from interviews, materials, files, links, and benchmarks',
              'mark whether an entry is a fact, observation, or hypothesis',
              'separate internal from external signals and reduce each to one clear thesis',
            ],
        note: isPolish
          ? 'Na tym etapie nie wyciąga się jeszcze decyzji. Powstaje warstwa źródłowa, z której później da się obronić wnioski.'
          : 'This is not the stage for conclusions yet. It builds the source layer from which the later conclusions can be defended.',
        accent: 'bg-sky-500',
        tone: 'from-sky-500/12 to-blue-500/5',
      },
      {
        id: 3,
        title: t('discoveryToolsMain.knownToolDetailView.matrixBuild'),
        oneLiner: isPolish
          ? 'Przypisz sygnały do S/W/O/T, usuń szum, zostaw to co zmienia decyzję'
          : 'Assign signals to S/W/O/T, remove noise, keep what moves the decision',
        items: isPolish
          ? [
              'przypisz sygnały do Strengths, Weaknesses, Opportunities i Threats',
              'usuń duplikaty, rozdziel objawy od przyczyn i podważaj ogólniki',
              'zostaw tylko karty, które rzeczywiście zmieniają pole decyzji',
            ]
          : [
              'assign the signals to Strengths, Weaknesses, Opportunities, and Threats',
              'remove duplicates, separate symptoms from causes, and challenge generic wording',
              'keep only the cards that truly change the decision space',
            ],
        note: isPolish
          ? 'Mocna macierz nie jest długa. Jest selektywna, konkretna i oparta na źródłach.'
          : 'A strong matrix is not long. It is selective, concrete, and backed by sources.',
        accent: 'bg-emerald-500',
        tone: 'from-emerald-500/12 to-blue-500/5',
      },
      {
        id: 4,
        title: t('discoveryToolsMain.knownToolDetailView.strategicTensions'),
        oneLiner: isPolish
          ? 'Pokaż, gdzie przewaga zderza się z ograniczeniem lub ryzykiem'
          : 'Show where advantage collides with constraint or risk',
        items: isPolish
          ? [
              'połącz karty w sytuacje decyzyjne: ofensywa, naprawa, obrona, ograniczanie',
              'pokaż, gdzie przewaga zderza się z ograniczeniem albo ryzykiem',
              'nazwij, dlaczego właśnie to napięcie ma znaczenie teraz, a nie później',
            ]
          : [
              'connect cards into decision situations: attack, repair, defend, reduce',
              'show where advantage meets constraint or risk',
              'name why this tension matters now rather than later',
            ],
        note: isPolish
          ? 'To tutaj pojawia się wartość konsultingowa. Sama lista kart przestaje być tabelą i zaczyna tworzyć logikę decyzji.'
          : 'This is where consulting value appears. The card list stops being a table and starts becoming decision logic.',
        accent: 'bg-amber-500',
        tone: 'from-amber-500/15 to-amber-500/5',
      },
      {
        id: 5,
        title: t('discoveryToolsMain.knownToolDetailView.movesOutputs'),
        oneLiner: isPolish
          ? 'Przełóż napięcia na rekomendowane ruchy i materiał do dalszego użycia'
          : 'Translate tensions into recommended moves and downstream material',
        items: isPolish
          ? [
              'przełóż napięcia na 2-4 rekomendowane ruchy z jasną sekwencją',
              'odróżnij quick win od ruchu strategicznego i od elementu, który wymaga jeszcze walidacji',
              'zamknij sesję source summary gotowym do raportu, decka, inicjatywy lub dalszej eksploracji',
            ]
          : [
              'translate the tensions into 2-4 recommended moves with a clear sequence',
              'separate a quick win from a strategic move and from an item that still needs validation',
              'close the session with a source summary ready for a report, deck, initiative, or further exploration',
            ],
        note: isPolish
          ? 'Dynamic SWOT jest dobry dopiero wtedy, gdy kończy się decyzją, ruchem albo sensownym mostem do działania.'
          : 'Dynamic SWOT is only strong when it ends in a decision, a move, or a credible bridge to action.',
        accent: 'bg-navy-900',
        tone: 'from-primary-500/15 to-crimson-500/5',
      },
    ];

    const ProcessStepper = () => {
      const [openStep, setOpenStep] = React.useState<number | null>(null);
      return (
        <div className="space-y-2">
          {processSteps.map((step) => {
            const isOpen = openStep === step.id;
            return (
              <div
                key={step.id}
                className={`rounded-2xl border transition-all duration-200 ${
                  isOpen
                    ? `border-slate-300/70 bg-gradient-to-br ${step.tone} shadow-sm dark:border-white/15`
                    : 'border-slate-200/50 bg-slate-50/50 hover:border-slate-300/70 hover:bg-slate-50/80 dark:border-white/5 dark:bg-white/[0.02] dark:hover:border-white/10'
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-3 text-left"
                  onClick={() => setOpenStep(isOpen ? null : step.id)}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-bold text-white dark:bg-white dark:text-slate-950">
                    {step.id}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {step.title}
                    </div>
                    {!isOpen && (
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {step.oneLiner}
                      </div>
                    )}
                  </div>
                  <span className={`mr-1 h-2 w-2 shrink-0 rounded-full ${step.accent}`} />
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    className={`shrink-0 text-slate-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <path
                      d="M3 5.5l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-200/50 px-3 pb-4 pt-3 dark:border-white/5">
                    <div className="pl-10">
                      {bullets(step.items)}
                      {step.note ? (
                        <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                          {step.note}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    const processSection = (
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {t('discoveryToolsMain.knownToolDetailView.workLogic')}
            </h2>
            <span className="inline-flex shrink-0 rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
              Process
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'Dobry Dynamic SWOT prowadzi przez pięć kroków biznesowych. Flow jest prosty dla użytkownika, ale rygorystyczny merytorycznie: najpierw ustawienie decyzji, potem higiena sygnałów, potem porządna macierz, a dopiero na końcu napięcia, ruchy i outputy.'
              : 'A strong Dynamic SWOT runs through five business steps. The flow is simple for the user but rigorous in substance: frame the decision first, clean the signals second, build a strong matrix third, and only then move into tensions, moves, and outputs.'}
          </div>
        </div>

        <ProcessStepper />

        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {isPolish
                ? 'Jak wygląda dobra sesja końcowa'
                : 'What a strong finished session looks like'}
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-emerald-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200">
              Quality
            </span>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
            {(isPolish
              ? [
                  'macierz z 6-12 wyselekcjonowanymi czynnikami rozłożonymi w 4 ćwiartkach (S/W/O/T) — każdy z oznaczonym źródłem i typem evidence, zamiast długiej listy wszystkiego',
                  '3-6 napięć strategicznych, które naprawdę tłumaczą pole decyzji',
                  '2-4 rekomendowane ruchy z jasną sekwencją i pierwszym krokiem',
                  'co najmniej 1 output candidate gotowy do dalszej decyzji lub akceptacji sponsora',
                  'final source summary, z którego da się bezpośrednio zbudować raport lub deck',
                ]
              : [
                  'a matrix with 6-12 selected factors across the 4 quadrants (S/W/O/T) — each with a marked source and evidence type, instead of a long list of everything',
                  '3-6 strategic tensions that genuinely explain the decision space',
                  '2-4 recommended moves with a clear sequence and first step',
                  'at least 1 output candidate ready for further decision or sponsor approval',
                  'a final source summary that can directly feed a report or deck',
                ]
            ).map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-primary-200/70 bg-primary-500/5 p-4 dark:border-primary-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
              {t('discoveryToolsMain.knownToolDetailView.4CommonDecisionSituations')}
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-primary-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary-800 dark:border-primary-800/50 dark:bg-white/[0.05] dark:text-primary-200">
              Insight
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'W kroku 4 łączysz czynniki wewnętrzne z zewnętrznymi. Każde takie połączenie tworzy jedną z czterech sytuacji decyzyjnych. Rozpoznanie typu sytuacji pomaga szybko zdecydować, jaki ruch jest logiczny.'
              : 'In step 4 you connect internal factors with external ones. Each connection creates one of four decision situations. Recognizing the type helps quickly decide what move makes sense.'}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(isPolish
              ? [
                  {
                    label: 'Siła + Szansa',
                    desc: 'Masz przewagę i rynek daje okazję. Graj ofensywnie — wykorzystaj to, co masz, żeby wejść w szansę.',
                    accent: 'emerald',
                  },
                  {
                    label: 'Słabość + Szansa',
                    desc: 'Szansa jest, ale wewnętrzna luka ją blokuje. Najpierw napraw lukę, potem wejdź w szansę.',
                    accent: 'sky',
                  },
                  {
                    label: 'Siła + Zagrożenie',
                    desc: 'Zewnętrzne ryzyko rośnie, ale masz przewagę. Użyj jej, żeby obronić pozycję.',
                    accent: 'amber',
                  },
                  {
                    label: 'Słabość + Zagrożenie',
                    desc: 'Słabość zwiększa ekspozycję na ryzyko. Najpierw ogranicz słabość, żeby zmniejszyć zagrożenie.',
                    accent: 'rose',
                  },
                ]
              : [
                  {
                    label: 'Strength + Opportunity',
                    desc: 'You have advantage and the market offers an opening. Play offensively — use what you have to capture the opportunity.',
                    accent: 'emerald',
                  },
                  {
                    label: 'Weakness + Opportunity',
                    desc: 'The opportunity exists, but an internal gap blocks it. Fix the gap first, then move in.',
                    accent: 'sky',
                  },
                  {
                    label: 'Strength + Threat',
                    desc: 'External risk is rising, but you have advantage. Use it to defend your position.',
                    accent: 'amber',
                  },
                  {
                    label: 'Weakness + Threat',
                    desc: 'A weakness increases exposure to risk. Reduce the weakness first to lower the threat.',
                    accent: 'rose',
                  },
                ]
            ).map((item) => {
              const accentMap: Record<
                string,
                { border: string; bg: string; title: string; dot: string }
              > = {
                emerald: {
                  border: 'border-emerald-200/70',
                  bg: 'bg-emerald-500/5',
                  title: 'text-emerald-700 dark:text-emerald-300',
                  dot: 'bg-emerald-500',
                },
                sky: {
                  border: 'border-sky-200/70',
                  bg: 'bg-sky-500/5',
                  title: 'text-sky-700 dark:text-sky-300',
                  dot: 'bg-sky-500',
                },
                amber: {
                  border: 'border-amber-200/70',
                  bg: 'bg-amber-500/5',
                  title: 'text-amber-700 dark:text-amber-300',
                  dot: 'bg-amber-500',
                },
                rose: {
                  border: 'border-danger-200/70',
                  bg: 'bg-danger-500/5',
                  title: 'text-danger-700 dark:text-danger-300',
                  dot: 'bg-danger-500',
                },
              };
              const a = accentMap[item.accent] || accentMap.emerald;
              return (
                <div key={item.label} className={`rounded-xl border ${a.border} ${a.bg} p-3`}>
                  <div className={`text-xs font-semibold ${a.title}`}>{item.label}</div>
                  <div className="mt-1.5 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
                    {item.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 dark:border-amber-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
              {t('discoveryToolsMain.knownToolDetailView.workingNotes')}
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-amber-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:border-amber-800/50 dark:bg-white/[0.05] dark:text-amber-200">
              Tips
            </span>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
            {(isPolish
              ? [
                  'SWOT nie jest celem, tylko etapem syntezy prowadzącym do decyzji',
                  'najczęstszy błąd to zbyt wiele słabych kart i zbyt mało selekcji',
                  'jakość wniosków nigdy nie będzie wyższa niż jakość sygnałów źródłowych',
                  'dobry prowadzący oddziela fakt od hipotezy i symptom od przyczyny',
                  'mocna sesja łączy realia wewnętrzne z rynkiem, a nie tylko opisuje jedną stronę sytuacji',
                  'wynik powinien być gotowy do użycia przez management, nie tylko do przeczytania przez autora analizy',
                ]
              : [
                  'SWOT is not the goal, but a synthesis step on the way to a decision',
                  'the most common mistake is too many weak cards and too little selection',
                  'the quality of conclusions never exceeds the quality of source signals',
                  'a strong facilitator separates fact from hypothesis and symptom from cause',
                  'a strong session connects internal reality with the market instead of describing only one side',
                  'the output should be ready for management use, not only for the analyst to read',
                ]
            ).map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );

    const outcomeBlocks = isPolish
      ? [
          {
            id: 'decision-frame',
            title: 'Rama decyzji',
            badge: 'Decision',
            color: 'violet' as const,
            what: 'Pytanie strategiczne, zakres, horyzont czasu i success signal. Jasne przypomnienie, czego analiza dotyczy, a czego nie.',
            why: 'Bez ramy nawet dobra macierz zamienia się w ogólny opis firmy oderwany od decyzji.',
            next: 'Executive summary z logiką decyzji dla sponsora lub zarządu.',
          },
          {
            id: 'evidence-picture',
            title: 'Obraz czynników i evidence',
            badge: 'Evidence',
            color: 'sky' as const,
            what: 'Najmocniejsze karty S/W/O/T ze źródłami. Rozdzielenie faktów, obserwacji i hipotez.',
            why: 'Decydent widzi nie tylko wniosek, ale też jakość materiału, na którym ten wniosek stoi.',
            next: 'Uzasadniona macierz i defensible story do rozmowy decyzyjnej.',
          },
          {
            id: 'tensions',
            title: 'Napięcia strategiczne',
            badge: 'Tensions',
            color: 'amber' as const,
            what: 'Najważniejsze połączenia między kartami wewnętrznymi i zewnętrznymi. Sytuacje decyzyjne, które zmieniają logikę ruchu.',
            why: 'Obserwacje przestają być listą i zaczynają tłumaczyć, gdzie leży prawdziwy trade-off.',
            next: 'Warstwa interpretacji do dyskusji z managementem i wyboru priorytetów.',
          },
          {
            id: 'moves',
            title: 'Rekomendowane ruchy',
            badge: 'Moves',
            color: 'emerald' as const,
            what: '2-4 ruchy wynikające z napięć z jasną sekwencją. Rozróżnienie: quick win, big bet, ruch obronny, capability build.',
            why: 'Przejście od diagnozy do ruchu, który ma sens biznesowy, ma pierwszy krok i da się obronić logicznie.',
            next: 'Shortlista ruchów do decka, sponsor decision lub rozwinięcia w inicjatywę.',
          },
          {
            id: 'execution-bridge',
            title: 'Most do działania',
            badge: 'Execution',
            color: 'rose' as const,
            what: 'Source summary gotowy do raportu lub prezentacji. Wybór: co na inicjatywę, co na deck, co zostaje ideą.',
            why: 'SWOT bez tego etapu zostawia zespół z ciekawą analizą, ale bez ruchu.',
            next: 'Raport, prezentacja, inicjatywa albo dalsza eksploracja z tego samego materiału.',
          },
        ]
      : [
          {
            id: 'decision-frame',
            title: 'Decision frame',
            badge: 'Decision',
            color: 'violet' as const,
            what: 'The strategic question, scope, time horizon, and success signal. An explicit statement of what the analysis covers and what it does not.',
            why: 'Without this frame even a strong matrix drifts away from the real decision.',
            next: 'An executive summary with a clear decision frame for the sponsor or board.',
          },
          {
            id: 'evidence-picture',
            title: 'Factor picture & evidence',
            badge: 'Evidence',
            color: 'sky' as const,
            what: 'The strongest S/W/O/T cards with their sources. A clear separation of facts, observations, and hypotheses.',
            why: 'Decision-makers see not only the conclusion, but the quality of the material underneath it.',
            next: 'A defensible matrix and narrative for the next decision discussion.',
          },
          {
            id: 'tensions',
            title: 'Strategic tensions',
            badge: 'Tensions',
            color: 'amber' as const,
            what: 'The most important connections between internal and external cards. Decision situations that change the move logic.',
            why: 'Observations stop being a list and start explaining where the real trade-off sits.',
            next: 'An interpretation layer for leadership discussion and priority choices.',
          },
          {
            id: 'moves',
            title: 'Recommended moves',
            badge: 'Moves',
            color: 'emerald' as const,
            what: '2-4 moves emerging from tensions with a clear sequence. Quick win vs big bet vs defensive move vs capability build.',
            why: 'The handoff from diagnosis to a move that makes business sense and can be defended logically.',
            next: 'A shortlist of moves for the deck, sponsor decision, or initiative design.',
          },
          {
            id: 'execution-bridge',
            title: 'Bridge to execution',
            badge: 'Execution',
            color: 'rose' as const,
            what: 'A source summary ready for the report or presentation. What goes to an initiative, what needs a deck, what stays an idea.',
            why: 'SWOT without this step leaves the team with an interesting analysis but no move.',
            next: 'A report, presentation, initiative push, or further exploration from the same source package.',
          },
        ];

    const colorMap = {
      violet: {
        card: 'border-primary-200/70 bg-primary-500/5 dark:border-primary-900/40',
        badge:
          'border-primary-300/50 bg-white/70 text-primary-800 dark:border-primary-800/50 dark:bg-white/[0.05] dark:text-primary-200',
        title: 'text-primary-700 dark:text-primary-300',
        dot: 'bg-navy-900',
      },
      sky: {
        card: 'border-sky-200/70 bg-sky-500/5 dark:border-sky-900/40',
        badge:
          'border-sky-300/50 bg-white/70 text-sky-800 dark:border-sky-800/50 dark:bg-white/[0.05] dark:text-sky-200',
        title: 'text-sky-700 dark:text-sky-300',
        dot: 'bg-sky-500',
      },
      amber: {
        card: 'border-amber-200/70 bg-amber-500/5 dark:border-amber-900/40',
        badge:
          'border-amber-300/50 bg-white/70 text-amber-800 dark:border-amber-800/50 dark:bg-white/[0.05] dark:text-amber-200',
        title: 'text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500',
      },
      emerald: {
        card: 'border-emerald-200/70 bg-emerald-500/5 dark:border-emerald-900/40',
        badge:
          'border-emerald-300/50 bg-white/70 text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200',
        title: 'text-emerald-700 dark:text-emerald-300',
        dot: 'bg-emerald-500',
      },
      rose: {
        card: 'border-danger-200/70 bg-danger-500/5 dark:border-danger-900/40',
        badge:
          'border-danger-300/50 bg-white/70 text-danger-800 dark:border-danger-800/50 dark:bg-white/[0.05] dark:text-danger-200',
        title: 'text-danger-700 dark:text-danger-300',
        dot: 'bg-danger-500',
      },
    };

    const outcomesSection = (
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {t('discoveryToolsMain.knownToolDetailView.whatTheSessionProduces')}
            </h2>
            <span className="inline-flex shrink-0 rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
              Output
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'Dobrze wykonany Dynamic SWOT kończy się materiałem gotowym do użycia: pytanie decyzyjne, jakość evidence, kluczowe napięcia i sekwencja ruchów.'
              : 'A strong Dynamic SWOT ends with usable material: the decision question, evidence quality, key tensions, and a move sequence.'}
          </div>
        </div>

        <div className="space-y-3">
          {outcomeBlocks.map((block) => {
            const c = colorMap[block.color];
            return (
              <div key={block.id} className={`rounded-2xl border p-4 ${c.card}`}>
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${c.title}`}
                  >
                    {block.title}
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${c.badge}`}
                  >
                    {block.badge}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-500">
                      {t('discoveryToolsMain.knownToolDetailView.contains')}
                    </div>
                    <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                      {block.what}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-500">
                      {t('discoveryToolsMain.knownToolDetailView.whyItMatters')}
                    </div>
                    <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                      {block.why}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-500">
                      {t('discoveryToolsMain.knownToolDetailView.enablesNext')}
                    </div>
                    <div className="text-sm leading-relaxed text-slate-900 dark:text-white">
                      {block.next}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {t('discoveryToolsMain.knownToolDetailView.whatAStrongOutcomeLooksLike')}
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-emerald-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200">
              Quality
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'Dobry wynik jest selektywny, evidence-backed i decyzyjny. Nie pokazuje wszystkiego, co udało się zebrać, tylko to, co naprawdę zmienia logikę wyboru i pozwala przejść do kolejnego kroku.'
              : 'A strong result is selective, evidence-backed, and decision-oriented. It does not show everything that was collected, only what truly changes the choice logic and enables the next step.'}
          </p>
        </div>
      </div>
    );

    const exampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('discoveryToolsMain.knownToolDetailView.example')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'Przykład pokazuje sytuację typową dla firm w transformacji: presja rośnie i technologia kusi jako szybka odpowiedź, ale najpierw trzeba ustalić, czy problemem jest naprawdę brak rozwiązania, czy brak prawdy o sytuacji.'
              : 'This example shows a common transformation moment: pressure rises and technology looks like the quick answer, but the first job is to establish whether the real problem is the missing solution or the missing truth about the situation.'}
          </div>
        </div>

        {caseGrid(
          isPolish
            ? [
                {
                  title: 'Premium producent przed CAPEX-em',
                  context:
                    'Marża spada, lead times są niestabilne, a zarząd rozważa automatyzację.',
                  question:
                    'Czy zaczynać od inwestycji technologicznej, czy od diagnozy strat i bottlenecków?',
                  evidence: [
                    'Wywiady pokazują silną markę i zaufanie klientów premium, ale też decyzje operacyjne podejmowane intuicyjnie.',
                    'Dane wskazują straty w przepływie, brak wspólnej definicji bottlenecków i rosnące koszty ekspresowych dostaw.',
                  ],
                  aiDraft:
                    'AI proponuje SWOT z mocnymi stronami w reputacji i relacjach B2B, słabościami w widoczności procesu, szansą w diagnostyce danych oraz zagrożeniem automatyzacji złego problemu.',
                  approvedUse:
                    'Użytkownik akceptuje tylko te karty, które mają evidence, a odrzuca ogólniki typu “wdrożyć AI”. Zaakceptowane elementy przechodzą do napięć i ruchów.',
                  outcome:
                    'Powstaje decyzja: przed CAPEX-em uruchomić diagnozę strat, mapę bottlenecków i warstwę danych, a automatyzację potraktować jako drugi etap.',
                },
                {
                  title: 'Software house po utracie dużego klienta',
                  context:
                    'Firma ma mocny zespół ekspercki, ale pipeline sprzedażowy jest zbyt zależny od rekomendacji.',
                  question:
                    'Czy skalować sprzedaż outbound, czy najpierw zawęzić pozycjonowanie oferty?',
                  evidence: [
                    'CRM pokazuje długi cykl sprzedaży poza rekomendacjami, a rozmowy z klientami wskazują niejasne rozróżnienie oferty.',
                    'Zespół ma mocne kompetencje techniczne, ale materiały sprzedażowe nie pokazują mierzalnych efektów projektów.',
                  ],
                  aiDraft:
                    'AI proponuje czynniki SWOT dotyczące eksperckiego delivery, słabej narracji wartości, szansy w pionizacji oferty i zagrożenia dalszą zależnością od pojedynczych kont.',
                  approvedUse:
                    'Po akceptacji kart AI buduje napięcie między jakością delivery a brakiem ostrego ICP oraz proponuje ruchy przed skalowaniem outboundu.',
                  outcome:
                    'Powstaje sekwencja: zawęzić ICP, stworzyć proof pack z efektami klientów, przetestować 2 kampanie segmentowe i dopiero potem zwiększać sprzedaż.',
                },
                {
                  title: 'Sieć usług lokalnych przed ekspansją',
                  context: 'Popyt rośnie, ale jakość operacyjna różni się między lokalizacjami.',
                  question:
                    'Czy otwierać kolejne punkty, czy najpierw standaryzować model działania?',
                  evidence: [
                    'Opinie klientów są bardzo dobre w najlepszych lokalizacjach, ale reklamacje koncentrują się wokół kilku powtarzalnych etapów usługi.',
                    'Managerowie lokalni różnie rozumieją standard jakości, a onboarding nowych pracowników trwa zbyt długo.',
                  ],
                  aiDraft:
                    'AI proponuje mocne strony w marce lokalnej i relacji z klientem, słabości w standardzie operacyjnym, szansę w playbooku ekspansji i zagrożenie utraty jakości przy skalowaniu.',
                  approvedUse:
                    'Zaakceptowane karty są używane do wyboru, czy przewaga jest naprawdę skalowalna, czy zależy od pojedynczych ludzi i lokalnych praktyk.',
                  outcome:
                    'Rekomendacja: najpierw stworzyć standard usługi, dashboard jakości i model szkolenia, a dopiero potem otwierać kolejne punkty.',
                },
              ]
            : [
                {
                  title: 'Premium manufacturer before CAPEX',
                  context:
                    'Margin is falling, lead times are unstable, and leadership is considering automation.',
                  question:
                    'Should the company start with technology investment or diagnose losses and bottlenecks first?',
                  evidence: [
                    'Interviews show strong brand trust and premium customer relationships, but operational decisions are still intuition-led.',
                    'Data points to flow losses, no shared bottleneck definition, and rising expediting costs.',
                  ],
                  aiDraft:
                    'AI proposes SWOT cards around reputation and B2B trust, weak process visibility, a data-diagnosis opportunity, and the threat of automating the wrong problem.',
                  approvedUse:
                    'The user accepts only evidence-backed cards and rejects generic “implement AI” recommendations. Approved cards feed tensions and moves.',
                  outcome:
                    'The decision becomes: run loss diagnosis, bottleneck mapping, and a data layer before CAPEX, with automation as the second stage.',
                },
                {
                  title: 'Software firm after losing a major client',
                  context:
                    'The team is strong, but the sales pipeline depends too heavily on referrals.',
                  question: 'Should it scale outbound sales or first sharpen offer positioning?',
                  evidence: [
                    'CRM data shows long sales cycles outside referrals, while customer interviews reveal unclear offer differentiation.',
                    'The team has strong technical capability, but sales materials do not show measurable customer outcomes.',
                  ],
                  aiDraft:
                    'AI proposes SWOT cards on expert delivery, weak value narrative, an opportunity to verticalize the offer, and the threat of continued key-account dependency.',
                  approvedUse:
                    'Approved cards create the tension between delivery quality and weak ICP clarity, then shape moves before outbound scale.',
                  outcome:
                    'The sequence is: narrow ICP, build a customer proof pack, test two segment campaigns, and only then expand sales effort.',
                },
                {
                  title: 'Local services network before expansion',
                  context: 'Demand is growing, but operating quality varies across locations.',
                  question:
                    'Should the company open more sites or standardize the operating model first?',
                  evidence: [
                    'Customer reviews are excellent in the best locations, but complaints cluster around repeatable service steps.',
                    'Local managers interpret quality standards differently, and onboarding new staff takes too long.',
                  ],
                  aiDraft:
                    'AI proposes strengths in local brand and customer trust, weaknesses in operating standard, an expansion-playbook opportunity, and the threat of quality loss while scaling.',
                  approvedUse:
                    'Approved cards help decide whether the advantage is truly scalable or dependent on individual people and local habits.',
                  outcome:
                    'The recommendation is to build a service standard, quality dashboard, and training model before opening more sites.',
                },
              ]
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50/70 p-4 dark:bg-navy-900/40">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
              {t('discoveryToolsMain.knownToolDetailView.situationAndDecisionQuestion')}
            </div>
            {bullets(
              isPolish
                ? [
                    'Ateliertoy to firma premium z własną produkcją i silną reputacją w B2B',
                    'marża spada, lead times są niestabilne, a zarząd rozważa wejście w kosztowną automatyzację',
                    'pytanie sesji brzmi: czy zaczynać transformację od CAPEX-u, czy najpierw od diagnozy strat, bottlenecków i blind spotów danych',
                  ]
                : [
                    'Ateliertoy is a premium company with in-house production and a strong B2B reputation',
                    'margin is under pressure, lead times are unstable, and leadership is considering expensive automation',
                    'the session question is whether the transformation should start with CAPEX or first with a diagnosis of losses, bottlenecks, and data blind spots',
                  ]
            )}
          </div>
          <div className="rounded-2xl bg-slate-50/70 p-4 dark:bg-navy-900/40">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
              {t('discoveryToolsMain.knownToolDetailView.keyInputSignals')}
            </div>
            {bullets(
              isPolish
                ? [
                    'mocna marka i zaufanie klientów premium są realną przewagą',
                    'decyzje operacyjne są nadal intuicyjne, a firma nie ma wspólnej prawdy o stratach i bottleneckach',
                    'na rynku rośnie oczekiwanie szybszych wdrożeń i większej przewidywalności',
                    'istnieje ryzyko przepalenia inwestycji, jeśli automatyzacja zostanie uruchomiona przed diagnozą procesu',
                  ]
                : [
                    'a strong brand and trusted premium customers are real advantages',
                    'operating decisions are still intuition-driven and there is no shared truth about losses and bottlenecks',
                    'the market increasingly expects faster delivery and higher predictability',
                    'there is a real risk of burning investment if automation starts before process diagnosis',
                  ]
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
              {t('discoveryToolsMain.knownToolDetailView.howTheMatrixLooks')}
            </div>
            {bullets(
              isPolish
                ? [
                    'Strengths: marka, relacje B2B, własna produkcja, kontrola IP',
                    'Weaknesses: brak wspólnej diagnozy, analogowe zarządzanie, słaba widoczność strat',
                    'Opportunities: diagnoza cyfrowa, warstwa danych, lepsze sekwencjonowanie inwestycji',
                    'Threats: presja cenowa, rosnące koszty i ryzyko automatyzacji złego problemu',
                  ]
                : [
                    'Strengths: brand, B2B trust, in-house production, IP control',
                    'Weaknesses: no shared diagnosis, analog management, weak visibility into losses',
                    'Opportunities: digital diagnosis, stronger data layer, better sequencing of investments',
                    'Threats: price pressure, rising costs, and the risk of automating the wrong problem',
                  ]
            )}
          </div>
          <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 dark:border-amber-900/40">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {t('discoveryToolsMain.knownToolDetailView.tensionAndInterpretation')}
            </div>
            {bullets(
              isPolish
                ? [
                    'firma ma realne aktywa do skalowania, ale nie ma jeszcze prawdy o tym, gdzie dziś wycieka wartość',
                    'automatyzacja wygląda atrakcyjnie, lecz bez diagnozy może tylko przyspieszyć chaos',
                    'główny wniosek brzmi: najpierw zobaczyć, co naprawdę ogranicza marżę i przepływ, a dopiero potem wybierać technologię',
                  ]
                : [
                    'the company has real assets to scale, but still lacks truth about where value is leaking today',
                    'automation looks attractive, yet without diagnosis it may only accelerate chaos',
                    'the main conclusion is to first see what truly constrains margin and flow, and only then choose the technology response',
                  ]
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
                {t('discoveryToolsMain.knownToolDetailView.recommendedMoves')}
              </div>
              {bullets(
                isPolish
                  ? [
                      'uruchomić diagnozę strat, bottlenecków i blind spotów danych przed CAPEX-em',
                      'zbudować wspólny obraz procesu oraz priorytetów transformacyjnych dla zarządu',
                      'dopiero potem ułożyć sekwencję: dane -> automatyzacja -> governance inwestycji',
                    ]
                  : [
                      'run a diagnosis of losses, bottlenecks, and data blind spots before CAPEX',
                      'build one shared view of the process and the transformation priorities for leadership',
                      'only then sequence the roadmap: data -> automation -> investment governance',
                    ]
              )}
            </div>
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
                {t('discoveryToolsMain.knownToolDetailView.outputsFromTheSession')}
              </div>
              {bullets(
                isPolish
                  ? [
                      'board-ready materiał tłumaczący, dlaczego transformację należy zacząć od diagnozy, a nie od zakupu technologii',
                      'krótka lista priorytetów i ryzyk do najbliższych decyzji transformacyjnych',
                      'materiał źródłowy do roadmapy, decka i wygenerowania inicjatyw w platformie',
                    ]
                  : [
                      'board-ready material explaining why the transformation should begin with diagnosis instead of a technology purchase',
                      'a short list of priorities and risks for the next transformation decisions',
                      'a source package for the roadmap, deck, and initiative generation in the platform',
                    ]
              )}
            </div>
          </div>
        </div>

        <DynamicSwotLibraryGraphic isPolish={isPolish} variant="example" />

        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 text-sm text-slate-700 dark:border-emerald-900/50 dark:text-slate-300">
          {isPolish
            ? 'To jest dobry case, bo nie kończy się na opisaniu czterech ćwiartek. Pokazuje, jak z sygnałów powstaje decyzja o kolejności ruchów oraz materiał, z którego można od razu przejść do działania.'
            : 'This is a strong case because it does not stop at describing four quadrants. It shows how signals turn into a decision about move sequence and into material that can immediately bridge into execution.'}
        </div>
      </div>
    );

    const marketGoalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-500">
            {t('discoveryToolsMain.knownToolDetailView.toolPositioning')}
          </div>
          <div className="mt-3 text-lg font-semibold leading-tight text-slate-900 dark:text-slate-100">
            {isPolish
              ? 'Market Forces nie służy do mechanicznego ocenienia pięciu sił. Służy do zamiany struktury rynku w decyzję: gdzie naciska marża, gdzie jest defensibility i jaki ruch ma sens.'
              : 'Market Forces is not a mechanical Five Forces scorecard. It turns market structure into a decision: where margin is pressured, where defensibility exists, and what move makes sense.'}
          </div>
          <div className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'To narzędzie jest evidence-first i AI-assisted. Najpierw ustawia branżę, zakres, pozycję firmy oraz pytanie decyzyjne. Potem AI pomaga zebrać sygnały z rozmów i kontekstu organizacji, proponuje scorecard sił, pyta użytkownika o akceptację i dopiero z zatwierdzonej diagnozy buduje implikacje, ruchy oraz inicjatywy.'
              : 'This is an evidence-first, AI-assisted tool. It frames the industry, scope, company position, and decision question first. AI then helps capture signals from interviews and organization context, proposes the force scorecard, asks for user approval, and only then builds implications, moves, and initiatives from the approved diagnosis.'}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-blue-200/70 bg-blue-500/5 p-4 dark:border-blue-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
              {t('discoveryToolsMain.knownToolDetailView.whatTheToolActuallyDoes')}
            </div>
            {bullets(
              isPolish
                ? [
                    'łączy kontekst organizacji i wywiadu z sygnałami rynku',
                    'zamienia sygnały w ocenę pięciu sił z driverami, evidence i confidence',
                    'pokazuje presję marży, siłę nabywców, bariery wejścia i defensibility',
                    'prowadzi od diagnozy rynku do rekomendowanych ruchów i inicjatyw',
                  ]
                : [
                    'connects organization and interview context with market signals',
                    'turns signals into a Five Forces scorecard with drivers, evidence, and confidence',
                    'shows margin pressure, buyer power, entry barriers, and defensibility',
                    'moves from market diagnosis into recommended moves and initiatives',
                  ]
            )}
          </div>
          <div className="rounded-2xl border border-danger-200/70 bg-danger-500/5 p-4 dark:border-danger-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-danger-700 dark:text-danger-300">
              {t('discoveryToolsMain.knownToolDetailView.whatThisToolIsNot')}
            </div>
            {bullets(
              isPolish
                ? [
                    'nie jest suchą checklistą Portera bez kontekstu decyzji',
                    'nie jest miejscem na ocenę rynku bez źródeł i sygnałów',
                    'nie służy do automatycznego wygenerowania strategii bez akceptacji użytkownika',
                    'nie kończy się na radarze lub scorecardzie, tylko przechodzi do outputów',
                  ]
                : [
                    'it is not a dry Porter checklist without decision context',
                    'it is not a place to score a market without sources and signals',
                    'it does not auto-generate strategy without user approval',
                    'it does not stop at a radar or scorecard, but bridges into outputs',
                  ]
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-primary-200/70 bg-primary-500/5 p-4 dark:border-primary-900/40">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
            {t('discoveryToolsMain.knownToolDetailView.aIPhilosophy')}
          </div>
          {chipRow(
            isPolish
              ? ['Market brief', 'Evidence', 'AI proposals', 'User approval', 'Initiatives']
              : ['Market brief', 'Evidence', 'AI proposals', 'User approval', 'Initiatives']
          )}
          <div className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'AI jest konsultantem wspierającym, nie źródłem prawdy. Proponuje sygnały, oceny sił, implikacje, ruchy i outputy, ale użytkownik akceptuje, odrzuca albo prosi o przemyślenie kart przed przejściem do inicjatyw.'
              : 'AI acts as an assisting consultant, not the source of truth. It proposes signals, force scores, implications, moves, and outputs, while the user accepts, rejects, or asks to rethink cards before they become initiative material.'}
          </div>
        </div>

        <MarketForcesLibraryGraphic isPolish={isPolish} variant="process" />
      </div>
    );

    const marketProcessSection = (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('discoveryToolsMain.knownToolDetailView.workLogic')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'Market Forces działa w pięciu fazach analogicznych do Dynamic SWOT: mission, input, forces, insights i outputs. Każda faza ma inny poziom decyzji i inne zadanie dla AI.'
              : 'Market Forces runs through five phases analogous to Dynamic SWOT: mission, input, forces, insights, and outputs. Each phase has a different decision level and a different AI job.'}
          </div>
        </div>
        <div className="grid gap-3">
          {(isPolish
            ? [
                [
                  'Mission & Market Context',
                  'Branża, geografia, pozycja, pytanie i success signal',
                ],
                ['Input & Exploration', 'Sygnały z wywiadu, benchmarków, plików i obserwacji'],
                [
                  'Five Forces Build',
                  'Ocena każdej siły: score, trend, drivery, evidence i confidence',
                ],
                [
                  'Strategic Implications',
                  'Presja marży, defensibility, napięcia rynkowe i rekomendacje',
                ],
                ['Outputs & Actions', 'Source summary, output candidates i drafty inicjatyw'],
              ]
            : [
                [
                  'Mission & Market Context',
                  'Industry, geography, position, question, and success signal',
                ],
                [
                  'Input & Exploration',
                  'Signals from interviews, benchmarks, files, and observations',
                ],
                [
                  'Five Forces Build',
                  'Each force scored with trend, drivers, evidence, and confidence',
                ],
                [
                  'Strategic Implications',
                  'Margin pressure, defensibility, market tensions, and recommendations',
                ],
                ['Outputs & Actions', 'Source summary, output candidates, and initiative drafts'],
              ]
          ).map(([title, text], index) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-[11px] font-bold text-white">
                  {index + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {title}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const marketOutcomesSection = (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('discoveryToolsMain.knownToolDetailView.whatTheSessionProduces')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'Dobry wynik jest gotowy do decyzji: pokazuje nie tylko ocenę sił, ale też konsekwencje dla pozycji, marży i kolejności ruchów.'
              : 'A strong outcome is decision-ready: it shows not only force scores, but also consequences for position, margin, and move sequence.'}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(isPolish
            ? [
                ['Scorecard 5 sił', 'Oceny, trendy, drivery, dowody i confidence dla każdej siły.'],
                [
                  'Implikacje strategiczne',
                  'Co struktura rynku oznacza dla marży, defensibility i pozycji firmy.',
                ],
                [
                  'Rekomendowane ruchy',
                  '2-4 ruchy z uzasadnieniem, wysiłkiem, ryzykiem i pierwszym krokiem.',
                ],
                [
                  'Output candidates',
                  'Materiał do inicjatywy, raportu, prezentacji lub dalszej eksploracji.',
                ],
              ]
            : [
                [
                  'Five Forces scorecard',
                  'Scores, trends, drivers, evidence, and confidence for each force.',
                ],
                [
                  'Strategic implications',
                  'What market structure means for margin, defensibility, and company position.',
                ],
                ['Recommended moves', '2-4 moves with rationale, effort, risk, and first step.'],
                [
                  'Output candidates',
                  'Material for an initiative, report, presentation, or follow-on exploration.',
                ],
              ]
          ).map(([title, text]) => (
            <div
              key={title}
              className="rounded-2xl border border-blue-200/70 bg-blue-500/5 p-4 dark:border-blue-900/40"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
                {title}
              </div>
              <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {text}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const marketExampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('discoveryToolsMain.knownToolDetailView.example')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'Firma premium rozważa wejście w nowy kanał marketplace. Market Forces pomaga sprawdzić, czy atrakcyjność wzrostu nie zostanie zjedzona przez siłę kupujących, presję platform i łatwość kopiowania oferty.'
              : 'A premium company is considering entering a new marketplace channel. Market Forces checks whether growth attractiveness will be consumed by buyer power, platform pressure, and easy offer imitation.'}
          </div>
        </div>
        {caseGrid(
          isPolish
            ? [
                {
                  title: 'Marketplace dla marki premium',
                  context:
                    'Firma rozważa nowy kanał sprzedaży z dużym zasięgiem, ale niską kontrolą relacji.',
                  question:
                    'Czy wzrost wolumenu nie zostanie zjedzony przez siłę platformy i presję cenową?',
                  evidence: [
                    'Wywiady wskazują, że klienci lubią markę, ale w marketplace porównują głównie cenę i czas dostawy.',
                    'Dane kanału pokazują wysokie prowizje, duży koszt promocji oraz łatwość kopiowania bestsellerów.',
                  ],
                  aiDraft:
                    'AI ocenia wysoką siłę kupujących i platformy, średnią groźbę nowych wejść oraz dużą presję substytutów w tańszych segmentach.',
                  approvedUse:
                    'Użytkownik akceptuje drivery, które mają dowody, a AI buduje z nich implikacje marżowe i warunki defensible entry.',
                  outcome:
                    'Decyzja nie brzmi “wejść albo nie”, tylko: wejść pilotażowo z ograniczonym SKU, kontrolą ceny i unikalnym bundlem, którego nie da się łatwo porównać.',
                },
                {
                  title: 'Nowy segment B2B w branży usług',
                  context:
                    'Firma chce wejść do większych klientów, gdzie proces zakupowy jest dłuższy i bardziej formalny.',
                  question: 'Czy atrakcyjność rynku równoważy siłę kupujących i koszt sprzedaży?',
                  evidence: [
                    'Rozmowy z handlowcami pokazują większe kontrakty, ale też silniejsze procurement, dłuższe RFP i presję na referencje.',
                    'Benchmark konkurencji wskazuje, że liderzy segmentu mają certyfikacje, case studies i długi proces pre-sales.',
                  ],
                  aiDraft:
                    'AI proponuje scorecard z wysoką siłą kupujących, wysokimi barierami reputacyjnymi i umiarkowaną rywalizacją w wyspecjalizowanych niszach.',
                  approvedUse:
                    'Po akceptacji kart narzędzie wskazuje, które bariery wejścia trzeba zbudować przed pełnym skalowaniem sprzedaży.',
                  outcome:
                    'Rekomendacja: zacząć od niszy B2B, przygotować referencje i proof assets, a dopiero potem wejść w szeroki segment enterprise.',
                },
                {
                  title: 'Producent przed wejściem zagranicznym',
                  context:
                    'Rynek wygląda duży, ale lokalni gracze mają dystrybucję i relacje z kanałem.',
                  question: 'Czy wejście ma sens bez partnerstwa lub unikalnej przewagi kosztowej?',
                  evidence: [
                    'Analiza rynku pokazuje duży popyt, ale także dominację kilku dystrybutorów i wysokie koszty pozyskania półki.',
                    'Wywiady sugerują, że lokalni klienci ufają obecnym dostawcom i wymagają serwisu posprzedażowego na miejscu.',
                  ],
                  aiDraft:
                    'AI wskazuje wysoką siłę dostawców kanału, wysokie bariery wejścia oraz ryzyko substytucji przez lokalne marki.',
                  approvedUse:
                    'Zaakceptowane siły przechodzą do implikacji: bez partnera firma może kupić przychód kosztem marży i kontroli.',
                  outcome:
                    'Powstaje model testu: partner dystrybucyjny, ograniczony region, jasne progi marży i decyzja scale/stop po 90 dniach.',
                },
              ]
            : [
                {
                  title: 'Marketplace entry for a premium brand',
                  context:
                    'The company considers a high-reach channel with low control over customer relationship.',
                  question: 'Will volume growth be eaten by platform power and price pressure?',
                  evidence: [
                    'Interviews show customers like the brand, but marketplace buying is driven by price and delivery comparison.',
                    'Channel data shows high commissions, promotion cost, and easy imitation of best-selling items.',
                  ],
                  aiDraft:
                    'AI scores buyer and platform power high, new entrants medium, and substitutes high in cheaper segments.',
                  approvedUse:
                    'The user approves evidence-backed drivers, and AI turns them into margin implications and defensible-entry conditions.',
                  outcome:
                    'The decision becomes a controlled pilot with limited SKU, price discipline, and a unique bundle that is hard to compare directly.',
                },
                {
                  title: 'New B2B segment for a services firm',
                  context:
                    'The company wants larger clients with longer and more formal buying processes.',
                  question: 'Does market attractiveness offset buyer power and sales cost?',
                  evidence: [
                    'Sales interviews show larger contracts, but stronger procurement, longer RFPs, and higher reference requirements.',
                    'Competitive benchmarks show segment leaders with certifications, case studies, and heavier pre-sales.',
                  ],
                  aiDraft:
                    'AI proposes high buyer power, high reputation barriers, and moderate rivalry in specialized niches.',
                  approvedUse:
                    'Approved cards identify which entry barriers must be built before broad sales scaling.',
                  outcome:
                    'The recommendation is to start with a B2B niche, build references and proof assets, then expand into enterprise.',
                },
                {
                  title: 'Manufacturer before international entry',
                  context:
                    'The market is large, but local players own distribution and channel relationships.',
                  question: 'Can entry work without a partner or a distinct cost advantage?',
                  evidence: [
                    'Market data shows strong demand, but a few distributors dominate access and shelf acquisition is expensive.',
                    'Interviews suggest local customers trust current suppliers and require local after-sales service.',
                  ],
                  aiDraft:
                    'AI flags high channel supplier power, high entry barriers, and substitution risk from local brands.',
                  approvedUse:
                    'Accepted forces feed implications: without a partner, revenue may be bought at the expense of margin and control.',
                  outcome:
                    'The output is a test model: distribution partner, limited region, clear margin gates, and a 90-day scale/stop decision.',
                },
              ]
        )}
        <MarketForcesLibraryGraphic isPolish={isPolish} variant="example" />
      </div>
    );

    const growthGoalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-500">
            {t('discoveryToolsMain.knownToolDetailView.toolPositioning')}
          </div>
          <div className="mt-3 text-lg font-semibold leading-tight text-slate-900 dark:text-slate-100">
            {isPolish
              ? 'Growth Paths nie jest listą pomysłów wzrostowych. To narzędzie do wyboru ścieżki: co skalować, co testować, gdzie wejść i czego nie robić teraz.'
              : 'Growth Paths is not a list of growth ideas. It is a path-selection tool: what to scale, what to test, where to enter, and what not to do now.'}
          </div>
          <div className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'AI bierze kontekst organizacji, wywiad i sygnały rynku, proponuje opcje w czterech polach Ansoffa, a użytkownik zatwierdza albo odrzuca karty. Dopiero zaakceptowane opcje przechodzą do porównania, ruchów, outputów i inicjatyw.'
              : 'AI uses organization context, interview notes, and market signals to propose options across the four Ansoff fields. The user accepts or rejects cards, and only approved options feed comparison, moves, outputs, and initiatives.'}
          </div>
        </div>
        <GrowthPathsLibraryGraphic isPolish={isPolish} variant="process" />
      </div>
    );

    const growthProcessSection = (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {t('discoveryToolsMain.knownToolDetailView.workLogic')}
        </h2>
        <div className="grid gap-3">
          {(isPolish
            ? [
                ['Mission', 'Ambicja wzrostu, zakres, success signal i ograniczenia'],
                ['Input', 'Sygnały z wywiadu, rynku, klientów i organizacji'],
                ['Options', 'Opcje w macierzy Ansoffa: core, rynek, produkt, dywersyfikacja'],
                ['Insights', 'Porównanie trade-offów i rekomendowana sekwencja ruchów'],
                ['Outputs', 'Final source summary, output candidates i drafty inicjatyw'],
              ]
            : [
                ['Mission', 'Growth ambition, scope, success signal, and constraints'],
                ['Input', 'Signals from interviews, market, customers, and organization context'],
                ['Options', 'Ansoff options: core, market, product, and diversification'],
                ['Insights', 'Trade-off comparison and recommended move sequence'],
                ['Outputs', 'Final source summary, output candidates, and initiative drafts'],
              ]
          ).map(([title, text], index) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-[11px] font-bold text-white">
                  {index + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {title}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const growthOutcomesSection = (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {t('discoveryToolsMain.knownToolDetailView.whatTheSessionProduces')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {(isPolish
            ? [
                ['Macierz opcji', 'Opcje wzrostu z impact, effort, risk, evidence i confidence.'],
                [
                  'Porównanie strategiczne',
                  'Trade-offy między skalowaniem core, wejściem w rynek, produktem i dywersyfikacją.',
                ],
                ['Rekomendowane ruchy', 'Sekwencja: co robić teraz, co testować, co odłożyć.'],
                [
                  'Output candidates',
                  'Materiał do inicjatywy, raportu, decka lub dalszej eksploracji.',
                ],
              ]
            : [
                [
                  'Option matrix',
                  'Growth options with impact, effort, risk, evidence, and confidence.',
                ],
                [
                  'Strategic comparison',
                  'Trade-offs between scaling core, entering markets, product development, and diversification.',
                ],
                ['Recommended moves', 'A sequence: what to do now, what to test, what to defer.'],
                [
                  'Output candidates',
                  'Material for an initiative, report, deck, or follow-on exploration.',
                ],
              ]
          ).map(([title, text]) => (
            <div
              key={title}
              className="rounded-2xl border border-primary-200/70 bg-primary-500/5 p-4 dark:border-primary-900/40"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                {title}
              </div>
              <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {text}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const growthExampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('discoveryToolsMain.knownToolDetailView.example')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'Firma premium chce rosnąć bez erozji marży. Growth Paths porównuje skalowanie obecnego segmentu, wejście do nowej geografii, nowy produkt i dywersyfikację, a potem układa sekwencję działań.'
              : 'A premium company wants to grow without margin erosion. Growth Paths compares scaling the current segment, entering a new geography, building a new product, and diversification, then sequences the moves.'}
          </div>
        </div>
        {caseGrid(
          isPolish
            ? [
                {
                  title: 'Premium firma szuka wzrostu bez erozji marży',
                  context: 'Core segment jest rentowny, ale tempo wzrostu spada.',
                  question:
                    'Czy skalować obecny rynek, wejść do nowej geografii, czy budować nowy produkt?',
                  evidence: [
                    'Sprzedaż pokazuje stabilną marżę w obecnym segmencie, ale malejącą liczbę nowych leadów.',
                    'Wywiady wskazują zapytania z sąsiednich segmentów, lecz bez jasnego dopasowania oferty i kanałów.',
                  ],
                  aiDraft:
                    'AI proponuje opcje w czterech polach: mocniejsza penetracja core, test nowej geografii, lekka wersja produktu i ostrożna dywersyfikacja.',
                  approvedUse:
                    'Użytkownik akceptuje opcje z jasnym pierwszym krokiem i odrzuca pomysły, które są tylko życzeniową ekspansją.',
                  outcome:
                    'Powstaje sekwencja: najpierw zwiększyć udział w core, równolegle przetestować jeden segment, a większy bet uruchomić dopiero po walidacji.',
                },
                {
                  title: 'SaaS po nasyceniu obecnego ICP',
                  context:
                    'Produkt ma dobrą retencję, ale nowy pipeline w obecnym segmencie słabnie.',
                  question: 'Czy rosnąć przez nowy segment, dodatki produktowe, czy pricing?',
                  evidence: [
                    'Retencja i expansion revenue są dobre, ale win-rate na nowych logo spada trzeci kwartał z rzędu.',
                    'Feedback klientów pokazuje popyt na funkcje raportowe, a sprzedaż słyszy zapytania z większych firm.',
                  ],
                  aiDraft:
                    'AI tworzy opcje: pricing packaging w core, wejście w mid-market, moduł analityczny i ryzykowną platformę dla enterprise.',
                  approvedUse:
                    'Zaakceptowane karty trafiają do porównania impact/effort/risk, a AI wskazuje, które opcje wymagają walidacji przed roadmapą.',
                  outcome:
                    'Rekomendacja: przetestować nowy pakiet cenowy i moduł analityczny na obecnych klientach przed kosztownym ruchem enterprise.',
                },
                {
                  title: 'Firma usługowa z silną relacją klienta',
                  context:
                    'Klienci proszą o dodatkowe usługi, ale zespół boi się rozmycia specjalizacji.',
                  question: 'Czy rozwijać produkt/usługę dla obecnych klientów, czy chronić focus?',
                  evidence: [
                    'Najlepsi klienci proszą o usługi komplementarne, ale rentowność projektów spada, gdy zakres jest zbyt szeroki.',
                    'Zespół wskazuje przeciążenie ekspertów i brak powtarzalnych standardów delivery dla nowych usług.',
                  ],
                  aiDraft:
                    'AI proponuje opcje rozwoju produktu dla obecnych klientów, selektywną penetrację key accounts i odrzuca szeroką dywersyfikację bez proofu.',
                  approvedUse:
                    'Akceptowane są tylko opcje z wyraźnym ICP, zakresem delivery i pierwszym eksperymentem komercyjnym.',
                  outcome:
                    'Powstaje plan: stworzyć jedną productized service dla obecnych klientów, przetestować cenę i dopiero potem rozwijać kolejne dodatki.',
                },
              ]
            : [
                {
                  title: 'Premium company seeking growth without margin erosion',
                  context: 'The core segment is profitable, but growth is slowing.',
                  question:
                    'Should it scale the current market, enter a new geography, or build a new product?',
                  evidence: [
                    'Sales data shows stable margin in the current segment but a declining number of new leads.',
                    'Interviews surface demand from adjacent segments, but offer and channel fit are still unclear.',
                  ],
                  aiDraft:
                    'AI proposes options across all four fields: deeper core penetration, a geography test, a lighter product version, and cautious diversification.',
                  approvedUse:
                    'The user approves options with a clear first step and rejects ideas that are just wishful expansion.',
                  outcome:
                    'The sequence becomes: grow share in core, test one adjacent segment in parallel, and only then commit to a bigger bet.',
                },
                {
                  title: 'SaaS after current ICP saturation',
                  context: 'Retention is strong, but pipeline in the current segment is weakening.',
                  question: 'Should growth come from a new segment, product add-ons, or pricing?',
                  evidence: [
                    'Retention and expansion revenue are healthy, but new-logo win rate has declined for three quarters.',
                    'Customer feedback shows demand for reporting features, while sales hears requests from larger companies.',
                  ],
                  aiDraft:
                    'AI creates options around core pricing packaging, mid-market entry, an analytics module, and a riskier enterprise platform move.',
                  approvedUse:
                    'Approved cards move into impact/effort/risk comparison, and AI identifies what must be validated before roadmap commitment.',
                  outcome:
                    'The recommendation is to test a new pricing package and analytics module with current customers before an expensive enterprise move.',
                },
                {
                  title: 'Services firm with strong client relationships',
                  context:
                    'Clients ask for adjacent services, but the team fears diluting specialization.',
                  question: 'Should it develop new offers for current clients or protect focus?',
                  evidence: [
                    'Top clients request complementary services, but project profitability drops when scope becomes too broad.',
                    'The team reports expert overload and no repeatable delivery standard for new service lines.',
                  ],
                  aiDraft:
                    'AI proposes product-development options for current clients, selective key-account penetration, and rejects broad diversification without proof.',
                  approvedUse:
                    'Only options with a clear ICP, delivery scope, and first commercial experiment are accepted.',
                  outcome:
                    'The plan is to create one productized service for current clients, test pricing, and then decide whether to add more offers.',
                },
              ]
        )}
        <GrowthPathsLibraryGraphic isPolish={isPolish} variant="example" />
      </div>
    );

    const portfolioGoalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-500">
            {t('discoveryToolsMain.knownToolDetailView.whyUseIt')}
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {isPolish
              ? 'Portfolio Priority pomaga wybrać, które produkty, inicjatywy albo bety finansować, utrzymywać, testować, harvestować lub zatrzymać. AI proponuje pierwszy szkic na podstawie kontekstu i wywiadu, ale decyzje przechodzą przez akceptację użytkownika.'
              : 'Portfolio Priority helps decide which products, initiatives, or bets to fund, maintain, test, harvest, or stop. AI proposes the first draft from context and interview evidence, but decisions flow through user approval.'}
          </div>
        </div>
        <PortfolioPriorityLibraryGraphic isPolish={isPolish} variant="process" />
      </div>
    );

    const portfolioProcessSection = (
      <div className="grid gap-4 md:grid-cols-2">
        {[
          [
            'Mission',
            isPolish
              ? 'Zakres portfolio, ograniczenia i sygnał sukcesu.'
              : 'Portfolio scope, constraints, and success signal.',
          ],
          [
            'Evidence',
            isPolish
              ? 'Sygnały z wywiadu, rynku, finansów i zasobów.'
              : 'Interview, market, financial, and resource signals.',
          ],
          [
            'Items',
            isPolish
              ? 'Karty BCG z oceną growth/share/investment.'
              : 'BCG cards scored on growth/share/investment.',
          ],
          [
            'Outputs',
            isPolish
              ? 'Trade-offy, ruchy, inicjatywy i final summary.'
              : 'Trade-offs, moves, initiatives, and final summary.',
          ],
        ].map(([title, text]) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30"
          >
            <div className="font-semibold text-slate-900 dark:text-white">{title}</div>
            <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {text}
            </div>
          </div>
        ))}
      </div>
    );

    const portfolioOutcomesSection = (
      <div className="space-y-3">
        {[
          t('discoveryToolsMain.knownToolDetailView.approvedBCGPortfolioMatrix'),
          isPolish
            ? 'Jawne trade-offy alokacji zasobów'
            : 'Explicit resource allocation trade-offs',
          isPolish
            ? 'Rekomendowane ruchy: invest, maintain, test, harvest, stop'
            : 'Recommended moves: invest, maintain, test, harvest, stop',
          isPolish
            ? 'Kandydaci outputów i inicjatyw downstream'
            : 'Downstream output and initiative candidates',
        ].map((text) => (
          <div
            key={text}
            className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-700 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-300"
          >
            {text}
          </div>
        ))}
      </div>
    );

    const portfolioExampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 text-sm leading-relaxed text-slate-600 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-300">
          {isPolish
            ? 'Firma ma kilka produktów i inicjatyw, ale budżet pozwala sfinansować tylko część z nich. Portfolio Priority porządkuje karty BCG, pokazuje koszt alternatywny i buduje rekomendowany portfel działań.'
            : 'A company has several products and initiatives, but budget only supports a subset. Portfolio Priority organizes the BCG cards, exposes opportunity cost, and builds the recommended action portfolio.'}
        </div>
        {caseGrid(
          isPolish
            ? [
                {
                  title: 'Budżet inwestycyjny tylko na 3 z 9 inicjatyw',
                  context: 'Lista projektów jest długa, a sponsorzy naciskają na swoje tematy.',
                  question: 'Które inicjatywy finansować, utrzymać, testować albo zatrzymać?',
                  evidence: [
                    'Każda inicjatywa ma innego sponsora, ale tylko część ma dowody wpływu na wzrost lub marżę.',
                    'Dane PMO pokazują przeciążenie zespołów i brak jasnego kryterium stop/continue.',
                  ],
                  aiDraft:
                    'AI proponuje karty portfolio z oceną growth/share/investment, uzasadnieniem oraz rekomendacją invest, maintain, test, harvest albo stop.',
                  approvedUse:
                    'Użytkownik akceptuje scoring tylko tam, gdzie zgadza się z evidence, a potem AI buduje trade-offy zasobów.',
                  outcome:
                    'Powstaje portfel decyzji: trzy inicjatywy do finansowania, dwie do testu z bramkami, reszta do zatrzymania lub odłożenia.',
                },
                {
                  title: 'Portfolio produktów po szybkim wzroście',
                  context:
                    'Część produktów ma wolumen, ale niską marżę; inne są małe, lecz perspektywiczne.',
                  question: 'Gdzie przesunąć zasoby produktowe i sprzedażowe?',
                  evidence: [
                    'Raport sprzedaży pokazuje produkty o wysokim wolumenie i niskiej marży oraz małe produkty z szybkim wzrostem.',
                    'Wywiady z sales wskazują, że zespół sprzedaje to, co łatwe, niekoniecznie to, co strategiczne.',
                  ],
                  aiDraft:
                    'AI klasyfikuje produkty jako stars, cash cows, question marks i dogs oraz proponuje przesunięcia uwagi sprzedaży.',
                  approvedUse:
                    'Po akceptacji kart narzędzie pokazuje koszt alternatywny utrzymywania zbyt szerokiego portfolio.',
                  outcome:
                    'Rekomendacja: utrzymać cash cow, dofinansować jednego question marka, harvestować niskomarżowy wolumen i zatrzymać produkty bez strategicznej roli.',
                },
                {
                  title: 'Transformacja z nadmiarem projektów',
                  context: 'PMO prowadzi wiele równoległych strumieni i traci zdolność dowożenia.',
                  question: 'Które prace są strategiczne, a które tylko zużywają przepustowość?',
                  evidence: [
                    'Statusy projektów są zielone na papierze, ale zależności blokują kluczowe milestone’y.',
                    'Rozmowy z liderami pokazują, że te same osoby są krytyczne dla kilku inicjatyw jednocześnie.',
                  ],
                  aiDraft:
                    'AI ocenia inicjatywy według strategicznego potencjału, pozycji, poziomu inwestycji i realnej przepustowości organizacji.',
                  approvedUse:
                    'Zaakceptowane karty przechodzą do syntezy: co finansować, co utrzymać minimalnie, co zakończyć, a co zamienić w krótki test.',
                  outcome:
                    'Powstaje plan odciążenia PMO: mniej aktywnych strumieni, jasne kryteria restartu i lista tematów do zamknięcia.',
                },
              ]
            : [
                {
                  title: 'Investment budget for only 3 of 9 initiatives',
                  context: 'The project list is long and sponsors push their own priorities.',
                  question: 'Which initiatives should be funded, maintained, tested, or stopped?',
                  evidence: [
                    'Each initiative has a different sponsor, but only some have evidence of growth or margin impact.',
                    'PMO data shows team overload and no clear stop/continue criteria.',
                  ],
                  aiDraft:
                    'AI proposes portfolio cards with growth/share/investment scores, rationale, and an invest/maintain/test/harvest/stop recommendation.',
                  approvedUse:
                    'The user approves scoring only where evidence fits, then AI builds resource trade-offs.',
                  outcome:
                    'The portfolio decision funds three initiatives, tests two with gates, and stops or defers the rest.',
                },
                {
                  title: 'Product portfolio after rapid growth',
                  context:
                    'Some products have volume but low margin; others are small but promising.',
                  question: 'Where should product and sales resources move?',
                  evidence: [
                    'Sales reports show high-volume low-margin products and smaller products with faster growth.',
                    'Sales interviews show the team sells what is easiest, not always what is strategic.',
                  ],
                  aiDraft:
                    'AI classifies products as stars, cash cows, question marks, and dogs, then proposes sales-focus shifts.',
                  approvedUse:
                    'Approved cards expose the opportunity cost of keeping the portfolio too broad.',
                  outcome:
                    'The recommendation maintains the cash cow, funds one question mark, harvests low-margin volume, and stops products without strategic role.',
                },
                {
                  title: 'Transformation overloaded with projects',
                  context: 'PMO runs many parallel streams and loses delivery capacity.',
                  question: 'Which work is strategic and which only consumes throughput?',
                  evidence: [
                    'Project statuses look green on paper, but dependencies block key milestones.',
                    'Leader interviews show the same people are critical to several initiatives at once.',
                  ],
                  aiDraft:
                    'AI scores initiatives by strategic potential, position, investment level, and real organizational capacity.',
                  approvedUse:
                    'Approved cards feed synthesis: what to fund, minimally maintain, stop, or convert into a short test.',
                  outcome:
                    'The result is a PMO relief plan: fewer active streams, restart criteria, and a list of topics to close.',
                },
              ]
        )}
        <PortfolioPriorityLibraryGraphic isPolish={isPolish} variant="example" />
      </div>
    );

    const riskGoalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-500">
            {t('discoveryToolsMain.knownToolDetailView.whyUseIt')}
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {isPolish
              ? 'Risk & Uncertainty pomaga sprawdzić, jakie założenia mogą się nie sprawdzić, które ryzyka są krytyczne i jakie ruchy odporności trzeba uruchomić przed decyzją.'
              : 'Risk & Uncertainty helps test which assumptions may fail, which risks are critical, and which resilience moves need to happen before the decision.'}
          </div>
        </div>
        <RiskUncertaintyLibraryGraphic isPolish={isPolish} variant="process" />
      </div>
    );

    const riskProcessSection = (
      <div className="grid gap-4 md:grid-cols-2">
        {[
          [
            'Mission',
            isPolish
              ? 'Decyzja, zakres niepewności i sygnał sukcesu.'
              : 'Decision, uncertainty scope, and success signal.',
          ],
          [
            'Evidence',
            isPolish
              ? 'Sygnały z wywiadu, rynku, danych i operacji.'
              : 'Interview, market, data, and operational signals.',
          ],
          [
            'Risk map',
            isPolish
              ? 'Założenia, ryzyka i scenariusze jako karty AI.'
              : 'Assumptions, risks, and scenarios as AI cards.',
          ],
          [
            'Outputs',
            isPolish
              ? 'Ruchy odporności, output candidates i inicjatywy.'
              : 'Resilience moves, output candidates, and initiatives.',
          ],
        ].map(([title, text]) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30"
          >
            <div className="font-semibold text-slate-900 dark:text-white">{title}</div>
            <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {text}
            </div>
          </div>
        ))}
      </div>
    );

    const riskOutcomesSection = (
      <div className="space-y-3">
        {[
          isPolish
            ? 'Zaakceptowana mapa założeń, ryzyk i scenariuszy'
            : 'Approved assumption, risk, and scenario map',
          isPolish
            ? 'Ruchy: validate, mitigate, monitor, hedge, escalate'
            : 'Moves: validate, mitigate, monitor, hedge, escalate',
          isPolish
            ? 'Early warnings i działania odporności'
            : 'Early warnings and resilience actions',
          isPolish
            ? 'Kandydaci outputów i inicjatyw downstream'
            : 'Downstream output and initiative candidates',
        ].map((text) => (
          <div
            key={text}
            className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-700 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-300"
          >
            {text}
          </div>
        ))}
      </div>
    );

    const riskExampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 text-sm leading-relaxed text-slate-600 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-300">
          {isPolish
            ? 'Firma planuje transformację, ale niepewne są koszty, adopcja i zależności technologiczne. Risk & Uncertainty porządkuje założenia, ryzyka i scenariusze, a potem wskazuje ruchy walidacji i mitygacji.'
            : 'A company plans a transformation, but costs, adoption, and technology dependencies are uncertain. Risk & Uncertainty structures assumptions, risks, and scenarios, then recommends validation and mitigation moves.'}
        </div>
        {caseGrid(
          isPolish
            ? [
                {
                  title: 'Transformacja z niepewną adopcją użytkowników',
                  context:
                    'Plan zakłada szybkie wdrożenie, ale zespoły operacyjne mają różne poziomy gotowości.',
                  question: 'Które założenia trzeba zwalidować przed commitmentem budżetu?',
                  evidence: [
                    'Wywiady pokazują entuzjazm zarządu, ale sceptycyzm kierowników liniowych i brak czasu na szkolenia.',
                    'Poprzednie wdrożenia miały opóźnienia nie przez technologię, tylko przez brak ownershipu po stronie biznesu.',
                  ],
                  aiDraft:
                    'AI proponuje założenia do walidacji, ryzyka adopcji, scenariusz opóźnienia oraz ruchy validate/monitor/mitigate.',
                  approvedUse:
                    'Użytkownik akceptuje karty, które mają realne wskaźniki ostrzegawcze, np. frekwencję szkoleń, aktywność użytkowników i liczbę workaroundów.',
                  outcome:
                    'Powstaje plan odporności: pilot adopcyjny, sponsorzy liniowi, early warnings i progi eskalacji przed pełnym rolloutem.',
                },
                {
                  title: 'Ekspansja przy zmiennym popycie',
                  context:
                    'Popyt rośnie, ale dane rynkowe są rozbieżne i zależne od kilku klientów.',
                  question: 'Jaki scenariusz bazowy, downside i stress powinien sterować decyzją?',
                  evidence: [
                    'Sprzedaż widzi duże zapytania od kilku klientów, ale pipeline jest skoncentrowany i ma niską powtarzalność.',
                    'Dane rynkowe pokazują wzrost kategorii, lecz też sezonowość i zależność od budżetów inwestycyjnych klientów.',
                  ],
                  aiDraft:
                    'AI proponuje scenariusze base/downside/stress, ryzyka koncentracji popytu i sygnały do monitorowania przed decyzją scale.',
                  approvedUse:
                    'Po akceptacji scenariuszy narzędzie buduje ruchy hedge i monitor oraz sugeruje progi, przy których decyzja ma być zatrzymana.',
                  outcome:
                    'Decyzja ekspansyjna dostaje warunki: minimalna liczba niezależnych klientów, próg marży i early warning na spadek konwersji.',
                },
                {
                  title: 'Program kosztowy pod presją czasu',
                  context:
                    'Zarząd oczekuje szybkich oszczędności, ale ryzyko wpływu na jakość jest wysokie.',
                  question: 'Jak ograniczyć ryzyko cięcia zdolności krytycznych?',
                  evidence: [
                    'Finanse widzą szybki potencjał oszczędności, ale operacje wskazują zależności między kosztami a SLA.',
                    'Historia podobnych cięć pokazuje wzrost reklamacji i kosztów naprawczych po kilku miesiącach.',
                  ],
                  aiDraft:
                    'AI proponuje ryzyka jakości, scenariusz odbicia kosztów, założenia do walidacji oraz ruchy mitigate/escalate.',
                  approvedUse:
                    'Akceptowane są tylko te mitygacje, które mają właściciela, trigger i jasny próg eskalacji.',
                  outcome:
                    'Powstaje program oszczędności z guardrailami: czego nie ciąć, co testować krótkim pilotażem i kiedy zatrzymać redukcję.',
                },
              ]
            : [
                {
                  title: 'Transformation with uncertain user adoption',
                  context:
                    'The plan assumes fast rollout, but operating teams have uneven readiness.',
                  question: 'Which assumptions must be validated before budget commitment?',
                  evidence: [
                    'Interviews show executive enthusiasm, but line-manager skepticism and limited training capacity.',
                    'Previous rollouts were delayed not by technology, but by lack of business ownership after go-live.',
                  ],
                  aiDraft:
                    'AI proposes validation assumptions, adoption risks, a delay scenario, and validate/monitor/mitigate moves.',
                  approvedUse:
                    'The user accepts cards with real warning indicators such as training attendance, user activity, and workaround volume.',
                  outcome:
                    'The resilience plan includes an adoption pilot, line sponsors, early warnings, and escalation thresholds before full rollout.',
                },
                {
                  title: 'Expansion under volatile demand',
                  context:
                    'Demand is growing, but market data is mixed and dependent on a few customers.',
                  question: 'Which base, downside, and stress scenarios should steer the decision?',
                  evidence: [
                    'Sales sees large requests from a few customers, but pipeline is concentrated and not yet repeatable.',
                    'Market data shows category growth, but also seasonality and dependence on client investment budgets.',
                  ],
                  aiDraft:
                    'AI proposes base/downside/stress scenarios, demand-concentration risks, and signals to monitor before scale.',
                  approvedUse:
                    'After scenario approval, the tool builds hedge and monitor moves and suggests thresholds that pause the decision.',
                  outcome:
                    'The expansion decision gets conditions: minimum independent customers, margin gate, and early warning for conversion decline.',
                },
                {
                  title: 'Cost program under time pressure',
                  context: 'Leadership expects quick savings, but quality impact risk is high.',
                  question: 'How can the company avoid cutting critical capabilities?',
                  evidence: [
                    'Finance sees fast savings potential, but operations points to dependencies between cost and SLA.',
                    'History of similar cuts shows complaints and rework costs rising several months later.',
                  ],
                  aiDraft:
                    'AI proposes quality risks, a cost rebound scenario, assumptions to validate, and mitigate/escalate moves.',
                  approvedUse:
                    'Only mitigations with an owner, trigger, and clear escalation threshold are accepted.',
                  outcome:
                    'The cost program gets guardrails: what not to cut, what to test through a pilot, and when to stop reductions.',
                },
              ]
        )}
        <RiskUncertaintyLibraryGraphic isPolish={isPolish} variant="example" />
      </div>
    );

    // ── Standard-C group tabs (mirrors InsightViewer/InitiativeDocumentView) ──
    // Every per-tool branch below returns the same 4 sections (goal / process /
    // outcomes / example). A bilingual groupLabels array switched on isPolish +
    // a per-section group assignment makes NModeShell's C-board render top group
    // tabs; wide narrative sections get cSpan: 2 so they breathe in the dense
    // 3-column grid. N-mode uses the same group fields for sidebar headers.
    const groupLabels = isPolish
      ? ['Przegląd', 'Jak to działa', 'Przykład']
      : ['Overview', 'How it works', 'Example'];
    const groupIndexById: Record<string, number> = {
      goal: 0, // Overview / Przegląd
      process: 1, // How it works / Jak to działa
      outcomes: 1,
      example: 2, // Example / Przykład
    };
    const cSpanById: Record<string, 1 | 2 | 3> = {
      goal: 2, // multi-card positioning grids
      process: 2, // stepper + decision-situation grids
      outcomes: 2, // 3-column outcome blocks
      example: 3, // wide 3-col case grids
    };
    const withGroup = (list: NModeSection[]): NModeSection[] =>
      list.map((section) => ({
        ...section,
        group: groupLabels[groupIndexById[section.id] ?? 0],
        cSpan: cSpanById[section.id] ?? section.cSpan,
      }));

    if (tool?.toolType === 'dynamic-swot') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: goalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: processSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: outcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: exampleSection,
        },
      ]);
    }

    if (tool?.toolType === 'market-forces' || toolType === 'market-forces') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: marketGoalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: marketProcessSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: marketOutcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: marketExampleSection,
        },
      ]);
    }

    if (tool?.toolType === 'growth-paths' || toolType === 'growth-paths') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: growthGoalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: growthProcessSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: growthOutcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: growthExampleSection,
        },
      ]);
    }

    if (tool?.toolType === 'portfolio-priority' || toolType === 'portfolio-priority') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: portfolioGoalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: portfolioProcessSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: portfolioOutcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: portfolioExampleSection,
        },
      ]);
    }

    if (tool?.toolType === 'risk-uncertainty' || toolType === 'risk-uncertainty') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: riskGoalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: riskProcessSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: riskOutcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: riskExampleSection,
        },
      ]);
    }

    return withGroup([
      {
        id: 'goal',
        icon: Target,
        label: { en: 'Goal', pl: 'Cel' },
        component: goalSection,
      },
      {
        id: 'process',
        icon: CheckCircle2,
        label: { en: 'Process', pl: 'Proces' },
        component: processSection,
      },
      {
        id: 'outcomes',
        icon: Lightbulb,
        label: { en: 'Outcomes', pl: 'Rezultat' },
        component: outcomesSection,
      },
      {
        id: 'example',
        icon: FileText,
        label: { en: 'Example', pl: 'Przykład' },
        component: exampleSection,
      },
    ]);
  }, [tool, isPolish, toolType]);

  return (
    <NModeShell
      loading={loading}
      presentationMode={mode}
      onPresentationModeChange={setMode}
      header={{
        title: tool?.name || toolType,
        onTitleChange: () => {},
        titleReadOnly: true,
        artifactId: tool?.toolType || toolType,
        artifactType: 'tool',
        onSave: () => {},
        saving: false,
        isDirty: false,
        onClose,
        statusDotColor: 'bg-primary-400',
      }}
      properties={properties}
      sections={sections}
      actions={actions}
      actionsVisible={true}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    />
  );
}
