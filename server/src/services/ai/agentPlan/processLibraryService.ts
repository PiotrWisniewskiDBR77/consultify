/**
 * ProcessLibrary — generator procesu konsultingowego (AGT-006, partia 2).
 *
 * SSOT koncepcyjne: Harvard/wdrozenie-100/_SPEC_AGENT_VAULT_2026-07-22.md §4
 * (PARTIA 2 — generator procesu) + decyzja Piotra 2026-07-22 ("weź klasyczny
 * konsulting jako pierwszy test"). Problem, który ten plik rozwiązuje:
 * `planBuilderService.buildPlanFromManifest` tłumaczy JEDEN manifest Discovery
 * na 3-4 kroki tego manifestu — nie umie zaproponować całego, rozpoznawalnego
 * PROCESU konsultingowego dla nowego projektu. Ten moduł dokłada tę warstwę:
 * **bibliotekę procesów** (id procesu -> uporządkowana lista faz), z domyślnym
 * schematem = **klasyczny 5-fazowy proces konsultingowy (Kubr/ILO)** i
 * wariantem **DRD (4-krokowy)** do świadomego wyboru.
 *
 * Zależność architektoniczna (DEC-002, SPEC §5): model **liniowy** —
 * `agentPlannerService.executePlan` idzie krok po kroku, bez grafu zależności.
 * Każda faza = dokładnie jeden krok `{toolName, toolInput}` z rejestru
 * `toolDefinitions.ts` (ten sam, którego używa czat Teresy i executor planu).
 * `toolChainExecutor` (DAG) świadomie NIE dotykany — rezerwa partii 3.
 *
 * Dlaczego (na start) reguły, nie LLM-planner: identycznie jak w
 * `planBuilderService.ts` — LLM-planner jest kuszący, ale flaky (patrz
 * finding_demo_llm_tier_glm_flaky_2026-07-07) i drogi na coś, co da się
 * rozstrzygnąć jawną, audytowalną tabelą. Domyślny schemat jest deterministyczny;
 * dostrajanie pod kontekst (`applyContextTuning`) to na razie proste, jawne
 * reguły. Miejsce na LLM-planner jest wyraźnie zostawione (patrz
 * `applyContextTuning` — hook), ale wchodzi osobno, za akceptem treści na
 * żywym LLM (SPEC §6 "Prompty/persona globalne — treść Piotr akceptuje").
 *
 * Metadane fazy (nazwa / moduł / deliverable) są wstrzykiwane do `toolInput`
 * kroku (klucze `phase`/`module`/`deliverable`) — executory `toolDefinitions.ts`
 * czytają args po kluczu i ignorują nadmiarowe, więc jest to bezpieczne w
 * runtime, a jednocześnie metadane trafiają do `ai_agent_plan_steps.tool_input_json`
 * i są widoczne w odpowiedzi sondy HTTP (dowód, że faza niesie moduł+deliverable).
 */
import { SIDE_EFFECT_TOOLS } from '../sideEffectTools.js';

/** Jedna faza procesu = jeden krok liniowy przez realny moduł. */
export interface ProcessPhase {
  /** Stabilny identyfikator fazy (do przestawiania klocków — partia 2 UI). */
  id: string;
  /** Nazwa fazy widoczna dla usera (PL). */
  name: string;
  /** Realny moduł(y) aplikacji, przez który ta faza się dzieje. */
  module: string;
  /** Co ta faza produkuje (artefakt/wynik etapu). */
  deliverable: string;
  /** Realne narzędzie z rejestru toolDefinitions.ts. */
  toolName: string;
  /** Wejście narzędzia (metadane fazy dołączane osobno w buildStepsFromProcess). */
  toolInput: Record<string, unknown>;
  /** Uzasadnienie (dla panelu/audytu — nie persystowane przez createPlan). */
  rationale: string;
  /** Odbicie SIDE_EFFECT_TOOLS — czy krok zatrzyma się na bramce akceptu. */
  requiresApproval: boolean;
}

/** Kontekst dostrajania — na start proste, jawne reguły (nie LLM). */
export interface ProcessContext {
  /** Oś Assessment, na której faza Diagnozy ma się skupić (np. 'data_analytics'). */
  focusAxis?: string;
  /** Branża — zawężenie benchmarków/finansów. */
  industry?: string;
  /** Czy w Vault są dokumenty klienta do wciągnięcia w fazę wejścia. */
  hasVaultDocs?: boolean;
  /** Krótki opis projektu — używany do wzbogacenia zapytań kontekstowych. */
  projectSummary?: string;
}

type PhaseSeed = Omit<ProcessPhase, 'requiresApproval'>;

function phase(seed: PhaseSeed): ProcessPhase {
  return { ...seed, requiresApproval: SIDE_EFFECT_TOOLS.has(seed.toolName) };
}

export interface ProcessDefinition {
  id: string;
  /** Nazwa procesu widoczna dla usera. */
  label: string;
  /** Skąd pochodzi ten schemat (doktryna). */
  description: string;
  /** Czy to domyślny schemat (proponowany dla nowego projektu). */
  isDefault: boolean;
  /** Buduje fazy (bez dostrajania — czysta tabela). */
  buildPhases: () => ProcessPhase[];
}

export const DEFAULT_PROCESS_ID = 'classic-5';

/**
 * KLASYCZNY 5-FAZOWY PROCES KONSULTINGOWY (Kubr/ILO) — DOMYŚLNY.
 * Wejście/Kontraktowanie -> Diagnoza -> Rekomendacje -> Wdrożenie -> Zamknięcie.
 * Zbieżny z McKinsey/BCG (research 2026-07-22). Każda faza przez realny moduł.
 */
function buildClassicFivePhase(): ProcessPhase[] {
  return [
    phase({
      id: 'entry',
      name: 'Wejście / Kontraktowanie',
      module: 'My Work · Chat',
      deliverable: 'Brief, zakres i cel projektu',
      toolName: 'search_knowledge_base',
      toolInput: {
        query: 'brief, zakres i cel projektu — kontekst wejściowy, kontraktowanie',
      },
      rationale: 'Wejście: zebranie briefu, zakresu i celu z dostępnego kontekstu.',
    }),
    phase({
      id: 'diagnosis',
      name: 'Diagnoza',
      module: 'Interview · Assessment',
      deliverable: 'Stan obecny, dane, zdefiniowany problem',
      toolName: 'get_assessment_data',
      toolInput: { include_benchmarks: true },
      rationale: 'Diagnoza: pobranie ocen/danych stanu obecnego i zdefiniowanie problemu.',
    }),
    phase({
      id: 'recommendations',
      name: 'Rekomendacje',
      module: 'Initiatives · Finance',
      deliverable: 'Warianty, priorytety, ROI',
      toolName: 'calculate_financial',
      toolInput: { calculation_type: 'roi' },
      rationale: 'Rekomendacje: wycena ROI wariantów i ustalenie priorytetów.',
    }),
    phase({
      id: 'execution',
      name: 'Wdrożenie',
      module: 'Execution',
      deliverable: 'Plan, zadania, kamienie milowe',
      toolName: 'get_initiative_status',
      toolInput: { include_tasks: true, include_risks: true },
      rationale: 'Wdrożenie: przegląd inicjatyw/zadań i ułożenie planu realizacji.',
    }),
    phase({
      id: 'closing',
      name: 'Zamknięcie',
      module: 'Results · Materials',
      deliverable: 'Efekty, deck, przekazanie',
      toolName: 'generate_report_section',
      toolInput: {
        section_title: 'Podsumowanie i przekazanie',
        section_type: 'executive_summary',
        format: 'mixed',
      },
      rationale: 'Zamknięcie: raport efektów i deck do przekazania (bramka akceptu).',
    }),
  ];
}

/**
 * DRD (4-krokowy) — WARIANT do świadomego wyboru.
 * Discovery -> Ocena -> Inicjatywy -> Efekty. Ten sam szkielet co klasyka,
 * bez jawnego Wejścia+Zamknięcia (klasyka je dokłada).
 */
function buildDrdFourStep(): ProcessPhase[] {
  return [
    phase({
      id: 'discovery',
      name: 'Discovery',
      module: 'Interview · Discovery',
      deliverable: 'Zebrany kontekst, obszary do analizy',
      toolName: 'search_knowledge_base',
      toolInput: { query: 'discovery: obszary, kontekst, sygnały problemowe' },
      rationale: 'Discovery: zebranie kontekstu i wyznaczenie obszarów.',
    }),
    phase({
      id: 'assessment',
      name: 'Ocena',
      module: 'Assessment',
      deliverable: 'Oceny osi, luki dojrzałości',
      toolName: 'get_assessment_data',
      toolInput: { include_benchmarks: true },
      rationale: 'Ocena: pobranie ocen osi i luk dojrzałości.',
    }),
    phase({
      id: 'initiatives',
      name: 'Inicjatywy',
      module: 'Initiatives · Finance',
      deliverable: 'Inicjatywy, priorytety, ROI',
      toolName: 'calculate_financial',
      toolInput: { calculation_type: 'roi' },
      rationale: 'Inicjatywy: wycena ROI i priorytetyzacja inicjatyw.',
    }),
    phase({
      id: 'results',
      name: 'Efekty',
      module: 'Results · Materials',
      deliverable: 'Efekty, deck',
      toolName: 'generate_report_section',
      toolInput: {
        section_title: 'Efekty i rekomendacje',
        section_type: 'recommendations',
        format: 'mixed',
      },
      rationale: 'Efekty: raport wyników i deck (bramka akceptu).',
    }),
  ];
}

export const PROCESS_LIBRARY: Record<string, ProcessDefinition> = {
  'classic-5': {
    id: 'classic-5',
    label: 'Klasyczny konsulting (5 faz, Kubr/ILO)',
    description:
      'Wejście/Kontraktowanie → Diagnoza → Rekomendacje → Wdrożenie → Zamknięcie. ' +
      'Uniwersalny, rozpoznawalny, zbieżny z McKinsey/BCG.',
    isDefault: true,
    buildPhases: buildClassicFivePhase,
  },
  drd: {
    id: 'drd',
    label: 'DRD (4 kroki)',
    description:
      'Discovery → Ocena → Inicjatywy → Efekty. Wariant skrócony (bez jawnego Wejścia/Zamknięcia).',
    isDefault: false,
    buildPhases: buildDrdFourStep,
  },
};

/** Lekkie podsumowanie do wyboru w UI ("wybierz proces"). */
export function listProcesses(): Array<{
  id: string;
  label: string;
  description: string;
  isDefault: boolean;
  phaseCount: number;
}> {
  return Object.values(PROCESS_LIBRARY).map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    isDefault: p.isDefault,
    phaseCount: p.buildPhases().length,
  }));
}

/**
 * Dostrajanie pod kontekst — na start PROSTE, JAWNE REGUŁY (nie LLM).
 * Nie zmienia LICZBY ani KOLEJNOŚCI faz — modyfikuje tylko `toolInput` faz,
 * tak by ten sam schemat był dostrojony do projektu (SPEC §4: "LLM-planner/
 * reguły dostrajające pod kontekst"). Miejsce na LLM-planner: gdyby wejść,
 * podmienia ciało tej funkcji za flagą + akcept treści na żywym LLM.
 */
export function applyContextTuning(
  phases: ProcessPhase[],
  context?: ProcessContext
): ProcessPhase[] {
  if (!context) return phases;

  return phases.map((p) => {
    const toolInput = { ...p.toolInput };

    // Reguła 1: Diagnoza celuje w słabą oś, jeśli podano.
    if (p.toolName === 'get_assessment_data' && context.focusAxis) {
      toolInput.axis = context.focusAxis;
    }
    // Reguła 2: Finanse/benchmarki dostają branżę, jeśli podano.
    if (
      (p.toolName === 'compare_benchmarks' || p.toolName === 'calculate_financial') &&
      context.industry
    ) {
      toolInput.industry = context.industry;
    }
    // Reguła 3: Faza wejścia wciąga dokumenty z Vault, jeśli są.
    if (p.toolName === 'search_knowledge_base') {
      const parts: string[] = [String(toolInput.query || '')];
      if (context.projectSummary) parts.push(context.projectSummary);
      if (context.hasVaultDocs) parts.push('uwzględnij dokumenty klienta z Vault');
      toolInput.query = parts.filter(Boolean).join(' — ');
    }

    return { ...p, toolInput };
  });
}

/**
 * Zwraca uporządkowane fazy dla procesu. Domyślnie klasyczny 5-fazowy.
 * Nieznane `processId` -> bezpieczny fallback do domyślnego (jak w
 * planBuilderService: generator zawsze zwraca sensowny schemat).
 */
export function buildProcessPlan(
  processId?: string | null,
  context?: ProcessContext
): ProcessPhase[] {
  const def = (processId && PROCESS_LIBRARY[processId]) || PROCESS_LIBRARY[DEFAULT_PROCESS_ID];
  return applyContextTuning(def.buildPhases(), context);
}

/**
 * Mapuje fazy na kroki wykonawcze `{toolName, toolInput}` dla
 * `agentPlannerService.createPlan`. Metadane fazy (nazwa/moduł/deliverable)
 * wstrzykiwane do `toolInput` — trafiają do `ai_agent_plan_steps.tool_input_json`
 * i są widoczne w sondzie HTTP (dowód struktury procesu).
 */
export function buildStepsFromProcess(
  processId?: string | null,
  context?: ProcessContext
): Array<{ toolName: string; toolInput: Record<string, unknown> }> {
  return buildProcessPlan(processId, context).map((p) => ({
    toolName: p.toolName,
    toolInput: {
      ...p.toolInput,
      phase: p.name,
      module: p.module,
      deliverable: p.deliverable,
    },
  }));
}

export default buildProcessPlan;
