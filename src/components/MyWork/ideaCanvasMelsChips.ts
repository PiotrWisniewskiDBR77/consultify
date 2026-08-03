/**
 * ideaCanvasMelsChips — Menu-1 command chips + Menu-3 view actions + right-rail
 * inspector descriptors for `IdeaCanvasMelsView` (EditorShell Wave W-1).
 *
 * Pure builders (no React state) so `IdeaMapWorkspace` can memoise them from
 * its existing handlers.
 *
 * ANATOMY (Z7 — Menu 1 / Menu 3 split, editor-shell-canon § 2):
 *   - Menu 1 (górny pasek) stays CLEAN: identity (breadcrumb · tool icon ·
 *     title · stage chip · saved indicator) + ONE primary "Konwertuj ▾"
 *     (rendered by the host as `primaryActionSlot`) + ghost "Teresa" (secondary
 *     chip) + kebab `⋯` (overflow chips: Eksport · Historia · Duplikuj · Usuń)
 *     + right-panel toggle (shell).
 *   - Menu 3 (druga listwa POD Menu 1) carries the per-tool VIEW actions that
 *     used to live in the top bar: Dodaj węzeł · Auto-układ · AI rozwiń ·
 *     Szablony · (prawa) Eksport · Utwórz z mapy.
 *
 * CRIMSON-SAFE: zero crimson tokens (the tailwind `primary` family / the accent
 * token) anywhere — chips are styled centrally by `<TopBar>` (neutral +
 * `c-focus`); the second bar / convert menu use `bg-c-text text-c-surface` for
 * the sole primary CTA and `text-c-danger` only for the destructive kebab row.
 */

import {
  Copy,
  Download,
  GitBranch,
  GitMerge,
  HelpCircle,
  History,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Lightbulb,
  Link2,
  type LucideIcon,
  MessageSquare,
  MessagesSquare,
  MousePointer2,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  StickyNote,
  Table2,
  Target,
  Trash2,
  Wand2,
  Workflow,
} from 'lucide-react';

import { getActionsForSurface, type IconName, runIdeaAction } from '@/actions/ideaActionRegistry';
import type {
  RightRailToolDescriptor,
  TopBarChipDescriptor,
} from '@/components/shared/ExecutiveModuleShell';

import type { CanvasToolType, IdeaWorkspaceSelection } from './ideaSelectionTypes';

// ── Per-tool identity icon (SSOT: superCanvasTypes.OBJECT_FAMILY_ICONS) ──────
export const IDEA_TOOL_ICON: Record<CanvasToolType, LucideIcon> = {
  mindmap: GitBranch,
  whiteboard: StickyNote,
  process_flow: Workflow,
  table: Table2,
};

// ── Menu 1 (top bar) — command chips ────────────────────────────────────────
export interface IdeaMenu1Handlers {
  /** "Discuss with Teresa" (ghost). */
  onDiscuss?: () => void;
  /** Export menu (real; also present on Menu 3). */
  onExport?: () => void;
  /** Version history — disabled placeholder until wired. */
  onHistory?: () => void;
  /** Duplicate idea — disabled placeholder until wired. */
  onDuplicate?: () => void;
  /** Delete idea — disabled placeholder until wired. */
  onDelete?: () => void;
  /** In-canvas search (folded under "Więcej"). */
  onSearch?: () => void;
  /** Keyboard-shortcuts help (folded under "Więcej"). */
  onShowHelp?: () => void;
}

/**
 * Menu 1 chip strip = ghost Teresa (secondary) + kebab `⋯` (overflow).
 * The primary "Konwertuj ▾" is NOT a chip — it is supplied by the host as the
 * shell's `primaryActionSlot` (needs a dropdown the flat chip contract can't
 * express). The right-panel toggle is the shell's own affordance.
 *
 * Kebab order (editor-shell-canon overflow pattern):
 *   default section  → Eksport · Historia · Duplikuj · Usuń (Usuń = danger)
 *   "Więcej" section → Szukaj · Skróty
 */
export function buildIdeaMenu1Chips(args: {
  handlers: IdeaMenu1Handlers;
  isPolish: boolean;
}): TopBarChipDescriptor[] {
  const { handlers, isPolish } = args;
  const soon = isPolish ? 'Wkrótce' : 'Coming soon';
  const chips: TopBarChipDescriptor[] = [];

  // Ghost Teresa — always-visible secondary entry to the unified AI.
  if (handlers.onDiscuss) {
    chips.push({
      id: 'idea-teresa',
      label: 'Teresa',
      icon: MessagesSquare,
      group: 'secondary',
      onClick: handlers.onDiscuss,
      tooltip: isPolish ? 'Omów z Teresą' : 'Discuss with Teresa',
      testId: 'idea-menu1-teresa',
    });
  }

  // Kebab `⋯` — document-level actions.
  chips.push({
    id: 'idea-export',
    label: isPolish ? 'Eksport' : 'Export',
    icon: Download,
    group: 'overflow',
    disabled: !handlers.onExport,
    onClick: handlers.onExport,
    testId: 'idea-menu1-export',
  });
  chips.push({
    id: 'idea-history',
    label: isPolish ? 'Historia' : 'History',
    icon: History,
    group: 'overflow',
    // Enabled once a version-history flow is wired (SnapshotHistory, all canvas
    // tools). Stays honest-disabled only if the caller passes no handler.
    disabled: !handlers.onHistory,
    onClick: handlers.onHistory,
    tooltip: handlers.onHistory ? undefined : soon,
    testId: 'idea-menu1-history',
  });
  chips.push({
    id: 'idea-duplicate',
    label: isPolish ? 'Duplikuj' : 'Duplicate',
    icon: Copy,
    group: 'overflow',
    disabled: !handlers.onDuplicate,
    onClick: handlers.onDuplicate,
    tooltip: handlers.onDuplicate ? undefined : soon,
    testId: 'idea-menu1-duplicate',
  });
  chips.push({
    id: 'idea-delete',
    label: isPolish ? 'Usuń' : 'Delete',
    icon: Trash2,
    group: 'overflow',
    danger: true,
    disabled: !handlers.onDelete,
    onClick: handlers.onDelete,
    tooltip: handlers.onDelete ? undefined : soon,
    testId: 'idea-menu1-delete',
  });

  // "Więcej" — power-user overflow (kept reachable, never hidden).
  if (handlers.onSearch) {
    chips.push({
      id: 'idea-search',
      label: isPolish ? 'Szukaj' : 'Search',
      icon: Search,
      group: 'overflow',
      overflowSection: isPolish ? 'Więcej' : 'More',
      onClick: handlers.onSearch,
      testId: 'idea-menu1-search',
    });
  }
  if (handlers.onShowHelp) {
    chips.push({
      id: 'idea-shortcuts',
      label: isPolish ? 'Skróty' : 'Shortcuts',
      icon: HelpCircle,
      group: 'overflow',
      overflowSection: isPolish ? 'Więcej' : 'More',
      onClick: handlers.onShowHelp,
      testId: 'idea-menu1-shortcuts',
    });
  }

  return chips;
}

// ── Menu 3 (second bar) — per-tool view actions ─────────────────────────────
export interface IdeaMenu3Action {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  tooltip?: string;
  testId?: string;
}

// Etykieta i ikona przycisku „Dodaj" zależą od aktywnego narzędzia (rozdz. 05:
// „ten sam builder, inny wynik") — to JEDYNA jawna różnica per reprezentacja w
// warstwie prezentacji Menu 3. Reszta pozycji ma jedną etykietę/ikonę.
const MENU3_ADD_LABEL: Record<CanvasToolType, { en: string; pl: string }> = {
  mindmap: { en: 'Add node', pl: 'Dodaj węzeł' },
  process_flow: { en: 'Add shape', pl: 'Dodaj kształt' },
  table: { en: 'Add row', pl: 'Dodaj wiersz' },
  whiteboard: { en: 'Add sticky', pl: 'Dodaj karteczkę' },
};

const MENU3_ADD_ICON: Record<CanvasToolType, LucideIcon> = {
  mindmap: Plus,
  process_flow: Workflow,
  table: Table2,
  whiteboard: Plus,
};

/**
 * Fallback ikon dla akcji, które w przyszłości dojdą do Menu 3 w rejestrze,
 * ale nie mają jeszcze wpisu w `MENU3_PRESENTATION`. Dzięki temu nowa akcja
 * `surfaces:['menu3']` pojawi się w pasku AUTOMATYCZNIE (o to chodzi w migracji
 * na render z rejestru), a nie zniknie po cichu.
 */
const ICON_BY_NAME: Record<IconName, LucideIcon> = {
  Plus,
  LayoutGrid,
  LayoutTemplate,
  Sparkles,
  Wand2,
  GitMerge,
  Search,
  Lightbulb,
  Target,
  MousePointer2,
  Workflow,
  Download,
  Copy,
};

/**
 * Prezentacja Menu 3 per identyfikator akcji z rejestru. Rejestr decyduje, KTÓRE
 * akcje się pokazują (filtr `surfaces`⊇`menu3` + `tools`⊇aktywne narzędzie) oraz
 * o ich KOLEJNOŚCI (porządek deklaracji w `IDEA_ACTIONS`). Ta tabela dokłada
 * warstwę widoczną (etykieta/ikona/klaster/stan pusty) tak, by po przepięciu
 * pasek wyglądał 1:1 jak stan zaakceptowany 2026-07-23 (kontrakt regresji, reguła
 * projektu #7 — zero cichej zmiany wyglądu).
 *
 * ⚠ ROZJAZD Z ETYKIETĄ/IKONĄ REJESTRU (świadomy, do decyzji wizualnej Piotra):
 *   • `idea.element.add` — rejestr ma jedną etykietę „Dodaj element"/ikonę `Plus`;
 *     UI zachowuje etykietę PER NARZĘDZIE („Dodaj węzeł/kształt/wiersz/karteczkę")
 *     i ikonę per narzędzie (MENU3_ADD_*), bo tak było dziś na ekranie.
 *   • `idea.view.auto_layout` — rejestr `LayoutGrid`, UI zachowuje `LayoutDashboard`.
 *   • `idea.ai.expand_map` — rejestr „AI: rozwiń mapę", UI zachowuje „AI rozwiń".
 * Ujednolicenie etykiet/ikon rejestr↔UI to zmiana WIZUALNA — nie robimy jej po
 * cichu przy migracji mechaniki.
 */
interface Menu3Presentation {
  itemId: string;
  testId: string;
  icon: LucideIcon;
  labelPl: string;
  labelEn: string;
  cluster: 'left' | 'right';
  /** Wyłączony, gdy reprezentacja pusta (dziś: „Eksport"). */
  needsContent?: boolean;
}

const MENU3_PRESENTATION: Record<string, Menu3Presentation> = {
  // labelPl/En dla „Dodaj" są nadpisywane per narzędzie niżej (MENU3_ADD_*).
  'idea.element.add': {
    itemId: 'menu3-add',
    testId: 'idea-menu3-add',
    icon: Plus,
    labelPl: 'Dodaj',
    labelEn: 'Add',
    cluster: 'left',
  },
  'idea.view.auto_layout': {
    itemId: 'menu3-auto-layout',
    testId: 'idea-menu3-auto-layout',
    icon: LayoutDashboard,
    labelPl: 'Auto-układ',
    labelEn: 'Auto-layout',
    cluster: 'left',
  },
  'idea.ai.expand_map': {
    itemId: 'menu3-ai-expand',
    testId: 'idea-menu3-ai-expand',
    icon: Sparkles,
    labelPl: 'AI rozwiń',
    labelEn: 'AI expand',
    cluster: 'left',
  },
  'idea.templates.open': {
    itemId: 'menu3-templates',
    testId: 'idea-menu3-templates',
    icon: LayoutTemplate,
    labelPl: 'Szablony',
    labelEn: 'Templates',
    cluster: 'left',
  },
  'idea.export.open': {
    itemId: 'menu3-export',
    testId: 'idea-menu3-export',
    icon: Download,
    labelPl: 'Eksport',
    labelEn: 'Export',
    cluster: 'right',
    needsContent: true,
  },
};

/**
 * Buduje pozycje Menu 3 Z REJESTRU AKCJI (pierwsza powierzchnia renderowana z
 * rejestru — wzorzec dla kolejnych). Host NIE trzyma już własnej listy pozycji:
 *   1. `getActionsForSurface('menu3', { tool })` zwraca zestaw akcji dostępnych
 *      w tej reprezentacji (filtr `surfaces`⊇`menu3` + `tools`) w kolejności
 *      deklaracji w rejestrze — czyli kolejność i grupowanie z rozdz. 05.
 *   2. Każda pozycja dostaje `onClick = runIdeaAction(id, ctx)` — TEN SAM tor
 *      wykonania, którego użyje Teresa (Z4); handlery żyją w rejestrze, nie tu.
 *   3. Warstwa widoczna (etykieta/ikona/klaster) z `MENU3_PRESENTATION`, z
 *      etykietą/ikoną „Dodaj" per narzędzie — żeby wygląd był 1:1 jak dziś.
 * `hasContent` wyłącza pozycje wymagające niepustej reprezentacji (Eksport).
 */
export function buildIdeaMenu3Actions(args: {
  tool: CanvasToolType;
  hasContent: boolean;
  isPolish: boolean;
  ideaId: string;
  selection: IdeaWorkspaceSelection;
}): { left: IdeaMenu3Action[]; right: IdeaMenu3Action[] } {
  const { tool, hasContent, isPolish, ideaId, selection } = args;
  const pl = isPolish;

  const left: IdeaMenu3Action[] = [];
  const right: IdeaMenu3Action[] = [];

  for (const { def } of getActionsForSurface('menu3', { tool })) {
    const pres = MENU3_PRESENTATION[def.id];
    const isAdd = def.id === 'idea.element.add';

    const label = isAdd
      ? MENU3_ADD_LABEL[tool][pl ? 'pl' : 'en']
      : pres
        ? pl
          ? pres.labelPl
          : pres.labelEn
        : def.label[pl ? 'pl' : 'en'];

    const icon = isAdd ? MENU3_ADD_ICON[tool] : pres ? pres.icon : ICON_BY_NAME[def.icon];

    const needsContent = pres?.needsContent ?? false;
    const disabled = needsContent && !hasContent;

    const action: IdeaMenu3Action = {
      id: pres?.itemId ?? `menu3-${def.id}`,
      label,
      icon,
      // Wykonanie idzie przez rejestr — jedno źródło prawdy dla kliknięcia w UI
      // i polecenia Teresy. Rejestrowy handler odmawia z komunikatem, gdy akcja
      // nie istnieje w tej reprezentacji, więc martwy klik jest niemożliwy.
      onClick: () => {
        void runIdeaAction(def.id, {
          ideaId,
          tool,
          selection,
          surface: 'menu3',
          source: 'ui',
          language: pl ? 'pl' : 'en',
        });
      },
      disabled,
      tooltip: disabled ? (pl ? 'Pusta mapa' : 'Empty map') : undefined,
      testId: pres?.testId,
    };

    if ((pres?.cluster ?? 'left') === 'right') right.push(action);
    else left.push(action);
  }

  return { left, right };
}

/**
 * KANON PRAWEGO PANELU (decyzja właściciela D1 —
 * docs/standards/idea-workspace/07_PRAWY_PANEL.md §1):
 *
 *     Przegląd · Właściwości · Powiązania · Komentarze · Historia
 *
 * Te same pięć zakładek obowiązuje w Idei i w kartach N (dawny SPEC-A §708).
 * Poprzedni zestaw (`problem · status · inspector · convert · health`) znika:
 *   • Problem + Status + Kondycja  → wchłania **Przegląd** (§4: zdrowie NIE jest
 *     osobną zakładką),
 *   • Inspektor                    → **Właściwości** (§1: termin z produktu,
 *     „Inspektor" to żargon narzędzi graficznych),
 *   • Konwersja                    → **Menu 1** (`IdeaConvertMenu` w
 *     `primaryActionSlot` powłoki) — §9: konwersja to akcja, nie zakładka.
 *
 * Identyfikatory MUSZĄ zgadzać się 1:1 z `IDEA_PANEL_SECTIONS`
 * (`IdeaWorkspaceTools.tsx`) — powłoka podaje id aktywnej ikony wprost jako
 * `onlySection`, więc rozjazd = pusty panel.
 */
export type IdeaCanvasRightToolId =
  | 'overview'
  | 'properties'
  | 'relations'
  | 'comments'
  | 'history';

/**
 * Stare identyfikatory sprzed kanonu D1. Przyjmujemy je nadal w `labels` /
 * `disabled` / `disabledReasons`, bo host (`IdeaMapWorkspace`, poza zakresem
 * tej zmiany) woła builder starymi kluczami. Mapowanie: patrz `LEGACY_NA_KANON`.
 */
export type IdeaCanvasRightToolLegacyId = 'problem' | 'status' | 'inspector' | 'convert' | 'health';

const LEGACY_NA_KANON: Record<IdeaCanvasRightToolLegacyId, IdeaCanvasRightToolId | null> = {
  problem: 'overview',
  status: 'overview',
  inspector: 'properties',
  // Kondycja żyje w Przeglądzie, Konwersja w Menu 1 — nie mają już własnej ikony.
  health: null,
  convert: null,
};

export interface IdeaCanvasRightRailLabels {
  overview: string;
  properties: string;
  relations: string;
  comments: string;
  history: string;
}

export const DEFAULT_IDEA_CANVAS_RIGHT_RAIL_LABELS: IdeaCanvasRightRailLabels = {
  overview: 'Overview',
  properties: 'Properties',
  relations: 'Relations',
  comments: 'Comments',
  history: 'History',
};

export const IDEA_CANVAS_RIGHT_RAIL_LABELS_PL: IdeaCanvasRightRailLabels = {
  overview: 'Przegląd',
  properties: 'Właściwości',
  relations: 'Powiązania',
  comments: 'Komentarze',
  history: 'Historia',
};

type KluczEtykiety = IdeaCanvasRightToolId | IdeaCanvasRightToolLegacyId;

/**
 * MOSTEK JĘZYKOWY (do usunięcia razem z aktualizacją hosta): host nie podaje
 * `isPolish`, tylko — gdy interfejs jest po polsku — komplet STARYCH etykiet
 * („Inspektor" / „Konwersja" / „Kondycja"). Ich obecność jednoznacznie
 * identyfikuje wywołanie polskie, więc dopóki host nie zacznie podawać
 * `isPolish` wprost, wykrywamy język po tych słowach. Nowe etykiety kanonu i
 * tak biorą się stąd (stare nazywały INNE zakładki — nie da się ich przenieść).
 */
function wykryjPolski(labels?: Partial<Record<KluczEtykiety, string>>): boolean {
  if (!labels) return false;
  return (
    labels.inspector === 'Inspektor' ||
    labels.convert === 'Konwersja' ||
    labels.health === 'Kondycja'
  );
}

export function buildIdeaCanvasRightRailTools(args?: {
  /** Etykiety kanonu; klucze sprzed D1 są przyjmowane i ignorowane (patrz wyżej). */
  labels?: Partial<Record<KluczEtykiety, string>>;
  /** Jawny język — preferowany nad mostkiem `wykryjPolski`. */
  isPolish?: boolean;
  disabled?: Partial<Record<KluczEtykiety, boolean>>;
  /**
   * Why a tab is unavailable for the active representation. A tab whose section
   * renders nothing MUST be disabled with a reason — a clickable icon that
   * opens an empty panel is a dead click.
   */
  disabledReasons?: Partial<Record<KluczEtykiety, string>>;
}): RightRailToolDescriptor[] {
  const polski = args?.isPolish ?? wykryjPolski(args?.labels);
  const bazowe = polski ? IDEA_CANVAS_RIGHT_RAIL_LABELS_PL : DEFAULT_IDEA_CANVAS_RIGHT_RAIL_LABELS;

  // Z kluczy starych bierzemy WYŁĄCZNIE stan wyłączenia i powód — etykiety
  // opisywały inne zakładki, więc byłyby mylące.
  const stan: Partial<Record<IdeaCanvasRightToolId, { disabled?: boolean; reason?: string }>> = {};
  const przypisz = (id: IdeaCanvasRightToolId | null, wyl?: boolean, powod?: string) => {
    if (!id) return;
    const biezacy = stan[id] ?? {};
    stan[id] = {
      disabled: biezacy.disabled || wyl,
      reason: wyl ? (powod ?? biezacy.reason) : biezacy.reason,
    };
  };
  for (const [klucz, wyl] of Object.entries(args?.disabled ?? {})) {
    const powod = args?.disabledReasons?.[klucz as KluczEtykiety];
    const kanon = (LEGACY_NA_KANON as Record<string, IdeaCanvasRightToolId | null>)[klucz];
    przypisz(kanon !== undefined ? kanon : (klucz as IdeaCanvasRightToolId), wyl, powod);
  }

  const etykieta = (id: IdeaCanvasRightToolId) => args?.labels?.[id] ?? bazowe[id];

  const opis = (id: IdeaCanvasRightToolId, icon: LucideIcon): RightRailToolDescriptor => ({
    id,
    label: etykieta(id),
    icon,
    disabled: stan[id]?.disabled,
    disabledReason: stan[id]?.reason,
  });

  return [
    // Przegląd — brief, etap, kompletność, statystyki, kondycja (§4).
    opis('overview', LayoutDashboard),
    // Właściwości — inspektor zaznaczenia / ustawienia reprezentacji (§5).
    opis('properties', SlidersHorizontal),
    // Powiązania — artefakty, źródła, backlinki (§6).
    opis('relations', Link2),
    // Komentarze — rozmowa zespołu i Teresy (§7).
    opis('comments', MessageSquare),
    // Historia — oś czasu zdarzeń i wersji (§8).
    opis('history', History),
  ];
}
