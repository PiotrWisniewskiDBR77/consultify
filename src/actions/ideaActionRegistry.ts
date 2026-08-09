/**
 * REJESTR AKCJI Idea Workspace — rdzeń standardu.
 *
 * SSOT: `docs/standards/idea-workspace/02_REJESTR_AKCJI.md`.
 *
 * PO CO TO JEST (powód powstania, nie ozdoba):
 * commit f5d0271992 naprawił ~40 martwych kliknięć na reprezentację, ale
 * PUNKTOWO — powłoka (Menu 3, popovery raila, prawy panel) nadal wysyła
 * gołe stringi akcji, więc następna akcja `mm_*` dopisana do wspólnej
 * powierzchni znowu będzie martwa. Rejestr + strażnik `scripts/check-actions.sh`
 * mają sprawić, że wprowadzenie martwego kliknięcia stanie się NIEMOŻLIWE:
 *   Z1 — akcja jest zadeklarowana RAZ, a pole `tools` fizycznie decyduje,
 *        w których reprezentacjach w ogóle istnieje (koniec rozjazdu nazw),
 *   Z3 — `handler` jest polem WYMAGANYM (akcja bez handlera się nie kompiluje),
 *        a strażnik sprawdza, że każdy string runtime ma odbiornik w hooku,
 *        każdy `CustomEvent` ma listenera i każdy endpoint istnieje w routerze,
 *   Z4 — `teresa.description` + `teresa.parameters` generują manifest narzędzi
 *        asystentki (`src/actions/teresaActionManifest.ts`), więc nowa akcja
 *        jest dostępna dla Teresy automatycznie.
 *
 * ⚠ KONTRAKT FORMATU (czyta go `scripts/check-actions.sh`, awk-em, nie parserem TS):
 *   • mapy runtime deklarujemy jako `const RUNTIME_*: ToolActionMap = { … }`
 *     z jedną parą `tool: 'action_string',` w linii,
 *   • każda akcja to jeden literał obiektu wcięty o 2 spacje w `IDEA_ACTIONS`,
 *     a pola akcji (`id:`, `handler:`, `surfaces:` …) o 4 spacje,
 *   • `id` i pola logiczne (`mutates`, `showsDisabled`) w JEDNEJ linii.
 * Zmiana formatu = zmiana strażnika. Bez tego rejestr przestaje być pilnowany.
 *
 * CZEGO TU JESZCZE NIE MA (świadomie, patrz raport fali):
 *   powierzchnie UI NIE renderują się jeszcze z rejestru — to następna fala
 *   (rozdz. 02, „Kolejność wdrożenia rdzenia", punkty 2–3 i 6).
 */

import type {
  CanvasToolType,
  IdeaWorkspaceSelection,
} from '@/components/MyWork/ideaSelectionTypes';
import type { UserRole } from '@/types/core';
import { Api } from '@/services/api';

// ───────────────────────────── TYPY KONTRAKTU ─────────────────────────────

/** Język etykiet/opisów. Produkt jest dwujęzyczny (PL domyślnie). */
export type Lang = 'pl' | 'en';

/** Zakres, na którym akcja operuje — DOKŁADNIE jeden (rozdz. 02). */
export type ActionScope =
  | 'workspace'
  | 'current_view'
  | 'selected_items'
  | 'single_item'
  | 'edge'
  | 'lane_frame'
  | 'table_row'
  | 'table_column'
  | 'table_cell'
  | 'external_artifact';

/** Cztery reprezentacje jednej Idei (ten sam graf, inny widok). */
export type Tool = CanvasToolType;

/** Powierzchnie, na których akcja może się pokazać. */
export type Surface = 'menu1' | 'menu3' | 'rail' | 'panel' | 'context' | 'floating';

/** Nazwy ikon lucide-react używane dziś przez powierzchnie Idea Workspace. */
export type IconName =
  | 'Plus'
  | 'LayoutGrid'
  | 'LayoutTemplate'
  | 'Sparkles'
  | 'Wand2'
  | 'GitMerge'
  | 'Search'
  | 'Lightbulb'
  | 'Target'
  | 'MousePointer2'
  | 'Workflow'
  | 'Download'
  | 'Copy'
  | 'Type'
  | 'ArrowLeftRight'
  | 'ArrowRight'
  | 'Paintbrush'
  | 'Trash2';

/** Minimalny JSON Schema — kształt zgodny z `parameters` w toolDefinitions.ts. */
export interface JSONSchema {
  type: 'object';
  properties: Record<string, Record<string, unknown>>;
  required?: string[];
}

/**
 * Kontekst wykonania. Ten sam dla kliknięcia w UI i dla polecenia Teresy —
 * różni je wyłącznie pole `source` (Z4: Teresa nie ma „ukrytych mocy").
 */
export interface ActionContext {
  ideaId: string;
  /** Aktywna reprezentacja (mapa/tablica/przepływ/tabela). */
  tool: Tool;
  selection: IdeaWorkspaceSelection;
  /** Powierzchnia, z której przyszło wywołanie ('panel' dla Teresy = czat). */
  surface: Surface;
  source: 'ui' | 'teresa';
  language?: Lang;
  /** Parametry z `teresa.parameters` albo z formularza powierzchni. */
  params?: Record<string, unknown>;
  /** Potwierdzenie użytkownika — wymagane, gdy `teresa.confirmBeforeRun`. */
  confirmed?: boolean;
}

export interface ActionResult {
  ok: boolean;
  actionId: string;
  /** Komunikat dla użytkownika (PL) — także powód odmowy. */
  message?: string;
  data?: unknown;
}

/**
 * Wymagana rola konta (hierarchia jak `ProtectedRoute.tsx:hasRequiredRole` —
 * OWNER/ADMIN spełniają wymóg roli niższej). Opcjonalne: brak pola = akcja
 * dostępna dla każdej zalogowanej roli (dzisiejsze domyślne zachowanie
 * wszystkich 16 wpisów, więc pole jest addytywne).
 */
export interface ActionPermission {
  requiredRole: UserRole;
}

/**
 * Typowany wynik terminalny — rozszerzenie ponad `ActionResult` (Krok
 * kolejnej fali, patrz DoD E02). `ActionResult` zostaje jako dzisiejszy,
 * synchroniczny kontrakt `handler`/`runIdeaAction`; `ActionOutcome` to
 * NOWA, bogatsza ścieżka zwrotna do wykorzystania przez powierzchnie, które
 * chcą rozróżnić `proposal`/`applied`/`error`/`cancelled` zamiast czytać to
 * z `ActionResult.ok` + `data.needsConfirmation`. Nieużywana jeszcze przez
 * `runIdeaAction` (patrz `outcomeFromResult` niżej) — dodana jako typ, żeby
 * kolejna fala mogła podłączać powierzchnie bez migracji sygnatury.
 */
export type ActionOutcome =
  | { status: 'applied'; result: ActionResult }
  | { status: 'proposal'; proposal: unknown }
  | { status: 'error'; error: string }
  | { status: 'cancelled' };

/** Adapter zgodności: dzisiejszy `ActionResult` → `ActionOutcome` (bez zmiany `runIdeaAction`). */
export function outcomeFromResult(result: ActionResult): ActionOutcome {
  if (!result.ok) {
    return { status: 'error', error: result.message || 'Nieznany błąd.' };
  }
  if ((result.data as { needsConfirmation?: boolean } | undefined)?.needsConfirmation) {
    return { status: 'cancelled' };
  }
  return { status: 'applied', result };
}

/**
 * Jak cofnąć skutek akcji. Wymagany, gdy `mutates: true` (kryterium odbioru
 * rozdz. 02: „żadna akcja mutates nie wykonuje się bez możliwości cofnięcia").
 */
export interface UndoDescriptor {
  /**
   * local_stack   — stos undo narzędzia (Ctrl+Z, `*_undo` w hooku),
   * proposal      — zmiana wchodzi dopiero po akceptacji podglądu (odrzucenie = brak zmiany),
   * snapshot      — cofnięcie przez Historię (`/map/snapshots`),
   * manual_delete — brak cofnięcia; skutkiem jest NOWY obiekt, który trzeba skasować ręcznie.
   */
  kind: 'local_stack' | 'proposal' | 'snapshot' | 'manual_delete';
  /** Skąd bierze się cofnięcie — plik/mechanizm, żeby dało się zweryfikować. */
  evidence: string;
}

export interface TeresaSpec {
  /** Co akcja robi — JĘZYKIEM UŻYTKOWNIKA, po polsku. */
  description: string;
  parameters?: JSONSchema;
  /** Dla destrukcyjnych/nieodwracalnych — Teresa musi zapytać przed wykonaniem. */
  confirmBeforeRun?: boolean;
}

/** Mapa: reprezentacja → realny string akcji obsługiwany przez jej hook. */
export type ToolActionMap = Partial<Record<Tool, string>>;

export interface ActionDef {
  /** Namespace'owany identyfikator ('idea.element.add'), nie 'mm_add_child'. */
  id: string;
  label: Record<Lang, string>;
  icon: IconName;
  scope: ActionScope;
  tools: Tool[] | 'all';
  surfaces: Surface[];
  shortcut?: string;
  /** WYMAGANY — brak handlera = brak kompilacji (Z3). */
  handler: (ctx: ActionContext) => Promise<ActionResult>;
  mutates: boolean;
  requiresPreview: boolean;
  undo?: UndoDescriptor;
  teresa: TeresaSpec;
  /**
   * Czy powierzchnia POKAZUJE akcję wyszarzoną poza jej zakresem (zamiast ją
   * ukryć). Jeśli true — `disabledReason` jest obowiązkowy (Z3: zero cichych
   * no-opów; konwencja z commita f5d0271992 / e2ad0cc85b).
   */
  showsDisabled?: boolean;
  disabledReason?: (ctx: ActionContext) => string | null;
  /** Realne stringi akcji wysyłane na szynę per reprezentacja (weryfikowane przez strażnika). */
  runtime?: ToolActionMap;
  /** Skąd wzięta definicja — plik:linia. Dowód, nie deklaracja. */
  source: string;

  /**
   * Wymagana rola konta. Brak pola = bez dodatkowego wymogu ponad zwykłe
   * uwierzytelnienie (dzisiejsze zachowanie wszystkich 16 wpisów — pole jest
   * opcjonalne, żeby nic nie trzeba było dopisywać wstecznie).
   */
  permission?: ActionPermission;
  /**
   * Nieodwracalna/niszcząca w sensie danych (np. trwałe usunięcie), OSOBNO od
   * `mutates` (które tylko mówi „coś się zmienia" — np. `idea.workspace.duplicate`
   * mutuje, ale nic nie niszczy). Domyślnie `false`, gdy nieustawione.
   */
  destructive?: boolean;
  /** Woła zewnętrzny system/efekt poza granicą Idea Workspace (np. eksport na dysk, integrację). Domyślnie `false`. */
  external?: boolean;
  /**
   * Kanoniczna JEDNA powierzchnia-właściciel akcji — odróżniona od `surfaces`
   * (gdzie akcja może się DODATKOWO pokazać, np. wyszarzona przez
   * `showsDisabled`). Brak pola = właściciel nieustalony jeszcze (dzisiejszy
   * stan wszystkich 16 wpisów); kolejna fala ma to uzupełnić per akcja.
   */
  ownerSurface?: Surface;
  /**
   * Nazwa zdarzenia telemetrii (WYŁĄCZNIE nazwa — żadnego payloadu treści
   * płótna/Idei tutaj, zgodnie z CLAUDE.md: telemetria nie może wyciekać
   * zawartości canvasu). Payload dobiera i sanityzuje warstwa wysyłająca
   * zdarzenie, nie rejestr.
   */
  analyticsEvent?: string;
}

// ─────────────────────── SZYNA: realne wywołania runtime ───────────────────────

/**
 * Kanoniczna szyna powłoki. `IdeaMapWorkspace.tsx:1119` nasłuchuje i re-emituje,
 * a hooki czterech narzędzi (`use*QuickActions.ts`) nasłuchują bezpośrednio:
 *   mindmap/useMindMapQuickActions.ts:1243 · whiteboard/useWhiteboardQuickActions.ts:147
 *   processflow/useProcessFlowQuickActions.ts:163 · table/useTableQuickActions.ts:316
 */
function dispatchQuickAction(action: string, ctx: ActionContext, extra?: Record<string, unknown>) {
  window.dispatchEvent(
    new CustomEvent('idea-workspace-quick-action', {
      detail: { action, ideaId: ctx.ideaId, source: ctx.source, ...(extra || {}) },
    })
  );
}

/**
 * Szyna węzłowa Mapy myśli (`IdeaMapWorkspace.tsx` nasłuchuje i deleguje do
 * `useMindMapQuickActions`). Używana WYŁĄCZNIE dla akcji Mapy — poza Mapą
 * nikt jej nie słucha, co było źródłem martwego „Auto-układu" w Przepływie.
 */
function dispatchMindmapPaneAction(action: string) {
  window.dispatchEvent(new CustomEvent('idea-mindmap-node-quick-action', { detail: { action } }));
}

/** Wysyła string właściwy dla AKTYWNEJ reprezentacji; brak wpisu = akcja tam nie istnieje. */
async function runByTool(
  actionId: string,
  map: ToolActionMap,
  ctx: ActionContext,
  extra?: Record<string, unknown>
): Promise<ActionResult> {
  const runtime = map[ctx.tool];
  if (!runtime) {
    return {
      ok: false,
      actionId,
      message: `Ta akcja nie istnieje w tej reprezentacji (${ctx.tool}).`,
    };
  }
  dispatchQuickAction(runtime, ctx, extra);
  return { ok: true, actionId, data: { runtime } };
}

/**
 * Cienki przekaźnik dla akcji `scope: 'edge'` Tablicy (pilot 2026-08-09,
 * `WhiteboardEdgeContextMenu.tsx`). Krawędź Tablicy NIE ma adresowalnego id
 * na szynie `idea-workspace-quick-action` — mutacja (etykieta/styl/strzałka/
 * odwrócenie/usunięcie) żyje w lokalnym zamknięciu `handleEdge*` w
 * `IdeaWhiteboardTool.tsx`, zamkniętym nad `edgeContextMenu.edgeId` z lokalnego
 * stanu Reacta. `useWhiteboardQuickActions.ts` NIE MA odbiornika dla akcji
 * krawędzi (patrz jego handlery `wb_*` — żaden nie dotyczy krawędzi), więc
 * `dispatchQuickAction`/`runByTool` tutaj by nie zadziałały bez dopisania
 * takiego odbiornika (poza zakresem tego pilota — celowo NIE ruszamy
 * `useWhiteboardQuickActions.ts` ani `IdeaWhiteboardTool.tsx`).
 *
 * Zamiast tego powierzchnia (komponent menu) przekazuje SWÓJ oryginalny
 * prop-callback jako `ctx.params.run` — ten handler go po prostu wykonuje.
 * ŚWIADOME OGRANICZENIE (Z4): Teresa NIE MA dziś sposobu wywołania tych akcji
 * — nie istnieje pojęcie „krawędź pod kursorem" adresowalne z czatu, więc
 * wywołanie z `ctx.source === 'teresa'` zawsze grzecznie odmawia. Naprawa
 * wymaga adresowalnego `edgeId` + odbiornika w `useWhiteboardQuickActions.ts`
 * — kolejna fala, nie ten pilot.
 */
async function runEdgeParamCallback(actionId: string, ctx: ActionContext): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa tylko z menu prawego kliku na konkretnym połączeniu Tablicy — nie mam dziś sposobu adresowania go z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

// ───────────────────── MAPY RUNTIME (parsowane przez strażnika) ─────────────────────

/**
 * „Dodaj element" — cztery warianty JEDNEJ akcji (Z1).
 * Źródło: `IdeaMapWorkspace.tsx` MENU3_ADD_ACTION_PER_TOOL (commit f5d0271992).
 */
const RUNTIME_ADD_ELEMENT: ToolActionMap = {
  mindmap: 'mm_add_child',
  whiteboard: 'wb_add_sticky',
  process_flow: 'pf_add_step',
  table: 'tbl_add_row',
};

/** Auto-układ. Przepływ ma WŁASNY silnik (`pf_auto_layout`, f5d0271992). */
const RUNTIME_AUTO_LAYOUT: ToolActionMap = {
  process_flow: 'pf_auto_layout',
};

/** Tryb kursora — stan wyłącznie Mapy myśli (obsługa: IdeaMapWorkspace.tsx:1060). */
const RUNTIME_CURSOR_SELECT: ToolActionMap = {
  mindmap: 'mm_select_mode',
};

/** AI: rozwiń (Mapa) — `/map/expand` + AIProposalDiffModal. */
const RUNTIME_AI_EXPAND: ToolActionMap = {
  mindmap: 'mm_ai_expand',
};

/** AI: podsumuj mapę — delegacja do czatu Teresy (bez mutacji grafu). */
const RUNTIME_AI_SUMMARIZE: ToolActionMap = {
  mindmap: 'mm_ai_summarize',
};

/** AI: znajdź tematy (Tablica) — generator `wb_find_themes` przez Propose→Accept. */
const RUNTIME_AI_FIND_THEMES: ToolActionMap = {
  whiteboard: 'wb_ai_find_themes',
};

/** AI: nazwij skupiska (Tablica) — `wb_name_clusters`, zmienia etykiety istniejących. */
const RUNTIME_AI_NAME_CLUSTERS: ToolActionMap = {
  whiteboard: 'wb_ai_name_clusters',
};

/** AI: wyciągnij działania (Tablica) — `wb_extract_actions`. */
const RUNTIME_AI_EXTRACT_ACTIONS: ToolActionMap = {
  whiteboard: 'wb_ai_extract_actions',
};

/** AI: analiza procesu (Przepływ) — `process_coach`, wynik tylko do odczytu. */
const RUNTIME_AI_PROCESS_ANALYSIS: ToolActionMap = {
  process_flow: 'pf_analyze',
};

/** AI: asystent tabeli — otwiera modal AITableAssistant (mutacja dopiero w środku). */
const RUNTIME_AI_TABLE_ASSISTANT: ToolActionMap = {
  table: 'tbl_ai_assistant',
};

/** AI: kategoryzacja tabeli — otwiera AICategorizeTool (Apply/Apply all per klaster). */
const RUNTIME_AI_TABLE_CATEGORIZE: ToolActionMap = {
  table: 'tbl_categorize',
};

/** AI: generator frameworka (Tabela) — otwiera FrameworkGenerator. */
const RUNTIME_AI_TABLE_FRAMEWORK: ToolActionMap = {
  table: 'tbl_framework',
};

// ──────────────────────────────── REJESTR ────────────────────────────────

const IDEA_ACTIONS: ActionDef[] = [
  {
    id: 'idea.element.add',
    label: {
      pl: 'Dodaj element',
      en: 'Add element',
    },
    icon: 'Plus',
    scope: 'current_view',
    tools: 'all',
    surfaces: ['menu3', 'context'],
    shortcut: 'Tab',
    // Krok B: `ctx.params` (dziś: `label` od Teresy/formularza) idzie na szynę
    // jako `extra` w CustomEvent.detail — cztery odbiorniki (`mm_add_child`
    // itd.) czytają `detail.label` i używają jej jako treści nowego elementu
    // zamiast pustej edycji (patrz use*QuickActions.ts, każdy z komentarzem
    // „Krok B").
    handler: (ctx) => runByTool('idea.element.add', RUNTIME_ADD_ELEMENT, ctx, ctx.params),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'stos undo narzędzia (mm/wb/pf/tbl_undo w use*QuickActions.ts)',
    },
    teresa: {
      description:
        'Dodaje nowy element do otwartej reprezentacji: gałąź w Mapie myśli, karteczkę na Tablicy, krok w Przepływie albo wiersz w Tabeli.',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Treść nowego elementu (opcjonalna).' },
        },
      },
    },
    runtime: RUNTIME_ADD_ELEMENT,
    source:
      'src/components/MyWork/IdeaMapWorkspace.tsx MENU3_ADD_ACTION_PER_TOOL (commit f5d0271992)',
  },
  {
    id: 'idea.view.auto_layout',
    label: {
      pl: 'Auto-układ',
      en: 'Auto layout',
    },
    icon: 'LayoutGrid',
    scope: 'current_view',
    tools: ['mindmap', 'process_flow'],
    surfaces: ['menu3', 'context'],
    handler: async (ctx) => {
      // Mapa myśli słucha szyny WĘZŁOWEJ, Przepływ ma własny silnik układu.
      // Dokładnie ten rozjazd był przyczyną martwego „Auto-układu" poza Mapą.
      if (ctx.tool === 'mindmap') {
        dispatchMindmapPaneAction('pane_auto_layout');
        return {
          ok: true,
          actionId: 'idea.view.auto_layout',
          data: { runtime: 'pane_auto_layout' },
        };
      }
      return runByTool('idea.view.auto_layout', RUNTIME_AUTO_LAYOUT, ctx);
    },
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaProcessFlowTool.handleAutoLayout (autoLayout + undo + broadcast); Mapa: mm-undo-state',
    },
    teresa: {
      description:
        'Układa elementy automatycznie — porządkuje gałęzie Mapy myśli albo kroki Przepływu. Nie zmienia treści, tylko rozmieszczenie.',
    },
    runtime: RUNTIME_AUTO_LAYOUT,
    source:
      'src/components/MyWork/processflow/useProcessFlowQuickActions.ts:149 (pf_auto_layout) + IdeaMapWorkspace.tsx onAutoLayout (commit f5d0271992)',
  },
  {
    id: 'idea.canvas.cursor_select',
    label: {
      pl: 'Tryb zaznaczania',
      en: 'Select mode',
    },
    icon: 'MousePointer2',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['rail'],
    handler: (ctx) => runByTool('idea.canvas.cursor_select', RUNTIME_CURSOR_SELECT, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Przełącza kursor w tryb zaznaczania na płótnie Mapy myśli (alternatywa dla przesuwania widoku).',
    },
    // Rail jest wspólny dla czterech reprezentacji, więc slot POKAZUJE się wszędzie
    // — poza Mapą wyszarzony z podanym powodem (konwencja f5d0271992/e2ad0cc85b).
    showsDisabled: true,
    disabledReason: (ctx) =>
      ctx.tool === 'mindmap'
        ? null
        : 'Tryb kursora to stan Mapy myśli. W tej reprezentacji zaznaczasz i przesuwasz bezpośrednio na płótnie.',
    runtime: RUNTIME_CURSOR_SELECT,
    source:
      'src/components/MyWork/IdeaMapWorkspace.tsx:1060 (mm_select_mode) + CanvasLeftToolbar.tsx (f5d0271992)',
  },
  {
    id: 'idea.ai.expand_map',
    label: {
      pl: 'AI: rozwiń mapę',
      en: 'AI: expand map',
    },
    icon: 'Sparkles',
    scope: 'workspace',
    tools: ['mindmap'],
    surfaces: ['menu3', 'rail', 'panel'],
    // Krok B: `ctx.params.nodeId` idzie na szynę jako `extra`, zgodnie z
    // deklaracją `teresa.parameters` niżej. ŚWIADOME OGRANICZENIE: runtime
    // string tej akcji to `mm_ai_expand` (patrz RUNTIME_AI_EXPAND), a
    // useMindMapQuickActions.ts obsługuje `mm_ai_expand` wołaniem
    // `handlers.handleAIExpand()` BEZ argumentu — `detail.nodeId` dociera na
    // szynę, ale nie ma dziś odbiornika dla TEGO runtime stringa (istnieje
    // osobny `mm_ai_expand_node`, który go czyta, ale rejestr go nie używa).
    // Zmiana routingu między `mm_ai_expand`/`mm_ai_expand_node` wykracza poza
    // zakres Kroku B — zostawiono jako znany dług, nie naprawiane tutaj.
    handler: (ctx) => runByTool('idea.ai.expand_map', RUNTIME_AI_EXPAND, ctx, ctx.params),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'POST /my-ideas/:id/map/expand → AIProposalDiffModal (checkbox per węzeł, Apply/Reject)',
    },
    teresa: {
      description:
        'Dopisuje do Mapy myśli nowe gałęzie zaproponowane przez AI. Zawsze pokazuje podgląd — nic nie wchodzi bez Twojej akceptacji.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'string',
            description: 'Węzeł, od którego rozwijamy (pusty = od korzenia lub zaznaczenia).',
          },
        },
      },
    },
    runtime: RUNTIME_AI_EXPAND,
    source: 'src/components/MyWork/mindmap/useMindMapQuickActions.ts:761',
  },
  {
    // „Szablony" — otwiera galerię szablonów widoku (`IdeaTemplateGallery`),
    // filtrowaną po aktywnym narzędziu. Wspólna dla wszystkich 4 reprezentacji
    // (Menu 3, lewy slot). NIE mutuje grafu — tylko otwiera modal; sama
    // aplikacja szablonu ma własny podgląd w środku galerii.
    id: 'idea.templates.open',
    label: {
      pl: 'Szablony',
      en: 'Templates',
    },
    icon: 'LayoutTemplate',
    scope: 'current_view',
    tools: 'all',
    surfaces: ['menu3'],
    handler: async (ctx) => {
      // Otwarcie modala żyje w stanie React hosta, więc rejestr sięga do niego
      // przez tę samą szynę co reszta akcji — string `open_template_gallery`
      // ma odbiornik w IdeaMapWorkspace.handleQuickAction (setTemplateGalleryOpen).
      dispatchQuickAction('open_template_gallery', ctx);
      return {
        ok: true,
        actionId: 'idea.templates.open',
        data: { runtime: 'open_template_gallery' },
      };
    },
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera galerię gotowych szablonów dla otwartej reprezentacji — szybki start z gotowej struktury zamiast pustego płótna/tabeli.',
    },
    source:
      'src/components/MyWork/IdeaMapWorkspace.tsx setTemplateGalleryOpen (Menu 3 „Szablony", buildIdeaMenu3Actions) + IdeaTemplateGallery.tsx',
  },
  {
    // „Eksport" — otwiera `IdeaExportMenu` z pełnym grafem + rozszerzeniami.
    // Document-level action: one canonical entry in Menu 1 overflow. Keeping it
    // out of Menu 3 prevents the same outcome from competing with view actions.
    id: 'idea.export.open',
    label: {
      pl: 'Eksport',
      en: 'Export',
    },
    icon: 'Download',
    scope: 'workspace',
    tools: 'all',
    surfaces: ['menu1'],
    handler: async (ctx) => {
      // `open_export_menu` ma gotowy odbiornik w IdeaMapWorkspace.handleQuickAction
      // (setExportMenuOpen) i w routerze zdarzeń szyny (lista dozwolonych akcji).
      dispatchQuickAction('open_export_menu', ctx);
      return { ok: true, actionId: 'idea.export.open', data: { runtime: 'open_export_menu' } };
    },
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera okno eksportu otwartej reprezentacji do pliku (obraz/PDF/pakiet — zależnie od narzędzia).',
    },
    source:
      'src/components/MyWork/IdeaMapWorkspace.tsx setExportMenuOpen (Menu 3 „Eksport" + kebab Menu 1) + IdeaExportMenu.tsx',
  },
  {
    id: 'idea.ai.summarize_map',
    label: {
      pl: 'AI: podsumuj mapę',
      en: 'AI: summarize map',
    },
    icon: 'Wand2',
    scope: 'workspace',
    tools: ['mindmap'],
    surfaces: ['rail', 'panel'],
    handler: (ctx) => runByTool('idea.ai.summarize_map', RUNTIME_AI_SUMMARIZE, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Streszcza zawartość Mapy myśli w czacie. Nie zmienia mapy — dostajesz opis tego, co już na niej jest.',
    },
    runtime: RUNTIME_AI_SUMMARIZE,
    source: 'src/components/MyWork/mindmap/useMindMapQuickActions.ts:931 (delegacja do czatu)',
  },
  {
    id: 'idea.ai.find_themes',
    label: {
      pl: 'AI: znajdź tematy',
      en: 'AI: find themes',
    },
    icon: 'Search',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['rail', 'panel'],
    handler: (ctx) => runByTool('idea.ai.find_themes', RUNTIME_AI_FIND_THEMES, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'POST /my-ideas/:id/ai-generate (wb_find_themes) → IdeaProposalReview (accept/reject per pozycja)',
    },
    teresa: {
      description:
        // ★ GRANICA NEGATYWNA (2026-07-24): na „ułóż tablicę automatycznie" dwa
        // z trzech modeli podstawiały tę akcję zamiast powiedzieć, że Tablica
        // nie ma auto-układu — zmierzone w żywej rundzie.
        'Grupuje karteczki na Tablicy w tematy i proponuje ramkę dla każdego. Propozycje pokazuję do akceptacji — nic nie wskakuje samo. Grupuje TYLKO tematycznie; nie układa elementów na płótnie — Tablica nie ma automatycznego układu, więc na prośbę o ułożenie powiedz to wprost.',
    },
    runtime: RUNTIME_AI_FIND_THEMES,
    source:
      'src/components/MyWork/whiteboard/useWhiteboardQuickActions.ts:21 (AI_ACTION_MAP) + AIActionsPopover.tsx TOOL_GENERATORS (f5d0271992)',
  },
  {
    id: 'idea.ai.name_clusters',
    label: {
      pl: 'AI: nazwij skupiska',
      en: 'AI: name clusters',
    },
    icon: 'GitMerge',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['rail', 'panel'],
    handler: (ctx) => runByTool('idea.ai.name_clusters', RUNTIME_AI_NAME_CLUSTERS, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'POST /my-ideas/:id/ai-generate (wb_name_clusters) → IdeaProposalReview (patch.updateNodes)',
    },
    teresa: {
      description:
        'Nadaje nazwy istniejącym skupiskom karteczek na Tablicy. Zmiana nazw wchodzi dopiero po akceptacji podglądu.',
    },
    runtime: RUNTIME_AI_NAME_CLUSTERS,
    source: 'src/components/MyWork/whiteboard/useWhiteboardQuickActions.ts:22 (AI_ACTION_MAP)',
  },
  {
    id: 'idea.ai.extract_actions',
    label: {
      pl: 'AI: wyciągnij działania',
      en: 'AI: extract action items',
    },
    icon: 'Target',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['rail', 'panel'],
    handler: (ctx) => runByTool('idea.ai.extract_actions', RUNTIME_AI_EXTRACT_ACTIONS, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'POST /my-ideas/:id/ai-generate (wb_extract_actions) → IdeaProposalReview',
    },
    teresa: {
      description:
        'Wyciąga z Tablicy konkretne działania do wykonania i proponuje je jako nowe elementy. Zawsze do akceptacji.',
    },
    runtime: RUNTIME_AI_EXTRACT_ACTIONS,
    source: 'src/components/MyWork/whiteboard/useWhiteboardQuickActions.ts:25 (AI_ACTION_MAP)',
  },
  {
    id: 'idea.ai.process_analysis',
    label: {
      pl: 'AI: analiza procesu',
      en: 'AI: process analysis',
    },
    icon: 'Lightbulb',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['rail', 'panel'],
    handler: (ctx) => runByTool('idea.ai.process_analysis', RUNTIME_AI_PROCESS_ANALYSIS, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Sprawdza Przepływ pod kątem wąskich gardeł i luk. Wynik dostajesz jako listę spostrzeżeń — sam proces zostaje bez zmian.',
    },
    runtime: RUNTIME_AI_PROCESS_ANALYSIS,
    source:
      'src/components/MyWork/processflow/useProcessFlowQuickActions.ts:144 (pf_analyze → runProcessCoach)',
  },
  {
    id: 'idea.ai.table_assistant',
    label: {
      pl: 'AI: asystent tabeli',
      en: 'AI: table assistant',
    },
    icon: 'Wand2',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['rail', 'panel'],
    handler: (ctx) => runByTool('idea.ai.table_assistant', RUNTIME_AI_TABLE_ASSISTANT, ctx),
    // Sama akcja tylko OTWIERA asystenta; zmiany danych robi się w jego wnętrzu
    // (i tam mają własny podgląd) — dlatego `mutates: false`, bez ściemy.
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera asystenta AI Tabeli — pomaga uzupełniać i przekształcać dane w wierszach i kolumnach.',
    },
    runtime: RUNTIME_AI_TABLE_ASSISTANT,
    source: 'src/components/MyWork/table/useTableQuickActions.ts:81',
  },
  {
    id: 'idea.ai.table_categorize',
    label: {
      pl: 'AI: skategoryzuj',
      en: 'AI: categorize',
    },
    icon: 'GitMerge',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['rail', 'panel'],
    handler: (ctx) => runByTool('idea.ai.table_categorize', RUNTIME_AI_TABLE_CATEGORIZE, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        // ★ GRANICA NEGATYWNA (2026-07-24): bez ostatniego zdania gpt-4o i
        // sonnet-4-6 wołały tę akcję na prośbę o KARTECZKI TABLICY i meldowały
        // „Otworzyłam kategoryzację AI dla Tablicy" — zmierzone w żywej rundzie.
        'Otwiera kategoryzację AI dla Tabeli — proponuje pogrupowanie WIERSZY tej Tabeli, każdą grupę zatwierdzasz osobno. Nie dotyczy karteczek Tablicy ani gałęzi Mapy myśli — jeśli użytkownik prosi o nie, powiedz wprost, że tej akcji nie ma w Tabeli.',
    },
    runtime: RUNTIME_AI_TABLE_CATEGORIZE,
    source: 'src/components/MyWork/table/useTableQuickActions.ts:85',
  },
  {
    id: 'idea.ai.table_framework',
    label: {
      pl: 'AI: generator frameworka',
      en: 'AI: framework generator',
    },
    icon: 'Lightbulb',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['rail', 'panel'],
    handler: (ctx) => runByTool('idea.ai.table_framework', RUNTIME_AI_TABLE_FRAMEWORK, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera generator frameworka Tabeli — podpowiada gotową strukturę kolumn dla wybranej metody pracy.',
    },
    runtime: RUNTIME_AI_TABLE_FRAMEWORK,
    source: 'src/components/MyWork/table/useTableQuickActions.ts:82',
  },
  {
    id: 'idea.workspace.convert',
    label: {
      pl: 'Konwertuj',
      en: 'Convert',
    },
    icon: 'Workflow',
    scope: 'workspace',
    tools: 'all',
    // Konwersja CAŁEJ Idei to zakres `workspace` → jej miejsce to Menu 1
    // (primary „Konwertuj ▾", `IdeaConvertMenu`) i prawy panel, NIGDY Menu 3.
    // Menu 3 renderuje się teraz z rejestru (filtr surfaces⊇menu3), więc
    // pozostawienie 'menu3' tutaj wstawiłoby do drugiej listwy przycisk bez
    // dropdownu (handler wymaga `target`+potwierdzenia → klik bez efektu) —
    // dokładnie martwy klik, którego pilnuje strażnik. Zgodne z rozdz. 05 §2
    // (workspace = Menu 1) i §4.1/D6 (skrót „Utwórz z mapy" ZAKAZANY w Menu 3).
    surfaces: ['menu1', 'panel'],
    handler: async (ctx) => {
      const target = String(ctx.params?.target || '');
      const allowed = ['initiative', 'task_set', 'decision', 'report', 'presentation'];
      if (!allowed.includes(target)) {
        return {
          ok: false,
          actionId: 'idea.workspace.convert',
          message: `Podaj, w co przekształcić Ideę: ${allowed.join(', ')}.`,
        };
      }
      if (!ctx.confirmed) {
        return {
          ok: false,
          actionId: 'idea.workspace.convert',
          message: 'Konwersja tworzy nowy, trwały obiekt — potrzebuję potwierdzenia.',
        };
      }
      const data = await Api.convertMyIdea(ctx.ideaId, {
        target: target as 'initiative' | 'task_set' | 'decision' | 'report' | 'presentation',
      });
      return { ok: true, actionId: 'idea.workspace.convert', data };
    },
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'brak cofnięcia — powstaje nowy rekord (Initiative/Decision/Task/Report/Presentation), usuwa się go ręcznie (audyt 04 §0 pkt 4)',
    },
    teresa: {
      description:
        'Przekształca Ideę w gotowy obiekt pracy: inicjatywę, zestaw zadań, decyzję, raport albo prezentację. Tworzy nowy, trwały rekord.',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'initiative | task_set | decision | report | presentation',
          },
        },
        required: ['target'],
      },
      confirmBeforeRun: true,
    },
    source:
      'src/services/api.ts:5138 (convertMyIdea) + IdeaMapWorkspace.tsx handleConvert (audyt 02 §A m1_convert)',
  },
  {
    id: 'idea.workspace.duplicate',
    label: {
      pl: 'Duplikuj Ideę',
      en: 'Duplicate idea',
    },
    icon: 'Copy',
    scope: 'workspace',
    tools: 'all',
    surfaces: ['menu1'],
    handler: async (ctx) => {
      const data = await Api.duplicateMyIdea(ctx.ideaId, { language: ctx.language || 'pl' });
      return { ok: true, actionId: 'idea.workspace.duplicate', data };
    },
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence: 'klon jest osobną Ideą — cofnięcie = usunięcie kopii (DELETE /my-ideas/:id)',
    },
    teresa: {
      description:
        'Robi kopię całej Idei razem z jej mapą — do eksperymentów bez ruszania oryginału.',
      confirmBeforeRun: true,
    },
    source: 'src/services/api.ts:4619 (duplicateMyIdea) + IdeaMapWorkspace.tsx kebab „Duplikuj"',
  },
  // ── PILOT scope='edge' (2026-08-09) — WhiteboardEdgeContextMenu.tsx ──────
  // Pierwsze 5 wpisów zakresu 'edge' w rejestrze. Handler = runEdgeParamCallback
  // (patrz komentarz przy jej definicji) — świadomie inny wzorzec niż
  // dispatchQuickAction/runByTool używany przez pozostałe 16 wpisów, bo
  // Tablica nie ma dziś odbiornika krawędzi na szynie. Kolejność deklaracji
  // = kolejność w menu (1:1 ze stanem sprzed migracji).
  {
    id: 'idea.edge.edit_label',
    label: { pl: 'Dodaj / edytuj etykietę', en: 'Add / edit label' },
    icon: 'Type',
    scope: 'edge',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.edit_label', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaWhiteboardTool.tsx handleEdgeEditLabel:3158 → pushUndoSnapshot() przed setEdges (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Ustawia etykietę zaznaczonego połączenia na Tablicy (okno tekstowe z bieżącą wartością). Dziś dostępne WYŁĄCZNIE z menu prawego kliku na konkretnym połączeniu — Teresa nie ma jeszcze sposobu wskazania „które połączenie", więc wywołanie z czatu zawsze odmówi.',
    },
    source: 'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeEditLabel:3158',
  },
  {
    id: 'idea.edge.reverse',
    label: { pl: 'Odwróć kierunek', en: 'Reverse direction' },
    icon: 'ArrowLeftRight',
    scope: 'edge',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.reverse', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaWhiteboardTool.tsx handleEdgeReverse:3223 → pushUndoSnapshot() przed zamianą source/target (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Zamienia miejscami początek i koniec zaznaczonego połączenia na Tablicy. Dziś dostępne WYŁĄCZNIE z menu prawego kliku na konkretnym połączeniu — jak wyżej, Teresa dziś tego nie wywoła.',
    },
    source: 'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeReverse:3223',
  },
  {
    id: 'idea.edge.cycle_arrow',
    label: { pl: 'Kierunek strzałki', en: 'Arrow direction' },
    icon: 'ArrowRight',
    scope: 'edge',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.cycle_arrow', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaWhiteboardTool.tsx handleEdgeCycleArrow:3200 → pushUndoSnapshot() przed zmianą data.arrowDirection (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Przełącza strzałkę kierunku zaznaczonego połączenia na Tablicy (cykl: brak → koniec → oba → początek). Dziś dostępne WYŁĄCZNIE z menu prawego kliku na konkretnym połączeniu — jak wyżej, Teresa dziś tego nie wywoła.',
    },
    source: 'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeCycleArrow:3200',
  },
  {
    id: 'idea.edge.cycle_style',
    label: { pl: 'Zmień styl linii', en: 'Change line style' },
    icon: 'Paintbrush',
    scope: 'edge',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.cycle_style', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaWhiteboardTool.tsx handleEdgeCycleStyle:3178 → pushUndoSnapshot() przed zmianą data.edgeStyle (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Przełącza styl linii zaznaczonego połączenia na Tablicy (cykl: ciągła → kreskowana → kropkowana → falista). Dziś dostępne WYŁĄCZNIE z menu prawego kliku na konkretnym połączeniu — jak wyżej, Teresa dziś tego nie wywoła.',
    },
    source: 'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeCycleStyle:3178',
  },
  {
    id: 'idea.edge.delete',
    label: { pl: 'Usuń połączenie', en: 'Delete connection' },
    icon: 'Trash2',
    scope: 'edge',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.delete', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaWhiteboardTool.tsx handleEdgeDelete:3245 → onEdgesChange:1144 → pushUndoSnapshot() przed applyEdgeChanges (stos Ctrl+Z)',
    },
    // Trwałe usunięcie krawędzi z grafu — pierwsze użycie `destructive` w
    // rejestrze (pole zadeklarowane, dotąd nieużywane przez żaden z 16
    // wcześniejszych wpisów). Undo jest lokalny (Ctrl+Z), stąd `mutates`+`undo`
    // osobno od `destructive`, zgodnie z opisem pola w interfejsie ActionDef.
    destructive: true,
    teresa: {
      description:
        'Usuwa zaznaczone połączenie z Tablicy na trwałe (cofnięcie tylko przez Ctrl+Z w tej samej sesji). Dziś dostępne WYŁĄCZNIE z menu prawego kliku na konkretnym połączeniu — jak wyżej, Teresa dziś tego nie wywoła.',
    },
    source: 'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeDelete:3245',
  },
];

// ─────────────────────────── DOSTĘP DO REJESTRU ───────────────────────────

/**
 * Zamrożony rejestr — pojedyncze źródło prawdy o akcjach Idea Workspace.
 * `Object.freeze` jest twardą blokadą dopisania akcji „w locie" z komponentu:
 * akcja może powstać wyłącznie tutaj, czyli pod okiem strażnika.
 */
export const IDEA_ACTION_REGISTRY: readonly ActionDef[] = Object.freeze(
  IDEA_ACTIONS.map((a) => Object.freeze(a))
);

const BY_ID: ReadonlyMap<string, ActionDef> = new Map(IDEA_ACTIONS.map((a) => [a.id, a]));

export function getAction(id: string): ActionDef | undefined {
  return BY_ID.get(id);
}

/** Czy akcja w ogóle istnieje w danej reprezentacji (Z1 — pole `tools` rządzi). */
export function isActionAvailableInTool(def: ActionDef, tool: Tool): boolean {
  return def.tools === 'all' || def.tools.includes(tool);
}

/**
 * Co powierzchnia ma narysować. Akcja spoza `tools` trafia tu WYŁĄCZNIE gdy
 * `showsDisabled` — i wtedy z gotowym powodem wyszarzenia (Z3).
 */
export function getActionsForSurface(
  surface: Surface,
  ctx: Pick<ActionContext, 'tool'> & Partial<ActionContext>
): Array<{ def: ActionDef; disabledReason: string | null }> {
  const full: ActionContext = {
    ideaId: ctx.ideaId || '',
    tool: ctx.tool,
    selection: ctx.selection || { type: 'none', count: 0, ids: [] },
    surface,
    source: ctx.source || 'ui',
    language: ctx.language,
    params: ctx.params,
    confirmed: ctx.confirmed,
  };
  const out: Array<{ def: ActionDef; disabledReason: string | null }> = [];
  for (const def of IDEA_ACTIONS) {
    if (!def.surfaces.includes(surface)) continue;
    const inTool = isActionAvailableInTool(def, ctx.tool);
    if (!inTool && !def.showsDisabled) continue;
    const reason = def.disabledReason
      ? def.disabledReason(full)
      : inTool
        ? null
        : 'Niedostępne tutaj.';
    out.push({ def, disabledReason: reason });
  }
  return out;
}

/**
 * Jedyne wejście wykonawcze — używają go i powierzchnie UI, i Teresa.
 * Egzekwuje reguły bezpieczeństwa rozdz. 02: brak akcji = odmowa z komunikatem,
 * wyszarzenie = odmowa z powodem, `confirmBeforeRun` = wymagane potwierdzenie.
 */
export async function runIdeaAction(id: string, ctx: ActionContext): Promise<ActionResult> {
  const def = BY_ID.get(id);
  if (!def) {
    return { ok: false, actionId: id, message: `Nie znam akcji „${id}".` };
  }
  if (!isActionAvailableInTool(def, ctx.tool)) {
    const reason = def.disabledReason?.(ctx) || 'Ta akcja nie istnieje w tej reprezentacji.';
    return { ok: false, actionId: id, message: reason };
  }
  const blocked = def.disabledReason?.(ctx);
  if (blocked) {
    return { ok: false, actionId: id, message: blocked };
  }
  if (def.teresa.confirmBeforeRun && ctx.source === 'teresa' && !ctx.confirmed) {
    return {
      ok: false,
      actionId: id,
      message: `„${def.label.pl}" zmienia dane na trwałe — potwierdź, zanim to zrobię.`,
      // Addytywne (Krok A): powierzchnia czatu używa tego pola, żeby zamiast
      // samego tekstu odmowy wyrenderować przyciski „Potwierdź"/„Anuluj" —
      // ponowne wywołanie z `confirmed: true` idzie TĄ SAMĄ ścieżką
      // (executeTeresaTool → runIdeaAction), więc nie ma drugiego mechanizmu.
      data: { needsConfirmation: true, actionId: id },
    };
  }
  return def.handler(ctx);
}
