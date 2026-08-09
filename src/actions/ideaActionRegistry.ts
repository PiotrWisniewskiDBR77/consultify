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

/**
 * Powierzchnie, na których akcja może się pokazać.
 *
 * `toolbar` (2026-08-09, N7 kontynuacja) — dopisane dla `WhiteboardToolbar.tsx`.
 * ŻADNA z sześciu poprzednich wartości nie pasuje uczciwie: to nie Menu 3
 * (osobny, już zarejestrowany komponent — `buildIdeaMenu3Actions` w
 * `IdeaMapWorkspace.tsx` — kolizja identyfikatorów powierzchni podwoiłaby te
 * pozycje w innym rzędzie), nie `rail` (fizyczny prawy/lewy rail kreacji —
 * właściciel: `CanvasLeftToolbar.tsx`, patrz komentarz w `WhiteboardToolbar.tsx`
 * o „Sticky/Text/Shape/Frame/Draw owned exclusively by the left rail"), nie
 * `panel` (prawy panel informacji) i nie `floating` (pasek zaznaczenia —
 * znaczenie zdefiniowane w `_KONTRAKT_REDAKCYJNY.md`). `WhiteboardToolbar.tsx`
 * to osobny, drugorzędny górny pasek („Editor Shell Canon §2 GÓRNA") spoza
 * sześciopunktowej anatomii z rozdz. 01 — dodanie nowej wartości zamiast
 * naciągnięcia istniejącej jest bezpieczne (żaden inny caller `getActionsForSurface`
 * nie używa dziś `rail`/`panel`/`floating`, więc zero ryzyka kolizji), ale
 * właściciel powinien ocenić, czy ten pasek docelowo scala się z Menu 3 zamiast
 * mieć własną powierzchnię — nierozstrzygnięte tutaj (wyłącznie wiring, nie redesign).
 */
export type Surface = 'menu1' | 'menu3' | 'rail' | 'panel' | 'context' | 'floating' | 'toolbar';

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
  | 'Trash2'
  | 'Circle'
  | 'Diamond'
  | 'Hexagon'
  | 'Image'
  | 'Link2'
  | 'Undo2'
  | 'Redo2'
  | 'ThumbsUp'
  | 'TrendingUp'
  | 'ExternalLink'
  | 'Keyboard'
  | 'Grid3X3'
  | 'Shapes'
  | 'Save';

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
 * Runtime strings na szynie `idea-workspace-quick-action` dla akcji krawędzi
 * Tablicy — odbiornik: `useWhiteboardQuickActions.ts` (`editEdgeLabel` /
 * `reverseEdge` / `cycleEdgeArrow` / `cycleEdgeStyle` / `deleteEdge`,
 * dopisane 2026-08-09 razem z tą mapą). Konwencja nazw 1:1 z resztą rejestru
 * (`RUNTIME_*`), analogicznie do `mm_edge_arrow` w Mapie myśli.
 */
const RUNTIME_EDGE_ACTION: Record<string, string> = {
  'idea.edge.edit_label': 'wb_edge_edit_label',
  'idea.edge.reverse': 'wb_edge_reverse',
  'idea.edge.cycle_arrow': 'wb_edge_cycle_arrow',
  'idea.edge.cycle_style': 'wb_edge_cycle_style',
  'idea.edge.delete': 'wb_edge_delete',
};

/**
 * Przekaźnik dla akcji `scope: 'edge'` Tablicy (pilot 2026-08-09,
 * `WhiteboardEdgeContextMenu.tsx`; odbiornik szyny dopisany tego samego dnia
 * jako follow-up, patrz `useWhiteboardQuickActions.ts` + `IdeaWhiteboardTool.tsx`
 * `handleEdge*`).
 *
 * DWIE ścieżki, jedna funkcja:
 *  • `ctx.source === 'ui'` + `ctx.params.run` (funkcja) — komponent menu
 *    przekazuje SWÓJ oryginalny prop-callback (zamknięty nad lokalnym stanem
 *    `edgeContextMenu` w `IdeaWhiteboardTool.tsx`); wykonujemy go wprost,
 *    DOKŁADNIE jak przed tym follow-upem — zachowanie kliku człowieka jest
 *    nietknięte.
 *  • każdy inny wywołujący (Teresa, przyszła powierzchnia bez dostępu do
 *    tego konkretnego zamknięcia komponentu) — nie ma `ctx.params.run`, więc
 *    zamiast grzecznej odmowy dispatchujemy na szynę `idea-workspace-quick-action`
 *    z realnym `edgeId`, którą teraz słucha `useWhiteboardQuickActions.ts`
 *    (ten sam wzorzec co `mm_edge_arrow` w Mapie myśli — `edgeId` zamiast
 *    zamknięcia nad komponentem).
 *
 * Skąd `edgeId` bez zamknięcia komponentu? `ctx.params.edgeId` (LLM podaje
 * wprost — `teresa.parameters` każdej z 5 akcji niżej go wymaga, wzorem
 * `idea.ai.expand_map`'s `nodeId`), z fallbackiem na `ctx.selection` (gdy
 * `type === 'edge'`, konwencja `IdeaWorkspaceSelection` z `ideaSelectionTypes.ts`)
 * dla przyszłych wywołań opartych na zaznaczeniu UI. UWAGA (odbiór): dziś
 * `UnifiedChatPanel.tsx` woła `executeTeresaTool` z `selection: EMPTY_SELECTION`
 * na sztywno (linie ~1988/2039) — fallback na `ctx.selection` jest więc
 * martwy dla Teresy, dopóki ta osobna, poza zakresem tego zadania, luka nie
 * zostanie naprawiona. Żywa ścieżka dla Teresy dziś to `ctx.params.edgeId`.
 */
async function runEdgeParamCallback(actionId: string, ctx: ActionContext): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }

  const edgeId =
    typeof ctx.params?.edgeId === 'string' && ctx.params.edgeId
      ? ctx.params.edgeId
      : ctx.selection?.type === 'edge' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  if (!edgeId) {
    return {
      ok: false,
      actionId,
      message:
        'Nie wiem, na którym połączeniu Tablicy wykonać tę akcję — podaj `edgeId` (np. z listy połączeń) albo zaznacz je najpierw.',
    };
  }
  const runtime = RUNTIME_EDGE_ACTION[actionId];
  if (!runtime) {
    return {
      ok: false,
      actionId,
      message: `Ta akcja nie istnieje w tej reprezentacji (${ctx.tool}).`,
    };
  }
  dispatchQuickAction(runtime, ctx, { edgeId, ...(ctx.params || {}) });
  return { ok: true, actionId, data: { runtime, edgeId } };
}

/**
 * Cienki przekaźnik dla akcji `WhiteboardToolbar.tsx` (2026-08-09, N7
 * kontynuacja pilota krawędzi) BEZ dziś istniejącego stringa runtime na
 * żadnej szynie ani odbiornika w `useWhiteboardQuickActions.ts` — dokładnie
 * ta sama sytuacja co edge PRZED follow-upem 43fb54eb4c, świadomie
 * NIENAPRAWIANA w tym samym wpisie (patrz `WhiteboardToolbar.tsx`, komentarz
 * przy każdej z tych akcji, DLACZEGO akurat tych sześć zostało bez odbiornika,
 * a reszta baru dostała realne dispatchowanie).
 *
 * ŚWIADOME OGRANICZENIE (Z4): `src/components/AIChat/whiteboardIntentDetector.ts`
 * (jedyny istniejący, choć legacy, regexowy detektor intencji Tablicy) nie ma
 * ANI JEDNEGO wzorca pasującego do skrótów klawiszowych/tła/Zapisz/Wyczyść
 * rysunki — więc w przeciwieństwie do edge (gdzie było jasne "Teresa powinna
 * to wołać po edgeId"), tu nie ma dziś ŻADNEGO sygnału, że ktokolwiek próbował
 * wywołać te operacje z czatu. Stąd świadoma decyzja: UI-only na tę turę,
 * bez budowania nowej infrastruktury szyny na spekulację.
 */
async function runToolbarUiOnlyCallback(actionId: string, ctx: ActionContext): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z górnego paska narzędzi Tablicy — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * DWIE ścieżki dla `WhiteboardToolbar.tsx` akcji z JUŻ ISTNIEJĄCYM
 * odbiornikiem na szynie (insert-shape ×5, undo/redo, voting/rola/podążaj) —
 * dokładnie ten sam kształt co `runEdgeParamCallback`, uogólniony na
 * `runByTool`:
 *  • `ctx.source === 'ui'` + `ctx.params.run` (funkcja) — wykonuje ORYGINALNY
 *    prop-callback komponentu wprost. KRYTYCZNE dla zachowania kontraktu
 *    propsów: `WhiteboardToolbar` jest komponentem kontrolowanym — jego
 *    `onXxx` propy MUSZĄ zostać wywołane przy kliku, inaczej test (i każdy
 *    przyszły konsument z własnym propem) się psuje. Pierwsza wersja tego
 *    wpisu (2026-08-09) błędnie szła prosto do `runByTool` z pominięciem
 *    `ctx.params.run` — złapane przez `WhiteboardToolbar.commandrow.test.tsx`
 *    (props.onExport/onToggleVoting nie wołane), naprawione tym helperem.
 *  • każdy inny wywołujący (Teresa) — `runByTool` (dispatch na szynę
 *    `idea-workspace-quick-action`, odbiornik już istnieje w
 *    `useWhiteboardQuickActions.ts`, patrz komentarz przy mapach RUNTIME_* niżej).
 */
async function runToolbarBusAction(
  actionId: string,
  map: ToolActionMap,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  return runByTool(actionId, map, ctx);
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

/**
 * `WhiteboardToolbar.tsx` (2026-08-09, N7 kontynuacja) — pięć wariantów
 * dropdownu „Wstaw" (dawniej hardkodowana tablica `items` w komponencie).
 * Runtime stringi `wb_add_shape_*`/`wb_add_image`/`wb_add_link` JUŻ MAJĄ
 * odbiornik w `useWhiteboardQuickActions.ts` (linie 100-123) — komponent po
 * prostu nigdy z niego nie korzystał, wołał `addElement(kind)` bezpośrednio z
 * closure. Migracja na `dispatchQuickAction` daje Teresie te 5 akcji ZA DARMO
 * (żadnej nowej szyny) — inaczej niż akcje niżej bez istniejącego odbiornika.
 */
// UWAGA FORMATU: jedna para `tool: 'action',` PER LINIA (nie w jednej linii z
// `const`) — `scripts/check-actions.sh` R6 parsuje mapy runtime awk-em wg
// dosłownego wzorca z nagłówka pliku; skrócony zapis `{ whiteboard: '...' }`
// w jednej linii jest NIEWIDOCZNY dla strażnika (cichy brak weryfikacji R6),
// dokładnie tej klasy błędu ma zapobiegać.
const RUNTIME_INSERT_SHAPE_CIRCLE: ToolActionMap = {
  whiteboard: 'wb_add_shape_circle',
};
const RUNTIME_INSERT_SHAPE_DIAMOND: ToolActionMap = {
  whiteboard: 'wb_add_shape_diamond',
};
const RUNTIME_INSERT_SHAPE_HEXAGON: ToolActionMap = {
  whiteboard: 'wb_add_shape_hexagon',
};
const RUNTIME_INSERT_IMAGE: ToolActionMap = {
  whiteboard: 'wb_add_image',
};
const RUNTIME_INSERT_LINK: ToolActionMap = {
  whiteboard: 'wb_add_link',
};

/**
 * Cofnij/Ponów — WSPÓLNE dla wszystkich czterech reprezentacji (Z1), pierwsze
 * takie użycie w rejestrze poza `idea.element.add`. Runtime stringi już mają
 * odbiorniki: `mm_undo`/`mm_redo` (useMindMapQuickActions.ts:254-255),
 * `wb_undo`/`wb_redo` (useWhiteboardQuickActions.ts:141-142), `pf_undo`/`pf_redo`
 * (useProcessFlowQuickActions.ts:183-184), `tbl_undo`/`tbl_redo`
 * (useTableQuickActions.ts:102-109) — weryfikowane grepem przed dopisaniem,
 * nie zgadywane.
 */
const RUNTIME_UNDO: ToolActionMap = {
  mindmap: 'mm_undo',
  whiteboard: 'wb_undo',
  process_flow: 'pf_undo',
  table: 'tbl_undo',
};
const RUNTIME_REDO: ToolActionMap = {
  mindmap: 'mm_redo',
  whiteboard: 'wb_redo',
  process_flow: 'pf_redo',
  table: 'tbl_redo',
};

/**
 * Sesja współpracy Tablicy (`WhiteboardToolbar.tsx` overflow „…") — runtime
 * stringi już obsłużone w `useWhiteboardQuickActions.ts` (linie 149-152), tak
 * jak insert-shape wyżej: komponent dziś woła prop bezpośrednio, odbiornik
 * szyny czeka nieużywany.
 */
const RUNTIME_TOGGLE_VOTING: ToolActionMap = {
  whiteboard: 'wb_session_toggle_voting',
};
const RUNTIME_CYCLE_ROLE: ToolActionMap = {
  whiteboard: 'wb_session_cycle_role',
};
const RUNTIME_TOGGLE_FOLLOW: ToolActionMap = {
  whiteboard: 'wb_session_toggle_follow',
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
  // ── scope='edge' (pilot 2026-08-09, dispatch-bus follow-up ten sam dzień) ─
  // Pierwsze 5 wpisów zakresu 'edge' w rejestrze. Handler = runEdgeParamCallback
  // (patrz komentarz przy jej definicji) — świadomie inny wzorzec niż
  // dispatchQuickAction/runByTool używany przez pozostałe 16 wpisów: UI nadal
  // idzie przez `ctx.params.run` (prop-callback menu), ale każdy INNY
  // wywołujący (Teresa) idzie przez `RUNTIME_EDGE_ACTION` → szynę
  // `idea-workspace-quick-action` → realny odbiornik w
  // `useWhiteboardQuickActions.ts`. Kolejność deklaracji = kolejność w menu
  // (1:1 ze stanem sprzed migracji).
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
        'Ustawia etykietę wskazanego połączenia na Tablicy. Podaj `edgeId` połączenia (z menu prawego kliku klik działa bez tego parametru — tam etykietę pyta okno tekstowe).',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) na Tablicy.' },
          label: { type: 'string', description: 'Nowa etykieta połączenia.' },
        },
        required: ['edgeId', 'label'],
      },
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
        'Zamienia miejscami początek i koniec wskazanego połączenia na Tablicy. Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) na Tablicy.' },
        },
        required: ['edgeId'],
      },
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
        'Przełącza strzałkę kierunku wskazanego połączenia na Tablicy (cykl: brak → koniec → oba → początek). Podaj `edgeId` połączenia — jeden klik cyklu, więc żeby dojść do konkretnego kierunku, może być potrzebne kilka wywołań.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) na Tablicy.' },
        },
        required: ['edgeId'],
      },
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
        'Przełącza styl linii wskazanego połączenia na Tablicy (cykl: ciągła → kreskowana → kropkowana → falista). Podaj `edgeId` połączenia — jeden klik cyklu, może być potrzebne kilka wywołań.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) na Tablicy.' },
        },
        required: ['edgeId'],
      },
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
        'Usuwa wskazane połączenie z Tablicy na trwałe (cofnięcie tylko przez Ctrl+Z w tej samej sesji, w tej samej sesji przeglądarki). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) na Tablicy.' },
        },
        required: ['edgeId'],
      },
    },
    source: 'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeDelete:3245',
  },
  // ── N7 kontynuacja (2026-08-09) — WhiteboardToolbar.tsx, surface='toolbar' ──
  // 18 pozycji = 1:1 z tym, co bar dziś renderuje (dropdown „Wstaw" ×5,
  // Cofnij/Ponów, overflow „…" ×9, Zapisz, Wyczyść rysunki). Kolejność
  // deklaracji = kolejność w barze. Pięć grup handlera:
  //  1. runToolbarBusAction + RUNTIME_INSERT_* — UI: prop wprost; Teresa: szyna
  //     (odbiornik już istnieje, reuse, Teresa za darmo)
  //  2. runToolbarBusAction + RUNTIME_UNDO/REDO — wspólne z 3 innymi narzędziami (Z1)
  //  3. runToolbarBusAction + RUNTIME_TOGGLE_VOTING/CYCLE_ROLE/TOGGLE_FOLLOW — odbiornik już istnieje
  //  4. dedykowany handler dla „Eksport" (ten sam kształt UI/Teresa co wyżej,
  //     ale poza szyną `idea-workspace-quick-action`) — dispatchuje TEN SAM
  //     CustomEvent co dziś (`idea-workspace-open-export-menu`, odbiornik:
  //     IdeaMapWorkspace.tsx:2931-2939), NIE ten sam co `idea.export.open`
  //     (patrz komentarz przy tej akcji niżej)
  //  5. runToolbarUiOnlyCallback — bez istniejącego odbiornika (skróty, tło ×4, Zapisz, Wyczyść)
  {
    id: 'idea.canvas.insert_shape_circle',
    label: { pl: 'Wstaw: koło', en: 'Insert: circle' },
    icon: 'Circle',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.insert_shape_circle', RUNTIME_INSERT_SHAPE_CIRCLE, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'stos undo Tablicy (wb_undo w useWhiteboardQuickActions.ts) po dodaniu elementu',
    },
    teresa: {
      description: 'Wstawia kształt koła na otwartą Tablicę.',
    },
    runtime: RUNTIME_INSERT_SHAPE_CIRCLE,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:227-231 (dropdown „Wstaw") + useWhiteboardQuickActions.ts:100 (wb_add_shape_circle, dotąd nieużywany odbiornik)',
  },
  {
    id: 'idea.canvas.insert_shape_diamond',
    label: { pl: 'Wstaw: romb', en: 'Insert: diamond' },
    icon: 'Diamond',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.insert_shape_diamond', RUNTIME_INSERT_SHAPE_DIAMOND, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'stos undo Tablicy (wb_undo w useWhiteboardQuickActions.ts) po dodaniu elementu',
    },
    teresa: {
      description: 'Wstawia kształt rombu na otwartą Tablicę.',
    },
    runtime: RUNTIME_INSERT_SHAPE_DIAMOND,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:232-237 (dropdown „Wstaw") + useWhiteboardQuickActions.ts:101 (wb_add_shape_diamond, dotąd nieużywany odbiornik)',
  },
  {
    id: 'idea.canvas.insert_shape_hexagon',
    label: { pl: 'Wstaw: sześciokąt', en: 'Insert: hexagon' },
    icon: 'Hexagon',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.insert_shape_hexagon', RUNTIME_INSERT_SHAPE_HEXAGON, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'stos undo Tablicy (wb_undo w useWhiteboardQuickActions.ts) po dodaniu elementu',
    },
    teresa: {
      description: 'Wstawia kształt sześciokąta na otwartą Tablicę.',
    },
    runtime: RUNTIME_INSERT_SHAPE_HEXAGON,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:238-243 (dropdown „Wstaw") + useWhiteboardQuickActions.ts:102 (wb_add_shape_hexagon, dotąd nieużywany odbiornik)',
  },
  {
    id: 'idea.canvas.insert_image',
    label: { pl: 'Wstaw obraz', en: 'Insert image' },
    icon: 'Image',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.insert_image', RUNTIME_INSERT_IMAGE, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'stos undo Tablicy (wb_undo w useWhiteboardQuickActions.ts) po dodaniu elementu',
    },
    teresa: {
      description: 'Wstawia placeholder obrazu na otwartą Tablicę.',
    },
    runtime: RUNTIME_INSERT_IMAGE,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:244-249,257 (dropdown „Wstaw" + domyślny klik) + useWhiteboardQuickActions.ts:122 (wb_add_image, dotąd nieużywany odbiornik)',
  },
  {
    id: 'idea.canvas.insert_link',
    label: { pl: 'Wstaw link', en: 'Insert link' },
    icon: 'Link2',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.insert_link', RUNTIME_INSERT_LINK, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'stos undo Tablicy (wb_undo w useWhiteboardQuickActions.ts) po dodaniu elementu',
    },
    teresa: {
      description: 'Wstawia placeholder linku na otwartą Tablicę.',
    },
    runtime: RUNTIME_INSERT_LINK,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:250-255 (dropdown „Wstaw") + useWhiteboardQuickActions.ts:123 (wb_add_link, dotąd nieużywany odbiornik)',
  },
  {
    id: 'idea.canvas.undo',
    label: { pl: 'Cofnij', en: 'Undo' },
    icon: 'Undo2',
    // Sam mechanizm cofania NIE ma własnego wpisu na stosie undo (byłby
    // nieskończony regres) — `mutates: false`, tak jak `idea.canvas.cursor_select`
    // (tryb, nie treść). Cofa realne mutacje, ale samo wywołanie nie jest
    // jedną z nich.
    scope: 'current_view',
    tools: 'all',
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.undo', RUNTIME_UNDO, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Cofa ostatnią zmianę w otwartej reprezentacji (Ctrl/Cmd+Z).',
    },
    runtime: RUNTIME_UNDO,
    source: 'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:273-279 (undo) — wspólne dla 4 narzędzi',
  },
  {
    id: 'idea.canvas.redo',
    label: { pl: 'Ponów', en: 'Redo' },
    icon: 'Redo2',
    scope: 'current_view',
    tools: 'all',
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.redo', RUNTIME_REDO, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Ponawia cofniętą zmianę w otwartej reprezentacji (Ctrl/Cmd+Shift+Z).',
    },
    runtime: RUNTIME_REDO,
    source: 'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:280-286 (redo) — wspólne dla 4 narzędzi',
  },
  {
    id: 'idea.canvas.toggle_voting',
    label: { pl: 'Głosowanie', en: 'Voting' },
    icon: 'ThumbsUp',
    // Stan SESJI współpracy (widoczny wszystkim uczestnikom), nie treść Idei —
    // tak jak `idea.canvas.cursor_select`, `mutates: false`: nie ma pozycji na
    // stosie Ctrl+Z, przełącza się z powrotem tym samym przyciskiem.
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.toggle_voting', RUNTIME_TOGGLE_VOTING, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Włącza/wyłącza tryb głosowania sesji współpracy na Tablicy.',
    },
    runtime: RUNTIME_TOGGLE_VOTING,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:300-307 (overflow „…") + useWhiteboardQuickActions.ts:151 (wb_session_toggle_voting, dotąd nieużywany odbiornik)',
  },
  {
    id: 'idea.canvas.cycle_role',
    label: { pl: 'Rola w sesji', en: 'Session role' },
    icon: 'Workflow',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.cycle_role', RUNTIME_CYCLE_ROLE, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Przełącza własną rolę w bieżącej sesji współpracy na Tablicy (cykl ról).',
    },
    runtime: RUNTIME_CYCLE_ROLE,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:308-314 (overflow „…") + useWhiteboardQuickActions.ts:149 (wb_session_cycle_role, dotąd nieużywany odbiornik)',
  },
  {
    id: 'idea.canvas.toggle_follow',
    label: { pl: 'Podążaj', en: 'Follow' },
    icon: 'TrendingUp',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.toggle_follow', RUNTIME_TOGGLE_FOLLOW, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Włącza/wyłącza podążanie widokiem za prowadzącym sesję na Tablicy.',
    },
    runtime: RUNTIME_TOGGLE_FOLLOW,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:315-322 (overflow „…") + useWhiteboardQuickActions.ts:152 (wb_session_toggle_follow, dotąd nieużywany odbiornik)',
  },
  {
    // UWAGA (odbiór): `idea.export.open` (scope='workspace', surfaces=['menu1'],
    // icon='Download') już istnieje i kończy się DOKŁADNIE tym samym efektem —
    // `IdeaMapWorkspace.tsx` nasłuchuje RÓWNOLEGLE `open_export_menu` (linia
    // ~1001) i `idea-workspace-open-export-menu` (linia 2931-2939), oba wołają
    // `setExportMenuOpen(true)`. Świadomie NIE reużyto tamtej akcji tutaj:
    // zrobiłoby to reużycie ikony `Download` zamiast dzisiejszej `ExternalLink`
    // tego przycisku — złamałoby wymóg "zero zmian wizualnych" tego zadania.
    // Zamiast tego osobny wpis z WŁASNĄ ikoną, ale dispatchujący TEN SAM,
    // już-nasłuchiwany event — zero nowej infrastruktury. Ujednolicenie tych
    // dwóch (jedna ikona wszędzie, zgodnie z Z1) to osobna decyzja właściciela,
    // nie ta migracja.
    id: 'idea.canvas.export_view',
    label: { pl: 'Eksport', en: 'Export' },
    icon: 'ExternalLink',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: async (ctx) => {
      // UI: wykonaj ORYGINALNY prop-callback komponentu (`onExport`) wprost —
      // ten sam kontrakt co `runToolbarBusAction` (patrz komentarz tam);
      // konieczne, bo ten event NIE idzie przez `dispatchQuickAction`/
      // `idea-workspace-quick-action`, więc `runByTool` by tu nie pasował.
      const run = ctx.params?.run;
      if (ctx.source === 'ui' && typeof run === 'function') {
        (run as () => void)();
        return { ok: true, actionId: 'idea.canvas.export_view' };
      }
      // Teresa/inny wywołujący: ten sam event co `onExport` dziś nadaje —
      // odbiornik już istnieje (IdeaMapWorkspace.tsx:2931-2939), zero nowej szyny.
      window.dispatchEvent(
        new CustomEvent('idea-workspace-open-export-menu', { detail: { ideaId: ctx.ideaId } })
      );
      return {
        ok: true,
        actionId: 'idea.canvas.export_view',
        data: { runtime: 'idea-workspace-open-export-menu' },
      };
    },
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Otwiera okno eksportu otwartej Tablicy do pliku.',
    },
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:323-328 (overflow „…") + IdeaWhiteboardTool.tsx:4017-4021 (idea-workspace-open-export-menu) + IdeaMapWorkspace.tsx:2931-2939 (odbiornik)',
  },
  {
    // Bez istniejącego runtime stringa/odbiornika ANI dziś, ani gdziekolwiek w
    // `whiteboardIntentDetector.ts` (regexowy detektor intencji Tablicy — 0
    // trafień dla skrótów/tła/Zapisz/Wyczyść) — UI-only na tę turę,
    // `runToolbarUiOnlyCallback` (patrz komentarz przy jej definicji).
    id: 'idea.canvas.toggle_shortcuts',
    label: { pl: 'Skróty klawiszowe', en: 'Keyboard shortcuts' },
    icon: 'Keyboard',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarUiOnlyCallback('idea.canvas.toggle_shortcuts', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Pokazuje/chowa okno skrótów klawiszowych Tablicy. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi — Teresa nie ma jeszcze sposobu wywołania tego z czatu.',
    },
    source: 'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:329-334 (overflow „…")',
  },
  {
    id: 'idea.canvas.set_bg_dots',
    label: {
      pl: 'Tło: Kropki',
      en: 'Background: Dots',
    },
    icon: 'Circle',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarUiOnlyCallback('idea.canvas.set_bg_dots', ctx),
    // Preferencja WIDOKU (zapisywana z Ideą, ale bez wpisu na stosie Ctrl+Z —
    // tak jak `idea.canvas.cursor_select`), nie mutacja treści grafu.
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Ustawia tło Tablicy na wzór kropek. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi — Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:335-341 (overflow „…", bg-dots)',
  },
  {
    id: 'idea.canvas.set_bg_grid',
    label: {
      pl: 'Tło: Siatka',
      en: 'Background: Grid',
    },
    icon: 'Grid3X3',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarUiOnlyCallback('idea.canvas.set_bg_grid', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Ustawia tło Tablicy na wzór siatki. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi — Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:342-348 (overflow „…", bg-grid)',
  },
  {
    id: 'idea.canvas.set_bg_lines',
    label: {
      pl: 'Tło: Linie',
      en: 'Background: Lines',
    },
    icon: 'LayoutGrid',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarUiOnlyCallback('idea.canvas.set_bg_lines', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Ustawia tło Tablicy na wzór linii. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi — Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:349-355 (overflow „…", bg-lines)',
  },
  {
    id: 'idea.canvas.set_bg_blank',
    label: {
      pl: 'Tło: Puste',
      en: 'Background: Blank',
    },
    icon: 'Shapes',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarUiOnlyCallback('idea.canvas.set_bg_blank', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Ustawia puste (bez wzoru) tło Tablicy. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi — Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:356-362 (overflow „…", bg-blank)',
  },
  {
    id: 'idea.canvas.save',
    label: { pl: 'Zapisz', en: 'Save' },
    icon: 'Save',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarUiOnlyCallback('idea.canvas.save', ctx),
    // Zapisuje już-zmutowany stan (persystencja), nie tworzy nowej mutacji —
    // `mutates: false`, analogicznie do akcji „otwiera X" w tym rejestrze
    // (np. `idea.ai.table_assistant`), gdzie realna zmiana (jeśli w ogóle)
    // żyje gdzie indziej.
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Zapisuje bieżący stan Tablicy natychmiast (poza automatycznym zapisem w tle). Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi — Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:375-393 (przycisk Zapisz)',
  },
  {
    // Destrukcyjne (trwałe usunięcie WSZYSTKICH rysunków odręcznych), z
    // dialogiem potwierdzenia PRZED wykonaniem (IdeaWhiteboardTool.tsx
    // showConfirm) — dokładnie jak `idea.edge.delete`, `destructive: true`
    // OSOBNO od `mutates`/`undo`.
    id: 'idea.canvas.clear_drawings',
    label: { pl: 'Wyczyść rysunki', en: 'Clear drawings' },
    icon: 'Trash2',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarUiOnlyCallback('idea.canvas.clear_drawings', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaWhiteboardTool.tsx onClearDrawings prop (WhiteboardToolbar.tsx:3995-4013) → pushUndoSnapshot() przed setDrawingPaths([]) (stos Ctrl+Z), za dialogiem potwierdzenia',
    },
    destructive: true,
    teresa: {
      description:
        'Usuwa WSZYSTKIE rysunki odręczne (pen paths) z Tablicy na trwałe, po potwierdzeniu w dialogu. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi — Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/IdeaWhiteboardTool.tsx:3995-4013 (onClearDrawings)',
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
