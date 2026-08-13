/**
 * Typy kontraktu rejestru akcji Idea Workspace.
 *
 * Wydzielone z `src/actions/ideaActionRegistry.ts` (QG-01, 2026-08-10) przy
 * podziale monolitu na moduły per narzędzie — patrz nagłówek
 * `src/actions/ideaActionRegistry.ts` po kontrakt formatu i
 * `docs/standards/idea-workspace/02_REJESTR_AKCJI.md` po SSOT reguł.
 * WYŁĄCZNIE typy/interfejsy tego kontraktu — zero logiki, zero akcji.
 */

import type {
  CanvasToolType,
  IdeaWorkspaceSelection,
} from '@/components/MyWork/ideaSelectionTypes';
import type { UserRole } from '@/types/core';

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
 *
 * `keyboard` (2026-08-10, reconciliacja skrótów — E02 DoD „toolbar, rail,
 * inspector, PPM, keyboard i Teresa wołają ten sam kontrakt") — dopisane dla
 * garstki akcji, które SPRAWDZONO grepem jako niemające ŻADNEGO menu/przycisku
 * gdziekolwiek w kodzie — jedyne wejście to globalny listener `keydown`
 * (`useKeyboardShortcuts.ts`/`useIdeasToolKeyboard.ts`). Żadna z siedmiu
 * istniejących wartości nie pasuje uczciwie: nie `context` (nie ma menu),
 * nie `toolbar`/`rail`/`panel`/`menu1`/`menu3`/`floating`/`inline` (żaden
 * nie opisuje "wyłącznie klawiatura, zero widocznego elementu"). R2
 * strażnika (`scripts/check-actions.sh`) wymaga NIEPUSTEGO `surfaces`, więc
 * `[]` nie jest opcją — to jedyna uczciwa alternatywa dla udawania istniejącej
 * powierzchni, której akcja nie ma.
 */
export type Surface =
  | 'menu1'
  | 'menu3'
  | 'rail'
  | 'panel'
  | 'context'
  | 'floating'
  | 'toolbar'
  | 'inline'
  | 'keyboard';

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
  | 'X'
  // Process Flow TOOLBAR — pasek + menu „Więcej" (2026-08-10, N6.4), 1:1 z
  // ikonami już importowanymi w `ProcessFlowToolbar.tsx` z lucide-react
  // (`BarChart3` = KPI i Podsumowanie, `AlertTriangle` = Waliduj, `ScanText` =
  // Odczyt zwrotny). Pozostałe pozycje tego paska reużywają nazw już obecnych
  // wyżej ('Sparkles', 'LayoutGrid', 'Copy', 'Trash2', 'MessageSquare',
  // 'Rocket', 'Workflow'). Trzy zakładki trybu (Klasyczny/Automatyzacja/
  // Strumień wartości) NIE mają w UI żadnej ikony (czysty tekst) — dostają
  // 'Workflow' jako najbliższą prawdę o tym, czym są, nie jako opis
  // dzisiejszego wyglądu.
  | 'BarChart3'
  | 'AlertTriangle'
  | 'ScanText'
  // WB-FRAME-01 (frame context menu, 2026-08-10) — `IdeaCanvasContextMenu.tsx`
  // frame menu, 1:1 z ikonami już importowanymi tam z lucide-react.
  | 'Boxes'
  | 'FolderInput'
  | 'FolderOutput'
  | 'Maximize2'
  | 'PackageOpen'
  // N10 (2026-08-10) — TableToolbar.tsx (powierzchnia platform, `surfaces:
  // ['toolbar']`), 1:1 z ikonami już importowanymi tam z lucide-react
  // ('Trophy' = Scoring Model, 'Presentation' = Export to Presentation,
  // 'Mic' = Voice/Image, 'Flame' = Heatmap). Ten sam PREISTNIEJĄCY dług
  // `ICON_BY_NAME` co notatka N8.2 niżej — wszystkie cztery wpisy mają
  // `surfaces: ['toolbar']`, więc `ICON_BY_NAME` (mapa Menu 3) i tak ich nie
  // czyta.
  | 'Trophy'
  | 'Presentation'
  | 'Mic'
  | 'Flame'
  // Group B naprawa typów (2026-08-10) — pięć wartości UŻYWANYCH w kodzie od
  // dawna (ikony menu kontekstowego, 1:1 z importami lucide-react w plikach
  // źródłowych niżej), ale nigdy niedopisanych do tej unii — `tsc` łapał to
  // jako TS2322 na polu `icon` każdego z pięciu wpisów. Wszystkie pięć mają
  // `surfaces: ['context']` WYŁĄCZNIE, więc `ICON_BY_NAME` (mapa fallbacku
  // Menu 3, patrz notatka niżej) i tak ich nie czyta — to czysta metadana
  // identyczności ikony w menu prawego kliku.
  | 'ClipboardPaste' // idea.canvas.paste — IdeaCanvasContextMenu.tsx
  | 'FileText' // idea.node.mm_summarize_branch — mindmap/NodeContextMenu.tsx
  | 'Globe' // idea.view.mm_ai_competitors — mindmap/PaneContextMenu.tsx
  | 'UserPlus' // idea.node.mm_assign — mindmap/NodeContextMenu.tsx
  | 'Share2' // idea.node.mm_copy_link — mindmap/NodeContextMenu.tsx
  // N-TP (2026-08-10) — 22 class-d paneli platformy Tabeli (Automatyzacje/
  // Synchronizacja/Dystrybucja×2/Współdzielenie/Formularze/Interfejsy/
  // Webhooki/Szablony rekordów/Zależności dat), 1:1 z ikonami już
  // importowanymi w plikach źródłowych z lucide-react.
  | 'RefreshCw' // table.date_dependency.recalculate — DateDependencyConfig.tsx
  | 'Play'; // table.automation.run_now / table.sync.run_now / table.distribution*.execute
// UWAGA (N8.2, 2026-08-10, ZAKTUALIZOWANA przy naprawie Group B) — menu
// kolumny Tabeli ŚWIADOMIE nie dokłada tu nic nowego (kandydowały
// 'ArrowUpDown'/'EyeOff'). Powód: `ICON_BY_NAME` w
// `src/components/MyWork/ideaCanvasMelsChips.ts:226` mapuje TYLKO ikony
// akcji Menu 3 (fallback dla wpisów bez własnej `Menu3Presentation`) — reszta
// tej unii (menu kontekstowe, toolbar, panel, rail…) jest poza jej domeną z
// definicji, więc ta mapa NIE MUSI (i celowo nie jest) `Record<IconName,
// LucideIcon>` PEŁNE. Od naprawy Group B jest jawnie `Partial<Record<IconName,
// LucideIcon>>` z typowanym fallbackiem (`MENU3_FALLBACK_ICON` + ostrzeżenie
// w konsoli, patrz ten plik) — więc nowa wartość tej unii nigdy nie zepsuje
// kompilacji ICON_BY_NAME i nigdy nie wyrenderuje pustki. Cztery wpisy
// `idea.column.*` mają `surfaces: ['context']`, więc `ICON_BY_NAME` i tak
// NIGDY ich nie czyta — ikona jest tu czystą metadaną. Użyte wyłącznie
// wartości już istniejące: 'Pencil', 'ArrowDownUp' (dosłownie pojęcie
// sortowania), 'FoldVertical' (ukrycie), 'Trash2'.

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
  /**
   * „Akcja została PRZYJĘTA i wysłana" — znaczenie NIEZMIENIONE od zawsze.
   * Świadomie NIE zmieniamy jego semantyki (RISK-30, 2026-08-12): ~59 akcji
   * zwraca dziś `ok: true` po wywołaniu domknięcia UI, którego wyniku nikt nie
   * oglądał. Przestawienie ich na `ok: false` zamieniłoby jedno kłamstwo na
   * gorsze — „nie udało się" dla operacji, które działają.
   */
  ok: boolean;
  actionId: string;
  /** Komunikat dla użytkownika (PL) — także powód odmowy. */
  message?: string;
  data?: unknown;
  /**
   * ★ RISK-30 (S5-TERESA, 2026-08-12) — TRZECI STAN, addytywny ★
   *
   * Czy ktokolwiek POTWIERDZIŁ, że operacja naprawdę się wykonała:
   *   `true`   — wróciło realne potwierdzenie z odbiornika; operacja się stała;
   *   `false`  — wysłane, ale NIC tego nie potwierdziło (brak odbiornika,
   *              limit czasu, albo domknięcie UI, które nic nie zwraca);
   *   `undefined` — ścieżka jeszcze niezmigrowana. Traktuj DOKŁADNIE jak
   *              `false`. NIGDY jak sukces.
   *
   * Powód istnienia: `ok` mówiło „wysłałem zdarzenie", a warstwa odpowiedzi
   * Teresy czytała to jako „zrobione". Użytkownik prosił o usunięcie toru,
   * `handleLaneDelete` odmawiał (ostatni tor), człowiek widział toast z
   * odmową — a Teresa i tak pisała, że usunęła. To pole jest jedynym
   * miejscem, w którym „wysłane" i „potwierdzone" przestają być tym samym.
   *
   * UWAGA NA NAZWĘ: `ActionContext.confirmed` (wyżej) to CO INNEGO —
   * potwierdzenie UŻYTKOWNIKA przed uruchomieniem (`teresa.confirmBeforeRun`).
   * Tamto jest wejściem od człowieka PRZED akcją, to jest wyjściem z systemu
   * PO akcji.
   */
  confirmed?: boolean;
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
 * DLACZEGO cofnięcie NIE istnieje dla wpisu `kind: 'no_undo'` — zamknięta
 * lista, żeby "brak cofnięcia" był AUDYTOWALNY (grep po wartości), nie
 * dowolną prozą, w którą można schować cokolwiek:
 *   self_reversing  — akcja jest WŁASNĄ odwrotnością (ponowne wywołanie tej
 *                      samej akcji lub jej sparowanego przeciwieństwa
 *                      przywraca poprzedni stan) — np. cykliczne sortowanie,
 *                      para dodaj/usuń powiązania w tym samym, niezapisanym
 *                      draftcie. Nic trwałego nie ginie.
 *   ephemeral_local — mutacja WYŁĄCZNIE lokalnego, niezapisanego stanu
 *                      komponentu (nic nie poszło na serwer) — użytkownik
 *                      cofa ręcznie w tym samym UI, zanim cokolwiek się
 *                      utrwali (np. odświeżeniem panelu przed zapisem).
 *   unrecoverable   — PRAWDZIWA luka: realna, serwerowa mutacja/kasowanie
 *                      bez żadnej ścieżki odzyskania (brak historii wersji,
 *                      brak kopii). Uczciwie przyznany brak, nie decyzja
 *                      projektowa — kandydat do naprawy, nie do ukrycia.
 */
export type UndoUnsupportedReason = 'self_reversing' | 'ephemeral_local' | 'unrecoverable';

/**
 * Jak cofnąć skutek akcji. Wymagany, gdy `mutates: true` (kryterium odbioru
 * rozdz. 02: „żadna akcja mutates nie wykonuje się bez możliwości cofnięcia").
 *
 * `kind: 'no_undo'` jest ŚWIADOMIE osobnym wariantem od pozostałych czterech
 * (nie „piątą wartością tej samej rodziny") — wymaga WŁASNEGO, zamkniętego
 * pola `reason` (patrz `UndoUnsupportedReason`), którego pozostałe cztery
 * warianty NIE mają. Dzięki temu żadna powierzchnia UI, która obiecuje
 * cofnięcie na podstawie samej OBECNOŚCI `undo`, nie może już pomylić „mam
 * mechanizm" z „świadomie nie mam" — TypeScript wymusza rozróżnienie.
 */
export type UndoDescriptor =
  | {
      /** local_stack — stos undo narzędzia (Ctrl+Z, `*_undo` w hooku). */
      kind: 'local_stack';
      /** Skąd bierze się cofnięcie — plik/mechanizm, żeby dało się zweryfikować. */
      evidence: string;
    }
  | {
      /** proposal — zmiana wchodzi dopiero po akceptacji podglądu (odrzucenie = brak zmiany). */
      kind: 'proposal';
      evidence: string;
    }
  | {
      /** snapshot — cofnięcie przez Historię (`/map/snapshots`). */
      kind: 'snapshot';
      evidence: string;
    }
  | {
      /** manual_delete — brak automatycznego cofnięcia; skutkiem jest NOWY obiekt, który trzeba skasować ręcznie. */
      kind: 'manual_delete';
      evidence: string;
    }
  | {
      /** no_undo — świadomie BEZ mechanizmu cofnięcia; `reason` mówi DLACZEGO to uczciwe (patrz `UndoUnsupportedReason`). */
      kind: 'no_undo';
      evidence: string;
      reason: UndoUnsupportedReason;
    };

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
