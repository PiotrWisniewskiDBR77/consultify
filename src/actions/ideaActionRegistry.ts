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
 *
 * `inline` (2026-08-10, N6.3) — dopisane dla `LaneSystem.tsx` (nagłówek toru
 * Przepływu: zmień nazwę/przesuń górę/dół/kolor/zwiń/usuń). Znowu ŻADNA z
 * istniejących wartości nie pasuje uczciwie: to nie `context` (rozdz. 08 §5
 * dokumentuje wprost, że dziś NIE ISTNIEJE menu kontekstowe toru — operacje
 * żyją jako stałe, zawsze widoczne przyciski w nagłówku; oznaczenie ich jako
 * `context` udawałoby menu, którego nie ma), nie `floating` (pasek
 * zaznaczenia — inny mechanizm wyzwolenia: zaznaczenie elementów, nie
 * hover nad kontenerem), nie `rail`/`toolbar`/`panel`/`menu1`/`menu3`
 * (żaden nie opisuje kontrolek wbudowanych bezpośrednio w treść płótna).
 * Rozdz. 08 §5 „Docelowo" chce TAKŻE realnego menu kontekstowego toru obok
 * tych przycisków — poza zakresem tego wpisu (patrz `idea.lane.pf_*` niżej,
 * `source`), zalogowane jako osobne ustalenie, nie wymyślane tutaj na nowo.
 */
export type Surface =
  | 'menu1'
  | 'menu3'
  | 'rail'
  | 'panel'
  | 'context'
  | 'floating'
  | 'toolbar'
  | 'inline';

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
  | 'Edit3'
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
  | 'Save'
  // N7 kontynuacja (2026-08-09) — Whiteboard node/pane PPM
  // (`IdeaCanvasContextMenu.tsx`), dodane 1:1 z ikonami już importowanymi tam
  // z lucide-react (zero nowych zależności ikon).
  | 'Pencil'
  | 'Clipboard'
  | 'BringToFront'
  | 'SendToBack'
  | 'Lock'
  | 'Unlock'
  | 'GitBranch'
  | 'BookOpen'
  | 'MessageSquare'
  | 'Layers'
  | 'Tags'
  | 'ListChecks'
  | 'Brain'
  | 'Network'
  | 'Table2'
  // N5 kontynuacja (2026-08-09) — Mind Map pane (tło) PPM
  // (`PaneContextMenu.tsx`), dodane 1:1 z ikonami już importowanymi tam
  // z lucide-react (zero nowych zależności ikon).
  | 'ClipboardCopy'
  | 'Scissors'
  | 'Maximize'
  | 'ChevronDown'
  // N5 kontynuacja (2026-08-09, druga fala) — Mind Map node (węzeł) PPM
  // (`NodeContextMenu.tsx`, grupy Edit/Structure/Delete), dodane 1:1 z ikonami
  // już importowanymi tam z lucide-react (zero nowych zależności ikon).
  | 'FoldVertical'
  | 'ScanSearch'
  | 'ChevronRight'
  // N5 kontynuacja (2026-08-09, trzecia fala) — Mind Map node (węzeł) PPM
  // grupy Convert/„Convert branch to…", dodane 1:1 z ikonami już
  // importowanymi w `NodeContextMenu.tsx` z lucide-react.
  | 'Star'
  | 'Rocket'
  // Process Flow edge menu (2026-08-09) — `ProcessFlowContextMenu.tsx`'s
  // `getEdgeContextActions`, dodane 1:1 z ikonami już importowanymi tam z
  // lucide-react (zero nowych zależności ikon).
  | 'Split'
  | 'Check'
  // Process Flow node menu + floating toolbar (2026-08-09) —
  // `ProcessFlowContextMenu.tsx`'s `getNodeContextActions` ('Settings' —
  // otwórz właściwości) i `ProcessFlowFloatingToolbar.tsx` ('MessageCircle' —
  // komentarze węzła, odróżnione od 'MessageSquare' użytego dla „Zapytaj AI").
  | 'Settings'
  | 'MessageCircle'
  // Process Flow canvas (background) menu + lane controls (2026-08-10) —
  // `getCanvasContextActions` reuses 'GitBranch'/'Clipboard'/'LayoutGrid'/
  // 'Plus' already in this union; `LaneSystem.tsx` header buttons add these
  // four, 1:1 z ikonami już importowanymi tam z lucide-react.
  | 'ArrowDownUp'
  | 'Palette'
  | 'X';

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
 * Runtime strings na szynie `idea-workspace-quick-action` dla akcji krawędzi —
 * PO JEDNEJ mapie na akcję (nie jedna zbiorcza `Record<string,string>` jak
 * przed 2026-08-09 rozszerzeniem na Mapę myśli), bo `scripts/check-actions.sh`
 * (R6) parsuje WYŁĄCZNIE linie `  tool: 'string',` związane z constem typu
 * `ToolActionMap` — zagnieżdżony jednolinijkowy zapis
 * (`'idea.edge.x': { whiteboard: '...', mindmap: '...' }`) był niewidoczny
 * dla strażnika (dotyczyło to również ORYGINALNEJ, jednotoolowej mapy z pilota
 * 2026-08-09 — R6 nigdy jej nie sprawdzał). Ten kształt NAPRAWIA to przy okazji:
 * każda z siedmiu map niżej jest realnie pilnowana przez R6.
 *
 * Odbiorniki: `useWhiteboardQuickActions.ts` (`editEdgeLabel`/`reverseEdge`/
 * `cycleEdgeArrow`/`cycleEdgeStyle`/`deleteEdge`, 2026-08-09) i
 * `useMindMapQuickActions.ts` (`mm_edge_*`, rozszerzenie 2026-08-09 —
 * `mm_edge_arrow` istniał już wcześniej, od 2026-07-28, i jest tu PONOWNIE
 * UŻYTY, nie duplikowany, bo to DOKŁADNIE to samo pole `data.arrowDirection`,
 * SSOT współdzielone z Tablicą/Przepływem — patrz `canvas/edgeArrowMarkers.tsx`).
 */
const RUNTIME_EDGE_LABEL: ToolActionMap = {
  whiteboard: 'wb_edge_edit_label',
  mindmap: 'mm_edge_edit_label',
};
const RUNTIME_EDGE_REVERSE: ToolActionMap = {
  whiteboard: 'wb_edge_reverse',
  mindmap: 'mm_edge_reverse',
  // process_flow (2026-08-09): `handleEdgeReverse(edgeId)` in
  // IdeaProcessFlowTool.tsx already takes an explicit edgeId (unlike
  // insertBetween()/deleteSelected() below it, which only act on the
  // canvas selection) — a genuine REUSE, not a new mechanism. New receiver
  // `pf_edge_reverse` added to useProcessFlowQuickActions.ts for this.
  process_flow: 'pf_edge_reverse',
};
const RUNTIME_EDGE_CYCLE_ARROW: ToolActionMap = {
  whiteboard: 'wb_edge_cycle_arrow',
  // PONOWNE UŻYCIE stringa 'mm_edge_arrow' — odbiornik istnieje od 2026-07-28
  // (useMindMapQuickActions.ts), NIE dopisujemy drugiego runtime dla tej samej
  // mutacji `data.arrowDirection`.
  mindmap: 'mm_edge_arrow',
};
const RUNTIME_EDGE_CYCLE_STYLE: ToolActionMap = {
  whiteboard: 'wb_edge_cycle_style',
  mindmap: 'mm_edge_cycle_style',
};
const RUNTIME_EDGE_DELETE: ToolActionMap = {
  whiteboard: 'wb_edge_delete',
  mindmap: 'mm_edge_delete',
};
/** Mapa myśli TYLKO — Tablica świadomie NIE wspiera rozcięcia krawędzi węzłem
 * (brak logiki po jej stronie, patrz `WhiteboardEdgeContextMenu.tsx`). */
const RUNTIME_EDGE_INSERT_NODE: ToolActionMap = {
  mindmap: 'mm_edge_insert_node',
};
/** Mapa myśli TYLKO — typy relacji (`related`/`depends_on`/…) to pojęcie bez
 * odpowiednika na Tablicy. */
const RUNTIME_EDGE_EDIT_RELATION: ToolActionMap = {
  mindmap: 'mm_edge_edit_relation',
};

/**
 * Process Flow edge menu (2026-08-09, `ProcessFlowContextMenu.tsx`'s
 * `getEdgeContextActions`) — cztery mapy PONIŻEJ są Przepływu TYLKO, dodane
 * ŚWIADOMIE jako NOWE akcje zamiast rozszerzenia `idea.edge.insert_node`/
 * `.delete` (Mapa myśli): `insertBetween()`/`deleteSelected()` w
 * `IdeaProcessFlowTool.tsx` operują na ZAZNACZENIU na płótnie (nie przyjmują
 * `edgeId`), a Mapy myśli `mm_edge_insert_node`/`mm_edge_delete` adresują po
 * jawnym id — inny mechanizm, nie wariant tej samej akcji (patrz `teresa.description`
 * przy każdym wpisie niżej). `edge-reverse` to jedyna z dziewięciu, która
 * NAPRAWDĘ jest tą samą operacją (adresowana po edgeId) — patrz
 * `RUNTIME_EDGE_REVERSE.process_flow` wyżej, rozszerzone w miejscu, nie
 * duplikowane tutaj.
 */
const RUNTIME_PF_EDGE_EDIT_PROPS: ToolActionMap = {
  process_flow: 'pf_edge_edit_props',
};
/** REUŻYCIE — `pf_insert_between` ma już odbiornik w useProcessFlowQuickActions.ts
 * (dawniej wołany tylko z floating toolbar „Insert between"); zero nowego kodu w hooku. */
const RUNTIME_PF_EDGE_INSERT_NODE: ToolActionMap = {
  process_flow: 'pf_insert_between',
};
const RUNTIME_PF_EDGE_CONDITION: ToolActionMap = {
  process_flow: 'pf_edge_set_condition',
};
/** REUŻYCIE — `pf_delete` ma już odbiornik (`handlers.deleteSelected()`), dawniej
 * wołany tylko z Menu 3/rail; zero nowego kodu w hooku. */
const RUNTIME_PF_EDGE_DELETE: ToolActionMap = {
  process_flow: 'pf_delete',
};

/**
 * Process Flow NODE menu (2026-08-09, `ProcessFlowContextMenu.tsx`'s
 * `getNodeContextActions`) — `idea.node.pf_ai_rewrite_step`'s bus path.
 * NOWY odbiornik `pf_ai_rewrite_step` dopisany do
 * `useProcessFlowQuickActions.ts` w tej samej zmianie.
 */
const RUNTIME_PF_NODE_AI_REWRITE_STEP: ToolActionMap = {
  process_flow: 'pf_ai_rewrite_step',
};

/** Wskaźnik akcja → jej mapa runtime (indirekcja NIE jest czytana przez R6 —
 * to zwykły obiekt JS, guard widzi tylko siedem `ToolActionMap` powyżej). */
const RUNTIME_EDGE_ACTION_MAPS: Partial<Record<string, ToolActionMap>> = {
  'idea.edge.edit_label': RUNTIME_EDGE_LABEL,
  'idea.edge.reverse': RUNTIME_EDGE_REVERSE,
  'idea.edge.cycle_arrow': RUNTIME_EDGE_CYCLE_ARROW,
  'idea.edge.cycle_style': RUNTIME_EDGE_CYCLE_STYLE,
  'idea.edge.delete': RUNTIME_EDGE_DELETE,
  'idea.edge.insert_node': RUNTIME_EDGE_INSERT_NODE,
  'idea.edge.edit_relation': RUNTIME_EDGE_EDIT_RELATION,
  'idea.edge.pf_edit_props': RUNTIME_PF_EDGE_EDIT_PROPS,
  'idea.edge.pf_insert_node': RUNTIME_PF_EDGE_INSERT_NODE,
  'idea.edge.pf_condition_none': RUNTIME_PF_EDGE_CONDITION,
  'idea.edge.pf_condition_yes': RUNTIME_PF_EDGE_CONDITION,
  'idea.edge.pf_condition_no': RUNTIME_PF_EDGE_CONDITION,
  'idea.edge.pf_condition_default': RUNTIME_PF_EDGE_CONDITION,
  'idea.edge.pf_condition_exception': RUNTIME_PF_EDGE_CONDITION,
  'idea.edge.pf_delete': RUNTIME_PF_EDGE_DELETE,
};

/**
 * Przekaźnik dla akcji `scope: 'edge'` (pilot Tablicy 2026-08-09,
 * `WhiteboardEdgeContextMenu.tsx`; rozszerzony tego samego dnia o Mapę myśli,
 * `EdgeContextMenu.tsx` — `src/components/MyWork/mindmap/`).
 *
 * DWIE ścieżki, jedna funkcja:
 *  • `ctx.source === 'ui'` + `ctx.params.run` (funkcja) — UŻYWANE WYŁĄCZNIE
 *    przez Tablicę: `WhiteboardEdgeContextMenu.tsx` przekazuje SWÓJ oryginalny
 *    prop-callback (zamknięty nad lokalnym stanem `edgeContextMenu` w
 *    `IdeaWhiteboardTool.tsx`); wykonujemy go wprost — zachowanie kliku
 *    człowieka jest nietknięte. Mapa myśli tej ścieżki NIE UŻYWA (jej hook już
 *    miał bezpośredni dostęp do surowego stanu `edges`/`setEdges`, więc
 *    zarówno klik człowieka, JAK i Teresa idą tą samą, drugą ścieżką niżej —
 *    dokładnie tak, jak `mm_edge_arrow` już działał od 2026-07-28).
 *  • każdy inny wywołujący (Mapa myśli zawsze, Tablica dla Teresy) — nie ma
 *    `ctx.params.run`, więc dispatchujemy na szynę `idea-workspace-quick-action`
 *    z realnym `edgeId`.
 *
 * Skąd `edgeId` bez zamknięcia komponentu? `ctx.params.edgeId` (LLM podaje
 * wprost — `teresa.parameters` każdej akcji niżej go wymaga, wzorem
 * `idea.ai.expand_map`'s `nodeId`; `EdgeContextMenu.tsx` na Mapie myśli też
 * ZAWSZE go podaje jawnie, bo menu zna edgeId z własnego propa), z fallbackiem
 * na `ctx.selection` (gdy `type === 'edge'`, konwencja `IdeaWorkspaceSelection`
 * z `ideaSelectionTypes.ts`) dla przyszłych wywołań opartych na zaznaczeniu UI.
 * UWAGA (odbiór): dziś `UnifiedChatPanel.tsx` woła `executeTeresaTool` z
 * `selection: EMPTY_SELECTION` na sztywno (linie ~1988/2039) — fallback na
 * `ctx.selection` jest więc martwy dla Teresy, dopóki ta osobna, poza zakresem
 * tego zadania, luka nie zostanie naprawiona. Żywa ścieżka dla Teresy dziś to
 * `ctx.params.edgeId`.
 */
async function runEdgeParamCallback(
  actionId: string,
  ctx: ActionContext,
  // Process Flow extension (2026-08-09): dla akcji, gdzie 5 rejestrowych id
  // dzielą JEDEN runtime string (`pf_edge_set_condition`, 5x warunek), wartość
  // jest zaszyta w `extra` per-id (np. `{ condition: 'yes' }`) i wygrywa nad
  // `ctx.params` — inaczej Teresa musiałaby zgadywać, że `idea.edge.pf_condition_yes`
  // wymaga też podania `condition: 'yes'` w parametrach, co byłoby zbędne
  // (wartość wynika z WYBRANEGO id, tak jak w `getEdgeContextActions`, gdzie
  // każdy z 5 wierszy woła `onSetCondition` z inną, zaszytą w domknięciu wartością).
  extra?: Record<string, unknown>
): Promise<ActionResult> {
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
    const toolLabel =
      ctx.tool === 'mindmap' ? 'Mapy myśli' : ctx.tool === 'process_flow' ? 'Przepływu' : 'Tablicy';
    return {
      ok: false,
      actionId,
      message: `Nie wiem, na którym połączeniu ${toolLabel} wykonać tę akcję — podaj \`edgeId\` (np. z listy połączeń) albo zaznacz je najpierw.`,
    };
  }
  const runtime = RUNTIME_EDGE_ACTION_MAPS[actionId]?.[ctx.tool];
  if (!runtime) {
    return {
      ok: false,
      actionId,
      message: `Ta akcja nie istnieje w tej reprezentacji (${ctx.tool}).`,
    };
  }
  dispatchQuickAction(runtime, ctx, { edgeId, ...(ctx.params || {}), ...(extra || {}) });
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

/**
 * UI-only akcje menu węzła/tła Tablicy (N7 kontynuacja, 2026-08-09,
 * `IdeaCanvasContextMenu.tsx`) — ten sam kształt co `runToolbarUiOnlyCallback`,
 * ale z UCZCIWYM komunikatem (to menu prawego kliku, nie górny pasek).
 * Sprawdzone PRZED użyciem dla każdej z tych pozycji, czy istnieje jakikolwiek
 * żywy punkt wejścia dla Teresy (szyna `idea-workspace-quick-action`,
 * `whiteboardIntentDetector.ts`) — dla żadnej z nich nie istnieje, więc
 * świadomie zostają UI-only zamiast budować nową infrastrukturę na spekulację.
 */
async function runContextMenuUiOnlyCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z menu kontekstowego (prawy klik) Tablicy — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * UI-only akcje menu tła (pane) Mapy myśli (N5 kontynuacja, 2026-08-09,
 * `PaneContextMenu.tsx`) — ten sam kształt co `runContextMenuUiOnlyCallback`
 * (Tablica), z UCZCIWYM komunikatem dla Mapy myśli. Sprawdzone PRZED użyciem:
 * `pane_copy`/`pane_cut`/`pane_paste` opierają się na `copySelected`/
 * `cutSelected`/`pasteNodes` z `useMindMapNodes.tsx` — closure nad lokalnym
 * schowkiem (`hasMindMapClipboard`) NIEPRZEKAZANYM do `useMindMapQuickActions`
 * (`MindMapQuickActionHandlers` go nie deklaruje) i bez sensownego odpowiednika
 * po stronie Teresy (schowek przeglądarki to nie coś, co LLM mógłby wypełnić).
 * Świadomie UI-only zamiast budować nową infrastrukturę na spekulację.
 */
async function runMindmapPaneUiOnlyCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z menu kontekstowego (prawy klik na tło) Mapy myśli — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * `idea.node.edit` (N7 kontynuacja, 2026-08-09) — jedyna pozycja menu węzła,
 * której realna mutacja NIE żyje na szynie `idea-workspace-quick-action`, tylko
 * na osobnym, już istniejącym evencie `idea-workspace-node-update`
 * (nadawany dziś przez `VSMNodeComponent.tsx:171` i przez `handleBaseAction`
 * 'edit' w `IdeaCanvasContextMenu.tsx`; odbiorniki: `IdeaWhiteboardTool.tsx:2571`
 * ORAZ `IdeaProcessFlowTool.tsx:2535` — generyczny patch `node.data` po
 * `nodeId`, nie nowa infrastruktura). Dwie ścieżki jak wszędzie: UI = oryginalny
 * `ctx.params.run` (prompt() + dispatch, nietknięte); Teresa = bezpośredni
 * dispatch po `ctx.params.nodeId`+`label` (LLM podaje wprost, ten sam wzorzec
 * co `idea.edge.edit_label`'s `edgeId`).
 *
 * ZASTRZEŻENIE ODKRYTE PRZY TYM WPISIE (nie wprowadzone tu, nie naprawiane
 * tu — poza zakresem wiringu): odbiornik `idea-workspace-node-update` w
 * `IdeaWhiteboardTool.tsx:2551-2569` NIE woła `pushUndoSnapshot()` przed
 * `setNodes`, w przeciwieństwie do `duplicateSelected`/`deleteSelected`/
 * `lockSelected` itd. — edycja etykiety węzła (ludzka I przez Teresę) NIE
 * trafia dziś na stos Ctrl+Z. Prawdziwe zarówno przed, jak i po tym wpisie
 * (sama funkcja `handleBaseAction` 'edit' też nigdy nie wołała
 * `pushUndoSnapshot`) — zgłoszone niżej w `undo.evidence`, nie ukryte.
 */
function dispatchNodeUpdate(nodeId: string, data: Record<string, unknown>) {
  window.dispatchEvent(
    new CustomEvent('idea-workspace-node-update', { detail: { nodeId, data } })
  );
}

/**
 * UI-only akcje menu WĘZŁA (nie tła) Mapy myśli (N5 kontynuacja, druga fala,
 * 2026-08-09, `NodeContextMenu.tsx` grupy Edit/Structure) — ten sam kształt co
 * `runMindmapPaneUiOnlyCallback`, osobna funkcja WYŁĄCZNIE dla uczciwego
 * komunikatu („menu węzła", nie „menu tła"), żeby odmowa nie myliła Teresy co
 * do tego, KTÓRE menu ma na myśli. Użyta dla pozycji bez sensownego,
 * nie-spekulatywnego punktu wejścia na szynę (sprawdzone PRZED użyciem dla
 * każdej — patrz komentarz przy każdym wpisie niżej, co dokładnie sprawdzono).
 */
async function runMindmapNodeUiOnlyCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z menu kontekstowego (prawy klik na węzeł) Mapy myśli — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * Szyna dla akcji WĘZŁA Mapy myśli, które MAJĄ żywy odbiornik w
 * `useMindMapQuickActions.ts` — jak `runToolbarBusAction`, ale DODATKOWO
 * przekazuje `ctx.params` jako `extra` do `dispatchQuickAction` (ten sam
 * zabieg co `idea.element.add`), bo te odbiorniki czytają konkretne pola z
 * `detail` (`nodeId`/`label`/`targetNodeId`) — bez przekazania `ctx.params`
 * Teresa nie mogłaby wskazać WĘZŁA, tylko trafiałaby w domyślne zachowanie
 * (zaznaczenie/ostatni aktywny), co dla menu PRAWEGO KLIKU NA KONKRETNY WĘZEŁ
 * byłoby nieuczciwe (menu istnieje właśnie po to, żeby wskazać węzeł).
 */
async function runMindmapNodeBusAction(
  actionId: string,
  map: ToolActionMap,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  return runByTool(actionId, map, ctx, ctx.params);
}

/**
 * UI-only akcje menu WĘZŁA Przepływu (N6 kontynuacja, 2026-08-09,
 * `ProcessFlowContextMenu.tsx`'s `getNodeContextActions` + dual-surface
 * `ProcessFlowFloatingToolbar.tsx`) — ten sam kształt co
 * `runMindmapNodeUiOnlyCallback`, osobna funkcja WYŁĄCZNIE dla uczciwego
 * komunikatu („menu węzła Przepływu"). Użyta dla pozycji bez sensownego,
 * nie-spekulatywnego punktu wejścia na szynę (sprawdzone PRZED użyciem dla
 * każdej — patrz komentarz przy każdym wpisie niżej, co dokładnie sprawdzono).
 */
async function runProcessFlowNodeUiOnlyCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z menu węzła (prawy klik) lub pływającego paska Przepływu — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * Runtime stringi TORU (lane) Przepływu (N6.3, 2026-08-10, `LaneSystem.tsx`).
 * Jedna mapa PER akcja (nie jedna zbiorcza), z tego samego powodu co
 * `RUNTIME_EDGE_LABEL`/etc. wyżej — `scripts/check-actions.sh` (R6) parsuje
 * WYŁĄCZNIE `  tool: 'string',` per linia pod constem typu `ToolActionMap`.
 * Torowość jest DZIŚ pojęciem WYŁĄCZNIE Przepływu (Whiteboard ma "ramkę"
 * ale jej kontenerowe operacje same w sobie nie są jeszcze zaimplementowane —
 * rozdz. 08 §5, tabela „Menu kontenera": „Grupuj/Rozgrupuj tylko z paska
 * zaznaczenia... brak dedykowanego menu prawego kliku «na ramce jako
 * kontenerze»" — nie ma więc NIC realnego po stronie Tablicy do porównania
 * mechanizmu z, Z1 poprawnie nie ma tu czego reużyć), stąd sześć map niżej
 * ma tylko jeden klucz każda.
 */
const RUNTIME_LANE_RENAME: ToolActionMap = {
  process_flow: 'pf_lane_rename',
};
const RUNTIME_LANE_MOVE_UP: ToolActionMap = {
  process_flow: 'pf_lane_move_up',
};
const RUNTIME_LANE_MOVE_DOWN: ToolActionMap = {
  process_flow: 'pf_lane_move_down',
};
const RUNTIME_LANE_COLOR: ToolActionMap = {
  process_flow: 'pf_lane_color',
};
const RUNTIME_LANE_TOGGLE_COLLAPSE: ToolActionMap = {
  process_flow: 'pf_lane_toggle_collapse',
};
const RUNTIME_LANE_DELETE: ToolActionMap = {
  process_flow: 'pf_lane_delete',
};

/**
 * `idea.view.pf_add_decision` (N6.3, 2026-08-10) — canvas menu „Add
 * decision". `pf_add_decision` już miał odbiornik w
 * `useProcessFlowQuickActions.ts` (linia 136, `handlers.addNode('decision')`)
 * od wcześniejszej fali, po prostu bez wołającego z rejestru — nie NOWA
 * infrastruktura, tylko brakujące podłączenie.
 */
const RUNTIME_PF_ADD_DECISION: ToolActionMap = {
  process_flow: 'pf_add_decision',
};

/**
 * UI-only akcje menu TŁA (kanwy) Przepływu (N6.3 kontynuacja, 2026-08-10,
 * `ProcessFlowContextMenu.tsx`'s `getCanvasContextActions`) — ten sam kształt
 * co `runProcessFlowNodeUiOnlyCallback`, osobna funkcja WYŁĄCZNIE dla
 * uczciwego komunikatu („menu tła", nie „menu węzła" — Teresa nie ma dziś
 * ŻADNEGO sposobu odróżnienia tych dwóch odmów bez precyzyjnego tekstu).
 * Użyta wyłącznie dla `idea.view.pf_paste_at_point` (schowek narzędzia jest
 * stanem przeglądarki `useRef`, dokładnie ta sama sytuacja co Mapy myśli
 * `idea.view.paste_at_point` i węzłowe `idea.node.pf_copy` — sprawdzone PRZED
 * użyciem, nie zgadywane).
 */
async function runProcessFlowPaneUiOnlyCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z menu tła (prawy klik na puste miejsce) Przepływu — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/** Wskaźnik akcja TORU (lane) → jej mapa runtime, ten sam kształt co
 * `RUNTIME_EDGE_ACTION_MAPS` (N6.3, 2026-08-10, `LaneSystem.tsx` — przyciski
 * stałe w nagłówku toru, BEZ tablicy `ActionDef[]`/menu do przechwycenia). */
const RUNTIME_LANE_ACTION_MAPS: Partial<Record<string, ToolActionMap>> = {
  'idea.lane.pf_rename': RUNTIME_LANE_RENAME,
  'idea.lane.pf_move_up': RUNTIME_LANE_MOVE_UP,
  'idea.lane.pf_move_down': RUNTIME_LANE_MOVE_DOWN,
  'idea.lane.pf_color': RUNTIME_LANE_COLOR,
  'idea.lane.pf_toggle_collapse': RUNTIME_LANE_TOGGLE_COLLAPSE,
  'idea.lane.pf_delete': RUNTIME_LANE_DELETE,
};

/**
 * Przekaźnik dla akcji `scope: 'lane_frame'` (N6.3, 2026-08-10) — ten sam
 * kształt co `runEdgeParamCallback`, przystosowany do toru: `LaneSystem.tsx`
 * NIE jest budowane z rejestru (przyciski stałe w nagłówku, NIETKNIĘTE —
 * dokładnie ten sam wybór co dla węzła/krawędzi Przepływu w tej fali:
 * „komponent zostaje, tylko obiekt handlerów przekazywany do hooka rośnie"),
 * więc `ctx.params.run` w praktyce NIGDY nie jest ustawiane przez Przepływ —
 * ścieżka niżej istnieje dla ewentualnych przyszłych wywołujących z realnym
 * zamknięciem (ten sam powód co w `runEdgeParamCallback`). Realna ścieżka
 * dziś to zawsze szyna z jawnym `laneId`.
 */
async function runLaneParamCallback(
  actionId: string,
  ctx: ActionContext,
  extra?: Record<string, unknown>
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }

  const laneId =
    typeof ctx.params?.laneId === 'string' && ctx.params.laneId
      ? ctx.params.laneId
      : ctx.selection?.type === 'lane' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  if (!laneId) {
    return {
      ok: false,
      actionId,
      message: 'Nie wiem, na którym torze Przepływu wykonać tę akcję — podaj `laneId` albo zaznacz go najpierw.',
    };
  }
  const runtime = RUNTIME_LANE_ACTION_MAPS[actionId]?.[ctx.tool];
  if (!runtime) {
    return {
      ok: false,
      actionId,
      message: `Ta akcja nie istnieje w tej reprezentacji (${ctx.tool}).`,
    };
  }
  dispatchQuickAction(runtime, ctx, { laneId, ...(ctx.params || {}), ...(extra || {}) });
  return { ok: true, actionId, data: { runtime, laneId } };
}

/**
 * `idea.node.pf_ai_rewrite_step` (N6 kontynuacja, 2026-08-09) — jedyna nowa
 * szyna węzła Przepływu w tej fali. UI: `ctx.params.run` = dokładnie
 * dotychczasowy klik (`openStepRewrite(nodeId)` w `IdeaProcessFlowTool.tsx`,
 * NIETKNIĘTY — otwiera pusty panel, człowiek sam wpisuje polecenie). Teresa:
 * nie ma przeglądarki do wpisania polecenia, więc podaje `instruction` wprost
 * w parametrach — dispatchuje na szynę z ZARÓWNO `nodeId` JAK I `instruction`,
 * a nowy odbiornik `pf_ai_rewrite_step` (`useProcessFlowQuickActions.ts`)
 * woła `createStepRewriteProposal` NATYCHMIAST (bez czekania na wpisanie
 * tekstu) — ale WCIĄŻ tylko tworzy propozycję (`AIProposalPanel`), człowiek
 * musi kliknąć Akceptuj/Odrzuć (rozdz. 09 §3, model propozycji zachowany dla
 * obu ścieżek).
 */
async function runProcessFlowAIRewriteStepCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.node.pf_ai_rewrite_step';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const nodeId =
    typeof ctx.params?.nodeId === 'string' && ctx.params.nodeId
      ? ctx.params.nodeId
      : ctx.selection?.type === 'node' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  const instruction =
    typeof ctx.params?.instruction === 'string' && ctx.params.instruction.trim()
      ? ctx.params.instruction
      : undefined;
  if (!nodeId || !instruction) {
    return {
      ok: false,
      actionId,
      message:
        'Nie wiem, który krok Przepływu przeredagować i jak — podaj `nodeId` kroku oraz `instruction` (polecenie przeredagowania).',
    };
  }
  const runtime = RUNTIME_PF_NODE_AI_REWRITE_STEP.process_flow;
  if (!runtime) {
    return { ok: false, actionId, message: 'Ta akcja nie istnieje w tej reprezentacji.' };
  }
  dispatchQuickAction(runtime, ctx, { nodeId, instruction });
  return { ok: true, actionId, data: { runtime, nodeId } };
}

/**
 * `idea.node.pf_convert_initiative` (N6 kontynuacja, 2026-08-09) — WZOROWANE
 * na `idea.workspace.convert` wyżej (bezpośrednie `Api.convertMyIdea`
 * w handlerze), NIE na szynie `idea-workspace-quick-action`. Powód
 * (sprawdzone, nie spekulacja): UI klik (`handleConvert('pf_convert_initiative')`
 * w `IdeaProcessFlowTool.tsx`) woła `onQuickAction('pf_convert_initiative',
 * { selectedIds, activeTool })` — ale `IdeaMapWorkspace.tsx`'s
 * `handleQuickAction` (odbiornik `pf_convert_*` na tej samej szynie) czyta
 * WYŁĄCZNIE `eventDetail?.nodeIds` (`CONVERT_PREFIX_MAP` branch) — `selectedIds`
 * jest polem MARTWYM, nigdy odczytanym. Efekt: `explicitNodeIds` jest ZAWSZE
 * `undefined` dla tej akcji, konwersja pada z powrotem na `selection.ids`
 * (stan całego workspace'u, zsynchronizowany z zaznaczeniem płótna) —
 * NIE na węzeł, na którym otwarto menu (prawy klik na węzeł go nie zaznacza,
 * patrz `idea.node.pf_edit`/`idea.node.duplicate`). PRZEDISTNIEJĄCY defekt
 * (nazwa pola), NIEnaprawiony tu — UI ścieżka (`ctx.params.run`) zostaje
 * dokładnie taka, jaka była. Zamiast próbować naprawić to przez tę samą,
 * wadliwą szynę, ścieżka Teresy pomija ją całkowicie i woła `Api.convertMyIdea`
 * wprost z poprawnym polem `nodeIds` — Teresa dostaje DZIAŁającą, poprawną
 * ścieżkę, której UI dziś nie ma (asymetria udokumentowana, nie ukryta).
 * Tak jak `idea.workspace.convert`, NIE replikuje dodatkowych efektów UI
 * ścieżki (`Api.createLinkGraphEdge`, `outputLinks` patch, event
 * `idea-mindmap-mark-converted`) — ta sama, już zaakceptowana uproszczona
 * ścieżka rejestru co istniejący `idea.workspace.convert` (patrz ten wpis),
 * nie nowe ograniczenie wprowadzone tutaj.
 */
async function runProcessFlowConvertInitiativeCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.node.pf_convert_initiative';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const nodeId =
    typeof ctx.params?.nodeId === 'string' && ctx.params.nodeId
      ? ctx.params.nodeId
      : ctx.selection?.type === 'node' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  if (!nodeId) {
    return {
      ok: false,
      actionId,
      message: 'Nie wiem, który krok Przepływu skonwertować — podaj `nodeId`.',
    };
  }
  if (!ctx.confirmed) {
    return {
      ok: false,
      actionId,
      message: 'Konwersja tworzy nowy, trwały obiekt (Inicjatywę) — potrzebuję potwierdzenia.',
    };
  }
  const data = await Api.convertMyIdea(ctx.ideaId, {
    target: 'initiative',
    options: { language: ctx.language || 'pl', nodeIds: [nodeId] },
  });
  return { ok: true, actionId, data };
}

/**
 * Konwersja węzła/gałęzi Mapy myśli do artefaktu (N5 trzecia fala, 2026-08-09
 * — `NodeContextMenu.tsx` grupy Convert/„Convert branch to…" + dual-surface
 * `FloatingNodeToolbar.tsx` „Convert branch"). Klik człowieka (`ctx.params.run`)
 * idzie DOKŁADNIE dotychczasową ścieżką (`onAction(item.id)` →
 * `handleContextAction`/lokalny `SUBTREE_MAP` w `IdeaRecommendationMap.tsx` —
 * OBA wołają TĘ SAMĄ funkcję `convertBranch(target, nodeId)`,
 * `IdeaRecommendationMap.tsx:4822`), NIETKNIĘTĄ.
 *
 * UCZCIWOŚĆ (rozdz. 10 „Konwersja, Eksport, Import, Szablony" §2.2/§7,
 * sprawdzone PRZED tym wpisem, nie zgadywane):
 *  - `convertBranch()` ZAWSZE zbiera potomków (`collectDescendants`),
 *    NIEZALEŻNIE od tego, czy wywołano ją z grupy „Convert" (etykieta
 *    sugeruje POJEDYNCZY węzeł, BEZ potomków) czy „Convert branch to…" — to
 *    jest DOKUMENTOWANA, PRZEDISTNIEJĄCA rozbieżność (rozdz. 10 §7: „«Convert»
 *    (bez sufiksu, węzeł Mind Map) | Zawsze konwertuje CAŁĄ gałąź, mimo
 *    etykiety sugerującej element"), NIE coś wprowadzone lub naprawione tym
 *    wpisem. `scope: 'single_item'` opisuje kotwicę (JEDEN węzeł, na którym
 *    otwarto menu) — kaskada do potomków jest opisana uczciwie w
 *    `teresa.description` każdego wpisu niżej, ten sam wybór co
 *    `idea.node.mm_duplicate_branch` wyżej (Structure group, druga fala).
 *  - Rozdz. 10 §2.2 WYMAGA podglądu treści docelowego artefaktu PRZED
 *    wykonaniem konwersji. DZIŚ go nie ma (tylko toast PO fakcie —
 *    `IdeaMapWorkspace.tsx handleConvert`) — `requiresPreview: false` jest
 *    uczciwe wobec STANU DZISIEJSZEGO, nie wobec docelowego standardu (ten sam
 *    wybór co istniejący `idea.workspace.convert` wyżej).
 *  - Backend zapisuje link zwrotny jako `outputLinks[]` w `extensions` grafu
 *    (addytywne) + krawędź LinkGraph, ale TEŻ nadpisuje `promoted_to`/
 *    `promoted_entity_id`/`stage='promoted'` na CAŁEJ Idei bezwarunkowo
 *    (`POST .../my-ideas/:id/convert`, opisane w rozdz. 10 §2.3 jako defekt
 *    DO naprawy: druga konwersja innej gałęzi kasuje ślad pierwszej). To NIE
 *    jest append-only `conversions[]` z audytu 09 §9
 *    (`{conversionId,targetType,targetId,scope,sourceElementIds,createdAt,
 *    createdBy,mappingVersion,sourceLink}`) — brak takiej struktury dziś w
 *    ogóle. `undo.kind: 'manual_delete'` (jak `idea.workspace.convert`) jest
 *    jedyną uczciwą odpowiedzią: nie ma czego automatycznie cofnąć, i nie ma
 *    historii wielu konwersji do przywrócenia z. Rozdz. 10 §2.3/audyt 09 §9 to
 *    osobny, większy epik (E11 — lineage/konwersja) — NIE naprawiane tym
 *    wpisem, tylko uczciwie nie deklarowane jako coś więcej niż jest.
 *
 * ZASTRZEŻENIE target `process_flow` — SPRAWDZONE, NIE spekulacja (pierwsza
 * lektura tego wpisu podejrzewała pętlę re-dispatchu; obalone przez
 * `tests/unit/mywork/h2.3-mindmap-processflow-branch-conversion.test.ts`,
 * commit `35e55d879d`, zanim wylądowało tutaj — patrz ten test dla dowodu).
 * `process_flow` NIE jest w `IDEA_CONVERT_TARGETS`/`CONVERT_PREFIX_MAP`
 * (`ideaConvertTargets.ts`) i faktycznie NIE idzie przez `Api.convertMyIdea`
 * jak pozostałe cztery targety (initiative/decision/task_set) — `convertBranch`
 * dispatchuje `convert_process_flow` z jawnym `nodeIds`, co
 * `IdeaMapWorkspace.tsx`'s `handleQuickAction` łapie NA SAMEJ GÓRZE funkcji
 * (`XFORM_MAP[action] || (action === 'convert_process_flow' && explicitNodeIds)`,
 * `IdeaMapWorkspace.tsx:888`) i kieruje przez `transformSelection` — TĘ SAMĄ
 * ścieżkę co „Przełącz na Proces" (`xform_to_flow`), nie przez konwersję do
 * artefaktu w innym module. Efekt: węzły gałęzi trafiają jako nowe kroki DO
 * WŁASNEGO Procesu Idei (`idea-workspace-insert`, `setActiveTool('process_flow')`),
 * BEZ nowego rekordu w innym module, BEZ `outputLinks`, BEZ `Api.convertMyIdea`.
 * Uczciwie: to jest bliżej „Generowanie reprezentacji" z rozdz. 10 §1 niż
 * „Konwersja do artefaktu" (mimo etykiety menu „Convert branch → Process
 * Flow") — istniejąca, PRZEDISTNIEJĄCA niezgodność nazwy z definicją rozdz.
 * 10, nie coś wprowadzone lub naprawione tym wpisem. Undo tej JEDNEJ pozycji
 * (`idea.node.mm_convert_branch_process_flow` niżej) jest oznaczone uczciwie
 * inaczej niż pozostałych siedmiu — patrz jej `undo.evidence`.
 */
async function runMindmapNodeConvertAction(
  actionId: string,
  target: string,
  map: ToolActionMap,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const nodeId =
    typeof ctx.params?.nodeId === 'string' && ctx.params.nodeId
      ? ctx.params.nodeId
      : ctx.selection?.type === 'node' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  if (!nodeId) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `nodeId` węzła (kotwicy poddrzewa) do konwersji.',
    };
  }
  if (!ctx.confirmed) {
    return {
      ok: false,
      actionId,
      message:
        'Konwersja tworzy nowy, trwały obiekt w innym module (i obejmuje CAŁE poddrzewo tego węzła) — potrzebuję potwierdzenia.',
    };
  }
  return runByTool(actionId, map, ctx, { nodeId, target });
}

/**
 * `idea.node.mm_attach_knowledge` (N5 czwarta fala, 2026-08-09) — jedyna
 * pozycja grupy Style & data z realnym, ADRESOWALNYM po `nodeId` punktem
 * wejścia (`idea-workspace-attach-knowledge`, `IdeaMapWorkspace.tsx:2716-2726`
 * — czyta `detail.nodeId`+`detail.ideaId` i otwiera popover artefaktów na
 * WSKAZANYM węźle). W PRZECIWIEŃSTWIE do `idea.node.attach_knowledge`
 * (Tablica, wyżej) — tamten odbiornik SPRAWDZONO, że IGNORUJE
 * `detail.nodeId` i działa wyłącznie na bieżące zaznaczenie przeglądarki, więc
 * jest UI-only. Tu odbiornik jest inny plik/inny mechanizm i faktycznie
 * honoruje `nodeId` — stąd OSOBNY wpis (nie rozszerzenie `tools` istniejącego),
 * bus-wired.
 */
function dispatchMindmapAttachKnowledge(nodeId: string, ideaId: string) {
  window.dispatchEvent(
    new CustomEvent('idea-workspace-attach-knowledge', { detail: { nodeId, ideaId } })
  );
}

async function runMindmapAttachKnowledgeCallback(ctx: ActionContext): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId: 'idea.node.mm_attach_knowledge' };
  }
  const nodeId =
    typeof ctx.params?.nodeId === 'string' && ctx.params.nodeId
      ? ctx.params.nodeId
      : ctx.selection?.type === 'node' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  if (!nodeId) {
    return {
      ok: false,
      actionId: 'idea.node.mm_attach_knowledge',
      message: 'Podaj `nodeId` węzła, do którego dołączyć wiedzę.',
    };
  }
  dispatchMindmapAttachKnowledge(nodeId, ctx.ideaId || '');
  return { ok: true, actionId: 'idea.node.mm_attach_knowledge', data: { nodeId } };
}

async function runNodeEditLabelCallback(ctx: ActionContext): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId: 'idea.node.edit' };
  }
  const nodeId =
    typeof ctx.params?.nodeId === 'string' && ctx.params.nodeId
      ? ctx.params.nodeId
      : ctx.selection?.type === 'node' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  const label = typeof ctx.params?.label === 'string' ? ctx.params.label : undefined;
  if (!nodeId || !label) {
    return {
      ok: false,
      actionId: 'idea.node.edit',
      message: 'Podaj `nodeId` elementu i nową `label` — bez nich nie wiem, co zmienić.',
    };
  }
  dispatchNodeUpdate(nodeId, { label });
  return { ok: true, actionId: 'idea.node.edit', data: { nodeId } };
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

/**
 * N7 kontynuacja (2026-08-09) — Whiteboard node/pane PPM (`IdeaCanvasContextMenu.tsx`).
 * `wb_duplicate`/`wb_delete` MAJĄ JUŻ odbiornik w `useWhiteboardQuickActions.ts`
 * (linie ok. 133-135) wołający DOKŁADNIE `handlers.duplicateSelected`/
 * `deleteSelected` — te same funkcje, które `IdeaWhiteboardTool.tsx` przekazuje
 * jako propy `onDuplicate`/`onDeleteNode` do tego menu. Reuse za darmo, bez
 * nowej szyny.
 *
 * N6 kontynuacja Przepływu (2026-08-09, `ProcessFlowContextMenu.tsx`'s
 * `getNodeContextActions` + dual-surface `ProcessFlowFloatingToolbar.tsx`):
 * `pf_duplicate`/`pf_delete` REUŻYTE tu (rozszerzenie `tools`, NIE nowe id) —
 * SPRAWDZONE, nie zgadywane: `duplicateSelected()`/`deleteSelected()` w
 * `useProcessFlowNodes.ts` operują na PŁASKIM zaznaczeniu płótna (tak jak
 * Tablica), NIE na drzewie z rodzicem (w przeciwieństwie do Mapy myśli, która
 * dlatego świadomie NIE reużyła tych id — `idea.node.mm_duplicate`/`mm_delete`
 * niżej, `single_item` zakotwiczony pod rodzicem). Oba mają już odbiornik w
 * `useProcessFlowQuickActions.ts` (`pf_duplicate`/`pf_delete`, istniały PRZED
 * tą zmianą — wołane dotąd tylko z Menu 3/rail), zero nowego kodu w hooku.
 */
const RUNTIME_NODE_DUPLICATE: ToolActionMap = {
  whiteboard: 'wb_duplicate',
  process_flow: 'pf_duplicate',
};
const RUNTIME_NODE_DELETE: ToolActionMap = {
  whiteboard: 'wb_delete',
  process_flow: 'pf_delete',
};

/**
 * `wb_ai_to_map`/`wb_ai_to_table` MAJĄ JUŻ odbiornik (AI_ACTION_MAP w
 * `useWhiteboardQuickActions.ts` → `handlers.runAIAction('wb_to_map_branches'
 * | 'wb_to_table')`) — dotąd nieużywany przez żaden wpis rejestru (podobnie
 * jak insert-shape ×5 przed toolbar-wpisem). Reuse za darmo.
 */
const RUNTIME_WB_TO_MINDMAP: ToolActionMap = {
  whiteboard: 'wb_ai_to_map',
};
const RUNTIME_WB_TO_TABLE: ToolActionMap = {
  whiteboard: 'wb_ai_to_table',
};

/**
 * `PaneContextMenu.tsx` (N5 kontynuacja, 2026-08-09) — tło (pane) Mapy myśli,
 * 13 pozycji. Każda mapa niżej wskazuje na odbiornik, który JUŻ ISTNIEJE i
 * JEST ŻYWY w `useMindMapQuickActions.ts` (zweryfikowane grepem przed
 * dopisaniem — żaden nowy odbiornik poza `mm_select_all`, patrz komentarz przy
 * tej mapie). `PaneContextMenu.tsx` przekazuje `ctx.params.run` (swój
 * dotychczasowy `onAction(item.id)` z `IdeaRecommendationMap.tsx` —
 * NIETKNIĘTY) dla WSZYSTKICH 13 pozycji, więc klik człowieka idzie DOKŁADNIE
 * tą samą ścieżką co przed migracją (zero zmiany zachowania); mapy niżej
 * dają Teresie (`ctx.source === 'teresa'`, brak `run`) drugą, realną ścieżkę
 * przez `runToolbarBusAction` → szynę `idea-workspace-quick-action`.
 */
const RUNTIME_PANE_ADD_ROOT: ToolActionMap = {
  // Odbiornik od 2026-07-28 (`handlers.addRootTopic()`), dotąd używany tylko
  // przez `MindmapCommandPalette.tsx` (Cmd+K) — bez wpisu w rejestrze.
  // RÓŻNICA od kliku człowieka (świadoma, nie naprawiana tutaj): pozycja
  // nowego węzła to stały offset od korzenia, nie punkt prawego kliku —
  // Teresa nie ma pojęcia "gdzie kliknięto", więc offset jest uczciwym
  // zachowaniem zastępczym, nie regresją klik-ścieżki (ta idzie przez `run`).
  mindmap: 'mm_add_root',
};
const RUNTIME_PANE_SELECT_ALL: ToolActionMap = {
  // NOWY odbiornik — `useMindMapQuickActions.ts`, dopisany przy tej migracji
  // (poprzednio `pane_select_all` żył WYŁĄCZNIE lokalnie w
  // `IdeaRecommendationMap.handlePaneContextAction`, bez odbiornika na szynie).
  mindmap: 'mm_select_all',
};
const RUNTIME_PANE_FIT_VIEW: ToolActionMap = {
  // Odbiornik już istnieje (`useMindMapQuickActions.ts` `mm_fit_view` →
  // `handlers.fitView`) — używany dotąd np. przez `CanvasLeftToolbar`/paletę
  // poleceń, nigdy przez ten rejestr.
  mindmap: 'mm_fit_view',
};
const RUNTIME_PANE_AUTO_CLUSTER: ToolActionMap = {
  // Odbiornik już istnieje i mutuje realnie (grupuje węzły-sieroty w klastry,
  // `handlers.pushUndo()` wewnątrz) — `useMindMapQuickActions.ts` `mm_auto_cluster`.
  mindmap: 'mm_auto_cluster',
};
const RUNTIME_PANE_COLLAPSE_ALL: ToolActionMap = {
  // `mm_fold_0` — ta sama gałąź obsługi co `mm_fold_1`/`mm_fold_2`/`mm_fold_3`
  // (`useMindMapQuickActions.ts`, `handlers.setFoldLevel?.(level)`).
  mindmap: 'mm_fold_0',
};
const RUNTIME_PANE_FOLD_1: ToolActionMap = {
  mindmap: 'mm_fold_1',
};
const RUNTIME_PANE_FOLD_2: ToolActionMap = {
  mindmap: 'mm_fold_2',
};
const RUNTIME_PANE_EXPAND_ALL: ToolActionMap = {
  mindmap: 'mm_expand_all',
};
const RUNTIME_PANE_AI_SUGGEST: ToolActionMap = {
  // Odbiornik już istnieje — otwiera czat z promptem "zasugeruj gałęzie"
  // (`handlers.onOpenChat`), z fallbackiem na `handlers.handleAIExpand()`
  // (ta sama wywoła AI co `idea.ai.expand_map`) gdy czat niedostępny.
  mindmap: 'mm_ai_suggest',
};

/**
 * `NodeContextMenu.tsx` (N5 kontynuacja, druga fala, 2026-08-09) — grupy
 * Edit/Structure/Delete (Convert/Convert-branch/Style&data i AI ŚWIADOMIE
 * NIETKNIĘTE, osobne przyszłe fale). Każda mapa niżej ma JUŻ ŻYWY odbiornik w
 * `useMindMapQuickActions.ts` — zweryfikowane grepem przed dopisaniem — poza
 * trzema NOWYMI: `mm_connect_nodes`, `mm_detach_branch`, `mm_duplicate_branch`
 * (dopisane tą samą zmianą; `detachBranch`/`duplicateBranch` istniały już w
 * `IdeaRecommendationMap.tsx` od V5-IDEA-17, ale nigdy nie były przekazane do
 * `useMindMapQuickActions`' `handlers` — dopięte tutaj, nie duplikowane).
 */
const RUNTIME_MM_NODE_ADD_CHILD: ToolActionMap = {
  mindmap: 'mm_add_child',
};
const RUNTIME_MM_NODE_ADD_SIBLING: ToolActionMap = {
  mindmap: 'mm_add_sibling',
};
const RUNTIME_MM_NODE_DUPLICATE: ToolActionMap = {
  mindmap: 'mm_duplicate',
};
const RUNTIME_MM_NODE_DELETE: ToolActionMap = {
  mindmap: 'mm_delete',
};
const RUNTIME_MM_NODE_TOGGLE_COLLAPSE: ToolActionMap = {
  mindmap: 'mm_toggle_collapse',
};
const RUNTIME_MM_NODE_CONNECT: ToolActionMap = {
  // NOWY odbiornik (patrz useMindMapQuickActions.ts) — czyta detail.nodeId
  // (węzeł źródłowy, ten sam parsing co wszystkie inne akcje węzłowe) oraz
  // detail.targetNodeId (drugi węzeł, NOWE pole — bez odpowiednika gdzie
  // indziej w tym pliku, bo żadna inna akcja węzłowa nie wymaga DRUGIEGO id).
  mindmap: 'mm_connect_nodes',
};
const RUNTIME_MM_NODE_DETACH_BRANCH: ToolActionMap = {
  mindmap: 'mm_detach_branch',
};
const RUNTIME_MM_NODE_DUPLICATE_BRANCH: ToolActionMap = {
  mindmap: 'mm_duplicate_branch',
};
/**
 * N5 trzecia fala (2026-08-09) — WSPÓLNY runtime string dla WSZYSTKICH ośmiu
 * `idea.node.mm_convert_*`/`idea.node.mm_convert_branch_*` wpisów niżej
 * (Convert + Convert-branch grupy): jeden odbiornik w
 * `useMindMapQuickActions.ts` (`mm_convert_branch`) czyta `target` z payloadu
 * (`{ nodeId, target }`, dopisane przez `runMindmapNodeConvertAction`) zamiast
 * ośmiu osobnych runtime stringów — target JEST już wybrany przez to, KTÓRĄ
 * akcję Teresa/klik zawołały (`idea.node.mm_convert_initiative` zawsze niesie
 * `target:'initiative'`), więc osiem runtime stringów byłoby czystą
 * duplikacją bez dodatkowej informacji.
 */
const RUNTIME_MM_NODE_CONVERT_BRANCH: ToolActionMap = {
  mindmap: 'mm_convert_branch',
};
/**
 * N5 czwarta fala (2026-08-09) — grupa AI węzła Mapy myśli. Reużywa
 * ISTNIEJĄCY runtime string `mm_ai_expand` (RUNTIME_AI_EXPAND wyżej, dziś
 * używany przez `idea.ai.expand_map` w zasięgu `workspace`, rail/panel) —
 * TEN SAM odbiornik (`handlers.handleAIExpand(targetNodeId)`,
 * `useMindMapQuickActions.ts:872`) już honoruje `detail.nodeId`, więc nowy
 * wpis w zasięgu `single_item` (menu węzła) może bezpiecznie dzielić string
 * zamiast duplikować go pod nową nazwą.
 */
const RUNTIME_MM_NODE_AI_WHAT_IF: ToolActionMap = {
  // Odbiornik (`useMindMapQuickActions.ts:1121`) IGNORUJE `detail.nodeId` —
  // zawsze tylko `setShowWhatIf(true)`, tak samo jak klik z menu węzła
  // (`IdeaRecommendationMap.tsx:4900`, `setShowWhatIf(true)` bez żadnego
  // targetowania). Modal wewnątrz i tak bierze `nodes.find(n => n.selected)`
  // — SPRAWDZONE PRZED wpisem, nie spekulacja (patrz honesty w teresa.description
  // niżej): ani klik z menu węzła, ani Teresa nie mogą dziś wskazać
  // KONKRETNEGO węzła dla tej akcji, mimo że jest wystawiona w menu węzła.
  mindmap: 'mm_ai_what_if',
};
const RUNTIME_MM_NODE_AI_SUMMARIZE_BRANCH: ToolActionMap = {
  // UWAGA — DWIE RÓŻNE ścieżki dla "podsumuj gałąź" (sprawdzone PRZED wpisem):
  // klik z menu węzła (`ctx_summarize_branch`) woła `summarizeBranch()`
  // (`IdeaRecommendationMap.tsx:4808-4828`), który TYLKO wypełnia prompt czatu
  // (`idea-workspace-chat-prompt`) — zero realnej generacji. Ten runtime
  // string (`mm_ai_summarize_branch`, odbiornik `useMindMapQuickActions.ts:1081`)
  // to INNY, MOCNIEJSZY mechanizm: otwiera `BranchSummaryPanel.tsx`, który
  // faktycznie woła `Api.*` po prawdziwe podsumowanie LLM. Świadomie wybrany
  // dla Teresy zamiast repliki "wypełnij czat" (dałby Teresie gorszy wynik niż
  // ma dziś dostępny w kodzie) — udokumentowana rozbieżność UI-vs-Teresa, jak
  // `idea.node.ai_find_themes` wyżej. Odbiornik używa WYŁĄCZNIE
  // `handlers.getSelectedNode()`, IGNORUJE `detail.nodeId` — ta sama uczciwa
  // granica co powyżej (`RUNTIME_MM_NODE_AI_WHAT_IF`).
  mindmap: 'mm_ai_summarize_branch',
};
const RUNTIME_MM_NODE_AI_SUGGEST_LINKS: ToolActionMap = {
  // UWAGA — KLIK Z MENU WĘZŁA JEST DZIŚ MARTWY (sprawdzone grepem, nie
  // spekulacja): `handleContextAction` w `IdeaRecommendationMap.tsx` NIE MA
  // gałęzi `if (action === 'ai_suggest_links')` — lista `if`-ów kończy się na
  // `ctx_delete` bez obsługi tego id. Ten SAM string działa dziś WYŁĄCZNIE z
  // pływającego paska (`FloatingAIPopover.tsx:52` → `useMindMapQuickActions.ts:1123`
  // → dispatch `mm_ai_suggest_links_execute` → `IdeaMapWorkspace.tsx:1047`
  // realny `generateAIProposal` + `setProposalBatch`, proposal-first). Zgodnie
  // z zasadą „zachowaj dokładny klik" NIE naprawiamy tu martwej gałęzi w
  // `handleContextAction` (zmieniłoby to widoczne zachowanie kliku, poza
  // zakresem tego wiringu) — `ctx.params.run` zostaje bajt-identyczny
  // no-opem dla człowieka, a Teresa dostaje TEN SAM realny odbiornik, którego
  // pływający pasek już używa. Zgłoszone jako oddzielna, tania naprawa do
  // zrobienia (jedna brakująca gałąź `if`).
  mindmap: 'ai_suggest_links',
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
      'src/components/MyWork/processflow/useProcessFlowQuickActions.ts:149 (pf_auto_layout) + IdeaMapWorkspace.tsx onAutoLayout (commit f5d0271992) · REUSED (2026-08-09, N6 kontynuacja) by ProcessFlowContextMenu.tsx getNodeContextActions "auto-layout" item (onAutoLayout → handleAutoLayout(), IdeaProcessFlowTool.tsx ~linia 3797) — genuine same action despite living in the NODE menu: handleAutoLayout() rearranges the WHOLE current view, not just the clicked node, identical to the canvas/pane menu\'s own "Auto-layout" item that already owns this id. `surfaces` already includes \'context\' (added for Mind Map\'s pane menu, E02-N5-PANE) — no field changes needed for this second, honest reuse.',
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
  // ── scope='edge' (pilot Tablicy 2026-08-09, rozszerzenie na Mapę myśli
  // tego samego dnia) ─────────────────────────────────────────────────────
  // Handler = runEdgeParamCallback (patrz komentarz przy jej definicji) —
  // świadomie inny wzorzec niż dispatchQuickAction/runByTool używany przez
  // pozostałe wpisy: Tablica idzie przez `ctx.params.run` (prop-callback
  // menu) dla UI, Mapa myśli ZAWSZE przez szynę `idea-workspace-quick-action`
  // (UI i Teresa jedną ścieżką — jej hook miał już bezpośredni dostęp do
  // `edges`/`setEdges`, więc nie potrzebuje zamknięcia komponentu). Pięć
  // wpisów niżej są WSPÓLNE obu narzędziom (Z1: ta sama realna akcja = to
  // samo id) — `idea.edge.edit_label`/`.reverse`/`.cycle_arrow`/
  // `.cycle_style`/`.delete`. Dwa pozostałe („Wstaw węzeł na połączeniu",
  // „Edytuj relację") są WYŁĄCZNIE Mapy myśli — Tablica nie ma pojęcia relacji
  // ani rozcinania krawędzi węzłem, więc to NIE są warianty tej samej akcji.
  // Kolejność deklaracji = kolejność w obu menu (1:1 ze stanem sprzed migracji;
  // Tablica po prostu pomija pozycje spoza jej `tools`).
  {
    id: 'idea.edge.edit_label',
    label: { pl: 'Dodaj / edytuj etykietę', en: 'Add / edit label' },
    icon: 'Type',
    scope: 'edge',
    tools: ['whiteboard', 'mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.edit_label', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Tablica: IdeaWhiteboardTool.tsx handleEdgeEditLabel:3158 → pushUndoSnapshot() przed setEdges. Mapa myśli: useMindMapQuickActions.ts mm_edge_edit_label → handlers.pushUndo() przed setEdges — DOPISANE 2026-08-09 razem z tym wpisem (poprzednio, w IdeaRecommendationMap.tsx handleEdgeContextAction/edge_add_label, etykiety krawędzi nie dało się cofnąć Ctrl+Z; ta luka jest teraz zamknięta na obu narzędziach).',
    },
    teresa: {
      description:
        'Ustawia etykietę wskazanego połączenia (Tablica lub Mapa myśli). Podaj `edgeId` połączenia (z menu prawego kliku działa bez tego parametru — tam etykietę pyta okno tekstowe).',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi).' },
          label: { type: 'string', description: 'Nowa etykieta połączenia.' },
        },
        required: ['edgeId', 'label'],
      },
    },
    source:
      'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeEditLabel:3158 (Tablica) · src/components/MyWork/mindmap/useMindMapQuickActions.ts mm_edge_edit_label (Mapa myśli)',
  },
  {
    id: 'idea.edge.insert_node',
    label: { pl: 'Wstaw węzeł na połączeniu', en: 'Insert node on edge' },
    icon: 'Plus',
    scope: 'edge',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.insert_node', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'useMindMapQuickActions.ts mm_edge_insert_node → handlers.pushUndo() przed setEdges/setNodes (stos Ctrl+Z) — logika przeniesiona 1:1 z IdeaRecommendationMap.tsx handleEdgeContextAction (dawne edge_insert_node), które też wołało pushUndo() przed mutacją.',
    },
    teresa: {
      description:
        'Dzieli wskazane połączenie relacji na Mapie myśli na dwa, wstawiając pusty węzeł pomiędzy jego końce. Działa TYLKO na krawędziach relacji (nie na strukturalnych krawędziach hierarchii) — na innych, tak jak dziś w menu prawego kliku, po cichu nic się nie stanie. Tablica NIE wspiera tej operacji (brak logiki rozcięcia krawędzi po jej stronie) — akcja tam nie istnieje.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: {
            type: 'string',
            description: 'Id połączenia (krawędzi relacji) na Mapie myśli.',
          },
        },
        required: ['edgeId'],
      },
    },
    source: 'src/components/MyWork/mindmap/useMindMapQuickActions.ts mm_edge_insert_node',
  },
  {
    id: 'idea.edge.reverse',
    label: { pl: 'Odwróć kierunek', en: 'Reverse direction' },
    icon: 'ArrowLeftRight',
    scope: 'edge',
    tools: ['whiteboard', 'mindmap', 'process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.reverse', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Tablica: IdeaWhiteboardTool.tsx handleEdgeReverse:3223 → pushUndoSnapshot() przed zamianą source/target. Mapa myśli: useMindMapQuickActions.ts mm_edge_reverse → handlers.pushUndo() przed zamianą source/target (ta sama logika, przeniesiona z IdeaRecommendationMap.tsx handleEdgeContextAction, które też już wołało pushUndo()). Przepływ (2026-08-09, `ProcessFlowContextMenu.tsx` edge-reverse): IdeaProcessFlowTool.tsx handleEdgeReverse:1012 → pushUndo():1015 przed zamianą source/target+handles — już obecne, nic nie dopisywano.',
    },
    teresa: {
      description:
        'Zamienia miejscami początek i koniec wskazanego połączenia (Tablica, Mapa myśli lub Przepływ). Na Mapie myśli działa TYLKO na krawędziach relacji — na strukturalnych krawędziach hierarchii po cichu nic się nie stanie (tak jak dziś w menu prawego kliku). Na Przepływie działa na KAŻDYM połączeniu (Przepływ ma jeden typ krawędzi, bez rozróżnienia strukturalna/relacja). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi).' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeReverse:3223 (Tablica) · src/components/MyWork/mindmap/useMindMapQuickActions.ts mm_edge_reverse (Mapa myśli) · src/components/MyWork/IdeaProcessFlowTool.tsx handleEdgeReverse:1012 + processflow/useProcessFlowQuickActions.ts pf_edge_reverse (Przepływ, 2026-08-09)',
  },
  {
    id: 'idea.edge.cycle_arrow',
    label: { pl: 'Kierunek strzałki', en: 'Arrow direction' },
    icon: 'ArrowRight',
    scope: 'edge',
    tools: ['whiteboard', 'mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.cycle_arrow', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Tablica: IdeaWhiteboardTool.tsx handleEdgeCycleArrow:3200 → pushUndoSnapshot() przed zmianą data.arrowDirection (Ctrl+Z). Mapa myśli: useMindMapQuickActions.ts mm_edge_arrow (już istniejący odbiornik z 2026-07-28, PONOWNIE UŻYTY tu, nie duplikowany) NIE woła pushUndo — Ctrl+Z NIE cofa zmiany kierunku strzałki na tym narzędziu. Uczciwa luka pre-existing, świadomie NIENAPRAWIANA w tym wpisie: mm_edge_arrow obsługuje też masowe ustawienie strzałki na całej gałęzi z FloatingNodeToolbar.tsx (poza zakresem tego zadania), więc dopisanie pushUndo tam wymaga osobnej weryfikacji tamtej ścieżki.',
    },
    teresa: {
      description:
        'Przełącza strzałkę kierunku wskazanego połączenia (Tablica lub Mapa myśli), cykl: brak → koniec → oba → początek. Podaj `edgeId` połączenia — jeden klik cyklu, więc żeby dojść do konkretnego kierunku, może być potrzebne kilka wywołań. Na Mapie myśli ta akcja NIE wspiera Ctrl+Z (patrz `undo.evidence`).',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi).' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeCycleArrow:3200 (Tablica) · src/components/MyWork/mindmap/useMindMapQuickActions.ts mm_edge_arrow (Mapa myśli, od 2026-07-28)',
  },
  {
    id: 'idea.edge.cycle_style',
    label: { pl: 'Zmień styl linii', en: 'Change line style' },
    icon: 'Paintbrush',
    scope: 'edge',
    tools: ['whiteboard', 'mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.cycle_style', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Tablica: IdeaWhiteboardTool.tsx handleEdgeCycleStyle:3178 → pushUndoSnapshot() przed zmianą data.edgeStyle. Mapa myśli: useMindMapQuickActions.ts mm_edge_cycle_style → handlers.pushUndo() przed zmianą style.strokeDasharray — DOPISANE 2026-08-09 (poprzednio brak Ctrl+Z, tak jak edit_label wyżej). UWAGA modelu danych (odbiór, poza zakresem naprawy tutaj): Mapa myśli cyklu 3 stanów (solid/dashed/dotted) przez `edge.style.strokeDasharray`; Tablica cyklu 4 stanów (+wavy) przez `data.edgeStyle`, semantyczne pole czytane przez jej renderer krawędzi. Mapa myśli MA WŁASNY renderer (`LabeledEdge.tsx`), który liczy `strokeDasharray` WYŁĄCZNIE z `data.edgeStyle` (linie 139-147) — `style.strokeDasharray` ustawiane przez tę akcję nigdy nie trafia na ekran, bo `<path>` nadpisuje je jawnie. Innymi słowy: dziś (przed I PO tej migracji, zachowanie 1:1 przeniesione bez zmian) klik „Zmień styl linii" na Mapie myśli pokazuje toast, ale linia wizualnie się NIE zmienia — pre-existing defekt renderowania, niezwiązany z wiring rejestru, NIE naprawiany w tym zadaniu.',
    },
    teresa: {
      description:
        'Przełącza styl linii wskazanego połączenia (Tablica lub Mapa myśli), cykl: Tablica ciągła→kreskowana→kropkowana→falista, Mapa myśli ciągła→kreskowana→kropkowana. Podaj `edgeId` połączenia — jeden klik cyklu, może być potrzebne kilka wywołań.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi).' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeCycleStyle:3178 (Tablica) · src/components/MyWork/mindmap/useMindMapQuickActions.ts mm_edge_cycle_style (Mapa myśli)',
  },
  {
    id: 'idea.edge.edit_relation',
    label: { pl: 'Edytuj relację', en: 'Edit relation' },
    icon: 'Edit3',
    scope: 'edge',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.edit_relation', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'useMindMapQuickActions.ts mm_edge_edit_relation → handlers.pushUndo() przed setEdges — DOPISANE 2026-08-09 (poprzednio, IdeaRecommendationMap.tsx handleEdgeContextAction/edge_edit_relation, brak Ctrl+Z, tak jak edit_label).',
    },
    teresa: {
      description:
        'Ustawia typ semantycznej relacji wskazanego połączenia na Mapie myśli: related/depends_on/blocks/supports/contradicts (wartość zapisuje się też jako etykieta linii). Działa TYLKO na krawędziach relacji — na strukturalnych po cichu nic się nie stanie, jak dziś. Tablica nie ma pojęcia relacji — akcja tam nie istnieje.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi relacji) na Mapie myśli.' },
          relation: {
            type: 'string',
            description: 'Typ relacji: related, depends_on, blocks, supports lub contradicts.',
          },
        },
        required: ['edgeId', 'relation'],
      },
    },
    source: 'src/components/MyWork/mindmap/useMindMapQuickActions.ts mm_edge_edit_relation',
  },
  {
    id: 'idea.edge.delete',
    label: { pl: 'Usuń połączenie', en: 'Delete connection' },
    icon: 'Trash2',
    scope: 'edge',
    tools: ['whiteboard', 'mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.delete', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Tablica: IdeaWhiteboardTool.tsx handleEdgeDelete:3245 → onEdgesChange:1144 → pushUndoSnapshot() przed applyEdgeChanges. Mapa myśli: useMindMapQuickActions.ts mm_edge_delete → handlers.pushUndo() przed setEdges filter (ta sama logika, przeniesiona z IdeaRecommendationMap.tsx handleEdgeContextAction, które też już wołało pushUndo()).',
    },
    // Trwałe usunięcie krawędzi z grafu — pierwsze użycie `destructive` w
    // rejestrze (pole zadeklarowane, dotąd nieużywane przez żaden z 16
    // wcześniejszych wpisów). Undo jest lokalny (Ctrl+Z), stąd `mutates`+`undo`
    // osobno od `destructive`, zgodnie z opisem pola w interfejsie ActionDef.
    destructive: true,
    teresa: {
      description:
        'Usuwa wskazane połączenie na trwałe (cofnięcie tylko przez Ctrl+Z w tej samej sesji przeglądarki). Na Mapie myśli działa TYLKO na krawędziach relacji utworzonych ręcznie — na strukturalnych i automatycznych po cichu nic się nie stanie (tak jak dziś w menu prawego kliku, gdzie ta pozycja jest wtedy wyszarzona). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi).' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeDelete:3245 (Tablica) · src/components/MyWork/mindmap/useMindMapQuickActions.ts mm_edge_delete (Mapa myśli)',
  },
  // ── Process Flow edge menu (2026-08-09) — `ProcessFlowContextMenu.tsx`'s
  // `getEdgeContextActions` (8 z 9 wpisów; `edge-reverse`, 9., rozszerzył
  // `idea.edge.reverse` WYŻEJ, w miejscu jego deklaracji — prawdziwe REUŻYCIE,
  // Przepływ ma dokładnie tę samą operację adresowaną po `edgeId`). Kolejność
  // deklaracji niżej = kolejność w `getEdgeContextActions`.
  //
  // `edge-insert`/`edge-delete` NIE rozszerzają `idea.edge.insert_node`/
  // `.delete` (Mapa myśli) mimo pozornie tej samej nazwy: `insertBetween()`/
  // `deleteSelected()` w `IdeaProcessFlowTool.tsx` operują na ZAZNACZENIU na
  // płótnie, nie przyjmują `edgeId` — inny mechanizm niż Mapy myśli
  // `mm_edge_insert_node`/`mm_edge_delete`, które adresują po jawnym id.
  // Świadomie NIE scalone — patrz `teresa.description` przy każdym z dwóch
  // wpisów niżej.
  //
  // 5 pozycji `edge-cond-*` (typ warunku BPMN-style: brak/Tak/Nie/Domyślny/
  // Wyjątek na `data.conditionType`) to pojęcie WYŁĄCZNIE Przepływu, bez
  // odpowiednika na Tablicy/Mapie myśli — 5 NOWYCH wpisów. Zachowanie opisane
  // niżej jest AKTUALNE (2026-08-09): manualny audyt
  // `docs/qa/ideas-manual-audit-2026-08-09/02_PROCESS_FLOW_AUDIT.md`, finding
  // `PF-P1-02` (repaired), potwierdza że etykietowanie Tak/Nie i pętli korekty
  // jest już naprawione i przeżywa przeładowanie — opisy odzwierciedlają ten
  // naprawiony stan, nie przedmigracyjny defekt.
  {
    id: 'idea.edge.pf_edit_props',
    label: { pl: 'Etykieta i styl', en: 'Label & style' },
    icon: 'Pencil',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.pf_edit_props', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera panel etykiety/koloru/stylu linii/strzałki wskazanego połączenia Przepływu (ten sam EdgeStylePopover co lewy klik na krawędzi). Sama w sobie NIC nie zmienia dane — użytkownik dokańcza zmianę W otwartym panelu (te dalsze mutacje nie mają dziś własnych wpisów w rejestrze, poza zakresem tego zadania). Wywołanie spoza UI (Teresa) otwiera panel w stałym domyślnym miejscu ekranu, bo nie ma współrzędnych kliknięcia. Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) Przepływu.' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/IdeaProcessFlowTool.tsx onEditProps → setEdgeStylePopover (~linia 3805) + processflow/EdgeStylePopover.tsx + processflow/useProcessFlowQuickActions.ts pf_edge_edit_props (nowy odbiornik, 2026-08-09)',
  },
  {
    id: 'idea.edge.pf_insert_node',
    label: { pl: 'Wstaw węzeł na połączeniu', en: 'Insert node on connection' },
    icon: 'Split',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.pf_insert_node', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaProcessFlowTool.tsx insertBetween:1775 → pushUndo():1811 przed mutacją (add_node+remove_edge+2×add_edge), stos Ctrl+Z.',
    },
    teresa: {
      description:
        'Dzieli wskazane połączenie Przepływu na dwa, wstawiając między nimi nowy krok. UWAGA (mechanizm inny niż na Mapie myśli): `insertBetween()` w Przepływie działa na AKTUALNIE ZAZNACZONEJ krawędzi na płótnie, nie na dowolnym `edgeId` — realnie trafi w to połączenie tylko, gdy jest ono zaznaczone w przeglądarce użytkownika w chwili wywołania (tak jak dziś prawy klik, który zaznacza krawędź PRZED otwarciem menu). Dlatego świadomie NIE rozszerzono nim `idea.edge.insert_node` (Mapa myśli, adresowane po edgeId) — to inny mechanizm, nie wariant tej samej akcji. `edgeId` w kontrakcie jest informacyjny (spójność z resztą rejestru) — realnie liczy się zaznaczenie.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: {
            type: 'string',
            description: 'Id połączenia (informacyjnie — realnie liczy się zaznaczenie na płótnie).',
          },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/IdeaProcessFlowTool.tsx insertBetween:1775 (też floating toolbar „Insert between" i szyna pf_insert_between, processflow/useProcessFlowQuickActions.ts:100 — REUŻYTY odbiornik, nie duplikowany)',
  },
  {
    id: 'idea.edge.pf_condition_none',
    label: { pl: 'Warunek: Bez warunku', en: 'Condition: No condition' },
    icon: 'Check',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.pf_condition_none', ctx, { condition: '' }),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaProcessFlowTool.tsx handleEdgeConditionChange:942 → pushUndo():945 przed setEdges (już obecne, nic nie dopisywano).',
    },
    teresa: {
      description:
        'Czyści typ warunku wskazanego połączenia Przepływu — krawędź wraca do zwykłej, sekwencyjnej (bez etykiety Tak/Nie/Domyślny/Wyjątek). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) Przepływu.' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx EDGE_CONDITIONS[0] + IdeaProcessFlowTool.tsx handleEdgeConditionChange:942',
  },
  {
    id: 'idea.edge.pf_condition_yes',
    label: { pl: 'Warunek: Tak', en: 'Condition: Yes' },
    icon: 'Check',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.pf_condition_yes', ctx, { condition: 'yes' }),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaProcessFlowTool.tsx handleEdgeConditionChange:942 → pushUndo():945 przed setEdges (już obecne, nic nie dopisywano).',
    },
    teresa: {
      description:
        'Ustawia typ warunku wskazanego połączenia Przepływu na „Tak" (gałąź decyzji spełnionej). Etykieta i logika zapisują się trwale i przeżywają przeładowanie (potwierdzone manualnym audytem, finding PF-P1-02). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) Przepływu.' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx EDGE_CONDITIONS[1] + IdeaProcessFlowTool.tsx handleEdgeConditionChange:942',
  },
  {
    id: 'idea.edge.pf_condition_no',
    label: { pl: 'Warunek: Nie', en: 'Condition: No' },
    icon: 'Check',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.pf_condition_no', ctx, { condition: 'no' }),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaProcessFlowTool.tsx handleEdgeConditionChange:942 → pushUndo():945 przed setEdges (już obecne, nic nie dopisywano).',
    },
    teresa: {
      description:
        'Ustawia typ warunku wskazanego połączenia Przepływu na „Nie" (gałąź decyzji niespełnionej). Etykieta i logika zapisują się trwale i przeżywają przeładowanie (potwierdzone manualnym audytem, finding PF-P1-02). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) Przepływu.' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx EDGE_CONDITIONS[2] + IdeaProcessFlowTool.tsx handleEdgeConditionChange:942',
  },
  {
    id: 'idea.edge.pf_condition_default',
    label: { pl: 'Warunek: Domyślny', en: 'Condition: Default' },
    icon: 'Check',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) =>
      runEdgeParamCallback('idea.edge.pf_condition_default', ctx, { condition: 'default' }),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaProcessFlowTool.tsx handleEdgeConditionChange:942 → pushUndo():945 przed setEdges (już obecne, nic nie dopisywano).',
    },
    teresa: {
      description:
        'Ustawia typ warunku wskazanego połączenia Przepływu na „Domyślny" (wyjście bramki, gdy żaden inny warunek nie pasuje). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) Przepływu.' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx EDGE_CONDITIONS[3] + IdeaProcessFlowTool.tsx handleEdgeConditionChange:942',
  },
  {
    id: 'idea.edge.pf_condition_exception',
    label: { pl: 'Warunek: Wyjątek', en: 'Condition: Exception' },
    icon: 'Check',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) =>
      runEdgeParamCallback('idea.edge.pf_condition_exception', ctx, { condition: 'exception' }),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaProcessFlowTool.tsx handleEdgeConditionChange:942 → pushUndo():945 przed setEdges (już obecne, nic nie dopisywano).',
    },
    teresa: {
      description:
        'Ustawia typ warunku wskazanego połączenia Przepływu na „Wyjątek" (gałąź błędu/wyjątku, np. pętla korekty — patrz finding PF-P1-02). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) Przepływu.' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx EDGE_CONDITIONS[4] + IdeaProcessFlowTool.tsx handleEdgeConditionChange:942',
  },
  {
    id: 'idea.edge.pf_delete',
    label: { pl: 'Usuń połączenie', en: 'Delete connection' },
    icon: 'Trash2',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.pf_delete', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'useProcessFlowNodes.ts deleteSelected:70 → pushUndo():83 przed usunięciem (stos Ctrl+Z).',
    },
    destructive: true,
    teresa: {
      description:
        'Usuwa wskazane połączenie Przepływu na trwałe (cofnięcie tylko przez Ctrl+Z w tej samej sesji). UWAGA (jak przy `idea.edge.pf_insert_node`): `deleteSelected()` w Przepływie działa na AKTUALNIE ZAZNACZONYM elemencie (węźle LUB krawędzi), nie na dowolnym `edgeId` — realnie usunie to połączenie tylko, gdy jest ono zaznaczone na płótnie (tak jak dziś prawy klik, który zaznacza krawędź przed otwarciem menu). Świadomie NIE rozszerzono `idea.edge.delete` (Tablica/Mapa myśli, adresowane po edgeId) — inny mechanizm. `edgeId` w kontrakcie jest informacyjny — realnie liczy się zaznaczenie.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: {
            type: 'string',
            description: 'Id połączenia (informacyjnie — realnie liczy się zaznaczenie na płótnie).',
          },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/IdeaProcessFlowTool.tsx onDelete → deleteSelected() (~linia 3816) + processflow/useProcessFlowNodes.ts:70 (też szyna pf_delete, processflow/useProcessFlowQuickActions.ts:185 — REUŻYTY odbiornik, nie duplikowany)',
  },
  // ── N6 kontynuacja (2026-08-09) — Process Flow NODE menu
  // (`ProcessFlowContextMenu.tsx`'s `getNodeContextActions`, 8 pozycji) +
  // dual-surface `ProcessFlowFloatingToolbar.tsx` (7 przycisków). Ani
  // `ProcessFlowContextMenu.tsx`, ani wywołania obu komponentów w
  // `IdeaProcessFlowTool.tsx` NIE są dotykane (ten sam wybór co edge-menu
  // 9182ae70cd) — klik człowieka na OBU powierzchniach zostaje 1:1 taki, jaki
  // był. Poniższe wpisy dają Teresie/nie-UI wywołującym drugą ścieżkę tylko
  // tam, gdzie jest ona realna i nie-spekulatywna.
  //
  // Zakres reużycia cross-tool (Z1), sprawdzone PRZED dopisaniem:
  //  • duplicate/delete → ROZSZERZONE `idea.node.duplicate`/`idea.node.delete`
  //    (Tablica) wyżej — `duplicateSelected()`/`deleteSelected()` w
  //    `useProcessFlowNodes.ts` operują na PŁASKIM zaznaczeniu płótna,
  //    dokładnie jak Tablicy wersja (NIE jak Mapy myśli `mm_duplicate`/
  //    `mm_delete`, zakotwiczone pod rodzicem — stąd Mapa myśli świadomie NIE
  //    reużyła tych samych id). Dual-surface za darmo: floating toolbar
  //    „Duplikuj"/„Usuń" wołają TE SAME funkcje.
  //  • auto-layout → REUŻYTE `idea.view.auto_layout` (istniejące, `tools`
  //    już zawiera `process_flow`) — `handleAutoLayout()` przestawia CAŁY
  //    widok, nie tylko kliknięty węzeł, więc pozycja menu węzła jest
  //    dosłownie tą samą akcją co pozycja menu tła/Menu 3, nie wariantem.
  //  • copy DEKLINOWANE od `idea.node.copy` (Tablica): sprawdzone w
  //    `useProcessFlowNodes.ts` (`schowekRef`/`kopiujWezly`/`pasteClipboard`)
  //    — to REALNA kopia obiektu (węzeł+wewnętrzne krawędzie) do schowka
  //    NARZĘDZIA, konsumowana przez „Wklej" na płótnie, W PRZECIWIEŃSTWIE do
  //    Tablicy `idea.node.copy` (WB-CLIPBOARD-01: kopia SAMEGO TEKSTU do
  //    schowka systemowego, bez wklejenia obiektu). Materialnie inny
  //    mechanizm — nowe id, nie reuse.
  //  • edit DEKLINOWANE od `idea.node.edit` (Tablica) i NIE tożsame z Mapy
  //    myśli `mm_edit` (osobne id per tool tam też) — sprawdzone: „Edit
  //    label" w Przepływie WYŁĄCZNIE bumpuje `editSignal` na węźle (przełącza
  //    tryb edycji inline), nie przyjmuje ani nie zapisuje `label` samo w
  //    sobie (w przeciwieństwie do Tablicy `idea.node.edit`, które od razu
  //    dispatchuje nową treść). Ten sam rodzaj różnicy co Mapa myśli już
  //    udokumentowała dla `mm_edit` — przełącznik trybu UI, nie mutacja.
  //  • properties DEKLINOWANE od Mapy myśli `idea.node.mm_open_detail`
  //    (inny komponent panelu, `ProcessFlowPropertiesPanel` vs
  //    `setDrawerNodeId`, zero współdzielonego kodu) — nowe id.
  //  • comments DEKLINOWANE od Tablicy `idea.node.comments` — SPRAWDZONE:
  //    `ProcessFlowNodeCommentThread.tsx`'s własny nagłówek mówi wprost, że
  //    dzieli warstwę trwałości z Tablicą (obie "blob-only via
  //    `node.data.comments[]`, no server API" — W PRZECIWIEŃSTWIE do Mapy
  //    myśli, która ma realne API serwerowe), ALE komponent/stan
  //    (`setCommentsPanelNodeId`) jest CAŁKOWICIE osobną implementacją, żadnego
  //    współdzielonego kodu z Tablicą — ten sam próg co reszta tego pliku
  //    (osobna implementacja = osobne id, mimo tej samej klasy trwałości).
  //  • artifact-links/chat: bez odpowiednika w rejestrze na żadnym innym
  //    narzędziu (Mapa myśli ma `mm_open_linked_artifacts`, ale inny
  //    mechanizm — 0/1/>1 rozgałęzienie zamiast prostego toggle popovera) —
  //    nowe id.
  //
  // Convert-to-initiative (E11 uczciwość, ta sama rodzina obaw co
  // E02-N5-CONVERT/Mapa myśli — patrz `docs/qa/ideas-complete-transformation-
  // 2026-08-09/02_EXECUTION_LEDGER.csv` wiersz E02-N5-CONVERT dla pełnego
  // kontekstu): Przepływ NIE cierpi na to samo (kaskada do potomków mimo
  // etykiety „Convert" bez „branch") — konwersja Przepływu bierze WĘZŁY, nie
  // poddrzewo (Przepływ nie ma pojęcia rodzic/dziecko). Ma INNY, nowo
  // odkryty defekt: `handleConvert()` wysyła `{selectedIds, activeTool}`, ale
  // `IdeaMapWorkspace.tsx`'s `CONVERT_PREFIX_MAP` odbiornik czyta WYŁĄCZNIE
  // `eventDetail.nodeIds` — `selectedIds` jest polem MARTWYM. Efekt: konwersja
  // pada na `selection.ids` (stan całego workspace'u), NIE na węzeł, na
  // którym otwarto menu (prawy klik nie zaznacza — patrz wyżej). Tak jak
  // Mapa myśli: brak podglądu przed konwersją (`requiresPreview: false`
  // zgodne z rzeczywistością, nie z docelowym standardem rozdz. 10 §2.2),
  // backend zapisuje `outputLinks[]` + bezwarunkowe nadpisanie
  // `promoted_to`/`stage`, NIE append-only `conversions[]`/lineage z audytu
  // 09 §9 — udokumentowane jako luka, nie naprawione (poza zakresem).
  {
    id: 'idea.node.pf_properties',
    label: { pl: 'Otwórz właściwości', en: 'Open properties' },
    icon: 'Settings',
    scope: 'single_item',
    tools: ['process_flow'],
    // Dual-surface (2026-08-09): NAPRAWDĘ ta sama akcja co
    // `ProcessFlowFloatingToolbar.tsx`'s „Rename" (F2) — SPRAWDZONE w kodzie
    // (nie zgadywane): oba `onOpenProperties` (menu węzła) i `onRename`
    // (pływający pasek) wołają DOSŁOWNIE `() => setShowPropertiesPanel(true)`,
    // bez ŻADNEGO parametru różnicującego "otwórz właściwości" od "zmień
    // nazwę" — ten sam panel (`ProcessFlowPropertiesPanel`) otwiera się
    // identycznie z obu wejść, mimo dwóch różnych etykiet ("Open properties"
    // vs "Rename (F2)"), co może mylić użytkownika oczekującego skupienia na
    // polu nazwy przy „Rename" — panel nie robi nic specjalnego dla tego
    // wejścia. Udokumentowane uczciwie, nie ukryte.
    surfaces: ['context', 'floating'],
    shortcut: 'F2',
    handler: (ctx) => runProcessFlowNodeUiOnlyCallback('idea.node.pf_properties', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera panel właściwości wskazanego kroku Przepływu (etykieta, typ bramki, tor, metryki). Samo otwarcie nie mutuje danych — edycje dzieją się WEWNĄTRZ panelu, poza tą akcją. Ta sama akcja jest też przyciskiem „Rename (F2)" pływającego paska — obie wejścia otwierają identyczny panel, mimo różnych etykiet. DZIŚ NIEDOSTĘPNE dla Teresy — lokalny stan UI (`setShowPropertiesPanel`), bez odbiornika na szynie.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx getNodeContextActions id=properties:96 (onOpenProperties) + IdeaProcessFlowTool.tsx (~linia 3794) · dual-surface: ProcessFlowFloatingToolbar.tsx onRename prop (~linia 3485), IdeaProcessFlowTool.tsx onRename → setShowPropertiesPanel(true) — DOKŁADNIE ta sama funkcja',
  },
  {
    id: 'idea.node.pf_edit',
    label: { pl: 'Edytuj etykietę', en: 'Edit label' },
    icon: 'Pencil',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['context'],
    // NIE reużyto `idea.node.edit` (Tablica, dispatchuje nową `label` wprost)
    // ani nie wprowadzono jako wariant Mapy myśli `mm_edit` — SPRAWDZONE:
    // przełącza WYŁĄCZNIE tryb edycji inline (bumpuje `editSignal` na
    // `node.data`, `FlowNodeComponent` zaczyna edycję), treść zmienia się
    // dopiero gdy użytkownik wpisze tekst i odejdzie z pola — osobny
    // mechanizm (`onLabelChange`), bez własnej pozycji menu. Ten sam rodzaj
    // różnicy (przełącznik trybu UI vs mutacja danych) co Mapa myśli już
    // udokumentowała dla `mm_edit`.
    handler: (ctx) => runProcessFlowNodeUiOnlyCallback('idea.node.pf_edit', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Włącza tryb edycji etykiety wskazanego kroku Przepływu (kursor w polu tekstowym). Dziś dostępne WYŁĄCZNIE z menu prawego kliku na węzeł — sama zmiana treści i tak wymaga wpisania tekstu przez człowieka, więc nie ma dziś sensownego odpowiednika dla czatu.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx getNodeContextActions id=edit:103 (onEditLabel) + IdeaProcessFlowTool.tsx editSignal bump (~linia 3759)',
  },
  {
    id: 'idea.node.pf_copy',
    label: { pl: 'Kopiuj', en: 'Copy' },
    icon: 'Copy',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['context'],
    // NIE reużyto `idea.node.copy` (Tablica, WB-CLIPBOARD-01: kopia SAMEGO
    // TEKSTU do schowka systemowego, bez wklejenia obiektu) — SPRAWDZONE w
    // `useProcessFlowNodes.ts`: `kopiujWezly`/`copyNodeById` kopiują węzeł
    // (i jego wewnętrzne krawędzie) do `schowekRef` — schowka NARZĘDZIA
    // (React ref, nie schowka przeglądarki) — a „Wklej" na płótnie
    // (`pasteClipboard`) REALNIE wkleja te obiekty jako nowe elementy. To
    // realna kopia obiektu, materialnie inny mechanizm niż Tablicy wersja —
    // nowe id, nie reuse. Menu prawego kliku nie zaznacza klikniętego węzła
    // (patrz `idea.node.pf_edit`), więc `onCopy` w `IdeaProcessFlowTool.tsx`
    // woła `copyNodeById(nodeId)` (po id z zamknięcia menu), NIE
    // `copySelected()` — jedyna z ośmiu pozycji tego menu, która świadomie
    // obsługuje ten przypadek zamiast cicho nic nie robić.
    handler: (ctx) => runProcessFlowNodeUiOnlyCallback('idea.node.pf_copy', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Kopiuje wskazany krok Przepływu (i jego wewnętrzne połączenia) do schowka narzędzia — realna kopia obiektu, konsumowana przez „Wklej" na płótnie (nie schowek systemowy — to nie jest wariant Tablicy `idea.node.copy`, który kopiuje tylko tekst). Dziś dostępne WYŁĄCZNIE z menu prawego kliku — schowek to zmienna w przeglądarce, bez odbiornika na szynie.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx getNodeContextActions id=copy:119 (onCopy) + IdeaProcessFlowTool.tsx copyNodeById (~linia 3778) + useProcessFlowNodes.ts kopiujWezly/copyNodeById:186-215',
  },
  {
    id: 'idea.node.pf_ai_rewrite_step',
    label: { pl: 'AI: przeredaguj krok', en: 'AI: rewrite step' },
    icon: 'Sparkles',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runProcessFlowAIRewriteStepCallback(ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'createStepRewriteProposal (generatorType: edit_step) → presentBatch → AIProposalPanel (accept/reject); odrzucenie = zero zmian. Rozdz. 09 §3 nazywa to WZORCEM DO SKOPIOWANIA — najlepiej zbudowaną ścieżkę AI dziś w całym Idea Workspace (before/after walidacja + readback w podglądzie).',
    },
    teresa: {
      description:
        'Przeredagowuje wskazany krok Przepływu wg polecenia (realne AI — `edit_step` generator, `Api`/`generateAIProposal`, ZAWSZE do akceptacji w podglądzie z porównaniem przed/po i walidacją). Podaj `nodeId` kroku i `instruction` (co zmienić). W przeciwieństwie do Mapy myśli `idea.node.mm_ai_rewrite_node` (UI-only, bo zbiera polecenie przez blokujący `window.prompt()`) — ta akcja ma prawdziwą ścieżkę dla Teresy, bo UI Przepływu zbiera polecenie przez zwykły panel React, nie dialog przeglądarki.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id kroku Przepływu do przeredagowania.' },
          instruction: { type: 'string', description: 'Polecenie — co zmienić w treści kroku.' },
        },
        required: ['nodeId', 'instruction'],
      },
    },
    runtime: RUNTIME_PF_NODE_AI_REWRITE_STEP,
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx getNodeContextActions id=ai-rewrite-step:144 (onAIRewriteStep) + IdeaProcessFlowTool.tsx openStepRewrite:817 + createStepRewriteProposal (useProcessFlowAIProposal.ts:356) + processflow/useProcessFlowQuickActions.ts pf_ai_rewrite_step (nowy odbiornik, 2026-08-09)',
  },
  {
    id: 'idea.node.pf_convert_initiative',
    label: { pl: 'Konwertuj na inicjatywę', en: 'Convert to initiative' },
    icon: 'Rocket',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runProcessFlowConvertInitiativeCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'Api.convertMyIdea → nowy rekord Initiative; brak automatycznego cofnięcia (ten sam wzorzec co idea.workspace.convert/idea.node.mm_convert_initiative).',
    },
    destructive: false,
    teresa: {
      description:
        'Konwertuje wskazany krok Przepływu na Inicjatywę — tworzy nowy, trwały rekord w PMO. UWAGA (defekt odkryty przy tym wpisie, NIE naprawiony w UI): kliknięcie człowieka w menu wysyła pole `selectedIds`, którego odbiornik w powłoce nigdy nie czyta (czyta tylko `nodeIds`) — w praktyce UI konwertuje bieżące zaznaczenie płótna, NIE koniecznie krok, na którym otwarto menu (prawy klik go nie zaznacza). Ta ścieżka (Teresa) go NIE dziedziczy — woła `Api.convertMyIdea` wprost z poprawnym `nodeId`, więc jest bardziej wiarygodna niż dzisiejszy klik człowieka. Brak podglądu przed konwersją (przedistniejące, rozdz. 10 §2.2 tego wymaga docelowo). Podaj `nodeId`.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id kroku Przepływu do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx getNodeContextActions id=convert-initiative:155 (onConvertInitiative) + IdeaProcessFlowTool.tsx handleConvert:2361 + IdeaMapWorkspace.tsx CONVERT_PREFIX_MAP/handleQuickAction:1017-1045 (selectedIds/nodeIds mismatch discovered here) + Api.convertMyIdea (Teresa path, direct call, 2026-08-09)',
  },
  {
    id: 'idea.node.pf_artifact_links',
    label: { pl: 'Powiązane artefakty', en: 'Artifact links' },
    icon: 'Link2',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['floating'],
    // Wyłącznie na pływającym pasku — menu prawego kliku na węzeł NIE ma tej
    // pozycji (sprawdzone w `getNodeContextActions`, 8 pozycji bez tej). Bez
    // odpowiednika cross-tool: Mapa myśli ma `idea.node.mm_open_linked_artifacts`,
    // ale INNY mechanizm (0/1/>1 rozgałęzienie: 0→toast, 1→otwiera wprost,
    // >1→panel szczegółów), podczas gdy tu to prosty toggle popovera z listą
    // + usuwaniem pojedynczych linków — materialnie inny UX, nowe id.
    handler: (ctx) => runProcessFlowNodeUiOnlyCallback('idea.node.pf_artifact_links', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Pokazuje/ukrywa popover z artefaktami powiązanymi ze wskazanym krokiem Przepływu (lista + usuwanie pojedynczych linków). Samo przełączenie nie mutuje danych — usunięcie linku wewnątrz popovera tak, ale to osobny, niewystawiony tu mechanizm. DZIŚ NIEDOSTĘPNE dla Teresy — lokalny stan UI (`showLinks`), bez odbiornika na szynie.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowFloatingToolbar.tsx onClick → setShowLinks (~linia 111)',
  },
  {
    id: 'idea.node.pf_comments',
    label: { pl: 'Komentarze', en: 'Comments' },
    icon: 'MessageCircle',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['floating'],
    // NIE reużyto `idea.node.comments` (Tablica) mimo tej samej warstwy
    // trwałości ("blob-only via node.data.comments[], no server API" — tak
    // twierdzi nagłówek `ProcessFlowNodeCommentThread.tsx` wprost) —
    // implementacja (komponent, stan `setCommentsPanelNodeId`) jest
    // CAŁKOWICIE osobna, zero współdzielonego kodu z Tablicą. Ten sam próg co
    // reszta tego rejestru: osobna implementacja = osobne id, nawet gdy klasa
    // trwałości się zgadza.
    handler: (ctx) => runProcessFlowNodeUiOnlyCallback('idea.node.pf_comments', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera wątek komentarzy wskazanego kroku Przepływu (trwałość: blob w `node.data.comments[]`, bez osobnego API serwerowego — jak Tablica, w przeciwieństwie do Mapy myśli, która ma realne API). Samo otwarcie nie mutuje danych. DZIŚ NIEDOSTĘPNE dla Teresy — lokalny stan UI (`setCommentsPanelNodeId`), bez odbiornika na szynie.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowFloatingToolbar.tsx onClick → onOpenComments (~linia 128) + IdeaProcessFlowTool.tsx setCommentsPanelNodeId (~linia 3500)',
  },
  {
    id: 'idea.node.pf_open_chat',
    label: { pl: 'Zapytaj AI', en: 'Ask AI' },
    icon: 'MessageSquare',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['floating'],
    handler: (ctx) => runProcessFlowNodeUiOnlyCallback('idea.node.pf_open_chat', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera czat Teresy z wstępnie wypełnionym kontekstem (tryb Przepływu, liczba kroków/torów, zaznaczone elementy, ostrzeżenia walidacji). Etykieta uczciwa wobec rzeczywistości (rozdz. 09 §2): to delegacja do rozmowy, NIE strukturalna zmiana danych — nie generuje propozycji, tylko wypełnia pole czatu tekstem, który człowiek może wysłać lub zmienić. DZIŚ NIEDOSTĘPNE jako osobna akcja dla Teresy (sama Teresa JEST czatem, do którego to prowadzi) — lokalny callback UI bez sensownego odpowiednika.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowFloatingToolbar.tsx onClick → onOpenChat (~linia 145) + IdeaProcessFlowTool.tsx handleOpenChatWithContext:2371',
  },
  // ── N6.3 (2026-08-10) — Process Flow CANVAS (tło) menu
  // (`ProcessFlowContextMenu.tsx`'s `getCanvasContextActions`, 4 pozycje) +
  // LANE (tor) controls (`LaneSystem.tsx` header, 6 stałych przycisków, BEZ
  // menu do przechwycenia — `scope: 'lane_frame'`, rozdz. 01 §3). Kolejność
  // deklaracji = kolejność w `getCanvasContextActions`, potem torowe.
  //
  // Canvas menu, 4/4 przejrzane:
  //  • "add-action" → REUŻYWA `idea.element.add` WYŻEJ (runtime `pf_add_step`
  //    już tworzy dokładnie węzeł kształtu 'action' — ten sam mechanizm co
  //    Menu 3 "Dodaj element" w Przepływie, potwierdzone w
  //    `useProcessFlowQuickActions.ts` komentarzem "same shape as
  //    pf_add_action"). Zero nowego wpisu.
  //  • "add-decision" → `idea.view.pf_add_decision` NIŻEJ, NOWY id: kształt
  //    'decision' nie ma odpowiednika w `idea.element.add` (ten dodaje
  //    WYŁĄCZNIE 'action'), więc to NIE jest ta sama akcja mimo sąsiedztwa w
  //    menu — `pf_add_decision` już miał gotowy, nieużywany odbiornik w
  //    `useProcessFlowQuickActions.ts` (linia 136 sprzed tej fali).
  //  • "paste" → `idea.view.pf_paste_at_point` NIŻEJ, NOWY id, UI-only:
  //    `pasteClipboard()` (weryfikacja PRZED wpisem, `useProcessFlowNodes.ts`)
  //    to REALNY schowek obiektów (nodes+edges w `schowekRef`, ta sama
  //    infrastruktura co `idea.node.pf_copy`) — nie atrapa. Deklarowane NIE
  //    reużywać Mapy myśli `idea.view.paste_at_point` (ta sama decyzja co
  //    `idea.node.pf_copy` vs `idea.node.copy`: osobny schowek, osobna
  //    implementacja, ten sam próg co reszta tego rejestru).
  //  • "layout" → REUŻYWA `idea.view.auto_layout` WYŻEJ (już `tools:
  //    ['mindmap', 'process_flow']`, już `surfaces: ['menu3', 'context']` —
  //    dokładnie ten sam `handleAutoLayout()`, co node-menu i Menu 3 wołają).
  //    Zero nowego wpisu.
  //
  // Lane controls, scope `lane_frame` (PIERWSZE użycie w rejestrze — rozdz.
  // 01 §3 „tor, ramka, obszar, sekcja"; rozdz. 08 §5 potwierdza `lane_frame`
  // jako zakres kontenera Przepływu). Whiteboard ma pojęcie "ramki" (frame),
  // ale rozdz. 08 §5 dokumentuje, że jej WŁASNE operacje kontenerowe
  // (Rozgrupuj/Zmień kolor obszaru/Usuń ramkę) same w sobie NIE są dziś
  // zaimplementowane ("Grupuj/Rozgrupuj tylko z paska zaznaczenia... brak
  // dedykowanego menu") — nie ma więc PO DRUGIEJ STRONIE nic realnego z
  // pasującym mechanizmem do porównania, więc wszystkie sześć poniżej są
  // `tools: ['process_flow']` bez prób reużycia, świadomie (Z1: reużycie
  // wymaga PASUJĄCEGO mechanizmu, nie samej etykiety).
  //
  // Resize (7. operacja toru — przeciąganie dolnej krawędzi pasma) ŚWIADOMIE
  // BEZ wpisu w rejestrze: to ciągły gest wskaźnika (`onPointerMove` co klatkę
  // podczas przeciągania), nie dyskretna komenda — "akcja" Teresy typu
  // `idea.lane.pf_resize({ laneId, height })` byłaby wymyśloną z powietrza
  // zdolnością (Teresa nigdy nie przeciąga myszką), nie odzwierciedleniem
  // istniejącego kliku, więc pominięta zgodnie z zasadą „bez spekulatywnej
  // infrastruktury" już stosowaną gdzie indziej w tym pliku (patrz
  // `runToolbarUiOnlyCallback`). PRZY OKAZJI złapany prawdziwy, osobny defekt:
  // `handleLaneResize` (IdeaProcessFlowTool.tsx) w ogóle NIE wołało
  // `pushUndo()` — Ctrl+Z nie cofał zmiany wysokości toru. NAPRAWIONE w tej
  // fali (nie tylko udokumentowane): `LaneSystem.tsx`'s `startResize` dostał
  // nowy, opcjonalny prop `onResizeStart`, wołany RAZ na `pointerdown`, PRZED
  // pierwszym `onResize` — jeden snapshot na przeciągnięcie, nie jeden na
  // klatkę (co zalałoby stos cofania). Nie jest to wpis rejestru (gest, nie
  // komenda), ale jest to prawdziwa naprawa bezpieczeństwa danych.
  {
    id: 'idea.view.pf_add_decision',
    label: { pl: 'Dodaj decyzję', en: 'Add decision' },
    icon: 'GitBranch',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runByTool('idea.view.pf_add_decision', RUNTIME_PF_ADD_DECISION, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'addNode() → pushUndo() w IdeaProcessFlowTool.tsx:1536 (ta sama funkcja co „Dodaj akcję").',
    },
    teresa: {
      description:
        'Dodaje nowy węzeł typu Decyzja (romb) do otwartego Przepływu. Klik człowieka z menu tła umieszcza węzeł DOKŁADNIE w miejscu prawego kliku — Teresa (bez współrzędnych ekranu) dostaje to samo `addNode(\'decision\')` BEZ pozycji, więc węzeł ląduje w domyślnym miejscu układu, nie precyzyjnie tam, gdzie „powinien" wg rozmowy. Ta sama, już istniejąca luka co Menu 3 „Dodaj element" (`idea.element.add`) — nie nowa.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx getCanvasContextActions „add-decision" (`onAddNode(\'decision\')`) + processflow/useProcessFlowQuickActions.ts pf_add_decision (odbiornik istniał już przed tą falą, bez wołającego z rejestru)',
  },
  {
    id: 'idea.view.pf_paste_at_point',
    label: { pl: 'Wklej elementy', en: 'Paste elements' },
    icon: 'Clipboard',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['context'],
    shortcut: '⌘V',
    handler: (ctx) => runProcessFlowPaneUiOnlyCallback('idea.view.pf_paste_at_point', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'pasteClipboard() → wstawKopie() → pushUndo() w useProcessFlowNodes.ts:129.',
    },
    teresa: {
      description:
        'Wkleja zawartość schowka NARZĘDZIA Przepływu (kroki + połączenia między nimi skopiowane przez „Kopiuj"/`idea.node.pf_copy`) w miejscu kliknięcia, jako nowe elementy. Dziś dostępne WYŁĄCZNIE z menu prawego kliku na tło — schowek żyje w `useRef` przeglądarki (nie na serwerze), Teresa tego jeszcze nie wywoła. Ta sama uczciwa granica co Mapy myśli „Wklej węzły" (`idea.view.paste_at_point`).',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx getCanvasContextActions „paste" (`onPaste` → `pasteClipboard()`) + useProcessFlowNodes.ts pasteClipboard/schowekRef',
  },
  {
    id: 'idea.lane.pf_rename',
    label: { pl: 'Zmień nazwę toru', en: 'Rename lane' },
    icon: 'Pencil',
    scope: 'lane_frame',
    tools: ['process_flow'],
    surfaces: ['inline'],
    handler: (ctx) => runLaneParamCallback('idea.lane.pf_rename', ctx, { label: ctx.params?.label }),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'handleLaneRename() → pushUndo() w useProcessFlowNodes.ts:281.',
    },
    teresa: {
      description:
        'Zmienia etykietę wskazanego toru Przepływu. W UI: podwójny klik na nazwę toru w nagłówku pasma. Podaj `laneId` i nową `label`.',
      parameters: {
        type: 'object',
        properties: {
          laneId: { type: 'string', description: 'Id toru Przepływu.' },
          label: { type: 'string', description: 'Nowa nazwa toru.' },
        },
        required: ['laneId', 'label'],
      },
    },
    source: 'src/components/MyWork/processflow/LaneSystem.tsx LaneBackground onDoubleClick → onRename prop',
  },
  {
    id: 'idea.lane.pf_move_up',
    label: { pl: 'Przesuń tor w górę', en: 'Move lane up' },
    icon: 'ArrowDownUp',
    scope: 'lane_frame',
    tools: ['process_flow'],
    surfaces: ['inline'],
    handler: (ctx) => runLaneParamCallback('idea.lane.pf_move_up', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'handleLaneMoveUp() → pushUndo() w useProcessFlowNodes.ts:348.',
    },
    teresa: {
      description:
        'Przesuwa wskazany tor o jedną pozycję w górę w kolejności torów Przepływu. Wyszarzone/bez efektu, gdy tor jest już pierwszy (tak jak dziś w nagłówku pasma). Podaj `laneId`.',
      parameters: {
        type: 'object',
        properties: { laneId: { type: 'string', description: 'Id toru Przepływu.' } },
        required: ['laneId'],
      },
    },
    source: 'src/components/MyWork/processflow/LaneSystem.tsx LaneBackground przycisk „Move up" → onMoveUp prop',
  },
  {
    id: 'idea.lane.pf_move_down',
    label: { pl: 'Przesuń tor w dół', en: 'Move lane down' },
    icon: 'ArrowDownUp',
    scope: 'lane_frame',
    tools: ['process_flow'],
    surfaces: ['inline'],
    handler: (ctx) => runLaneParamCallback('idea.lane.pf_move_down', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'handleLaneMoveDown() → pushUndo() w useProcessFlowNodes.ts:364.',
    },
    teresa: {
      description:
        'Przesuwa wskazany tor o jedną pozycję w dół w kolejności torów Przepływu. Wyszarzone/bez efektu, gdy tor jest już ostatni (tak jak dziś w nagłówku pasma). Podaj `laneId`.',
      parameters: {
        type: 'object',
        properties: { laneId: { type: 'string', description: 'Id toru Przepływu.' } },
        required: ['laneId'],
      },
    },
    source: 'src/components/MyWork/processflow/LaneSystem.tsx LaneBackground przycisk „Move down" → onMoveDown prop',
  },
  {
    id: 'idea.lane.pf_color',
    label: { pl: 'Zmień kolor toru', en: 'Change lane color' },
    icon: 'Palette',
    scope: 'lane_frame',
    tools: ['process_flow'],
    surfaces: ['inline'],
    handler: (ctx) => runLaneParamCallback('idea.lane.pf_color', ctx, { color: ctx.params?.color }),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'handleLaneColorChange() → pushUndo() w useProcessFlowNodes.ts:324.',
    },
    teresa: {
      description:
        'Ustawia kolor tła wskazanego toru Przepływu na jeden z 10 gotowych odcieni palety (`LANE_COLORS` w `LaneSystem.tsx`, hex). Podaj `laneId` i `color` (hex, np. „#dbeafe" — wartość spoza tej dziesiątki też się zapisze, ale w UI nie będzie zaznaczona jako aktywny swatch).',
      parameters: {
        type: 'object',
        properties: {
          laneId: { type: 'string', description: 'Id toru Przepływu.' },
          color: { type: 'string', description: 'Kolor tła toru (hex).' },
        },
        required: ['laneId', 'color'],
      },
    },
    source:
      'src/components/MyWork/processflow/LaneSystem.tsx LaneBackground selektor kolorów → onColorChange prop',
  },
  {
    id: 'idea.lane.pf_toggle_collapse',
    label: { pl: 'Zwiń/rozwiń tor', en: 'Collapse/expand lane' },
    icon: 'ChevronDown',
    scope: 'lane_frame',
    tools: ['process_flow'],
    surfaces: ['inline'],
    handler: (ctx) => runLaneParamCallback('idea.lane.pf_toggle_collapse', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'handleLaneToggleCollapse() → pushUndo() w IdeaProcessFlowTool.tsx:2107 (F5a A3).',
    },
    teresa: {
      description:
        'Przełącza wskazany tor Przepływu między pełnym a zwiniętym pasmem (`lanes[].collapsed`). Jeden klik = jedno przełączenie w drugą stronę — kolejne wywołanie cofa. Podaj `laneId`.',
      parameters: {
        type: 'object',
        properties: { laneId: { type: 'string', description: 'Id toru Przepływu.' } },
        required: ['laneId'],
      },
    },
    source:
      'src/components/MyWork/processflow/LaneSystem.tsx LaneBackground przycisk zwiń/rozwiń → onToggleCollapse prop',
  },
  {
    id: 'idea.lane.pf_delete',
    label: { pl: 'Usuń tor', en: 'Delete lane' },
    icon: 'X',
    scope: 'lane_frame',
    tools: ['process_flow'],
    surfaces: ['inline'],
    handler: (ctx) => runLaneParamCallback('idea.lane.pf_delete', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'handleLaneDelete() → pushUndo() w useProcessFlowNodes.ts:294 (przed reasygnacją węzłów + usunięciem toru).',
    },
    // Trwałe usunięcie toru z grafu (i przeniesienie/odpięcie jego węzłów —
    // patrz `handleLaneDelete` w `useProcessFlowNodes.ts`). Undo lokalny
    // (Ctrl+Z), stąd `destructive` osobno od `undo`, jak przy `idea.edge.delete`.
    destructive: true,
    teresa: {
      description:
        'Usuwa wskazany tor Przepływu na trwałe (jego węzły przechodzą na kolejny pozostały tor, nie znikają; cofnięcie tylko przez Ctrl+Z w tej samej sesji przeglądarki). ZNANA LUKA (sprawdzona w kodzie, nie naprawiana w tym wpisie — poza zakresem wiringu rejestru): `handleLaneDelete` na JEDYNYM pozostałym torze wychodzi wcześnie i nic nie robi, BEZ żadnego komunikatu (`useProcessFlowNodes.ts:293`, `if (locked || lanes.length <= 1) return;`) — cichy brak reakcji, dokładnie to, czego zakazuje rozdz. 01 §3 pkt 8. W UI przycisk jest wtedy ukryty (`laneCount > 1` w `LaneSystem.tsx`), więc człowiek nigdy tego nie zobaczy — ale Teresa, wywołując po `laneId` bezpośrednio, dostanie fałszywe „ok" bez żadnej zmiany. Podaj `laneId`.',
      parameters: {
        type: 'object',
        properties: { laneId: { type: 'string', description: 'Id toru Przepływu.' } },
        required: ['laneId'],
      },
    },
    source: 'src/components/MyWork/processflow/LaneSystem.tsx LaneBackground przycisk „Delete lane" → onDelete prop',
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
  // ── N7 kontynuacja (2026-08-09) — IdeaCanvasContextMenu.tsx, Whiteboard
  // node/pane PPM. Ten sam komponent jest importowany też przez
  // IdeaProcessFlowTool.tsx, ale — zweryfikowane grepem po `<IdeaCanvasContextMenu`
  // — Przepływ go dziś NIE RENDERUJE (ma własny `ProcessFlowContextMenu`,
  // decyzja "M07 F5b B2" udokumentowana komentarzem w IdeaProcessFlowTool.tsx:3730);
  // jedyny żywy renderer to IdeaWhiteboardTool.tsx z `activeTool={'whiteboard'}`
  // na sztywno. Te 20 wpisów mają więc `tools: ['whiteboard']`, zero ryzyka dla
  // Przepływu — nie ma go tu czego regresować.
  //
  // Pierwsze użycie zakresu `selected_items` w rejestrze: 5 z tych wpisów
  // (duplicate/bring_to_front/send_to_back/lock/delete) operują na CAŁYM
  // bieżącym zaznaczeniu płótna (funkcje `*Selected` już wspólne z
  // WhiteboardSelectionBar), nie tylko na węźle, na którym otwarto menu —
  // stąd `selected_items`, odróżnione od `single_item` (edit/copy/AI-node/
  // attach/comments, które działają na `target.nodeId` konkretnie klikniętym).
  // Namespace `idea.node.*` obejmuje oba zakresy (jak `idea.edge.*` obejmuje
  // jeden `scope`), bo z punktu widzenia menu to jedna rodzina "operacje na
  // węźle/węzłach"; `idea.canvas.*` dla 4 pozycji tła (scope `current_view`,
  // bez kolizji z istniejącymi `idea.canvas.*` wpisami toolbara — inne id-ki).
  {
    id: 'idea.node.edit',
    label: { pl: 'Edytuj', en: 'Edit' },
    icon: 'Pencil',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runNodeEditLabelCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'ZASTRZEŻENIE (odkryte przy tym wpisie, nie naprawiane tu): odbiornik idea-workspace-node-update w IdeaWhiteboardTool.tsx:2551-2569 NIE woła pushUndoSnapshot() przed setNodes — w przeciwieństwie do duplicate/delete/lock/layer poniżej, edycja etykiety węzła nie trafia dziś na stos Ctrl+Z (prawdziwe też przed tym wpisem — handleBaseAction "edit" też nigdy tego nie wołał).',
    },
    teresa: {
      description:
        'Zmienia etykietę (treść) wskazanego elementu na Tablicy. Podaj `nodeId` elementu i nową `label`.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id elementu na Tablicy.' },
          label: { type: 'string', description: 'Nowa treść etykiety.' },
        },
        required: ['nodeId', 'label'],
      },
    },
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx BASE_NODE_ACTIONS kind=edit + handleBaseAction:403-416',
  },
  {
    id: 'idea.node.copy',
    label: { pl: 'Kopiuj', en: 'Copy' },
    icon: 'Clipboard',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.copy', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        // WB-CLIPBOARD-01 (docs/qa/ideas-complete-transformation-2026-08-09/02_EXECUTION_LEDGER.csv):
        // to WYŁĄCZNIE kopia TEKSTU etykiety do schowka systemowego — NIE jest
        // to kopia obiektu (brak wklejenia węzła/krawędzi). Świadomie
        // nienaprawione tym wpisem (osobno logowany defekt P1).
        'Kopiuje treść etykiety wskazanego elementu do schowka jako TEKST — to nie jest kopia obiektu (brak wklejenia całego elementu). Dostępne tylko z menu przeglądarki, nie z czatu.',
    },
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx BASE_NODE_ACTIONS kind=copy + handleBaseAction:417-419 (WB-CLIPBOARD-01)',
  },
  {
    id: 'idea.node.duplicate',
    label: { pl: 'Duplikuj', en: 'Duplicate' },
    icon: 'Copy',
    scope: 'selected_items',
    // Rozszerzone o `process_flow` (2026-08-09, N6 kontynuacja — patrz
    // komentarz przy `RUNTIME_NODE_DUPLICATE` wyżej dla pełnego uzasadnienia):
    // `duplicateSelected()` w `useProcessFlowNodes.ts` operuje na PŁASKIM
    // zaznaczeniu płótna, identycznie jak Tablicy wersja — genuine reuse, nie
    // nowe id. `surfaces` dostaje `floating`, bo `ProcessFlowFloatingToolbar.tsx`
    // ma przycisk „Duplikuj" wołający TĘ SAMĄ funkcję (`onDuplicate=
    // {duplicateSelected}`) — Tablica dziś nie ma zarejestrowanej powierzchni
    // `floating` dla tej akcji (ma `WhiteboardSelectionBar` używającą tej samej
    // funkcji, ale niepodłączoną do rejestru — poza zakresem tego wpisu).
    tools: ['whiteboard', 'process_flow'],
    surfaces: ['context', 'floating'],
    handler: (ctx) => runToolbarBusAction('idea.node.duplicate', RUNTIME_NODE_DUPLICATE, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Tablica: useWhiteboardNodes.ts duplicateSelected:131-161 → pushSnapshot() (stos Ctrl+Z). Przepływ (2026-08-09): useProcessFlowNodes.ts duplicateSelected:227 → pushUndo():231 (stos Ctrl+Z, już obecne, nic nie dopisywano).',
    },
    teresa: {
      description:
        'Duplikuje zaznaczone elementy (Tablica lub Przepływ). UWAGA: działa na to, co jest DZIŚ zaznaczone na płótnie w przeglądarce użytkownika (ta sama funkcja co przycisk "Duplikuj") — nie przyjmuje `nodeId`, więc bez wcześniejszego zaznaczenia przez użytkownika nie ma czego duplikować. Na Przepływie menu prawego kliku na węzeł NIE zaznacza go (celowe zachowanie, patrz `idea.node.pf_edit`) — jeśli klikniesz prawym na węzeł, który nie był wcześniej zaznaczony lewym kliknięciem, ta pozycja menu po cichu nic nie zrobi (przedistniejąca luka, niedotknięta tym wpisem).',
    },
    runtime: RUNTIME_NODE_DUPLICATE,
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx BASE_NODE_ACTIONS kind=duplicate + useWhiteboardNodes.ts:131 (Tablica) · src/components/MyWork/IdeaProcessFlowTool.tsx onDuplicate → duplicateSelected() (~linia 3786, menu węzła) + ProcessFlowFloatingToolbar.tsx onDuplicate prop (~linia 3486) + useProcessFlowNodes.ts:227 (Przepływ, 2026-08-09)',
  },
  {
    id: 'idea.node.bring_to_front',
    label: { pl: 'Warstwa: na wierzch', en: 'Layer: bring to front' },
    icon: 'BringToFront',
    scope: 'selected_items',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.bring_to_front', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'IdeaWhiteboardTool.tsx bringSelectedToFront:3043-3052 → pushUndoSnapshot()',
    },
    teresa: {
      description:
        'Przenosi zaznaczone elementy na wierzch (kolejność rysowania) na Tablicy. Dziś dostępne WYŁĄCZNIE z menu prawego kliku — brak odbiornika na szynie, Teresa tego jeszcze nie wywoła.',
    },
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx BASE_NODE_ACTIONS kind=bring_to_front + IdeaWhiteboardTool.tsx:3043',
  },
  {
    id: 'idea.node.send_to_back',
    label: { pl: 'Warstwa: pod spód', en: 'Layer: send to back' },
    icon: 'SendToBack',
    scope: 'selected_items',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.send_to_back', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'IdeaWhiteboardTool.tsx sendSelectedToBack:3054-3063 → pushUndoSnapshot()',
    },
    teresa: {
      description:
        'Przenosi zaznaczone elementy pod spód (kolejność rysowania) na Tablicy. Dziś dostępne WYŁĄCZNIE z menu prawego kliku — brak odbiornika na szynie, Teresa tego jeszcze nie wywoła.',
    },
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx BASE_NODE_ACTIONS kind=send_to_back + IdeaWhiteboardTool.tsx:3054',
  },
  {
    id: 'idea.node.lock',
    // Bazowa etykieta = stan "zablokuj" (jak w oryginalnym BASE_NODE_ACTIONS).
    // Komponent nadal robi lokalny swap na "Odblokuj"/"Unlock" wg
    // `target.nodeLocked`, dokładnie jak przed tym wpisem — rejestr nie modeluje
    // stanu per-instancja, tylko domyślną etykietę.
    label: { pl: 'Zablokuj', en: 'Lock' },
    icon: 'Lock',
    scope: 'selected_items',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.lock', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'IdeaWhiteboardTool.tsx lockSelected:3023-3038 → pushUndoSnapshot()',
    },
    teresa: {
      description:
        'Przełącza blokadę (edycja/przesuwanie/usuwanie) zaznaczonych elementów na Tablicy. Dziś dostępne WYŁĄCZNIE z menu prawego kliku — brak odbiornika na szynie, Teresa tego jeszcze nie wywoła.',
    },
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx BASE_NODE_ACTIONS kind=lock + IdeaWhiteboardTool.tsx:3023',
  },
  {
    id: 'idea.node.delete',
    label: { pl: 'Usuń', en: 'Delete' },
    icon: 'Trash2',
    scope: 'selected_items',
    // Rozszerzone o `process_flow` (2026-08-09, N6 kontynuacja) — patrz
    // uzasadnienie przy `idea.node.duplicate` wyżej i przy
    // `RUNTIME_NODE_DELETE`: `deleteSelected()` w `useProcessFlowNodes.ts`
    // usuwa CZYMKOLWIEK jest dziś zaznaczone (węzły LUB krawędzie), tak samo
    // ogólnie jak Tablicy wersja ("zaznaczone elementy", nie "węzły") —
    // genuine reuse. `floating`: `ProcessFlowFloatingToolbar.tsx` ma przycisk
    // „Usuń" wołający TĘ SAMĄ funkcję (`onDelete={deleteSelected}`).
    tools: ['whiteboard', 'process_flow'],
    surfaces: ['context', 'floating'],
    handler: (ctx) => runToolbarBusAction('idea.node.delete', RUNTIME_NODE_DELETE, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Tablica: useWhiteboardNodes.ts deleteSelected:107-129 → pushSnapshot() (stos Ctrl+Z). Przepływ: useProcessFlowNodes.ts deleteSelected:70 → pushUndo():83 (stos Ctrl+Z, już obecne — ta sama funkcja już reużyta przez `idea.edge.pf_delete`, edge-menu wpis 2026-08-09).',
    },
    destructive: true,
    teresa: {
      description:
        'Usuwa zaznaczone elementy (Tablica lub Przepływ; cofnięcie przez Ctrl+Z w tej samej sesji). UWAGA: działa na to, co jest DZIŚ zaznaczone na płótnie w przeglądarce użytkownika — nie przyjmuje `nodeId`, więc bez wcześniejszego zaznaczenia przez użytkownika nie ma czego usunąć. Na Przepływie menu prawego kliku na węzeł NIE zaznacza go — jeśli klikniesz prawym na niezaznaczony węzeł, ta pozycja menu po cichu nic nie zrobi (przedistniejąca luka, ta sama co przy `idea.node.duplicate`, niedotknięta tym wpisem; krawędzie NIE mają tego problemu, bo prawy klik na krawędzi ZAZNACZA ją jawnie przed otwarciem menu — patrz `idea.edge.pf_delete`).',
    },
    runtime: RUNTIME_NODE_DELETE,
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx DESTRUCTIVE_NODE_ACTIONS kind=delete + useWhiteboardNodes.ts:107 (Tablica) · src/components/MyWork/IdeaProcessFlowTool.tsx onDelete → deleteSelected() (~linia 3793, menu węzła) + ProcessFlowFloatingToolbar.tsx onDelete prop (~linia 3487) + useProcessFlowNodes.ts:70 (Przepływ, 2026-08-09)',
  },
  {
    id: 'idea.node.expand',
    label: { pl: 'AI: Rozbuduj', en: 'AI: Expand' },
    icon: 'GitBranch',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.expand', ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'generateAIProposal(generatorType:"mindmap_expand") → onGenerateProposal → IdeaProposalReview (accept/reject)',
    },
    teresa: {
      description:
        'Proponuje rozbudowanie wskazanego elementu Tablicy o nowe powiązane elementy (AI). Zawsze do akceptacji w podglądzie. Dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=expand:166-174',
  },
  {
    id: 'idea.node.challenge',
    label: { pl: 'AI: Kwestionuj', en: 'AI: Challenge' },
    icon: 'Target',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.challenge', ctx),
    // Nie mutuje grafu — wysyła pytanie do czatu (onSendToChat), sam element
    // zostaje bez zmian.
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Wysyła do czatu pytanie kwestionujące wskazany element Tablicy (nie zmienia elementu — to prompt do rozmowy). Dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=challenge:175-183',
  },
  {
    id: 'idea.node.find_evidence',
    label: { pl: 'AI: Znajdź dowody', en: 'AI: Find evidence' },
    icon: 'Search',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.find_evidence', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Wysyła do czatu prośbę o dowody dla wskazanego elementu Tablicy (nie zmienia elementu — to prompt do rozmowy). Dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=evidence:184-192',
  },
  {
    id: 'idea.node.suggest_connections',
    label: { pl: 'AI: Sugeruj połączenia', en: 'AI: Suggest connections' },
    icon: 'Link2',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.suggest_connections', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Wysyła do czatu prośbę o sugestie połączeń dla wskazanego elementu Tablicy (nie zmienia elementu — to prompt do rozmowy). Dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=connections:193-201',
  },
  {
    id: 'idea.node.attach_knowledge',
    label: { pl: 'Dołącz wiedzę', en: 'Attach knowledge' },
    icon: 'BookOpen',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.attach_knowledge', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        // Sprawdzone: `attach_artifact` na szynie `idea-workspace-quick-action`
        // MA odbiornik (IdeaMapWorkspace.tsx:985), ale czyta `selectionRef`
        // (bieżące zaznaczenie UI) i CAŁKOWICIE IGNORUJE `detail.nodeId` — nie
        // jest więc adresowalne po id z czatu, tylko z żywego zaznaczenia w
        // przeglądarce. Ta sama klasa ograniczenia co "martwy fallback
        // ctx.selection" udokumentowany przy idea.edge.* — tu nawet gorzej,
        // bo nie ma ŻADNEJ parametrowej ścieżki. Stąd UI-only, nie bus-wired.
        'Otwiera panel dołączania wiedzy (Vault) dla wskazanego elementu Tablicy. Dziś dostępne WYŁĄCZNIE z menu prawego kliku — odbiornik na szynie istnieje, ale działa na bieżące zaznaczenie w przeglądarce, nie na `nodeId` z czatu.',
    },
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=attach_knowledge:202-208 + IdeaMapWorkspace.tsx:985 (attach_artifact, selection-only)',
  },
  {
    id: 'idea.node.comments',
    label: { pl: 'Komentarze', en: 'Comments' },
    icon: 'MessageSquare',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.comments', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera panel komentarzy wskazanego elementu Tablicy (lokalny stan panelu, nie mutuje elementu). Dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=wb_comments:211-218',
  },
  {
    id: 'idea.node.ai_find_themes',
    label: { pl: 'AI: Znajdź tematy', en: 'AI: Find themes' },
    icon: 'Layers',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runToolbarBusAction('idea.node.ai_find_themes', RUNTIME_AI_FIND_THEMES, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'POST /my-ideas/:id/ai-generate (wb_find_themes) → IdeaProposalReview',
    },
    teresa: {
      description:
        // Wersja tej samej AI generacji co `idea.ai.find_themes` (rail/panel),
        // ale wywołana z menu węzła: ludzki klik ogniskuje seedText na
        // wskazanym elemencie ("Focus on: <label>"), a dispatch na szynę
        // (Teresa) NIE niesie tego ogniska — trafia do `runWhiteboardAIAction`,
        // który generuje z całej Tablicy + bieżącym zaznaczeniem UI (jeśli
        // jest), nie z konkretnego `nodeId`. Uczciwie różne zachowanie
        // UI-vs-Teresa, nie regres — świadomy kompromis zamiast nowej szyny.
        'Grupuje karteczki Tablicy w tematy i proponuje ramkę dla każdego (do akceptacji). Wywołane z czatu działa na całej Tablicy (i bieżącym zaznaczeniu w przeglądarce, jeśli jest) — nie da się dziś ograniczyć do jednego wskazanego elementu spoza UI.',
    },
    runtime: RUNTIME_AI_FIND_THEMES,
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=wb_find_themes:219-228 + useWhiteboardQuickActions.ts AI_ACTION_MAP',
  },
  {
    id: 'idea.node.ai_name_clusters',
    label: { pl: 'AI: Nazwij klastry', en: 'AI: Name clusters' },
    icon: 'Tags',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) =>
      runToolbarBusAction('idea.node.ai_name_clusters', RUNTIME_AI_NAME_CLUSTERS, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'POST /my-ideas/:id/ai-generate (wb_name_clusters) → IdeaProposalReview',
    },
    teresa: {
      description:
        'Nadaje nazwy skupiskom karteczek na Tablicy (do akceptacji). Wywołane z czatu działa na całej Tablicy, nie tylko na jednym wskazanym elemencie spoza UI (patrz idea.node.ai_find_themes).',
    },
    runtime: RUNTIME_AI_NAME_CLUSTERS,
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=wb_name_clusters:229-237 + useWhiteboardQuickActions.ts AI_ACTION_MAP',
  },
  {
    id: 'idea.node.ai_extract_actions',
    label: { pl: 'AI: Wyodrębnij akcje', en: 'AI: Extract actions' },
    icon: 'ListChecks',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) =>
      runToolbarBusAction('idea.node.ai_extract_actions', RUNTIME_AI_EXTRACT_ACTIONS, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'POST /my-ideas/:id/ai-generate (wb_extract_actions) → IdeaProposalReview',
    },
    teresa: {
      description:
        'Wyciąga konkretne działania z Tablicy jako nowe elementy (do akceptacji). Wywołane z czatu działa na całej Tablicy, nie tylko na jednym wskazanym elemencie spoza UI (patrz idea.node.ai_find_themes).',
    },
    runtime: RUNTIME_AI_EXTRACT_ACTIONS,
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=wb_extract_actions:238-246 + useWhiteboardQuickActions.ts AI_ACTION_MAP',
  },
  {
    id: 'idea.canvas.fill_gap',
    label: { pl: 'AI: Wypełnij luki', en: 'AI: Fill gaps' },
    icon: 'Lightbulb',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.canvas.fill_gap', ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'generateAIProposal(generatorType:"suggestions") → IdeaProposalReview',
    },
    teresa: {
      description:
        'Proponuje nowe elementy wypełniające luki na Tablicy (do akceptacji). Dziś dostępne WYŁĄCZNIE z menu prawego kliku na tle — brak odbiornika na szynie, Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/IdeaCanvasContextMenu.tsx EMPTY_ACTIONS id=fill_gap:250-257',
  },
  {
    id: 'idea.canvas.brainstorm_here',
    label: { pl: 'AI: Brainstorm tutaj', en: 'AI: Brainstorm here' },
    icon: 'Brain',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.canvas.brainstorm_here', ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'generateAIProposal(generatorType:"whiteboard_brainstorm") → IdeaProposalReview',
    },
    teresa: {
      description:
        'Generuje pomysły przy pozycji kliknięcia na Tablicy (do akceptacji). Dziś dostępne WYŁĄCZNIE z menu prawego kliku na tle — brak odbiornika na szynie, Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/IdeaCanvasContextMenu.tsx EMPTY_ACTIONS id=brainstorm:258-265',
  },
  {
    id: 'idea.canvas.to_mindmap',
    label: { pl: 'AI: Przekształć w mapę myśli', en: 'AI: Convert to mind map' },
    icon: 'Network',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.to_mindmap', RUNTIME_WB_TO_MINDMAP, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'POST /my-ideas/:id/ai-generate (wb_to_map_branches) → IdeaProposalReview',
    },
    teresa: {
      description:
        'Proponuje przekształcenie zawartości Tablicy w gałęzie Mapy myśli — wynik pokazuje się jako podgląd NA Tablicy, do akceptacji (nie tworzy sam z siebie nowej Mapy).',
    },
    runtime: RUNTIME_WB_TO_MINDMAP,
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx EMPTY_ACTIONS id=wb_to_map_branches:269-276 + useWhiteboardQuickActions.ts AI_ACTION_MAP',
  },
  {
    id: 'idea.canvas.to_table',
    label: { pl: 'AI: Przekształć w tabelę', en: 'AI: Convert to table' },
    icon: 'Table2',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.to_table', RUNTIME_WB_TO_TABLE, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'POST /my-ideas/:id/ai-generate (wb_to_table) → IdeaProposalReview',
    },
    teresa: {
      description:
        'Proponuje przekształcenie zawartości Tablicy w wiersze Tabeli — wynik pokazuje się jako podgląd NA Tablicy, do akceptacji (nie tworzy sam z siebie nowej Tabeli).',
    },
    runtime: RUNTIME_WB_TO_TABLE,
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx EMPTY_ACTIONS id=wb_to_table:277-285 + useWhiteboardQuickActions.ts AI_ACTION_MAP',
  },

  // ── Mapa myśli: menu tła (pane), N5 kontynuacja (2026-08-09) ─────────────
  // `PaneContextMenu.tsx`, 13 pozycji. Cztery bez odpowiednika: `idea.view.copy_selection`
  // /`cut_selection`/`paste_at_point` (schowek lokalny, patrz
  // `runMindmapPaneUiOnlyCallback`) są UI-only; `idea.view.add_root_topic` jest
  // hybrydowe (klik = pozycja pod kursorem, Teresa = offset od korzenia).
  // `idea.view.auto_layout` (wyżej, Krok „AI: rozwiń mapę" fala) JEST już
  // zarejestrowane z `tools: ['mindmap', 'process_flow']` i `surfaces` włącznie
  // z `'context'` — Menu tła NIE dostaje drugiego wpisu dla Auto-układu, tylko
  // odwołuje się do tego samego id (Z1, zero duplikacji).
  {
    id: 'idea.view.add_root_topic',
    label: { pl: 'Dodaj temat (do korzenia)', en: 'Add topic (to root)' },
    icon: 'Plus',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'N',
    handler: (ctx) => runToolbarBusAction('idea.view.add_root_topic', RUNTIME_PANE_ADD_ROOT, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'klik: pushUndo() w IdeaRecommendationMap.handlePaneContextAction (pane_add_node); Teresa: pushUndo() w useMindMapNodes.tsx addRootTopic (mm_add_root)',
    },
    teresa: {
      description:
        'Dodaje nowy, pusty temat połączony z korzeniem Mapy myśli. Z czatu ląduje w stałym miejscu obok korzenia (nie w miejscu kliknięcia — Teresa nie zna pozycji kursora).',
    },
    runtime: RUNTIME_PANE_ADD_ROOT,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:51 (pane_add_node)',
  },
  {
    id: 'idea.view.copy_selection',
    label: { pl: 'Kopiuj węzły', en: 'Copy nodes' },
    icon: 'ClipboardCopy',
    scope: 'selected_items',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘C',
    handler: (ctx) => runMindmapPaneUiOnlyCallback('idea.view.copy_selection', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Kopiuje zaznaczone węzły do schowka Mapy myśli. Dziś dostępne WYŁĄCZNIE z menu prawego kliku na tło — schowek jest stanem przeglądarki, Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:58 (pane_copy)',
  },
  {
    id: 'idea.view.cut_selection',
    label: { pl: 'Wytnij węzły', en: 'Cut nodes' },
    icon: 'Scissors',
    scope: 'selected_items',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘X',
    handler: (ctx) => runMindmapPaneUiOnlyCallback('idea.view.cut_selection', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'cutSelected() → pushUndo() w useMindMapNodes.tsx:1154',
    },
    teresa: {
      description:
        'Wycina zaznaczone węzły do schowka Mapy myśli (usuwa z płótna). Dziś dostępne WYŁĄCZNIE z menu prawego kliku na tło — schowek jest stanem przeglądarki, Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:65 (pane_cut)',
  },
  {
    id: 'idea.view.paste_at_point',
    label: { pl: 'Wklej węzły', en: 'Paste nodes' },
    icon: 'Clipboard',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘V',
    handler: (ctx) => runMindmapPaneUiOnlyCallback('idea.view.paste_at_point', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'pasteNodes() → pushUndo() w useMindMapNodes.tsx:1219',
    },
    teresa: {
      description:
        'Wkleja zawartość schowka Mapy myśli w miejscu kliknięcia. Dziś dostępne WYŁĄCZNIE z menu prawego kliku na tło — schowek jest stanem przeglądarki, Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:72 (pane_paste)',
  },
  {
    id: 'idea.view.select_all',
    label: { pl: 'Zaznacz wszystko', en: 'Select all' },
    icon: 'Grid3X3',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘A',
    handler: (ctx) => runToolbarBusAction('idea.view.select_all', RUNTIME_PANE_SELECT_ALL, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Zaznacza wszystkie węzły na otwartej Mapie myśli.',
    },
    runtime: RUNTIME_PANE_SELECT_ALL,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:80 (pane_select_all)',
  },
  {
    id: 'idea.view.fit_view',
    label: { pl: 'Dopasuj widok', en: 'Fit view' },
    icon: 'Maximize',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘0',
    handler: (ctx) => runToolbarBusAction('idea.view.fit_view', RUNTIME_PANE_FIT_VIEW, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Dopasowuje widok kamery tak, by cała Mapa myśli zmieściła się na ekranie.',
    },
    runtime: RUNTIME_PANE_FIT_VIEW,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:86 (pane_fit_view)',
  },
  {
    id: 'idea.view.auto_cluster',
    label: { pl: 'Auto-grupowanie', en: 'Auto-cluster' },
    icon: 'Layers',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runToolbarBusAction('idea.view.auto_cluster', RUNTIME_PANE_AUTO_CLUSTER, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'handlers.pushUndo() w useMindMapQuickActions.ts (blok mm_auto_cluster)',
    },
    teresa: {
      description:
        'Grupuje niepogrupowane węzły (bezpośrednio pod korzeniem) w tematyczne gałęzie na podstawie etykiet/tagów/typu semantycznego. Wymaga co najmniej dwóch niepogrupowanych węzłów.',
    },
    runtime: RUNTIME_PANE_AUTO_CLUSTER,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:98 (pane_auto_cluster)',
  },
  {
    id: 'idea.view.collapse_all',
    label: { pl: 'Zwiń wszystko', en: 'Collapse all' },
    icon: 'ChevronDown',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'Alt+0',
    handler: (ctx) => runToolbarBusAction('idea.view.collapse_all', RUNTIME_PANE_COLLAPSE_ALL, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Zwija wszystkie gałęzie Mapy myśli do samego korzenia (poziom 0).',
    },
    runtime: RUNTIME_PANE_COLLAPSE_ALL,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:106 (pane_collapse_all)',
  },
  {
    id: 'idea.view.fold_level_1',
    label: { pl: 'Pokaż poziom 1', en: 'Show level 1' },
    icon: 'ChevronDown',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'Alt+1',
    handler: (ctx) => runToolbarBusAction('idea.view.fold_level_1', RUNTIME_PANE_FOLD_1, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Zwija Mapę myśli tak, by widoczny był tylko pierwszy poziom gałęzi.',
    },
    runtime: RUNTIME_PANE_FOLD_1,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:112 (pane_fold_1)',
  },
  {
    id: 'idea.view.fold_level_2',
    label: { pl: 'Pokaż poziom 2', en: 'Show level 2' },
    icon: 'ChevronDown',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'Alt+2',
    handler: (ctx) => runToolbarBusAction('idea.view.fold_level_2', RUNTIME_PANE_FOLD_2, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Zwija Mapę myśli tak, by widoczne były dwa pierwsze poziomy gałęzi.',
    },
    runtime: RUNTIME_PANE_FOLD_2,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:118 (pane_fold_2)',
  },
  {
    id: 'idea.view.expand_all',
    label: { pl: 'Rozwiń wszystko', en: 'Expand all' },
    icon: 'ChevronDown',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'Alt+9',
    handler: (ctx) => runToolbarBusAction('idea.view.expand_all', RUNTIME_PANE_EXPAND_ALL, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Rozwija wszystkie zwinięte gałęzie Mapy myśli.',
    },
    runtime: RUNTIME_PANE_EXPAND_ALL,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:124 (pane_expand_all)',
  },
  {
    id: 'idea.ai.suggest_nodes',
    label: { pl: 'AI: Zasugeruj węzły', en: 'AI: Suggest nodes' },
    icon: 'Sparkles',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runToolbarBusAction('idea.ai.suggest_nodes', RUNTIME_PANE_AI_SUGGEST, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera czat z gotowym promptem proszącym AI o propozycje nowych gałęzi dla otwartej Mapy myśli. Nie zmienia mapy samo z siebie — to prośba o sugestię, nie wykonanie.',
    },
    runtime: RUNTIME_PANE_AI_SUGGEST,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:131 (pane_ai_suggest)',
  },

  // ─────────── N5 kontynuacja, druga fala (2026-08-09) — NodeContextMenu.tsx ───────────
  // Grupy Edit (8) + Structure (6) + Delete (1) = 15 pozycji. AI/Convert/
  // Convert-branch/Style&data ŚWIADOMIE NIETKNIĘTE (osobne przyszłe fale —
  // dotykanie ich teraz utrudniłoby review tego diffa).
  //
  // Cross-tool reuse (Z1), sprawdzone PRZED dopisaniem: Tablica ma już
  // `idea.node.edit`/`idea.node.copy`/`idea.node.duplicate`/`idea.node.delete`
  // (`tools: ['whiteboard']`). Dla KAŻDEJ z nich zdecydowano NIE reużywać id —
  // patrz komentarz przy odpowiednim wpisie niżej za powód (mechanizm i/lub
  // zakres różnią się materialnie, nie kosmetycznie).
  {
    id: 'idea.node.mm_edit',
    label: { pl: 'Edytuj', en: 'Edit' },
    icon: 'Edit3',
    scope: 'single_item',
    tools: ['mindmap'],
    // Dual-surface (2026-08-09): `FloatingNodeToolbar.tsx:302` ma `onClick`
    // wołający `onAction('ctx_edit')` — DOKŁADNIE ten sam lokalny id co
    // `NodeContextMenu.tsx`. ZASTRZEŻENIE odkryte przy tym wpisie, NIE
    // naprawione tutaj (poza zakresem — dotknięcie renderowania/dispatchu
    // 742-liniowego `FloatingNodeToolbar.tsx` to osobna fala): ten `onClick`
    // NIE woła `handleContextAction` — ma WŁASNY `onAction` prop
    // (`IdeaRecommendationMap.tsx:5649-5668`), który dla nierozpoznanych
    // lokalnych id-ków (w tym `ctx_edit`) po prostu odpala surowy
    // `window.dispatchEvent(...'idea-workspace-quick-action'..., {action:
    // 'ctx_edit', nodeId})` — string `'ctx_edit'` NIE MA odbiornika w
    // `useMindMapQuickActions.ts` (zweryfikowane grepem), więc przycisk
    // „Edytuj" na pływającym pasku jest DZIŚ MARTWY. Deklarujemy `'floating'`
    // w `surfaces` tylko jako uczciwe zadeklarowanie WŁAŚCICIELSTWA tej samej
    // akcji na tej powierzchni (dla przyszłego podłączenia) — samo dodanie
    // tego pola NIE naprawia klika (toolbar nie czyta jeszcze z rejestru).
    surfaces: ['context', 'floating'],
    shortcut: 'F2',
    // NIE reużyto `idea.node.edit` (Tablica): tam „Edytuj" = prompt() +
    // bezpośredni dispatch nowej `label` (`runNodeEditLabelCallback`,
    // realna mutacja treści). Tu „Edytuj" WYŁĄCZNIE przełącza tryb edycji
    // inline węzła (`_startEditing` na `data`, `startEditingSelected` w
    // `useMindMapNodes.tsx:964`) — sama treść zmienia się DOPIERO gdy
    // użytkownik wpisze tekst i odejdzie z pola (osobny mechanizm,
    // `onLabelChange`, bez własnej pozycji menu). To różnica w RODZAJU
    // (przełącznik trybu UI vs mutacja danych), nie kosmetyczna — stąd osobne
    // id zamiast rozszerzania `tools` istniejącego wpisu.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_edit', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Włącza tryb edycji etykiety wskazanego węzła Mapy myśli (kursor w polu tekstowym). Dziś dostępne WYŁĄCZNIE z menu prawego kliku/pływającego paska — sama zmiana treści i tak wymaga wpisania tekstu przez człowieka, więc nie ma dziś sensownego odpowiednika dla czatu.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:91 (ctx_edit)',
  },
  {
    id: 'idea.node.mm_open_detail',
    label: { pl: 'Otwórz szczegóły', en: 'Open details' },
    icon: 'ExternalLink',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // REUŻYWANY (N5 czwarta fala, 2026-08-09) także przez `ctx_quick_notes`
    // ("Notes") i `ctx_quick_tags` ("Tags") — SPRAWDZONE w
    // handleContextAction:4916-4918, nie spekulacja: obie pozycje wołają
    // DOSŁOWNIE `setDrawerNodeId(ctxNode.id)`, identycznie jak `ctx_open_detail`
    // — zero dedykowanego widoku notatek/tagów, zero parametru wskazującego
    // zakładkę. Trzy różne etykiety menu ("Open details"/"Notes"/"Tags"), JEDNA
    // faktyczna akcja — mylące wobec użytkownika (spodziewa się widoku notatek
    // lub tagów, dostaje ten sam generyczny panel szczegółów), udokumentowane
    // tu zamiast utrzymywane w trzech pozorowanych osobnych wpisach.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_open_detail', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera panel szczegółów wskazanego węzła Mapy myśli. Stan lokalny UI (`setDrawerNodeId` w `IdeaRecommendationMap.tsx`), nieprzekazany do szyny — dziś dostępne WYŁĄCZNIE z menu prawego kliku. UWAGA: menu prawego kliku ma też pozycje "Notes" i "Tags" — obie wołają DOKŁADNIE tę samą akcję (ten sam kod, brak dedykowanego widoku notatek/tagów), więc odpowiadają na TO SAMO polecenie co "Open details".',
    },
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:98 (ctx_open_detail) + :446 (ctx_quick_notes) + :452 (ctx_quick_tags) — wszystkie trzy handleContextAction:4874-4918',
  },
  {
    id: 'idea.node.mm_add_child',
    label: { pl: 'Dodaj dziecko', en: 'Add child' },
    icon: 'Plus',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'Tab',
    // Rozważono reużycie `idea.element.add` (ten sam runtime string
    // `mm_add_child`, `surfaces` już zawiera `'context'`) — ODRZUCONE: jego
    // `handler` (`runByTool`) ZAWSZE dyspatchuje na szynę, nawet dla kliku
    // człowieka (ignoruje `ctx.params.run`), co złamałoby wymóg tej fali
    // („byte-identical human-click behavior" przez `ctx.params.run`). Nowy id
    // reużywa TEN SAM runtime string (`mm_add_child`) — zero nowej logiki po
    // stronie hooka, tylko druga, ostrożniejsza ścieżka wejścia.
    handler: (ctx) => runMindmapNodeBusAction('idea.node.mm_add_child', RUNTIME_MM_NODE_ADD_CHILD, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'useMindMapNodes.tsx addChildNode:349 → pushUndo() (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Dodaje węzeł-dziecko do wskazanego węzła Mapy myśli. Podaj `nodeId` węzła-rodzica; bez niego trafi pod aktualnie zaznaczony/ostatnio aktywny węzeł. `label` opcjonalna treść nowego węzła.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-rodzica.' },
          label: { type: 'string', description: 'Treść nowego węzła (opcjonalna).' },
        },
      },
    },
    runtime: RUNTIME_MM_NODE_ADD_CHILD,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:104 (ctx_add_child)',
  },
  {
    id: 'idea.node.mm_add_sibling',
    label: { pl: 'Dodaj rodzeństwo', en: 'Add sibling' },
    icon: 'GitBranch',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'Enter',
    handler: (ctx) =>
      runMindmapNodeBusAction('idea.node.mm_add_sibling', RUNTIME_MM_NODE_ADD_SIBLING, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'useMindMapNodes.tsx addSiblingNode:487 → pushUndo() (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Dodaje węzeł-rodzeństwo obok wskazanego węzła Mapy myśli (ten sam rodzic). Węzeł bez rodzica (korzeń) dostaje zamiast tego dziecko — uczciwy fallback, nie cichy błąd. Podaj `nodeId` węzła kotwicy.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła, obok którego dodać rodzeństwo.' },
        },
      },
    },
    runtime: RUNTIME_MM_NODE_ADD_SIBLING,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:111 (ctx_add_sibling)',
  },
  {
    id: 'idea.node.mm_duplicate',
    label: { pl: 'Duplikuj', en: 'Duplicate' },
    icon: 'Copy',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘D',
    // NIE reużyto `idea.node.duplicate` (Tablica, scope `selected_items`,
    // runtime `wb_duplicate`): Mapa myśli duplikuje DOKŁADNIE jeden węzeł
    // zakotwiczony pod jego rodzicem (`duplicateSelected` w
    // `useMindMapNodes.tsx:724` — cicho no-opuje bez rodzica, tzn. dla
    // korzenia/gałęzi startowej), podczas gdy Tablica duplikuje płaski zbiór
    // zaznaczonych kształtów bez pojęcia rodzica. Różny zakres (`single_item`
    // vs `selected_items`) I różny odbiornik (`mm_duplicate` vs
    // `wb_duplicate`) — nie kosmetyka, osobne id.
    handler: (ctx) => runMindmapNodeBusAction('idea.node.mm_duplicate', RUNTIME_MM_NODE_DUPLICATE, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'useMindMapNodes.tsx duplicateSelected:724 → pushUndo() (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Duplikuje węzeł. UWAGA: działa na to, co jest DZIŚ zaznaczone na płótnie w przeglądarce użytkownika (ta sama funkcja co przycisk „Duplikuj") — nie przyjmuje `nodeId`, więc bez wcześniejszego zaznaczenia przez użytkownika nie ma czego duplikować (ta sama uczciwa granica co `idea.node.duplicate` na Tablicy).',
    },
    runtime: RUNTIME_MM_NODE_DUPLICATE,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:118 (ctx_duplicate)',
  },
  {
    id: 'idea.node.mm_copy',
    label: { pl: 'Kopiuj', en: 'Copy' },
    icon: 'ClipboardCopy',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘C',
    // NIE reużyto `idea.node.copy` (Tablica): implementacje schowka są
    // CAŁKOWICIE niezależne (Mapa: `_clipboard` — closure w
    // `useMindMapNodes.tsx` serializująca podgraf węzeł+krawędzie; Tablica:
    // WB-CLIPBOARD-01, kopia SAMEGO TEKSTU etykiety do schowka systemowego).
    // Zero wspólnego runtime, oba już UI-only — konflacja id-ków nic by nie
    // dała, tylko zmyliła który mechanizm faktycznie działa.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_copy', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Kopiuje węzeł (i jego wewnętrzne krawędzie) do schowka Mapy myśli. Schowek to zmienna w przeglądarce (`useMindMapNodes.tsx`), nieprzekazana do szyny — dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:125 (ctx_copy_nodes)',
  },
  {
    id: 'idea.node.mm_cut',
    label: { pl: 'Wytnij', en: 'Cut' },
    icon: 'Scissors',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘X',
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_cut', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Wycina węzeł (kopiuje do schowka Mapy myśli i usuwa z płótna). Ten sam schowek co „Kopiuj" — dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:132 (ctx_cut_nodes)',
  },
  {
    id: 'idea.node.mm_paste',
    label: { pl: 'Wklej', en: 'Paste' },
    icon: 'Clipboard',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘V',
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_paste', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'useMindMapNodes.tsx pasteNodes:1219 → pushUndo() (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Wkleja zawartość schowka Mapy myśli w miejscu wskazanego węzła. Ten sam schowek co „Kopiuj"/„Wytnij" — dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:139 (ctx_paste_nodes)',
  },
  {
    id: 'idea.node.mm_toggle_collapse',
    label: { pl: 'Zwiń / rozwiń', en: 'Fold / unfold' },
    icon: 'FoldVertical',
    scope: 'single_item',
    tools: ['mindmap'],
    // Dual-surface (2026-08-09): `FloatingNodeToolbar.tsx:314` ma `onClick`
    // wołający `onAction('mm_toggle_collapse')` — TEN SAM string co runtime
    // tej akcji (nie lokalny `ctx_*` id, ale identyczny efekt). W
    // przeciwieństwie do `ctx_edit` (patrz `idea.node.mm_edit` wyżej), ten
    // klik DZIAŁA dziś (odbiornik istnieje) — po tym wpisie działa PRECYZYJNIEJ:
    // `useMindMapQuickActions.ts`'s `mm_toggle_collapse` odbiornik ignorował
    // `detail.nodeId` na rzecz `getSelectedNode()` (poprawione tą samą zmianą,
    // patrz komentarz w hooku) — pływający pasek zyskuje to poprawnie
    // wycelowane zachowanie za darmo, bez zmiany w `FloatingNodeToolbar.tsx`.
    surfaces: ['context', 'floating'],
    shortcut: 'Space',
    handler: (ctx) =>
      runMindmapNodeBusAction('idea.node.mm_toggle_collapse', RUNTIME_MM_NODE_TOGGLE_COLLAPSE, ctx),
    // Stan widoku (zwinięcie gałęzi), nie treść Idei — ta sama konwencja co
    // `idea.view.collapse_all`/`fold_level_1`/`fold_level_2`/`expand_all`
    // (wszystkie `mutates: false` mimo wołania setNodes/setCollapsedNodeIds).
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Zwija albo rozwija (przełącznik) dzieci wskazanego węzła Mapy myśli. Podaj `nodeId` — bez niego działa na aktualnie zaznaczonym węźle.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła do zwinięcia/rozwinięcia.' },
        },
      },
    },
    runtime: RUNTIME_MM_NODE_TOGGLE_COLLAPSE,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:152 (ctx_toggle_collapse)',
  },
  {
    id: 'idea.node.mm_focus_subtree',
    label: { pl: 'Skup na poddrzewie', en: 'Focus subtree' },
    icon: 'ScanSearch',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // ZASTRZEŻENIE odkryte przy tym wpisie, NIE wprowadzone/naprawiane tutaj:
    // `ctx_focus_subtree` i `ctx_drill_down` (niżej) wołają DZIŚ DOKŁADNIE tę
    // samą funkcję (`handleDrillDown(ctxNode.id)`,
    // `IdeaRecommendationMap.tsx:4837-4840`) — mimo to zostają DWOMA osobnymi
    // wpisami rejestru, bo to dwie WIZUALNIE odrębne pozycje menu (różne
    // etykiety/ikony/miejsce w grupie) — Z1 rządzi reużyciem TEJ SAMEJ akcji
    // pod wieloma id-kami, nie zabrania dwóm różnym pozycjom menu współdzielić
    // dziś implementację (prawdziwe przed tym wpisem, nie ukryte).
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_focus_subtree', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Ustawia widok na poddrzewo wskazanego węzła (breadcrumb + dopasowanie kadru). Stan lokalny UI (`setDrillPath` w `IdeaRecommendationMap.tsx`), nieprzekazany do szyny — dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:159 (ctx_focus_subtree)',
  },
  {
    id: 'idea.node.mm_drill_down',
    label: { pl: 'Wejdź głębiej', en: 'Drill down' },
    icon: 'ChevronRight',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_drill_down', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Wchodzi w poddrzewo wskazanego węzła jako nowy „katalog roboczy" (breadcrumb). Dziś identyczne wykonawczo z „Skup na poddrzewie" (patrz `idea.node.mm_focus_subtree`) — stan lokalny UI, dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:165 (ctx_drill_down)',
  },
  {
    id: 'idea.node.mm_connect_to_selected',
    label: { pl: 'Połącz z zaznaczonym', en: 'Connect to selected' },
    icon: 'Link2',
    // `single_item`, NIE `selected_items`: akcja jest zakotwiczona na JEDNYM
    // węźle (tym, na którym otwarto menu) — drugi węzeł to PARAMETR
    // (`targetNodeId`), nie zestaw wielu zaznaczonych elementów w sensie, w
    // jakim `selected_items` jest używane gdzie indziej w tym rejestrze
    // (Tablica: „zrób coś z tym, co jest dziś zaznaczone").
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) =>
      runMindmapNodeBusAction('idea.node.mm_connect_to_selected', RUNTIME_MM_NODE_CONNECT, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      // HONEST FIX (patrz komentarz w IdeaRecommendationMap.tsx przy
      // ctx_connect_to_selected i w useMindMapQuickActions.ts przy
      // mm_connect_nodes) — ta mutacja NIGDY nie wołała pushUndo() ani na
      // ścieżce kliku, ani teraz na nowej ścieżce Teresy; DOPISANE tym
      // wpisem w obu miejscach.
      evidence:
        'IdeaRecommendationMap.tsx ctx_connect_to_selected + useMindMapQuickActions.ts mm_connect_nodes → oba wołają teraz pushUndo() (dopisane tą zmianą)',
    },
    teresa: {
      description:
        'Łączy relacją ("related") wskazany węzeł z drugim węzłem Mapy myśli. Podaj `nodeId` węzła źródłowego i `targetNodeId` węzła docelowego — w przeciwieństwie do kliku człowieka (gdzie drugi węzeł to to, co było zaznaczone PRZED prawym kliknięciem), Teresa nie ma pojęcia "co było zaznaczone wcześniej", więc musi podać oba id-ki wprost.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła źródłowego.' },
          targetNodeId: { type: 'string', description: 'Id węzła docelowego.' },
        },
        required: ['nodeId', 'targetNodeId'],
      },
    },
    runtime: RUNTIME_MM_NODE_CONNECT,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:171 (ctx_connect_to_selected)',
  },
  {
    id: 'idea.node.mm_detach_branch',
    label: { pl: 'Odłącz gałąź', en: 'Detach branch' },
    icon: 'Scissors',
    // Zakotwiczone na JEDNYM węźle (rozłącza TYLKO jego własną krawędź do
    // rodzica) — `single_item`, nie zestaw zaznaczeń.
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) =>
      runMindmapNodeBusAction('idea.node.mm_detach_branch', RUNTIME_MM_NODE_DETACH_BRANCH, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaRecommendationMap.tsx detachBranch:4718 → pushUndo() (DOPISANE tym wpisem — funkcja istniała od V5-IDEA-17 bez wywołania pushUndo)',
    },
    teresa: {
      description:
        'Odłącza wskazany węzeł od jego rodzica (staje się węzłem najwyższego poziomu). Podaj `nodeId`.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła do odłączenia.' },
        },
        required: ['nodeId'],
      },
    },
    runtime: RUNTIME_MM_NODE_DETACH_BRANCH,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:177 (ctx_detach_branch)',
  },
  {
    id: 'idea.node.mm_duplicate_branch',
    label: { pl: 'Duplikuj gałąź', en: 'Duplicate branch' },
    icon: 'Copy',
    // `single_item`, NIE `selected_items`: JEDNA kotwica + jej struktura
    // potomna — to nie jest wielokrotne zaznaczenie w sensie tego rejestru,
    // tylko efekt kaskadowy jednego celu (dokładnie rozważanie zasugerowane
    // w briefie tej fali: zamiast wymyślać nowe pojęcie `scope`, uczciwość
    // "duplikuje TEŻ poddrzewo" idzie do opisu Teresy, nie do `scope`).
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) =>
      runMindmapNodeBusAction('idea.node.mm_duplicate_branch', RUNTIME_MM_NODE_DUPLICATE_BRANCH, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaRecommendationMap.tsx duplicateBranch:4736 → pushUndo() (DOPISANE tym wpisem — funkcja istniała od V5-IDEA-17 bez wywołania pushUndo)',
    },
    teresa: {
      description:
        'Duplikuje wskazany węzeł WRAZ Z CAŁYM PODDRZEWEM (wszystkimi węzłami potomnymi) Mapy myśli — nowa kopia zawiera każdy węzeł-potomek, nie tylko sam wskazany węzeł. Podaj `nodeId`.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy poddrzewa do duplikacji.' },
        },
        required: ['nodeId'],
      },
    },
    runtime: RUNTIME_MM_NODE_DUPLICATE_BRANCH,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:183 (ctx_duplicate_branch)',
  },
  // ── Convert (single-item label, cascades to descendants today — see the
  // honesty block above `runMindmapNodeConvertAction`) ─────────────────────
  {
    id: 'idea.node.mm_convert_initiative',
    label: { pl: 'Konwertuj → Inicjatywa', en: 'Convert → Initiative' },
    icon: 'Rocket',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_initiative',
        'initiative',
        RUNTIME_MM_NODE_CONVERT_BRANCH,
        ctx
      ),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'IdeaMapWorkspace.tsx handleConvert → Api.convertMyIdea → nowy rekord Initiative; brak automatycznego cofnięcia (ten sam wzorzec co idea.workspace.convert wyżej)',
    },
    teresa: {
      description:
        'Konwertuje wskazany węzeł Mapy myśli na Inicjatywę. UWAGA (etykieta menu myli — sprawdzone w kodzie): mimo że pozycja nazywa się „Convert" (bez „branch"), zabiera CAŁE poddrzewo tego węzła, nie tylko sam węzeł — identycznie jak „Konwertuj gałąź". Podaj `nodeId`. Tworzy nowy, trwały rekord w PMO.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy (wraz z poddrzewem) do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_BRANCH,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:314 (ctx_convert_initiative) + IdeaRecommendationMap.tsx:4979 convertBranch(\'initiative\', ...)',
  },
  {
    id: 'idea.node.mm_convert_decision',
    label: { pl: 'Konwertuj → Decyzja', en: 'Convert → Decision' },
    icon: 'Star',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_decision',
        'decision',
        RUNTIME_MM_NODE_CONVERT_BRANCH,
        ctx
      ),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'IdeaMapWorkspace.tsx handleConvert → Api.convertMyIdea → nowy rekord Decision; brak automatycznego cofnięcia',
    },
    teresa: {
      description:
        'Konwertuje wskazany węzeł Mapy myśli na artefakt Decyzji. Tak samo jak „→ Inicjatywa" wyżej — mimo etykiety bez „branch" zabiera CAŁE poddrzewo tego węzła. Podaj `nodeId`.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy (wraz z poddrzewem) do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_BRANCH,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:320 (ctx_convert_decision) + IdeaRecommendationMap.tsx:4980 convertBranch(\'decision\', ...)',
  },
  {
    id: 'idea.node.mm_convert_tasks',
    label: { pl: 'Konwertuj → Taski', en: 'Convert → Tasks' },
    icon: 'ListChecks',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_tasks',
        'task_set',
        RUNTIME_MM_NODE_CONVERT_BRANCH,
        ctx
      ),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'IdeaMapWorkspace.tsx handleConvert → Api.convertMyIdea(target: task_set) → nowe zadania; brak automatycznego cofnięcia',
    },
    teresa: {
      description:
        'Konwertuje wskazany węzeł Mapy myśli na zestaw zadań (target `task_set` — nie istnieje osobny target „tasks", to ta sama konwersja co „→ Task set (branch)" niżej pod inną etykietą menu). Zabiera CAŁE poddrzewo tego węzła, mimo etykiety bez „branch". Podaj `nodeId`.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy (wraz z poddrzewem) do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_BRANCH,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:326 (ctx_convert_tasks) + IdeaRecommendationMap.tsx:4978 convertBranch(\'task_set\', ...)',
  },
  // ── Convert branch to… (dual-surface, Z1: NodeContextMenu.tsx `context` +
  // FloatingNodeToolbar.tsx `floating` — literally identical local ids
  // `ctx_subtree_convert_*` in both components, same `convertBranch()` call
  // underneath, ONE registry entry each) ────────────────────────────────────
  {
    id: 'idea.node.mm_convert_branch_decision',
    label: { pl: 'Konwertuj gałąź → Decyzja', en: 'Convert branch → Decision' },
    icon: 'Star',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context', 'floating'],
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_branch_decision',
        'decision',
        RUNTIME_MM_NODE_CONVERT_BRANCH,
        ctx
      ),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'IdeaMapWorkspace.tsx handleConvert → Api.convertMyIdea → nowy rekord Decision; brak automatycznego cofnięcia',
    },
    teresa: {
      description:
        'Konwertuje wskazany węzeł Mapy myśli WRAZ Z CAŁYM PODDRZEWEM na artefakt Decyzji. Podaj `nodeId` węzła-kotwicy gałęzi.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy gałęzi do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_BRANCH,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:340 (ctx_subtree_convert_decision) + FloatingNodeToolbar.tsx:563 + IdeaRecommendationMap.tsx:4982/5688 convertBranch(\'decision\', ...)',
  },
  {
    id: 'idea.node.mm_convert_branch_tasks',
    label: { pl: 'Konwertuj gałąź → Taski', en: 'Convert branch → Tasks' },
    icon: 'ListChecks',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context', 'floating'],
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_branch_tasks',
        'task_set',
        RUNTIME_MM_NODE_CONVERT_BRANCH,
        ctx
      ),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'IdeaMapWorkspace.tsx handleConvert → Api.convertMyIdea(target: task_set) → nowe zadania; brak automatycznego cofnięcia',
    },
    teresa: {
      description:
        'Konwertuje wskazany węzeł Mapy myśli WRAZ Z CAŁYM PODDRZEWEM na zestaw zadań. UWAGA (sprawdzone w kodzie): dziś IDENTYCZNA konwersja (target `task_set`) co „→ Task set (branch)" niżej — dwie różne pozycje menu, ten sam efekt, nie naprawiane tym wpisem. Podaj `nodeId` węzła-kotwicy gałęzi.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy gałęzi do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_BRANCH,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:346 (ctx_subtree_convert_tasks) + FloatingNodeToolbar.tsx:568 + IdeaRecommendationMap.tsx:4983/5689 convertBranch(\'task_set\', ...)',
  },
  {
    id: 'idea.node.mm_convert_branch_task_set',
    label: { pl: 'Konwertuj gałąź → Zestaw zadań', en: 'Convert branch → Task set' },
    icon: 'ListChecks',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context', 'floating'],
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_branch_task_set',
        'task_set',
        RUNTIME_MM_NODE_CONVERT_BRANCH,
        ctx
      ),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'IdeaMapWorkspace.tsx handleConvert → Api.convertMyIdea(target: task_set) → nowe zadania; brak automatycznego cofnięcia',
    },
    teresa: {
      description:
        'Konwertuje wskazany węzeł Mapy myśli WRAZ Z CAŁYM PODDRZEWEM na zestaw zadań. Ten sam target (`task_set`) co „→ Tasks (branch)" wyżej — osobny wpis, bo to wizualnie odrębna pozycja menu (Z1 nie zabrania dwóm pozycjom menu współdzielić dziś implementacji). Podaj `nodeId` węzła-kotwicy gałęzi.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy gałęzi do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_BRANCH,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:352 (ctx_subtree_convert_task_set) + FloatingNodeToolbar.tsx:573 + IdeaRecommendationMap.tsx:4984/5690 convertBranch(\'task_set\', ...)',
  },
  {
    id: 'idea.node.mm_convert_branch_initiative',
    label: { pl: 'Konwertuj gałąź → Inicjatywa', en: 'Convert branch → Initiative' },
    icon: 'Rocket',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context', 'floating'],
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_branch_initiative',
        'initiative',
        RUNTIME_MM_NODE_CONVERT_BRANCH,
        ctx
      ),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'IdeaMapWorkspace.tsx handleConvert → Api.convertMyIdea → nowy rekord Initiative; brak automatycznego cofnięcia',
    },
    teresa: {
      description:
        'Konwertuje wskazany węzeł Mapy myśli WRAZ Z CAŁYM PODDRZEWEM na Inicjatywę. Podaj `nodeId` węzła-kotwicy gałęzi.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy gałęzi do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_BRANCH,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:358 (ctx_subtree_convert_initiative) + FloatingNodeToolbar.tsx:578 + IdeaRecommendationMap.tsx:4985/5691 convertBranch(\'initiative\', ...)',
  },
  {
    id: 'idea.node.mm_convert_branch_process_flow',
    label: { pl: 'Konwertuj gałąź → Proces', en: 'Convert branch → Process Flow' },
    icon: 'Workflow',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context', 'floating'],
    // UWAGA — SPRAWDZONE (`h2.3-mindmap-processflow-branch-conversion.test.ts`),
    // NIE spekulacja: `process_flow` idzie INNĄ ścieżką niż pozostałe 4
    // targety tej grupy — nie przez `Api.convertMyIdea` (dziś nawet nie jest
    // w `IDEA_CONVERT_TARGETS`), tylko przez `IdeaMapWorkspace.tsx`'s
    // `XFORM_MAP`/`transformSelection` (`convert_process_flow` + jawne
    // `nodeIds` łapane NA GÓRZE `handleQuickAction`, `IdeaMapWorkspace.tsx:888`)
    // — wstawia kroki do WŁASNEGO Procesu Idei, BEZ nowego rekordu w innym
    // module, BEZ `outputLinks`. Bliżej „Generowanie reprezentacji" (rozdz. 10
    // §1) niż „Konwersja do artefaktu", mimo etykiety menu — PRZEDISTNIEJĄCA
    // niezgodność, nie naprawiana tym wpisem (patrz komentarz nad
    // `runMindmapNodeConvertAction` dla pełnego dowodu).
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_branch_process_flow',
        'process_flow',
        RUNTIME_MM_NODE_CONVERT_BRANCH,
        ctx
      ),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'Mechanizm inny niż reszta grupy (patrz komentarz wyżej): IdeaMapWorkspace.tsx transformSelection → idea-workspace-insert wstawia kroki do Procesu TEJ SAMEJ Idei (nie nowy rekord w innym module) — czy odbiornik `idea-workspace-insert` po stronie Procesu woła pushUndo() NIE zweryfikowane w tym wpisie (poza zakresem — trzeci plik/inne narzędzie); manual_delete jest bezpiecznym dolnym ograniczeniem, nie potwierdzonym faktem',
    },
    teresa: {
      description:
        'Konwertuje wskazany węzeł Mapy myśli WRAZ Z CAŁYM PODDRZEWEM na kroki Procesu (Process Flow) TEJ SAMEJ Idei. UWAGA: w przeciwieństwie do „→ Inicjatywa/Decyzja/Taski (branch)" wyżej, to NIE tworzy nowego rekordu w innym module — to reprezentacja tej samej Idei, sprawdzone w kodzie (`IdeaMapWorkspace.tsx` `transformSelection`, nie `Api.convertMyIdea`). Podaj `nodeId` węzła-kotwicy gałęzi.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy gałęzi do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_BRANCH,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:364 (ctx_subtree_convert_process_flow) + FloatingNodeToolbar.tsx:583 + IdeaRecommendationMap.tsx:4986-4991/5694 convertBranch(\'process_flow\', ...)',
  },
  // ─────────── N5 czwarta fala (2026-08-09) — grupa AI (9 pozycji, 8 wpisów) ───────────
  {
    id: 'idea.node.mm_ai_rewrite_node',
    label: { pl: 'AI: Przeredaguj ten węzeł', en: 'AI: Rewrite this node' },
    icon: 'Sparkles',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // SPRAWDZONE PRZED wpisem (nie spekulacja): odbiornik
    // `IdeaMapWorkspace.tsx:2741` (`idea-mindmap-rewrite-node`) zbiera
    // instrukcję przez SYNCHRONICZNY `window.prompt()` (przeglądarkowy, blokujący
    // dialog), DOPIERO POTEM woła realny LLM (`Api.chatWithAIStream`) i buduje
    // proposal (`generatorType:'node_rewrite'`, `setProposalBatch`) —
    // proposal-first, zgodne z rozdz. 09 §3. Ale `window.prompt()` wymaga
    // CZŁOWIEKA przy klawiaturze przeglądarki — Teresa (wywołanie z czatu, bez
    // okna przeglądarki użytkownika) nie ma jak dostarczyć `instruction` do tego
    // dialogu. Świadomie UI-only: dispatch na szynę tylko przeniósłby ten sam
    // blokujący prompt, nie dając Teresie żadnej realnej ścieżki — to właśnie
    // ograniczenie, które rozdz. 09 §6 nazywa „prymitywny UX do poprawy",
    // udokumentowane tu, nie naprawione (poza zakresem tego wiringu).
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_ai_rewrite_node', ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'IdeaMapWorkspace.tsx:2764-2790 — Api.chatWithAIStream → setProposalBatch (generatorType: node_rewrite) → IdeaProposalReview; odrzucenie = zero zmian.',
    },
    teresa: {
      description:
        'Przeredagowuje etykietę wskazanego węzła Mapy myśli wg polecenia (realne AI, zawsze do akceptacji w podglądzie). DZIŚ NIEDOSTĘPNE dla Teresy: mechanizm zbiera polecenie przez natywny `window.prompt()` przeglądarki użytkownika (blokujący dialog) — nie ma parametru, którym Teresa mogłaby dostarczyć instrukcję z czatu. Dostępne WYŁĄCZNIE z menu prawego kliku na węzeł.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:280 (ctx_ai_rewrite_node)',
  },
  {
    id: 'idea.node.mm_ai_expand_node',
    label: { pl: 'AI: Rozbuduj temat', en: 'Expand topic' },
    icon: 'Sparkles',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // UCZCIWOŚĆ (rozdz. 09 §2, sprawdzone w handleContextAction:4885-4887, nie
    // spekulacja): „Expand topic" (`ctx_ai_expand`) i „Deepen" (`ctx_ai_deepen`)
    // są DWIEMA RÓŻNYMI etykietami menu, ale wołają DOKŁADNIE tę samą funkcję
    // — `handleAIExpand(ctxNode?.id)` — bez ŻADNEGO parametru różnicującego
    // "rozbuduj" od "pogłęb". Zero różnicy w backendowym wywołaniu
    // (`Api.expandMyIdeaMap`, ten sam `count:5`, ten sam `context`). To jest
    // ODWROTNOŚĆ zakazanego wzorca z rozdz. 09 §2 (tam: JEDNA etykieta ukrywa
    // różne efekty; tu: DWIE etykiety obiecują różny efekt, dostarczają
    // identyczny) — świadomie WSPÓLNY wpis rejestru dla obu lokalnych id
    // (patrz `REGISTRY_ID_BY_LOCAL_ID` w `NodeContextMenu.tsx`), zamiast dwóch
    // wpisów udających, że to różne akcje.
    handler: (ctx) =>
      runMindmapNodeBusAction('idea.node.mm_ai_expand_node', RUNTIME_AI_EXPAND, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'IdeaRecommendationMap.tsx:4360-4442 handleAIExpand — Api.expandMyIdeaMap(proposeOnly:true) → setAiProposal + setShowAIModal(true); odrzucenie = zero zmian.',
    },
    teresa: {
      description:
        'Proponuje nowe węzły-potomki rozbudowujące wskazany węzeł Mapy myśli (realne AI, zawsze do akceptacji w podglądzie). UWAGA: w menu prawego kliku ta sama akcja jest wystawiona pod DWIEMA etykietami — „Expand topic" i „Deepen" — obie wołają identyczny kod, żadna nie "pogłębia" mocniej niż druga (sprawdzone w kodzie, nie w opisie). Podaj `nodeId` węzła-kotwicy.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła, który AI ma rozbudować.' },
        },
        required: ['nodeId'],
      },
    },
    runtime: RUNTIME_AI_EXPAND,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:286 (ctx_ai_expand) + :292 (ctx_ai_deepen) — oba handleContextAction:4885-4887',
  },
  {
    id: 'idea.node.mm_ai_what_if',
    label: { pl: 'AI: Co jeśli...?', en: 'What if...?' },
    icon: 'GitBranch',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // UCZCIWOŚĆ (sprawdzone w AIWhatIfScenarios call site,
    // IdeaRecommendationMap.tsx:6143-6165, nie spekulacja): mimo że pozycja
    // wisi w menu KONKRETNEGO węzła, ANI klik człowieka, ANI ta akcja rejestru
    // nie przekazują `ctxNode` do modalu — modal sam bierze
    // `nodes.find(n => n.selected)`, z fallbackiem na `ideaTitle`/`'root'`.
    // Prawoklik na węzeł A, gdy zaznaczony jest węzeł B, wygeneruje scenariusze
    // dla B, nie A. Zasięg deklarowany jako `single_item` opisuje POZYCJĘ w
    // menu (kotwica intencji), nie faktyczny mechanizm — realnie działa jak
    // `selected_items`/`current_view`.
    handler: (ctx) =>
      runMindmapNodeBusAction('idea.node.mm_ai_what_if', RUNTIME_MM_NODE_AI_WHAT_IF, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'AIWhatIfScenarios.tsx (Api.getMyIdeaAISuggestions) → onApplyScenario w IdeaRecommendationMap.tsx:6157-6165 → pushUndo() + idea-workspace-insert (per-scenariusz Apply, nieklikniete = brak zmian).',
    },
    teresa: {
      description:
        'Generuje scenariusze "co jeśli" (realne AI) dla aktualnie zaznaczonego węzła Mapy myśli — do przeglądu i ręcznego zastosowania per scenariusz. UWAGA: nie da się wskazać KONKRETNEGO węzła (ani z menu, ani z czatu) — działa zawsze na to, co jest DZIŚ zaznaczone w przeglądarce, z fallbackiem na tytuł Idei/korzeń mapy, gdy nic nie jest zaznaczone.',
    },
    runtime: RUNTIME_MM_NODE_AI_WHAT_IF,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:298 (ctx_what_if)',
  },
  {
    id: 'idea.node.mm_summarize_branch',
    label: { pl: 'Podsumuj gałąź', en: 'Summarize branch' },
    icon: 'FileText',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Etykieta BEZ słowa "AI" — poprawnie: klik człowieka (`summarizeBranch()`,
    // IdeaRecommendationMap.tsx:4808-4828) TYLKO wypełnia prompt czatu Teresy
    // (`idea-workspace-chat-prompt`), zero bezpośredniej generacji, zero
    // mutacji grafu — zgodne z rozdz. 09 §2/§5 (delegacja do czatu, jawnie
    // nazwana, bez udawania structured AI). Dla Teresy wybrano INNY, mocniejszy
    // mechanizm (`RUNTIME_MM_NODE_AI_SUMMARIZE_BRANCH` — patrz jego komentarz)
    // zamiast repliki "wyślij sobie prompt do czatu", co byłoby bez sensu dla
    // wywołującego, który JEST czatem.
    handler: (ctx) =>
      runMindmapNodeBusAction(
        'idea.node.mm_summarize_branch',
        RUNTIME_MM_NODE_AI_SUMMARIZE_BRANCH,
        ctx
      ),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Podsumowuje gałąź (węzeł + potomkowie) aktualnie zaznaczoną na Mapie myśli — realne AI, tylko odczyt (nie zmienia mapy). UWAGA: to INNY mechanizm niż klik człowieka z menu węzła (ten tylko wypełnia prompt w oknie czatu) — Teresa dostaje bezpośrednio wygenerowane podsumowanie. Ani jedna, ani druga ścieżka nie przyjmuje `nodeId` — obie działają na to, co jest dziś zaznaczone w przeglądarce.',
    },
    runtime: RUNTIME_MM_NODE_AI_SUMMARIZE_BRANCH,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:304 (ctx_summarize_branch)',
  },
  {
    id: 'idea.node.mm_ai_detect_dependencies',
    label: { pl: 'Wykryj zależności', en: 'Detect dependencies' },
    icon: 'Network',
    scope: 'workspace',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Etykieta BEZ słowa "AI" mimo realnego LLM (`AIDependencyDetector.tsx` →
    // `Api.getMyIdeaAISuggestions`) — zgodne z rozdz. 09 §5 (nazwa nie musi
    // zawierać "AI", żeby akcja BYŁA realnym AI; zakaz działa w drugą stronę).
    // `scope: 'workspace'` (NIE `single_item`) jest UCZCIWY wobec kodu, nie
    // wobec pozycji w menu: `setShowDependencyDetector(true)`
    // (handleContextAction:4946) nie przekazuje ŻADNEGO nodeId, a
    // `AIDependencyDetector` bierze CAŁE `nodes`/`edges` mapy — prawoklik na
    // konkretny węzeł nie ma żadnego wpływu na wynik. Za flagą
    // `mindmapHeuristicAiOverlays` (domyślnie OFF) — nazwa flagi myląco sugeruje
    // heurystykę; SAMO WYKRYWANIE jest realnym wywołaniem LLM, sprawdzone w
    // kodzie (nie w nazwie flagi). BRAK bus/Teresa: `setShowDependencyDetector`
    // to czysty lokalny stan komponentu, bez żadnego odbiornika na szynie —
    // sprawdzone PRZED wpisem (grep `showDependencyDetector` poza tym plikiem:
    // brak wyników), UI-only.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_ai_detect_dependencies', ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'IdeaRecommendationMap.tsx:6469-6529 onAddDependency/onAddAll → pushUndo() + setEdges (Add pojedynczo/Add All, nieklikniete = brak zmian).',
    },
    teresa: {
      description:
        'Wykrywa semantyczne zależności między węzłami CAŁEJ Mapy myśli (realne AI) i proponuje nowe krawędzie do akceptacji pojedynczo lub hurtem. DZIŚ NIEDOSTĘPNE dla Teresy — otwarcie panelu to czysty lokalny stan UI bez odbiornika na szynie. UWAGA: mimo pozycji w menu prawego kliku na węzeł, węzeł spod kursora NIE wpływa na wynik — analiza zawsze obejmuje całą mapę. Za flagą wyłączoną domyślnie.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:310 (ctx_dependencies)',
  },
  {
    id: 'idea.node.mm_ai_prioritize',
    label: { pl: 'Ustal priorytety', en: 'Prioritize' },
    icon: 'Target',
    scope: 'workspace',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Ten sam wzorzec co `idea.node.mm_ai_detect_dependencies` wyżej: etykieta
    // bez "AI" (poprawnie — LLM realny, `AIPriorityRecommender.tsx` →
    // `Api.getMyIdeaAISuggestions`), `scope: 'workspace'` bo
    // `setShowPriorityRecommender(true)` (handleContextAction:4947) nie
    // przekazuje nodeId, a komponent bierze CAŁE `nodes`. UI-only — brak
    // odbiornika na szynie (sprawdzone grepem).
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_ai_prioritize', ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'IdeaRecommendationMap.tsx:6537-6560 onApplyPriorities → pushUndo() + setNodes (recenzja rekomendacji, Apply commit).',
    },
    teresa: {
      description:
        'Proponuje priorytety (0-100) dla węzłów CAŁEJ Mapy myśli na podstawie analizy impact/effort (realne AI, do przeglądu przed zastosowaniem). DZIŚ NIEDOSTĘPNE dla Teresy — czysty lokalny stan UI. Węzeł spod kursora nie wpływa na wynik (cała mapa), mimo pozycji w menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:316 (ctx_priority)',
  },
  {
    id: 'idea.node.mm_ai_competitors',
    label: { pl: 'Konkurencja', en: 'Competitors' },
    icon: 'Globe',
    scope: 'workspace',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Ten sam wzorzec co dwa wpisy wyżej. DODATKOWA NAPRAWA (ta sama klasa co
    // `mm_connect_to_selected`/`mm_detach_branch` w drugiej fali — prawdziwy,
    // zweryfikowany brak, nie spekulacja): `onAddToMap`
    // (IdeaRecommendationMap.tsx, wywołanie AICompetitiveLandscape) NIE wołało
    // `pushUndo()` przed `idea-workspace-insert`, w przeciwieństwie do
    // WSZYSTKICH pozostałych 6 wywołujących tego samego eventu w tym pliku
    // (onAddBlindSpot/onAddNodes×2/onImport itd., wszystkie mają `pushUndo()`
    // jako pierwszą linię) — dopisane TĄ zmianą (patrz IdeaRecommendationMap.tsx).
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_ai_competitors', ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'IdeaRecommendationMap.tsx onAddToMap (AICompetitiveLandscape) → pushUndo() (DOPISANE tym wpisem — było brakiem, patrz komentarz wyżej) + idea-workspace-insert.',
    },
    teresa: {
      description:
        'Generuje listę konkurentów/analogii dla CAŁEJ Idei (realne AI) i wstawia wybrane pozycje jako nowe węzły. DZIŚ NIEDOSTĘPNE dla Teresy — czysty lokalny stan UI. Węzeł spod kursora nie wpływa na wynik.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:322 (ctx_competitive)',
  },
  {
    id: 'idea.node.mm_ai_suggest_links',
    label: { pl: 'AI: Sugeruj połączenia', en: 'AI: Suggest links' },
    icon: 'Sparkles',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context', 'floating'],
    handler: (ctx) =>
      runMindmapNodeBusAction(
        'idea.node.mm_ai_suggest_links',
        RUNTIME_MM_NODE_AI_SUGGEST_LINKS,
        ctx
      ),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'IdeaMapWorkspace.tsx:1047-1080 mm_ai_suggest_links_execute → generateAIProposal(generatorType: ai_propose_attachments) → setProposalBatch; odrzucenie = zero zmian.',
    },
    teresa: {
      description:
        'Proponuje powiązania (linki/krawędzie do innych elementów) dla wskazanego węzła Mapy myśli (realne AI, do akceptacji w podglądzie). UWAGA: klik z menu prawego kliku na węzeł jest DZIŚ MARTWY (brak gałęzi obsługi w komponencie — zgłoszone, nie naprawione tym wpisem, żeby nie zmieniać widocznego zachowania kliku poza zakresem wiringu); TA SAMA etykieta na pływającym pasku AI DZIAŁA już dziś i to jej odbiornik wykonuje wywołanie Teresy. Odbiornik ignoruje `nodeId` z parametrów — operuje na tym, co jest dziś zaznaczone w przeglądarce.',
    },
    runtime: RUNTIME_MM_NODE_AI_SUGGEST_LINKS,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:328 (ai_suggest_links, martwy klik) + FloatingAIPopover.tsx:52 (żywy klik, ta sama etykieta)',
  },
  // ─── N5 czwarta fala (2026-08-09) — grupa Style & data (13 pozycji, 11 nowych wpisów + 2 reużycia idea.node.mm_open_detail) ───
  {
    id: 'idea.node.mm_change_shape',
    label: { pl: 'Zmień kształt', en: 'Change shape' },
    icon: 'Diamond',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // JEDYNA (razem z paste_style/vote_up niżej) pozycja tej grupy, która
    // mutuje dane węzła BEZPOŚREDNIO, bez modalu pośredniczącego — i, tak jak
    // te dwie, BEZ `pushUndo()` przed `updateNodeData`
    // (handleContextAction:4949-4960, sprawdzone: brak wywołania w tym bloku).
    // To PRZEDISTNIEJĄCA, SYSTEMOWA luka obejmująca WSZYSTKIE bezpośrednie
    // mutacje danych węzła w tej grupie (change_shape/paste_style/vote_up) —
    // nie punktowy brak jak `mm_connect_to_selected` w drugiej fali, tylko cała
    // klasa zachowań. Zgłoszone uczciwie tu, NIE naprawione hurtem tym wpisem
    // (3 niezależne miejsca, poza wąskim zakresem tego wiringu; patrz raport).
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_change_shape', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK: handleContextAction ctx_change_shape (IdeaRecommendationMap.tsx:4949-4960) NIE woła pushUndo() przed updateNodeData — zmiana kształtu nie trafia dziś na stos Ctrl+Z. `local_stack` deklarowany jako bezpieczne dolne ograniczenie zamierzonego mechanizmu (autosave i tak zapisuje stan), nie potwierdzony fakt działania Ctrl+Z dla TEJ konkretnej zmiany.',
    },
    teresa: {
      description:
        'Zmienia kształt wskazanego węzła Mapy myśli (cykl: domyślny/koło/romb/sześciokąt). Lokalna mutacja danych węzła, bez wywołania AI. DZIŚ NIEDOSTĘPNE dla Teresy — brak odbiornika na szynie.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:404 (ctx_change_shape)',
  },
  {
    id: 'idea.node.mm_add_image',
    label: { pl: 'Dodaj obraz', en: 'Add image' },
    icon: 'Image',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Wzorzec `idea.node.mm_edit`: pozycja menu WYŁĄCZNIE otwiera modal
    // (`setImageUrlNodeId`, handleContextAction:5004-5008) — sama treść (URL
    // obrazu) i faktyczna mutacja (`updateNodeDataById`, bez `pushUndo()` —
    // ta sama systemowa luka co wyżej) następują DOPIERO po wypełnieniu
    // modalu przez człowieka, osobny mechanizm bez własnej pozycji menu.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_add_image', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera okno dodania obrazu (URL) do wskazanego węzła Mapy myśli. Sama treść (adres obrazu) wymaga wpisania przez człowieka w modalu — dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:410 (ctx_add_image)',
  },
  {
    id: 'idea.node.mm_copy_style',
    label: { pl: 'Kopiuj styl', en: 'Copy style' },
    icon: 'Paintbrush',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Nie mutuje GRAFU — zapisuje styl w lokalnym stanie schowka komponentu
    // (`styleClipboard`, przeglądarkowe, jak `idea.node.mm_copy`/`mm_cut`
    // wyżej) — ten sam wzorzec, ta sama uczciwa granica dla Teresy.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_copy_style', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Kopiuje styl wskazanego węzła Mapy myśli do schowka narzędzia (do późniejszego "Wklej styl"). Schowek jest stanem przeglądarki użytkownika — DZIŚ NIEDOSTĘPNE dla Teresy z tego samego powodu co kopiuj/wytnij węzły.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:416 (ctx_copy_style)',
  },
  {
    id: 'idea.node.mm_paste_style',
    label: { pl: 'Wklej styl', en: 'Paste style' },
    icon: 'Paintbrush',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Bezpośrednia mutacja (`setNodes`, handleContextAction:5013-5017), BEZ
    // `pushUndo()` — ta sama systemowa luka jak `mm_change_shape`/`mm_vote_up`
    // (patrz komentarz tam). Poza tym: czyta lokalny `styleClipboard` — bez
    // sensownego odpowiednika dla Teresy (schowek to stan przeglądarki), tak
    // samo jak `idea.node.mm_copy` — UI-only z DWÓCH niezależnych powodów.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_paste_style', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK: handleContextAction ctx_paste_style (IdeaRecommendationMap.tsx:5013-5017) NIE woła pushUndo() przed setNodes — ta sama systemowa luka co ctx_change_shape/ctx_vote_up (patrz idea.node.mm_change_shape). `local_stack` = dolne ograniczenie, nie potwierdzone działanie.',
    },
    teresa: {
      description:
        'Wkleja wcześniej skopiowany styl na wskazany węzeł. DZIŚ NIEDOSTĘPNE dla Teresy — wymaga schowka stylu w przeglądarce użytkownika (musiał wcześniej kliknąć "Kopiuj styl" na innym węźle), bez odpowiednika parametrowego.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:422 (ctx_paste_style)',
  },
  {
    id: 'idea.node.mm_vote_up',
    label: { pl: 'Głosuj', en: 'Vote up' },
    icon: 'Star',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_vote_up', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK: handleContextAction ctx_vote_up (IdeaRecommendationMap.tsx:4901-4907) NIE woła pushUndo() przed updateNodeData (cykl 0-5) — ta sama systemowa luka co ctx_change_shape/ctx_paste_style.',
    },
    teresa: {
      description:
        'Zwiększa licznik głosów wskazanego węzła Mapy myśli (cykl 0→5→0). Lokalna mutacja danych węzła. DZIŚ NIEDOSTĘPNE dla Teresy — brak odbiornika na szynie.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:428 (ctx_vote_up)',
  },
  {
    id: 'idea.node.mm_assign',
    label: { pl: 'Przypisz osobę', en: 'Assign person' },
    icon: 'UserPlus',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Wzorzec `idea.node.mm_edit`/`mm_add_image`: pozycja menu WYŁĄCZNIE
    // otwiera `AssignPersonModal` (`setAssignModalNodeId`,
    // handleContextAction:4908-4912). Rzeczywista mutacja (`onAssign` →
    // `updateNodeDataById`, IdeaRecommendationMap.tsx:6909-6917) jest lokalnym
    // polem `assignee` na węźle, bez wywołania API i BEZ `pushUndo()` — ta sama
    // systemowa luka jak wyżej, tym razem w kroku PO modalu, więc poza samą
    // klasyfikacją tego wpisu (który opisuje TYLKO otwarcie modalu).
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_assign', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera okno przypisania osoby do wskazanego węzła Mapy myśli. Nazwisko/imię wymaga wpisania przez człowieka w modalu — dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:434 (ctx_assign)',
  },
  {
    id: 'idea.node.mm_comments',
    label: { pl: 'Komentarze', en: 'Comments' },
    icon: 'MessageSquare',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // NIE reużyto `idea.node.comments` (Tablica, tools:['whiteboard'] wyżej) —
    // SPRAWDZONE PRZED wpisem, nie spekulacja: to DWA różne komponenty z
    // różnym trwałym magazynem. `WhiteboardNodeCommentThread.tsx` (nagłówek
    // pliku, dosłownie): "Persistence contract... blob-only via
    // node.data.comments[], no server API". Mapa myśli używa
    // `NodeCommentThread.tsx` — REALNE API (`Api.getNodeComments`/
    // `addNodeComment`/`deleteNodeComment`, serwerowo trwałe komentarze z
    // @mention). To NIE kosmetyczna różnica nazwy komponentu — Mapa myśli ma
    // dojrzalszą, serwerową wersję tej samej funkcji niż Tablica; osobny wpis
    // dokumentuje tę rozbieżność zamiast ją zamazywać wspólnym `tools`.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_comments', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera wątek komentarzy (serwerowo trwały, z @wzmiankami) wskazanego węzła Mapy myśli. Samo otwarcie panelu nie mutuje danych — dodawanie/usuwanie komentarzy dzieje się wewnątrz panelu, poza tą akcją. DZIŚ NIEDOSTĘPNE dla Teresy — lokalny stan UI (`setCommentNodeId`) bez odbiornika na szynie.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:440 (ctx_comments)',
  },
  {
    id: 'idea.node.mm_attach_knowledge',
    label: { pl: 'Dołącz wiedzę', en: 'Attach knowledge' },
    icon: 'BookOpen',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runMindmapAttachKnowledgeCallback(ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera panel dołączania wiedzy (Vault/artefakty) dla wskazanego węzła Mapy myśli, wskazanego po `nodeId`. Samo otwarcie nie mutuje danych. W przeciwieństwie do wersji Tablicy (`idea.node.attach_knowledge`, UI-only bo tamten odbiornik ignoruje nodeId) — Mapa myśli ma realny, adresowalny mechanizm.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła, dla którego otworzyć panel wiedzy.' },
        },
        required: ['nodeId'],
      },
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:458 (ctx_attach_knowledge)',
  },
  {
    id: 'idea.node.mm_attach_artifact',
    label: { pl: 'Dołącz artefakt', en: 'Attach artifact' },
    icon: 'BookOpen',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Wzorzec `idea.node.mm_edit`: pozycja menu WYŁĄCZNIE otwiera
    // `AttachArtifactModal` (`setAttachArtifactNodeId`,
    // handleContextAction:4928-4930). Realna mutacja (`onAttach` →
    // `Api.attachArtifactToObject`, IdeaRecommendationMap.tsx:6925-6947) jest
    // REALNYM wywołaniem serwera (w przeciwieństwie do assign/change_shape —
    // to nie tylko lokalne dane węzła), ale dzieje się PO wypełnieniu modalu,
    // osobny krok od samego otwarcia menu.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_attach_artifact', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera okno dołączania artefaktu (innego rekordu Consultify) do wskazanego węzła Mapy myśli. Wybór artefaktu i faktyczne dołączenie (realny zapis na serwerze) następują w modalu — dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:464 (ctx_attach_artifact)',
  },
  {
    id: 'idea.node.mm_open_linked_artifacts',
    label: { pl: 'Powiązane artefakty', en: 'Linked artifacts' },
    icon: 'ExternalLink',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Wyłącznie odczyt: 0 linków → toast informacyjny; 1 link → otwiera go
    // wprost (`mywork-open-item`); >1 → otwiera panel szczegółów węzła
    // (handleContextAction:4931-4945). Żadna gałąź nie zmienia danych.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_open_linked_artifacts', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Pokazuje artefakty powiązane ze wskazanym węzłem Mapy myśli (otwiera bezpośrednio, gdy jest dokładnie jeden; w przeciwnym razie panel szczegółów). Wyłącznie odczyt. DZIŚ NIEDOSTĘPNE dla Teresy — logika czyta `ctxNode.data.artifactLinks` z domknięcia komponentu, bez odbiornika na szynie.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:470 (ctx_open_linked_artifacts)',
  },
  {
    id: 'idea.node.mm_copy_link',
    label: { pl: 'Kopiuj link', en: 'Copy link' },
    icon: 'Share2',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Czysty odczyt + zapis do schowka SYSTEMOWEGO (nie schowka narzędzia) —
    // buduje URL z `focusNode=<id>` i kopiuje (handleContextAction:5018-5030).
    // Nie zmienia żadnych danych Idei.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_copy_link', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Kopiuje do schowka systemowego link URL do wskazanego węzła Mapy myśli (parametr `focusNode`). Nie zmienia danych Idei. DZIŚ NIEDOSTĘPNE dla Teresy — `navigator.clipboard` to API przeglądarki użytkownika, bez sensownego odpowiednika po stronie czatu.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:476 (ctx_share_branch)',
  },
  {
    id: 'idea.node.mm_delete',
    label: { pl: 'Usuń', en: 'Delete' },
    icon: 'Trash2',
    // Ta INSTANCJA (wywołana z menu prawego kliku na JEDNYM węźle) działa
    // jako single_item — ale bazowa funkcja (`deleteSelected`) potrafi
    // usunąć WIELE zaznaczonych węzłów naraz, gdy wywołana skądinąd (np.
    // klawisz Delete przy zaznaczeniu wielokrotnym). Deklarujemy `single_item`
    // bo to jest zakres TEJ powierzchni (menu węzła), nie ukrywając szerszej
    // zdolności funkcji w opisie Teresy poniżej.
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'Del',
    // NIE reużyto `idea.node.delete` (Tablica, `wb_delete`) — inny odbiornik,
    // inna reprezentacja, ta sama „operuje na dzisiejszym zaznaczeniu, nie
    // przyjmuje nodeId" uczciwa granica (patrz teresa.description niżej,
    // słowo w słowo ten sam wzorzec co Tablica).
    handler: (ctx) => runMindmapNodeBusAction('idea.node.mm_delete', RUNTIME_MM_NODE_DELETE, ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'local_stack',
      evidence: 'useMindMapNodes.tsx deleteSelected:657 → pushUndo() (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Usuwa węzeł (i jego poddrzewo — z potwierdzeniem, gdy ma dzieci). UWAGA: działa na to, co jest DZIŚ zaznaczone na płótnie w przeglądarce użytkownika — nie przyjmuje `nodeId`, więc bez wcześniejszego zaznaczenia przez użytkownika nie ma czego usunąć (ta sama uczciwa granica co `idea.node.delete` na Tablicy).',
    },
    runtime: RUNTIME_MM_NODE_DELETE,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:404 (ctx_delete)',
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
