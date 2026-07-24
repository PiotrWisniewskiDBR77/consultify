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
 * Stan rejestru na 2026-07-24 (`git show origin/demo:server/src/services/ai/
 * toolDefinitions.ts`) — 19 narzędzi, wszystkie z case'em w dispatcherze:
 *   search_web · search_knowledge_base · list_enterprise_connectors ·
 *   search_enterprise_connector · get_assessment_data · calculate_financial ·
 *   run_monte_carlo · get_initiative_status · compare_benchmarks ·
 *   find_similar_decisions · get_stakeholder_analysis · create_initiative_draft ·
 *   generate_report_section · schedule_meeting · create_notebook_entry ·
 *   query_structured_data · create_task · update_task · create_decision
 *
 * ── BRAMKA AKCEPTU ───────────────────────────────────────────────────────────
 * `SIDE_EFFECT_TOOLS` (server/src/services/ai/sideEffectTools.ts) trzyma pięć
 * narzędzi, które backend SAM zatrzymuje na `awaiting_approval`:
 * create_initiative_draft, generate_report_section, schedule_meeting,
 * create_notebook_entry, query_structured_data. UWAGA — pisarze My Work
 * (`create_task`, `update_task`, `create_decision`) NIE są na tej liście, czyli
 * domyślnie wykonałyby się bez pytania. Dlatego klocki `kind: 'automat'`
 * (i `'brama-akceptu'`) wysyłają JAWNY override `requiresApproval: true`
 * (backend go przyjmuje — `PlanStepInputSchema` w agent-plan.routes.ts,
 * DOROBKA C 2026-07-23). Kierunek bezpieczny: pytamy częściej, nie rzadziej.
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
  | 'informacja';

export const ALL_BLOCK_KINDS: PlanBlockKind[] = [
  'etap-modul',
  'ai-teresa',
  'vault-kontekst',
  'brama-akceptu',
  'automat',
  'informacja',
];

export const BLOCK_KIND_FALLBACK_LABEL: Record<PlanBlockKind, string> = {
  'etap-modul': 'Etap-moduł',
  'ai-teresa': 'AI / Teresa',
  'vault-kontekst': 'Vault-kontekst',
  'brama-akceptu': 'Zgoda (bramka)',
  automat: 'Automat',
  informacja: 'Informacja',
};

export const BLOCK_KIND_LABEL_KEY: Record<PlanBlockKind, string> = {
  'etap-modul': 'agentPlan.canvas.kind.etapModul',
  'ai-teresa': 'agentPlan.canvas.kind.aiTeresa',
  'vault-kontekst': 'agentPlan.canvas.kind.vaultKontekst',
  'brama-akceptu': 'agentPlan.canvas.kind.bramaAkceptu',
  automat: 'agentPlan.canvas.kind.automat',
  informacja: 'agentPlan.canvas.kind.informacja',
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
  return kind === 'brama-akceptu' || kind === 'automat';
}

/** Jedna pozycja palety = jeden klocek do wstawienia w schemat. */
export interface AgentBlockCatalogEntry {
  /** Stabilny id pozycji palety (nie mylić z id klocka w schemacie). */
  id: string;
  /** Czytelna nazwa PO POLSKU — to ona ląduje na klocku, nie snake_case. */
  label: string;
  /** Jedno zdanie: co ten klocek robi. */
  hint: string;
  kind: PlanBlockKind;
  /** Nazwa narzędzia 1:1 z `AI_TOOLS`. Brak = klocek nie jest krokiem (informacja) lub pozycja 'soon'. */
  toolName?: string;
  /** Moduł/obszar aplikacji pokazywany na klocku pod nazwą. */
  module?: string;
  status: 'active' | 'soon';
  /** Wypełnione TYLKO dla 'soon' — czego konkretnie brakuje w rejestrze. */
  soonReason?: string;
  /** true = backend zatrzyma plan na tym kroku (SIDE_EFFECT_TOOLS lub jawny override). */
  approval?: boolean;
}

export interface AgentBlockCatalogGroup {
  id: string;
  label: string;
  /** Jedno zdanie pod nagłówkiem grupy. */
  hint: string;
  entries: AgentBlockCatalogEntry[];
}

export const AGENT_BLOCK_CATALOG: AgentBlockCatalogGroup[] = [
  {
    id: 'moduly',
    label: 'Moduły',
    hint: 'Etapy oparte o dane z modułów aplikacji.',
    entries: [
      {
        id: 'mod-assessment',
        label: 'Dane oceny',
        hint: 'Czyta wyniki i luki z modułu Assessment.',
        kind: 'etap-modul',
        toolName: 'get_assessment_data',
        module: 'Assessment',
        status: 'active',
      },
      {
        id: 'mod-initiatives',
        label: 'Status inicjatyw',
        hint: 'Portfel inicjatyw: postęp, właściciele, ryzyka.',
        kind: 'etap-modul',
        toolName: 'get_initiative_status',
        module: 'Initiatives',
        status: 'active',
      },
      {
        id: 'mod-decisions',
        label: 'Podobne decyzje',
        hint: 'Szuka wcześniejszych decyzji o zbliżonym kontekście.',
        kind: 'etap-modul',
        toolName: 'find_similar_decisions',
        module: 'My Work · Decyzje',
        status: 'active',
      },
      {
        id: 'mod-stakeholders',
        label: 'Analiza interesariuszy',
        hint: 'Mapa wpływu i nastawienia interesariuszy.',
        kind: 'etap-modul',
        toolName: 'get_stakeholder_analysis',
        module: 'Initiatives',
        status: 'active',
      },
      {
        id: 'mod-finance',
        label: 'Kalkulacja finansowa',
        hint: 'ROI, NPV, okres zwrotu na danych projektu.',
        kind: 'etap-modul',
        toolName: 'calculate_financial',
        module: 'Finance',
        status: 'active',
      },
      {
        id: 'mod-montecarlo',
        label: 'Symulacja Monte Carlo',
        hint: 'Rozkład wyniku przy niepewnych założeniach.',
        kind: 'etap-modul',
        toolName: 'run_monte_carlo',
        module: 'Finance',
        status: 'active',
      },
      {
        id: 'mod-benchmarks',
        label: 'Porównanie z benchmarkami',
        hint: 'Zestawia wyniki z bazą benchmarków branżowych.',
        kind: 'etap-modul',
        toolName: 'compare_benchmarks',
        module: 'Results',
        status: 'active',
      },
      {
        id: 'mod-interview',
        label: 'Wywiad (Interview)',
        hint: 'Pobranie odpowiedzi z ankiet i wywiadów.',
        kind: 'etap-modul',
        module: 'Interview',
        status: 'soon',
        soonReason:
          'Brak narzędzia Interview w AI_TOOLS (toolDefinitions.ts) — nie ma czego wywołać.',
      },
      {
        id: 'mod-execution',
        label: 'Realizacja (Execution)',
        hint: 'Kamienie milowe, zadania i blokery wdrożenia.',
        kind: 'etap-modul',
        module: 'Execution',
        status: 'soon',
        soonReason:
          'Brak narzędzia Execution w AI_TOOLS — istnieje tylko get_initiative_status (Initiatives).',
      },
      {
        id: 'mod-results',
        label: 'Rezultaty (Results)',
        hint: 'Odczyt KPI i zrealizowanych korzyści.',
        kind: 'etap-modul',
        module: 'Results',
        status: 'soon',
        soonReason:
          'Brak narzędzia KPI/Results w AI_TOOLS — compare_benchmarks nie czyta realizacji.',
      },
      {
        id: 'mod-materials',
        label: 'Materiały / Deck',
        hint: 'Złożenie prezentacji z gotowych sekcji.',
        kind: 'etap-modul',
        module: 'Materials',
        status: 'soon',
        soonReason:
          'Brak narzędzia generującego Deck w AI_TOOLS — generate_report_section zwraca opis sekcji, nie dokument.',
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI / Teresa',
    hint: 'Kroki, w których pracuje model.',
    entries: [
      {
        id: 'ai-web',
        label: 'Szukaj w sieci',
        hint: 'Świeże dane rynkowe spoza organizacji.',
        kind: 'ai-teresa',
        toolName: 'search_web',
        module: 'Teresa',
        status: 'active',
      },
      {
        id: 'ai-report-section',
        label: 'Sekcja raportu',
        hint: 'Przygotowuje sekcję raportu z podanych źródeł.',
        kind: 'ai-teresa',
        toolName: 'generate_report_section',
        module: 'Materials',
        status: 'active',
        approval: true,
      },
      {
        id: 'ai-summary',
        label: 'Podsumowanie etapu',
        hint: 'Streszczenie wyników poprzednich kroków planu.',
        kind: 'ai-teresa',
        module: 'Teresa',
        status: 'soon',
        soonReason:
          'Brak narzędzia podsumowującego wyniki kroków w AI_TOOLS — agent nie ma dziś kroku „podsumuj to, co zebrałeś".',
      },
    ],
  },
  {
    id: 'dane',
    label: 'Dane i Vault',
    hint: 'Skąd agent bierze kontekst.',
    entries: [
      {
        id: 'vault-context',
        label: 'Vault — wybrany sejf',
        hint: 'Ogranicza wiedzę agenta do jednego sejfu (Mój / Projekt / Organizacja).',
        kind: 'vault-kontekst',
        toolName: 'search_knowledge_base',
        module: 'Vault',
        status: 'active',
      },
      {
        id: 'kb-search',
        label: 'Szukaj w wiedzy',
        hint: 'Przeszukuje dokumenty organizacji bez zawężania do sejfu.',
        kind: 'etap-modul',
        toolName: 'search_knowledge_base',
        module: 'Vault',
        status: 'active',
      },
      {
        id: 'structured-query',
        label: 'Zapytanie do danych',
        hint: 'Pytanie w języku naturalnym do danych tabelarycznych.',
        kind: 'etap-modul',
        toolName: 'query_structured_data',
        module: 'Tabele',
        status: 'active',
        approval: true,
      },
    ],
  },
  {
    id: 'automaty',
    label: 'Automaty',
    hint: 'Kroki, które coś TWORZĄ. Każdy pyta o zgodę przed wykonaniem.',
    entries: [
      {
        id: 'auto-task',
        label: 'Utwórz zadanie',
        hint: 'Zakłada zadanie w My Work.',
        kind: 'automat',
        toolName: 'create_task',
        module: 'My Work',
        status: 'active',
        approval: true,
      },
      {
        id: 'auto-task-update',
        label: 'Zaktualizuj zadanie',
        hint: 'Zmienia status lub pola istniejącego zadania.',
        kind: 'automat',
        toolName: 'update_task',
        module: 'My Work',
        status: 'active',
        approval: true,
      },
      {
        id: 'auto-decision',
        label: 'Utwórz decyzję',
        hint: 'Zakłada kartę decyzji do rozstrzygnięcia.',
        kind: 'automat',
        toolName: 'create_decision',
        module: 'My Work',
        status: 'active',
        approval: true,
      },
      {
        id: 'auto-initiative',
        label: 'Szkic inicjatywy',
        hint: 'Proponuje inicjatywę z opisem i szacunkiem ROI.',
        kind: 'automat',
        toolName: 'create_initiative_draft',
        module: 'Initiatives',
        status: 'active',
        approval: true,
      },
      {
        id: 'auto-note',
        label: 'Wpis w Notatniku',
        hint: 'Zapisuje ustalenia jako notatkę.',
        kind: 'automat',
        toolName: 'create_notebook_entry',
        module: 'Notatnik',
        status: 'active',
        approval: true,
      },
      {
        id: 'auto-meeting',
        label: 'Propozycja spotkania',
        hint: 'Proponuje termin i uczestników spotkania.',
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
    label: 'Kontrola przebiegu',
    hint: 'Gdzie agent ma się zatrzymać i co ma być opisane.',
    entries: [
      {
        id: 'ctrl-gate',
        label: 'Zgoda (bramka)',
        hint: 'Plan zatrzymuje się i czeka na Twoje zatwierdzenie.',
        kind: 'brama-akceptu',
        toolName: 'search_knowledge_base',
        module: 'Kontrola',
        status: 'active',
        approval: true,
      },
      {
        id: 'ctrl-note',
        label: 'Informacja (notatka)',
        hint: 'Opis na schemacie. Nie jest wykonywana — porządkuje proces.',
        kind: 'informacja',
        module: 'Kontrola',
        status: 'active',
      },
      {
        id: 'ctrl-branch',
        label: 'Warunek (rozgałęzienie)',
        hint: 'Różne ścieżki zależnie od wyniku poprzedniego kroku.',
        kind: 'brama-akceptu',
        module: 'Kontrola',
        status: 'soon',
        soonReason:
          'Plan jest LINIOWY (decyzja DEC-002, v1) — backend wykonuje kroki po kolei, nie ma modelu rozgałęzień.',
      },
      {
        id: 'ctrl-loop',
        label: 'Pętla po liście',
        hint: 'Powtórz krok dla każdego elementu (np. każdej inicjatywy).',
        kind: 'brama-akceptu',
        module: 'Kontrola',
        status: 'soon',
        soonReason:
          'Brak modelu iteracji w agentPlannerService — kroki są płaską listą wykonywaną raz.',
      },
    ],
  },
  {
    id: 'integracje',
    label: 'Integracje',
    hint: 'Systemy poza Consultify.',
    entries: [
      {
        id: 'int-list',
        label: 'Lista konektorów',
        hint: 'Sprawdza, które integracje są podłączone i świeże.',
        kind: 'etap-modul',
        toolName: 'list_enterprise_connectors',
        module: 'Integracje',
        status: 'active',
      },
      {
        id: 'int-search',
        label: 'Szukaj w konektorze',
        hint: 'Odpytuje podłączony system firmowy przez bramę Wave 7.',
        kind: 'etap-modul',
        toolName: 'search_enterprise_connector',
        module: 'Integracje',
        status: 'active',
      },
      {
        id: 'int-sharepoint',
        label: 'SharePoint',
        hint: 'Pobranie dokumentów z biblioteki SharePoint.',
        kind: 'etap-modul',
        module: 'Integracje',
        status: 'soon',
        soonReason:
          'Konektor jest w katalogu integracji (integrationHubService CONNECTORS), ale nie ma własnego narzędzia w AI_TOOLS — agent sięga po niego tylko ogólnym „Szukaj w konektorze".',
      },
      {
        id: 'int-teams',
        label: 'Microsoft Teams',
        hint: 'Kanały i wiadomości zespołu.',
        kind: 'etap-modul',
        module: 'Integracje',
        status: 'soon',
        soonReason: 'Konektor w katalogu integracji, bez dedykowanego narzędzia w AI_TOOLS.',
      },
      {
        id: 'int-slack',
        label: 'Slack',
        hint: 'Kanały i wiadomości.',
        kind: 'etap-modul',
        module: 'Integracje',
        status: 'soon',
        soonReason: 'Konektor w katalogu integracji, bez dedykowanego narzędzia w AI_TOOLS.',
      },
      {
        id: 'int-jira',
        label: 'Jira',
        hint: 'Zgłoszenia, sprinty i tablice.',
        kind: 'etap-modul',
        module: 'Integracje',
        status: 'soon',
        soonReason: 'Konektor w katalogu integracji, bez dedykowanego narzędzia w AI_TOOLS.',
      },
      {
        id: 'int-gdrive',
        label: 'Google Drive',
        hint: 'Pliki i foldery z Dysku.',
        kind: 'etap-modul',
        module: 'Integracje',
        status: 'soon',
        soonReason: 'Konektor w katalogu integracji, bez dedykowanego narzędzia w AI_TOOLS.',
      },
      {
        id: 'int-outlook',
        label: 'Outlook / Kalendarz',
        hint: 'Poczta i terminy.',
        kind: 'etap-modul',
        module: 'Integracje',
        status: 'soon',
        soonReason: 'Konektor w katalogu integracji, bez dedykowanego narzędzia w AI_TOOLS.',
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
 */
export const TOOL_LABEL_BY_NAME: Record<string, string> = AGENT_BLOCK_ENTRIES.reduce<
  Record<string, string>
>((acc, entry) => {
  if (entry.status === 'active' && entry.toolName && !acc[entry.toolName]) {
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
    if (entry.status !== 'active' || !entry.toolName || seen.has(entry.toolName)) return;
    seen.add(entry.toolName);
    out.push({
      name: entry.toolName,
      label: entry.approval ? `${entry.label} (zgoda)` : entry.label,
    });
  });
  return out;
})();

/** Bezpieczny, tylko-do-odczytu domyślny wybór dla nowego klocka. */
export const DEFAULT_TOOL_NAME = 'search_knowledge_base';
