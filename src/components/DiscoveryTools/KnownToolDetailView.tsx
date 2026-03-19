import { ArrowRight, CheckCircle2, FileText, HelpCircle, Lightbulb, Target } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useHelpSidePanel } from '@/contexts/HelpContext';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';
import { Callout, InlineTable, type InlineTableColumn } from '@/components/shared/NModeBlocks';

import { DynamicSwotLibraryGraphic } from './DynamicSwotLibraryGraphic';
import {
  type NModeAction,
  type NModePropertyField,
  type NModeSection,
  NModeShell,
} from '../shared/NModeLayout';

type KnownTool = Awaited<ReturnType<typeof Api.getKnownTool>>['tool'];

export function KnownToolDetailView(props: {
  toolType: string;
  onClose: () => void;
  onSessionCreated: (sessionId: string, toolType: string, name: string) => void;
}) {
  const { toolType, onClose, onSessionCreated } = props;
  const { i18n } = useTranslation();
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
      toast.error(isPolish ? 'To narzędzie nie jest jeszcze aktywne.' : 'This tool is not active yet.');
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
      toast.success(isPolish ? 'Sesja narzędzia utworzona' : 'Tool session created');
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
        value: isPolish ? 'Poznanie narzędzia' : 'Learn the tool',
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
            {isPolish ? 'Ta sekcja zostanie uzupełniona w kolejnych iteracjach.' : 'This section will be expanded in upcoming iterations.'}
          </div>
        );
      }
      return (
        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          {safe.map((v, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-400" />
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

    const goalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            {isPolish ? 'Pozycjonowanie narzędzia' : 'Tool positioning'}
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
          <div className="rounded-2xl bg-slate-50/70 p-4 dark:bg-navy-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {isPolish ? 'Co to narzędzie naprawdę robi' : 'What the tool actually does'}
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
          <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 dark:border-amber-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {isPolish ? 'Czym to narzędzie nie jest' : 'What this tool is not'}
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
          <div className="rounded-2xl bg-slate-50/70 p-4 dark:bg-navy-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {isPolish ? 'Kiedy użyć' : 'When to use'}
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
          <div className="rounded-2xl bg-slate-50/70 p-4 dark:bg-navy-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {isPolish ? 'Kiedy nie zaczynać od SWOT' : 'When not to start with SWOT'}
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
          <div className="rounded-2xl bg-slate-50/70 p-4 dark:bg-navy-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {isPolish ? 'Co przygotować przed startem' : 'What to prepare before starting'}
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
          <div className="rounded-2xl border border-violet-200/70 bg-violet-500/5 p-4 dark:border-violet-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              {isPolish ? 'Co sprawia, że SWOT jest tutaj dynamiczny' : 'What makes the SWOT dynamic here'}
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

    const processSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {isPolish ? 'Logika pracy' : 'Work logic'}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'Dobry Dynamic SWOT prowadzi przez pięć kroków biznesowych. Flow jest prosty dla użytkownika, ale rygorystyczny merytorycznie: najpierw ustawienie decyzji, potem higiena sygnałów, potem porządna macierz, a dopiero na końcu napięcia, ruchy i outputy.'
              : 'A strong Dynamic SWOT runs through five business steps. The flow is simple for the user but rigorous in substance: frame the decision first, clean the signals second, build a strong matrix third, and only then move into tensions, moves, and outputs.'}
          </div>
        </div>

        {[
          {
            title: isPolish ? 'KROK 1 — Mission Brief' : 'STEP 1 — Mission Brief',
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
          },
          {
            title: isPolish ? 'KROK 2 — Sygnały i evidence' : 'STEP 2 — Signals and evidence',
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
          },
          {
            title: isPolish ? 'KROK 3 — Budowa macierzy SWOT' : 'STEP 3 — Build the SWOT matrix',
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
          },
          {
            title: isPolish ? 'KROK 4 — Napięcia strategiczne i logika TOWS' : 'STEP 4 — Strategic tensions and TOWS logic',
            items: isPolish
              ? [
                  'połącz karty w układy attack, repair, defend i protect',
                  'pokaż, gdzie przewaga zderza się z ograniczeniem albo ryzykiem',
                  'nazwij, dlaczego właśnie to napięcie ma znaczenie teraz, a nie później',
                ]
              : [
                  'connect the cards into attack, repair, defend, and protect patterns',
                  'show where advantage meets constraint or risk',
                  'name why this tension matters now rather than later',
                ],
            note: isPolish
              ? 'To tutaj pojawia się wartość konsultingowa. Sama lista kart przestaje być tabelą i zaczyna tworzyć logikę decyzji.'
              : 'This is where consulting value appears. The card list stops being a table and starts becoming decision logic.',
          },
          {
            title: isPolish ? 'KROK 5 — Ruchy i outputy' : 'STEP 5 — Moves and outputs',
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
          },
        ].map((step) => (
          <div
            key={step.title}
            className="rounded-2xl bg-slate-50/70 p-4 dark:bg-navy-900/40"
          >
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{step.title}</div>
            <div className="mt-3">{bullets(step.items)}</div>
            {'note' in step && step.note ? (
              <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-sm text-slate-600 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-300">
                {step.note}
              </div>
            ) : null}
          </div>
        ))}

        <Callout
          variant="info"
          title={isPolish ? 'Jak wygląda dobra sesja końcowa' : 'What a strong finished session looks like'}
          className="border border-sky-200/40 dark:border-sky-900/30"
        >
          {bullets(
            isPolish
              ? [
                  '6-12 zaakceptowanych kart SWOT zamiast długiej listy wszystkiego',
                  '3-6 napięć strategicznych, które naprawdę tłumaczą pole decyzji',
                  '2-4 rekomendowane ruchy z jasną sekwencją i pierwszym krokiem',
                  'co najmniej 1 output candidate gotowy do dalszej decyzji lub akceptacji sponsora',
                  'final source summary, z którego da się bezpośrednio zbudować raport lub deck',
                ]
              : [
                  '6-12 accepted SWOT cards instead of a long list of everything',
                  '3-6 strategic tensions that genuinely explain the decision space',
                  '2-4 recommended moves with a clear sequence and first step',
                  'at least 1 output candidate ready for further decision or sponsor approval',
                  'a final source summary that can directly feed a report or deck',
                ]
          )}
        </Callout>

        <div className="rounded-2xl border border-violet-200/70 bg-violet-500/5 p-4 dark:border-violet-900/40">
          <div className="text-[11px] uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
            {isPolish ? 'Typy napięć w interpretacji' : 'Tension types in interpretation'}
          </div>
          <div className="mt-3">
            {chipRow(
              isPolish
                ? ['Attack: Strength + Opportunity', 'Repair: Weakness + Opportunity', 'Defend: Strength + Threat', 'Protect: Weakness + Threat']
                : ['Attack: Strength + Opportunity', 'Repair: Weakness + Opportunity', 'Defend: Strength + Threat', 'Protect: Weakness + Threat']
            )}
          </div>
          <div className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'To nie są etykiety ozdobne. Pomagają odróżnić, czy organizacja powinna dziś wykorzystać przewagę, naprawić lukę, obronić pozycję czy ograniczyć ekspozycję na ryzyko.'
              : 'These are not decorative labels. They help distinguish whether the organization should use an advantage, repair a gap, defend a position, or reduce exposure to risk.'}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 dark:border-amber-900/40">
          <div className="text-[11px] uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            {isPolish ? 'Uwagi do pracy' : 'Working notes'}
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

    const outcomesSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {isPolish ? 'Struktura outputu' : 'Output structure'}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'Dobrze wykonany Dynamic SWOT kończy się decision-grade outputem: materiałem, który przypomina pytanie decyzyjne, pokazuje jakość evidence, tłumaczy najważniejsze napięcia i prowadzi do sekwencji ruchów.'
              : 'A strong Dynamic SWOT ends with a decision-grade output: material that restates the decision question, shows the quality of the evidence, explains the key tensions, and leads into a clear move sequence.'}
          </div>
        </div>

        {(() => {
          type OutcomeBoardRow = {
            id: string;
            block: string;
            badge: string;
            summary: string[];
            why: string;
            next: string;
          };

          const rows: OutcomeBoardRow[] = isPolish
            ? [
                {
                  id: 'decision-frame',
                  block: '1. Rama decyzji',
                  badge: 'Decision',
                  summary: [
                    'pytanie strategiczne, zakres, horyzont czasu i success signal',
                    'jawne przypomnienie, czego analiza dotyczy, a czego nie dotyczy',
                  ],
                  why: 'Bez tej ramy nawet dobra macierz pozostaje oderwana od realnej decyzji i łatwo zamienia się w ogólny opis firmy.',
                  next: 'Executive summary z jasno ustawioną logiką decyzji dla sponsora lub zarządu.',
                },
                {
                  id: 'evidence-picture',
                  block: '2. Obraz czynników i evidence',
                  badge: 'Evidence',
                  summary: [
                    'najmocniejsze karty Strengths, Weaknesses, Opportunities i Threats wraz z ich źródłami',
                    'krótkie rozdzielenie tego, co jest faktem, obserwacją lub hipotezą',
                  ],
                  why: 'To zabezpiecza jakość rozumowania. Decydent widzi nie tylko wniosek, ale też jakość materiału, na którym ten wniosek stoi.',
                  next: 'Uzasadniona macierz i defensible story do dalszej rozmowy decyzyjnej.',
                },
                {
                  id: 'tensions',
                  block: '3. Napięcia strategiczne',
                  badge: 'Tensions',
                  summary: [
                    'najważniejsze połączenia między kartami wewnętrznymi i zewnętrznymi',
                    'układy typu attack, repair, defend lub protect, które naprawdę zmieniają logikę ruchu',
                  ],
                  why: 'Tu pojawia się konsultingowa wartość narzędzia: obserwacje przestają być listą, a zaczynają tłumaczyć, gdzie leży prawdziwy trade-off.',
                  next: 'Warstwa interpretacji do dyskusji z managementem oraz do wyboru priorytetów.',
                },
                {
                  id: 'moves',
                  block: '4. Rekomendowane ruchy i sekwencja',
                  badge: 'Moves',
                  summary: [
                    '2-4 ruchy wynikające z napięć, a nie z intuicji autora',
                    'jasne odróżnienie: quick win, big bet, ruch obronny albo capability build',
                  ],
                  why: 'To moment przejścia od diagnozy do wyboru ruchu, który ma sens biznesowy teraz, ma pierwszy krok i którego da się bronić logicznie.',
                  next: 'Shortlista ruchów do decka, sponsor decision albo rozwinięcia w inicjatywę wraz z first step.',
                },
                {
                  id: 'execution-bridge',
                  block: '5. Most do działania',
                  badge: 'Execution',
                  summary: [
                    'final source summary gotowy do raportu, prezentacji lub artefaktu dla zarządu',
                    'wybór, co jest gotowe na inicjatywę, co wymaga decka, a co powinno pozostać jeszcze ideą',
                  ],
                  why: 'Domyka narzędzie wejściem do działania. SWOT bez tego etapu zostawia zespół z ciekawą analizą, ale bez ruchu.',
                  next: 'Raport, prezentacja, przekazanie do inicjatyw albo dalsza eksploracja z tego samego materiału źródłowego.',
                },
              ]
            : [
                {
                  id: 'decision-frame',
                  block: '1. Decision frame',
                  badge: 'Decision',
                  summary: [
                    'the strategic question, scope, time horizon, and success signal',
                    'an explicit reminder of what the analysis covers and what it does not cover',
                  ],
                  why: 'Without this frame even a strong matrix drifts away from the real decision and becomes a generic company description.',
                  next: 'An executive summary with a clear decision frame for the sponsor or board.',
                },
                {
                  id: 'evidence-picture',
                  block: '2. Factor picture and evidence',
                  badge: 'Evidence',
                  summary: [
                    'the strongest Strengths, Weaknesses, Opportunities, and Threats with their sources',
                    'a short distinction between facts, observations, and hypotheses',
                  ],
                  why: 'This protects the reasoning quality. Decision-makers see not only the conclusion, but the quality of the material underneath it.',
                  next: 'A defensible matrix and narrative for the next decision discussion.',
                },
                {
                  id: 'tensions',
                  block: '3. Strategic tensions',
                  badge: 'Tensions',
                  summary: [
                    'the most important connections between internal and external cards',
                    'attack, repair, defend, or protect patterns that actually change the move logic',
                  ],
                  why: 'This is where consulting value appears: observations stop being a list and start explaining where the real trade-off sits.',
                  next: 'An interpretation layer for leadership discussion and priority choices.',
                },
                {
                  id: 'moves',
                  block: '4. Recommended moves and sequence',
                  badge: 'Moves',
                  summary: [
                    '2-4 moves emerging from the tensions rather than from analyst intuition',
                    'a clear distinction between a quick win, a big bet, a defensive move, or a capability build',
                  ],
                  why: 'This is the handoff from diagnosis to a move that makes business sense now, has a first step, and can be defended logically.',
                  next: 'A shortlist of moves for the deck, sponsor decision, or initiative design with a visible first step.',
                },
                {
                  id: 'execution-bridge',
                  block: '5. Bridge to execution',
                  badge: 'Execution',
                  summary: [
                    'a final source summary ready for the report, presentation, or leadership artifact',
                    'a choice of what is ready for an initiative, what needs a deck first, and what should remain an idea',
                  ],
                  why: 'It closes the tool with a bridge to action. SWOT without this step leaves the team with an interesting analysis but no move.',
                  next: 'A report, presentation, initiative push, or further exploration from the same source package.',
                },
              ];

          const columns: InlineTableColumn<OutcomeBoardRow>[] = [
            {
              key: 'block',
              header: isPolish ? 'Blok wyniku' : 'Outcome block',
              width: 'w-[22%] align-top',
              render: (row) => (
                <div className="min-w-0">
                  <div className="inline-flex items-center rounded-full border border-purple-500/15 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-purple-700 dark:text-purple-300">
                    {row.badge}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {row.block}
                  </div>
                </div>
              ),
            },
            {
              key: 'summary',
              header: isPolish ? 'Co pokazuje' : 'What it shows',
              width: 'w-[28%] align-top',
              render: (row) => (
                <ul className="space-y-1.5">
                  {row.summary.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400/80" />
                      <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              key: 'why',
              header: isPolish ? 'Dlaczego ważne' : 'Why it matters',
              width: 'w-[25%] align-top',
              render: (row) => (
                <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{row.why}</div>
              ),
            },
            {
              key: 'next',
              header: isPolish ? 'Co uruchamia dalej' : 'What it enables next',
              width: 'w-[25%] align-top',
              render: (row) => (
                <div className="text-sm leading-relaxed text-slate-900 dark:text-slate-100">
                  {row.next}
                </div>
              ),
            },
          ];

          return (
            <InlineTable
              columns={columns}
              data={rows}
              rowKey={(row) => row.id}
              caption={isPolish ? 'Decision board' : 'Decision board'}
              compact={false}
              striped
              emptyMessage={isPolish ? 'Brak outcomeów.' : 'No outcomes.'}
              className="bg-white/70 dark:bg-navy-950/20"
            />
          );
        })()}

        <Callout
          variant="success"
          title={isPolish ? 'Jak wygląda dobry wynik' : 'What a strong outcome looks like'}
          className="border border-emerald-200/40 dark:border-emerald-900/30"
        >
          {isPolish
            ? 'Dobry wynik jest selektywny, evidence-backed i decyzyjny. Nie pokazuje wszystkiego, co udało się zebrać, tylko to, co naprawdę zmienia logikę wyboru i pozwala przejść do kolejnego kroku.'
            : 'A strong result is selective, evidence-backed, and decision-oriented. It does not show everything that was collected, only what truly changes the choice logic and enables the next step.'}
        </Callout>
      </div>
    );

    const exampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {isPolish ? 'Przykład' : 'Example'}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'Przykład pokazuje sytuację typową dla firm w transformacji: presja rośnie i technologia kusi jako szybka odpowiedź, ale najpierw trzeba ustalić, czy problemem jest naprawdę brak rozwiązania, czy brak prawdy o sytuacji.'
              : 'This example shows a common transformation moment: pressure rises and technology looks like the quick answer, but the first job is to establish whether the real problem is the missing solution or the missing truth about the situation.'}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50/70 p-4 dark:bg-navy-900/40">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {isPolish ? 'Sytuacja i pytanie decyzyjne' : 'Situation and decision question'}
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
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {isPolish ? 'Kluczowe sygnały wejściowe' : 'Key input signals'}
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
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {isPolish ? 'Jak wygląda macierz' : 'How the matrix looks'}
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
              {isPolish ? 'Napięcie i interpretacja' : 'Tension and interpretation'}
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
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {isPolish ? 'Rekomendowane ruchy' : 'Recommended moves'}
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
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {isPolish ? 'Outputy z sesji' : 'Outputs from the session'}
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

    if (tool?.toolType === 'dynamic-swot') {
      return [
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
      ];
    }

    return [
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
        label: { en: 'Outcomes', pl: 'Outcomes' },
        component: outcomesSection,
      },
    ];
  }, [tool, isPolish]);

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
        statusDotColor: 'bg-purple-400',
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
