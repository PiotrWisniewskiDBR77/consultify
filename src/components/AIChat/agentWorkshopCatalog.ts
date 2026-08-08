/**
 * agentWorkshopCatalog — KATALOG KLOCKÓW warsztatu agenta (SSOT palety).
 *
 * Warsztat agenta (3 kolumny: sterowanie · schemat · paleta) potrzebuje JEDNEJ
 * listy tego, co można wstawić do procesu. Ta lista NIE jest wymyślona — jest
 * kurowanym odbiciem realnego rejestru narzędzi
 * `server/src/services/ai/toolDefinitions.ts` (`AI_TOOLS` + dispatcher
 * `executeToolCall`). Frontend nie importuje tamtego pliku wprost (inny target
 * bundlowania, importy node-only), więc odbicie musi być ręczne — stąd twarde
 * kryterium poniżej, żeby nie rozjechało się po cichu.
 *
 * ── KRYTERIUM „AKTYWNY" vs „WKRÓTCE" (weryfikowalne, nie uznaniowe) ──────────
 *   status: 'active' ⇔ `toolName` występuje JEDNOCZEŚNIE
 *      (a) w tablicy `AI_TOOLS` (definicja narzędzia dla modelu), oraz
 *      (b) jako `case '<toolName>'` w `executeToolCall` (realny wykonawca).
 *   status: 'soon'   ⇔ pozycja NIE MA narzędzia w tym rejestrze. Pokazujemy ją
 *      mimo to (właściciel chce widzieć mapę drogową), ale wyszarzoną,
 *      nieklikalną, z etykietą „Wkrótce" i polem `soonReason` mówiącym CZEGO
 *      brakuje. Nigdy nie wstawiamy takiego klocka do schematu — plan wysłałby
 *      na backend `toolName`, którego `executeToolCall` nie zna (default →
 *      `{error: "Unknown tool"}` → krok padłby jako `failed`).
 *
 * Stan rejestru na 2026-07-26 (`git show origin/demo:server/src/services/ai/
 * toolDefinitions.ts`) — 20 narzędzi, wszystkie z case'em w dispatcherze:
 *   search_web · search_knowledge_base · list_enterprise_connectors ·
 *   search_enterprise_connector · get_assessment_data · calculate_financial ·
 *   run_monte_carlo · get_initiative_status · compare_benchmarks ·
 *   find_similar_decisions · get_stakeholder_analysis · create_initiative_draft ·
 *   generate_report_section · schedule_meeting · create_notebook_entry ·
 *   query_structured_data · create_task · update_task · create_decision ·
 *   wait_until (Fala 1 flow, 2026-07-26 — patrz klocek 'pauza' niżej)
 *
 * ── BRAMKA AKCEPTU ───────────────────────────────────────────────────────────
 * `SIDE_EFFECT_TOOLS` (server/src/services/ai/sideEffectTools.ts) trzyma osiem
 * narzędzi, które backend SAM zatrzymuje na `awaiting_approval`:
 * create_initiative_draft, generate_report_section, schedule_meeting,
 * create_notebook_entry, query_structured_data, oraz (od 2026-07-26, decyzja
 * właściciela — Harvey benchmark) pisarze My Work: `create_task`,
 * `update_task`, `create_decision`. Klocki `kind: 'automat'` (i
 * `'brama-akceptu'`) nadal wysyłają JAWNY override `requiresApproval: true`
 * (backend go przyjmuje — `PlanStepInputSchema` w agent-plan.routes.ts,
 * DOROBKA C 2026-07-23) — teraz redundantny z domyślną bramką dla tych trzech,
 * ale zostawiony: jawny override jest odporny na przyszłe zmiany w
 * `SIDE_EFFECT_TOOLS` i nie ma kosztu. Kierunek bezpieczny: pytamy częściej, nie rzadziej.
 *
 * ── CB-06 / RB-028 — LOKALIZACJA ─────────────────────────────────────────────
 * `label`/`hint`/`soonReason` poniżej są ANGIELSKIM DOMYŚLNYM tekstem (fallback
 * dla `t()`), nie językiem wyświetlania — to samo id daje klucz tłumaczenia
 * `agentPlan.catalog.<id>.label` / `.hint` / `.soonReason` (patrz
 * `catalogLabelKey`/`catalogHintKey`/`catalogSoonReasonKey` niżej), realne PL
 * żyje w `public/locales/pl/translation.json`. Konsument (AgentWorkshopPalette)
 * MUSI wołać `t(catalogLabelKey(entry), entry.label)`, nigdy `entry.label`
 * wprost, żeby paleta nie była zamrożona na jednym języku niezależnie od
 * locale użytkownika.
 */

/**
 * Typy klocków v1. Cztery pierwsze istniały od AGT-007/008; `automat`
 * i `informacja` dochodzą wraz z warsztatem.
 *
 * ⚠ `informacja` to JEDYNY kind, który NIE jest krokiem wykonania — to notatka
 * na schemacie. Persystencja: `blocksToSteps`/`stepsToBlocks`
 * (AgentPlanPanel.tsx) przenoszą ją w `toolInput.notesBefore` sąsiedniego
 * kroku, więc notatka przeżywa zapis i uruchomienie planu bez zmiany schematu
 * bazy. Notatka nigdy nie generuje własnego kroku.
 */
export type PlanBlockKind =
  | 'etap-modul'
  | 'ai-teresa'
  | 'vault-kontekst'
  | 'brama-akceptu'
  | 'automat'
  | 'informacja'
  | 'pauza';

export const ALL_BLOCK_KINDS: PlanBlockKind[] = [
  'etap-modul',
  'ai-teresa',
  'vault-kontekst',
  'brama-akceptu',
  'automat',
  'informacja',
  'pauza',
];

export const BLOCK_KIND_FALLBACK_LABEL: Record<PlanBlockKind, string> = {
  'etap-modul': 'Etap-moduł',
  'ai-teresa': 'AI / Teresa',
  'vault-kontekst': 'Vault-kontekst',
  'brama-akceptu': 'Zgoda (bramka)',
  automat: 'Automat',
  informacja: 'Informacja',
  pauza: 'Odczekaj (pauza)',
};

export const BLOCK_KIND_LABEL_KEY: Record<PlanBlockKind, string> = {
  'etap-modul': 'agentPlan.canvas.kind.etapModul',
  'ai-teresa': 'agentPlan.canvas.kind.aiTeresa',
  'vault-kontekst': 'agentPlan.canvas.kind.vaultKontekst',
  'brama-akceptu': 'agentPlan.canvas.kind.bramaAkceptu',
  automat: 'agentPlan.canvas.kind.automat',
  informacja: 'agentPlan.canvas.kind.informacja',
  pauza: 'agentPlan.canvas.kind.pauza',
};

export function isPlanBlockKind(value: unknown): value is PlanBlockKind {
  return typeof value === 'string' && (ALL_BLOCK_KINDS as string[]).includes(value);
}

/** Klocki, które NIE są krokiem wykonania (nie trafiają do `steps`). */
export function isAnnotationKind(kind: PlanBlockKind): boolean {
  return kind === 'informacja';
}

/**
 * Klocki, dla których wymuszamy jawną zgodę użytkownika przed wykonaniem
 * (override `requiresApproval: true` w kroku) — patrz nagłówek pliku.
 */
export function forcesApproval(kind: PlanBlockKind): boolean {
  return kind === 'brama-akceptu' || kind === 'automat' || kind === 'pauza';
}

/** Jedna pozycja palety = jeden klocek do wstawienia w schemat. */
export interface AgentBlockCatalogEntry {
  /** Stabilny id pozycji palety (nie mylić z id klocka w schemacie). Także rdzeń klucza tłumaczenia. */
  id: string;
  /** Angielski tekst domyślny (fallback dla `t()`) — NIE renderuj wprost, patrz nagłówek pliku. */
  label: string;
  /** Jedno zdanie: co ten klocek robi (angielski fallback). */
  hint: string;
  kind: PlanBlockKind;
  /** Nazwa narzędzia 1:1 z `AI_TOOLS`. Brak = klocek nie jest krokiem (informacja) lub pozycja 'soon'. */
  toolName?: string;
  /** Moduł/obszar aplikacji pokazywany na klocku pod nazwą. */
  module?: string;
  status: 'active' | 'soon';
  /** Wypełnione TYLKO dla 'soon' — angielski fallback tego, czego brakuje w rejestrze. */
  soonReason?: string;
  /** true = backend zatrzyma plan na tym kroku (SIDE_EFFECT_TOOLS lub jawny override). */
  approval?: boolean;
}

export interface AgentBlockCatalogGroup {
  id: string;
  /** Angielski tekst domyślny — patrz `catalogGroupLabelKey`. */
  label: string;
  /** Jedno zdanie pod nagłówkiem grupy (angielski fallback). */
  hint: string;
  entries: AgentBlockCatalogEntry[];
}

/** CB-06 / RB-028 — translation-key builders, id-derived so every new catalog entry gets one for free. */
export const catalogGroupLabelKey = (group: { id: string }): string =>
  `agentPlan.catalog.group.${group.id}.label`;
export const catalogGroupHintKey = (group: { id: string }): string =>
  `agentPlan.catalog.group.${group.id}.hint`;
export const catalogLabelKey = (entry: { id: string }): string =>
  `agentPlan.catalog.${entry.id}.label`;
export const catalogHintKey = (entry: { id: string }): string =>
  `agentPlan.catalog.${entry.id}.hint`;
export const catalogSoonReasonKey = (entry: { id: string }): string =>
  `agentPlan.catalog.${entry.id}.soonReason`;

export const AGENT_BLOCK_CATALOG: AgentBlockCatalogGroup[] = [
  {
    id: 'moduly',
    label: 'Modules',
    hint: 'Steps based on data from application modules.',
    entries: [
      {
        id: 'mod-assessment',
        label: 'Assessment data',
        hint: 'Reads results and gaps from the Assessment module.',
        kind: 'etap-modul',
        toolName: 'get_assessment_data',
        module: 'Assessment',
        status: 'active',
      },
      {
        id: 'mod-initiatives',
        label: 'Initiative status',
        hint: 'Initiative portfolio: progress, owners, risks.',
        kind: 'etap-modul',
        toolName: 'get_initiative_status',
        module: 'Initiatives',
        status: 'active',
      },
      {
        id: 'mod-decisions',
        label: 'Similar decisions',
        hint: 'Searches for earlier decisions with a similar context.',
        kind: 'etap-modul',
        toolName: 'find_similar_decisions',
        module: 'My Work · Decisions',
        status: 'active',
      },
      {
        id: 'mod-stakeholders',
        label: 'Stakeholder analysis',
        hint: 'Map of stakeholder influence and sentiment.',
        kind: 'etap-modul',
        toolName: 'get_stakeholder_analysis',
        module: 'Initiatives',
        status: 'active',
      },
      {
        id: 'mod-finance',
        label: 'Financial calculation',
        hint: 'ROI, NPV, payback period on project data.',
        kind: 'etap-modul',
        toolName: 'calculate_financial',
        module: 'Finance',
        status: 'active',
      },
      {
        id: 'mod-montecarlo',
        label: 'Monte Carlo simulation',
        hint: 'Outcome distribution under uncertain assumptions.',
        kind: 'etap-modul',
        toolName: 'run_monte_carlo',
        module: 'Finance',
        status: 'active',
      },
      {
        id: 'mod-benchmarks',
        label: 'Benchmark comparison',
        hint: 'Compares results against the industry benchmark base.',
        kind: 'etap-modul',
        toolName: 'compare_benchmarks',
        module: 'Results',
        status: 'active',
      },
      {
        id: 'mod-interview',
        label: 'Interview',
        hint: 'Retrieves answers from surveys and interviews.',
        kind: 'etap-modul',
        module: 'Interview',
        status: 'soon',
        soonReason:
          "The agent doesn't have access to the Interview module yet — this feature is in progress.",
      },
      {
        id: 'mod-execution',
        label: 'Execution',
        hint: 'Milestones, tasks, and delivery blockers.',
        kind: 'etap-modul',
        module: 'Execution',
        status: 'soon',
        soonReason:
          'Today the agent only reads initiative status — full access to the Execution module is in progress.',
      },
      {
        id: 'mod-results',
        label: 'Results',
        hint: 'Reads KPIs and realized benefits.',
        kind: 'etap-modul',
        module: 'Results',
        status: 'soon',
        soonReason:
          'Today the agent only compares benchmarks — reading realized KPIs is in progress.',
      },
      {
        id: 'mod-materials',
        label: 'Materials / Deck',
        hint: 'Assembles a presentation from ready sections.',
        kind: 'etap-modul',
        module: 'Materials',
        status: 'soon',
        soonReason:
          'Today the agent only generates a section description, not the whole document — assembling a full presentation is in progress.',
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI / Teresa',
    hint: 'Steps where the model does the work.',
    entries: [
      {
        id: 'ai-web',
        label: 'Search the web',
        hint: 'Fresh market data from outside the organization.',
        kind: 'ai-teresa',
        toolName: 'search_web',
        module: 'Teresa',
        status: 'active',
      },
      {
        id: 'ai-report-section',
        label: 'Report section',
        hint: 'Prepares a report section from the given sources.',
        kind: 'ai-teresa',
        toolName: 'generate_report_section',
        module: 'Materials',
        status: 'active',
        approval: true,
      },
      {
        id: 'ai-summary',
        label: 'Stage summary',
        hint: "Summary of the previous plan steps' results.",
        kind: 'ai-teresa',
        module: 'Teresa',
        status: 'soon',
        soonReason:
          'The agent doesn\'t have a "summarize what you\'ve gathered" step today — this feature is in progress.',
      },
    ],
  },
  {
    id: 'dane',
    label: 'Data & Vault',
    hint: 'Where the agent gets its context from.',
    entries: [
      {
        id: 'vault-context',
        label: 'Vault — selected safe',
        hint: "Limits the agent's knowledge to one safe (Mine / Project / Organization).",
        kind: 'vault-kontekst',
        toolName: 'search_knowledge_base',
        module: 'Vault',
        status: 'active',
      },
      {
        id: 'kb-search',
        label: 'Search knowledge',
        hint: "Searches the organization's documents without narrowing to a safe.",
        kind: 'etap-modul',
        toolName: 'search_knowledge_base',
        module: 'Vault',
        status: 'active',
      },
      {
        id: 'structured-query',
        label: 'Data query',
        hint: 'A natural-language question against tabular data.',
        kind: 'etap-modul',
        toolName: 'query_structured_data',
        module: 'Tables',
        status: 'active',
        approval: true,
      },
    ],
  },
  {
    id: 'automaty',
    label: 'Automations',
    hint: 'Steps that CREATE something. Each one asks for approval before running.',
    entries: [
      {
        id: 'auto-task',
        label: 'Create task',
        hint: 'Creates a task in My Work.',
        kind: 'automat',
        toolName: 'create_task',
        module: 'My Work',
        status: 'active',
        approval: true,
      },
      {
        id: 'auto-task-update',
        label: 'Update task',
        hint: 'Changes the status or fields of an existing task.',
        kind: 'automat',
        toolName: 'update_task',
        module: 'My Work',
        status: 'active',
        approval: true,
      },
      {
        id: 'auto-decision',
        label: 'Create decision',
        hint: 'Creates a decision card to be resolved.',
        kind: 'automat',
        toolName: 'create_decision',
        module: 'My Work',
        status: 'active',
        approval: true,
      },
      {
        id: 'auto-initiative',
        label: 'Initiative draft',
        hint: 'Proposes an initiative with a description and ROI estimate.',
        kind: 'automat',
        toolName: 'create_initiative_draft',
        module: 'Initiatives',
        status: 'active',
        approval: true,
      },
      {
        id: 'auto-note',
        label: 'Notebook entry',
        hint: 'Saves findings as a note.',
        kind: 'automat',
        toolName: 'create_notebook_entry',
        module: 'Notebook',
        status: 'active',
        approval: true,
      },
      {
        id: 'auto-meeting',
        label: 'Meeting proposal',
        hint: 'Proposes a meeting time and attendees.',
        kind: 'automat',
        toolName: 'schedule_meeting',
        module: 'Meeting',
        status: 'active',
        approval: true,
      },
    ],
  },
  {
    id: 'kontrola',
    label: 'Flow control',
    hint: 'Where the agent should stop and what should be documented.',
    entries: [
      {
        id: 'ctrl-gate',
        label: 'Approval (gate)',
        hint: 'The plan stops and waits for your approval.',
        kind: 'brama-akceptu',
        toolName: 'search_knowledge_base',
        module: 'Control',
        status: 'active',
        approval: true,
      },
      {
        id: 'ctrl-wait',
        label: 'Wait (pause)',
        hint: 'The process waits a set time before continuing.',
        kind: 'pauza',
        toolName: 'wait_until',
        module: 'Control',
        status: 'active',
        approval: true,
      },
      {
        id: 'ctrl-note',
        label: 'Note (info)',
        hint: 'A description on the diagram. Not executed — organizes the process.',
        kind: 'informacja',
        module: 'Control',
        status: 'active',
      },
      {
        id: 'ctrl-branch',
        label: 'Condition (branch)',
        hint: "Different paths depending on the previous step's result.",
        kind: 'brama-akceptu',
        module: 'Control',
        status: 'soon',
        soonReason: 'The plan is linear today — steps run in order; branching is in progress.',
      },
      {
        id: 'ctrl-loop',
        label: 'Loop over a list',
        hint: 'Repeat a step for each item (e.g. each initiative).',
        kind: 'brama-akceptu',
        module: 'Control',
        status: 'soon',
        soonReason: 'Steps run once today, as a flat list — looping over a list is in progress.',
      },
    ],
  },
  {
    id: 'integracje',
    label: 'Integrations',
    hint: 'Systems outside Consultify.',
    entries: [
      {
        id: 'int-list',
        label: 'Connector list',
        hint: 'Checks which integrations are connected and fresh.',
        kind: 'etap-modul',
        toolName: 'list_enterprise_connectors',
        module: 'Integrations',
        status: 'active',
      },
      {
        id: 'int-search',
        label: 'Search a connector',
        hint: 'Queries a connected company system through the Wave 7 gateway.',
        kind: 'etap-modul',
        toolName: 'search_enterprise_connector',
        module: 'Integrations',
        status: 'active',
      },
      {
        id: 'int-sharepoint',
        label: 'SharePoint',
        hint: 'Retrieves documents from the SharePoint library.',
        kind: 'etap-modul',
        module: 'Integrations',
        status: 'soon',
        soonReason:
          'This connector is already connected in the integrations catalog; today the agent reaches it only through the generic "Search a connector" step — a dedicated step is in progress.',
      },
      {
        id: 'int-teams',
        label: 'Microsoft Teams',
        hint: 'Team channels and messages.',
        kind: 'etap-modul',
        module: 'Integrations',
        status: 'soon',
        soonReason:
          'This connector is in the integrations catalog, but a dedicated agent step for it is in progress.',
      },
      {
        id: 'int-slack',
        label: 'Slack',
        hint: 'Channels and messages.',
        kind: 'etap-modul',
        module: 'Integrations',
        status: 'soon',
        soonReason:
          'This connector is in the integrations catalog, but a dedicated agent step for it is in progress.',
      },
      {
        id: 'int-jira',
        label: 'Jira',
        hint: 'Issues, sprints, and boards.',
        kind: 'etap-modul',
        module: 'Integrations',
        status: 'soon',
        soonReason:
          'This connector is in the integrations catalog, but a dedicated agent step for it is in progress.',
      },
      {
        id: 'int-gdrive',
        label: 'Google Drive',
        hint: 'Files and folders from Drive.',
        kind: 'etap-modul',
        module: 'Integrations',
        status: 'soon',
        soonReason:
          'This connector is in the integrations catalog, but a dedicated agent step for it is in progress.',
      },
      {
        id: 'int-outlook',
        label: 'Outlook / Calendar',
        hint: 'Mail and appointments.',
        kind: 'etap-modul',
        module: 'Integrations',
        status: 'soon',
        soonReason:
          'This connector is in the integrations catalog, but a dedicated agent step for it is in progress.',
      },
    ],
  },
];

/** Wszystkie pozycje w jednej płaskiej liście (do wyszukiwarki palety). */
export const AGENT_BLOCK_ENTRIES: AgentBlockCatalogEntry[] = AGENT_BLOCK_CATALOG.flatMap(
  (group) => group.entries
);

/**
 * Czytelna etykieta narzędzia po `toolName` — używana na klocku i w liście
 * kroków, żeby nigdzie nie świecił snake_case rejestru.
 *
 * ⚠ Jedno narzędzie bywa opakowane przez KILKA pozycji palety — np.
 * `search_knowledge_base` stoi zarówno za „Vault — wybrany sejf" (opakowanie
 * z wyborem sejfu), za „Zgoda (bramka)" (opakowanie z bramką), jak i za
 * zwykłym „Szukaj w wiedzy". Nazwą NARZĘDZIA jest to ostatnie, więc pozycje
 * wyspecjalizowane (`vault-kontekst`, `brama-akceptu`) są przy budowie mapy
 * pomijane — inaczej krok wyszukujący w wiedzy nazywałby się „Vault — wybrany
 * sejf" wszędzie tam, gdzie nie jest klockiem Vault.
 *
 * Uwaga lokalizacyjna: ta mapa (i `TOOL_CATALOG` niżej) osadza etykietę w
 * momencie WSTAWIENIA klocka do schematu (dane biznesowe, zapisywane) — to
 * inna warstwa niż live-render palety (patrz `catalogLabelKey`), więc celowo
 * zostaje angielskim domyślnym tekstem niezależnie od bieżącego locale UI.
 */
export const TOOL_LABEL_BY_NAME: Record<string, string> = AGENT_BLOCK_ENTRIES.reduce<
  Record<string, string>
>((acc, entry) => {
  const specialized = entry.kind === 'vault-kontekst' || entry.kind === 'brama-akceptu';
  if (entry.status === 'active' && entry.toolName && !specialized && !acc[entry.toolName]) {
    acc[entry.toolName] = entry.label;
  }
  return acc;
}, {});

export function toolLabel(toolName: string | undefined): string | undefined {
  if (!toolName) return undefined;
  return TOOL_LABEL_BY_NAME[toolName] ?? toolName;
}

/**
 * Katalog narzędzi do `<select>` „Narzędzie" na klocku — kompatybilny kształt
 * z AGT-008 (`{name, label}`), teraz wyprowadzony z jednego katalogu zamiast
 * osobnej, ręcznie utrzymywanej listy. „(zgoda)" = krok zatrzyma plan.
 */
export interface ToolCatalogEntry {
  name: string;
  label: string;
}

export const TOOL_CATALOG: ToolCatalogEntry[] = (() => {
  const seen = new Set<string>();
  const out: ToolCatalogEntry[] = [];
  AGENT_BLOCK_ENTRIES.forEach((entry) => {
    const specialized = entry.kind === 'vault-kontekst' || entry.kind === 'brama-akceptu';
    if (entry.status !== 'active' || !entry.toolName || specialized) return;
    if (seen.has(entry.toolName)) return;
    seen.add(entry.toolName);
    out.push({
      name: entry.toolName,
      label: entry.approval ? `${entry.label} (approval)` : entry.label,
    });
  });
  return out;
})();

/** Bezpieczny, tylko-do-odczytu domyślny wybór dla nowego klocka. */
export const DEFAULT_TOOL_NAME = 'search_knowledge_base';
