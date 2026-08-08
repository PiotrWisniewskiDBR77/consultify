/**
 * RowActionsMenu — JEDEN renderer menu wiersza dla KEBABA i dla PPM.
 *
 * Używany przez 26 miejsc renderowania (Inbox, Tasks, Decisions, Notifications,
 * Initiatives, Interview, Materials, Finance…). Kebab i menu prawego przycisku
 * to DWA TRIGGERY tego samego popovera — nie dwa projekty menu.
 *
 * ── R01 (pakiet naprawczy, `REPAIR_MASTER_PLAN.md` Fala 1) ──────────────────
 *
 * Kontrakt normatywny: `docs/ui-standards/MY_WORK_TABLE_SURFACE_CONTRACT_V1.md`
 * §7 (Kebab) i §8 (PPM). Kontrakt maszynowy: `src/contracts/tableSurface`
 * (pakiet R00) — `CANON_ROW_MENU`, `CANON_ROW_MENU_ZONE_ORDER`, walidatory.
 *
 * Co ten plik naprawia wobec stanu bazowego `d8b3979e65`:
 *
 *  1. STREFY. `RowActionSectionKind` dopuszcza siedem rodzajów sekcji, a renderer
 *     rysował separator przed KAŻDĄ sekcją o indeksie > 0 — stąd defekt
 *     `T01-KEBAB-K04` (P0): „Menu renders about 6 visually separated groups".
 *     Teraz normalizacja do trzech stref `context → manage → danger` dzieje się
 *     TUTAJ, w rendererze. Dzięki temu wszystkie 26 miejsc renderowania staje
 *     się kanonicznych bez edycji 26 plików, a sekcje już kanoniczne (wyjście
 *     `StandardTable.buildSections`) przechodzą bez zmiany.
 *  2. GEOMETRIA. Panel 220–320 px (było `min-w-[160px]` bez górnej granicy),
 *     pozycja h-9 = 36 px (było `py-1.5 text-xs` ≈ 26 px), ikona 16 px (było 14
 *     przy `size="sm"`), clearance od viewportu 12 px (było 8).
 *  3. KLAWIATURA. Było wyłącznie `Escape`. Jest ArrowUp/ArrowDown, Home/End,
 *     Enter/Space, Esc, typeahead oraz focus return: kebab → trigger,
 *     PPM → wiersz.
 *  4. DISABLED. Ścieżka legacy (`actions` bez `sections`) filtrowała
 *     `!action.disabled`, czyli USUWAŁA pozycje wyłączone. Kanon wymaga
 *     odwrotnie: pozycja ograniczona regułą ZOSTAJE, wyraźnie jaśniejsza.
 *     Atrapy („Coming soon"/„Wkrótce") nadal znikają — patrz `czyAtrapa`.
 *
 * CZEGO R01 NIE ROBI: nie zmienia Menu 1/2/3, preview, domen ani danych.
 * Model akcji po stronie fasady należy do `StandardTable` i NIE jest tu ruszany.
 */

import { ChevronDown, ChevronRight, MoreHorizontal, MoreVertical } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface RowAction {
  id: string;
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'primary';
  disabled?: boolean;
  hidden?: boolean;
  description?: string;
  rightLabel?: string;
  /**
   * @deprecated R01: separatory należą do stref, nie do pozycji. Pole jest
   * przyjmowane dla zgodności wstecznej, ale IGNOROWANE — inaczej pojedyncza
   * pozycja mogła dołożyć trzeci separator ponad limit z §7.
   */
  divider?: boolean;
  /** Optional inline sub-menu (e.g. Delay ▸ +1/+3/+7). Clicking the parent
   *  expands these items inline instead of firing onClick. */
  submenu?: RowAction[];
}

export type RowActionSectionKind =
  | 'context'
  | 'open'
  | 'ai'
  | 'convert'
  | 'output'
  | 'manage'
  | 'danger';

export interface RowActionSection {
  id: string;
  label?: string;
  kind?: RowActionSectionKind;
  actions: RowAction[];
}

interface RowActionsMenuProps {
  actions?: RowAction[];
  sections?: RowActionSection[];
  /** Size variant */
  size?: 'sm' | 'md';
  className?: string;
  /** Icon variant: horizontal "⋯" or vertical "⋮" */
  iconVariant?: 'horizontal' | 'vertical';
  /**
   * PPM-mirror (ANEKS #3b — `_PRZEGLAD_DOMOWY_WYNIKI_2026-07-10.md` #3/#33):
   * "DOKŁADNIE TO SAMO menu ma wyskakiwać pod prawym przyciskiem myszy".
   * When set to a viewport point, this SAME popover (same sections, same
   * repositioning mechanism) opens already-open, anchored at that point
   * instead of the kebab button — independent of the kebab's own open state.
   * The caller (e.g. a table row's onContextMenu) owns this state and must
   * clear it via `onContextMenuClose` to close (backdrop click/Escape/pick
   * all call it). Purely additive: omit both props and behavior is
   * byte-identical to today's kebab-only menu.
   */
  contextMenuAnchor?: { x: number; y: number } | null;
  onContextMenuClose?: () => void;
}

/**
 * Czy pozycja menu to ATRAPA — akcja, która istnieje na ekranie, ale nic nie
 * robi, bo jej po prostu nie zbudowano.
 *
 * Piotr, P-17 (Sejf) i P-18 (Run agent), 2026-07-27: „Ta tabela jest w ogóle
 * wbrew jakimkolwiek standardom" — przy kebabie, w którym 3 z 4 pozycji były
 * martwe. Przegląd 128 zrzutów naliczył takich menu pięć (Sejf 3/4, Run agent
 * Szablony 3/4, Run agent Procesy 2/4, Documents→Sheets 3/7, Interview→
 * Initiatives 3/6), a jako wzorzec wskazał kebab Interview→Templates: dziewięć
 * pozycji, ZERO wyłączonych.
 *
 * Sprawdziłem, zanim to napisałem: „Coming soon (backend)" mówi prawdę —
 * `my_ideas` i siostrzane tabele nie mają nawet kolumny na archiwizację, a
 * `POST /archive` istnieje wyłącznie dla sesji wywiadu i report-buildera.
 * Czyli to nie jest coś, co da się „włączyć" — to funkcja do zbudowania.
 *
 * Dlatego menu jej nie pokazuje. Rozróżnienie jest celowe i przebiega po
 * TREŚCI komunikatu:
 *   - „jeszcze tego nie ma" (Coming soon / Wkrótce)  → ATRAPA, znika z menu;
 *   - „nie wolno, bo…" (`AI-generated — read-only`, `Archive first`,
 *     `Safes are automatic — cannot be deleted`) → ZOSTAJE wyłączone z powodem,
 *     bo uczy użytkownika reguły produktu zamiast go oszukiwać.
 *
 * R01 rozszerza wykrywanie na `label` — atrapa nazwana wprost w etykiecie
 * („Export (coming soon)") przechodziła dotąd przez filtr, mimo że §1 zabrania
 * jej bezwarunkowo.
 */
const ATRAPA_WZORZEC = /coming soon|wkrótce|wkrotce/i;

export function czyAtrapa(
  action: Pick<RowAction, 'disabled' | 'description' | 'rightLabel'> & { label?: string }
) {
  // Etykieta zdradza atrapę niezależnie od stanu `disabled` — pozycja aktywna
  // nazwana „Coming soon" jest kłamstwem tak samo jak wyłączona.
  if (ATRAPA_WZORZEC.test(action.label ?? '')) return true;
  if (!action.disabled) return false;
  return ATRAPA_WZORZEC.test(`${action.description ?? ''} ${action.rightLabel ?? ''}`);
}

// ── Normalizacja stref (§7) ─────────────────────────────────────────────────

type CanonicalZone = 'context' | 'manage' | 'danger';

/** Kanoniczna kolejność stref. Pusta strefa znika razem ze swoim separatorem. */
const ZONE_ORDER: readonly CanonicalZone[] = ['context', 'manage', 'danger'];

/**
 * `actionId` należące do strefy manage (§7 Manage — Open preview → Edit →
 * Archive/Restore → Delay). Rozpoznawane po identyfikatorze, bo ścieżki legacy
 * nie deklarują `kind`.
 */
const MANAGE_IDS = new Set([
  'open-preview',
  'preview',
  'edit',
  'rename',
  'archive',
  'restore',
  'delay',
  'snooze',
]);

/** `actionId` strefy danger. `variant: 'danger'` rozstrzyga tak samo. */
const DANGER_IDS = new Set(['delete', 'destructive', 'reject', 'move-to-trash', 'remove']);

function zoneOfAction(action: RowAction, sectionZone?: CanonicalZone): CanonicalZone {
  if (action.variant === 'danger' || DANGER_IDS.has(action.id)) return 'danger';
  if (sectionZone) return sectionZone;
  return MANAGE_IDS.has(action.id) ? 'manage' : 'context';
}

function zoneOfSection(section: RowActionSection): CanonicalZone | undefined {
  const kind = section.kind ?? (section.id as RowActionSectionKind | undefined);
  switch (kind) {
    case 'danger':
      return 'danger';
    case 'context':
    case 'open':
      return 'context';
    case 'manage':
    case 'ai':
    case 'convert':
    case 'output':
      // §10: Idea/AI/Convert/Output NIE tworzą dodatkowych stref wizualnych —
      // są mapowane do context/manage według skutku.
      return 'manage';
    default:
      // Sekcja bez `kind` (np. legacy `[{ id: 'legacy', actions }]`) nie narzuca
      // strefy — rozstrzyga wtedy sam `actionId`.
      return undefined;
  }
}

/**
 * Składa dowolne wejście (sekcje kanoniczne, sekcje legacy, płaska tablica)
 * w maksymalnie trzy strefy w stałej kolejności.
 *
 * Kolejność akcji WEWNĄTRZ strefy jest zachowana dokładnie taka, jaką podał
 * wywołujący — normalizacja porządkuje strefy, nigdy nie sortuje akcji.
 */
export function normalizeZones(
  sections: RowActionSection[]
): Array<{ zone: CanonicalZone; actions: RowAction[] }> {
  const buckets: Record<CanonicalZone, RowAction[]> = { context: [], manage: [], danger: [] };

  for (const section of sections) {
    const sectionZone = zoneOfSection(section);
    for (const action of section.actions) {
      if (action.hidden || czyAtrapa(action)) continue;
      buckets[zoneOfAction(action, sectionZone)].push(action);
    }
  }

  return ZONE_ORDER.map((zone) => ({ zone, actions: buckets[zone] })).filter(
    (group) => group.actions.length > 0
  );
}

// ── Geometria (§7 kontrakt graficzny) ───────────────────────────────────────

const PANEL_MIN_WIDTH = 220;
const PANEL_MAX_WIDTH = 320;
/** Minimalny odstęp od krawędzi viewportu przed auto-flip/clamp. */
const VIEWPORT_CLEARANCE = 12;
/** Odstęp panelu od triggera. */
const ANCHOR_GAP = 6;

export const RowActionsMenu: React.FC<RowActionsMenuProps> = ({
  actions = [],
  sections,
  size = 'sm',
  className = '',
  // App Table Standard (v3): always prefer vertical kebab (⋮)
  iconVariant = 'vertical',
  contextMenuAnchor = null,
  onContextMenuClose,
}) => {
  const [kebabOpen, setKebabOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typeaheadRef = useRef<{ buffer: string; at: number }>({ buffer: '', at: 0 });
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    right: number;
    maxWidth: number;
    placement: 'top' | 'bottom';
  } | null>(null);

  // Either trigger can drive the SAME popover: kebab click (internal state)
  // or the PPM-mirror context-menu anchor (externally controlled point).
  const isOpen = kebabOpen || !!contextMenuAnchor;
  const isContextMenu = !!contextMenuAnchor;

  /**
   * Focus return (§7, §8). Kebab wraca do triggera, PPM do wiersza. Element
   * docelowy zapamiętujemy w chwili otwarcia, bo po zamknięciu anchor PPM już
   * nie istnieje.
   */
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const closeMenu = useCallback(() => {
    setKebabOpen(false);
    onContextMenuClose?.();
  }, [onContextMenuClose]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setKebabOpen((prev) => !prev);
  }, []);

  // Capture anchor rect on open and keep updated on scroll/resize. In
  // context-menu mode the anchor is the cursor point itself (static viewport
  // coords) — no button to measure/track.
  useEffect(() => {
    if (!isOpen) {
      setAnchorRect(null);
      setPanelPos(null);
      setExpandedId(null);
      setActiveIndex(-1);
      return;
    }

    if (contextMenuAnchor) {
      // PPM: focus wraca do WIERSZA, zgodnie z §8 pkt 3.
      // `elementFromPoint` bywa nieobecne (jsdom, starsze środowiska testowe),
      // a wyjątek tutaj wywracałby CAŁY wiersz przy każdym prawym kliknięciu —
      // focus return jest udogodnieniem, nie warunkiem otwarcia menu.
      const fromPoint =
        typeof document.elementFromPoint === 'function'
          ? document.elementFromPoint(contextMenuAnchor.x, contextMenuAnchor.y)
          : null;
      returnFocusRef.current = (fromPoint?.closest('tr') as HTMLElement | null) ?? null;
      setAnchorRect({
        top: contextMenuAnchor.y,
        bottom: contextMenuAnchor.y,
        left: contextMenuAnchor.x,
        right: contextMenuAnchor.x,
        width: 0,
        height: 0,
      } as DOMRect);
      return;
    }

    returnFocusRef.current = buttonRef.current;

    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect() || null;
      setAnchorRect(rect);
    };
    update();

    window.addEventListener('resize', update);
    // Capture scroll from any scroll container
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen, contextMenuAnchor]);

  // Position panel (fixed) so it won't be clipped by overflow containers.
  // Right-anchored to the button's right edge via CSS `right` — robust to panel width
  // (no width measurement, which mis-fired on first paint and detached the menu). A
  // ResizeObserver re-runs once the panel settles, so height-based flip is also correct.
  useLayoutEffect(() => {
    if (!isOpen) return;
    if (!anchorRect) return;
    const panel = panelRef.current;
    if (!panel) return;

    const reposition = () => {
      const p = panelRef.current;
      if (!p) return;
      const panelHeight = p.offsetHeight || 200;

      // Auto-flip: w dół, jeśli się mieści; w górę, jeśli tylko tam jest miejsce.
      const canOpenDown =
        anchorRect.bottom + ANCHOR_GAP + panelHeight <= window.innerHeight - VIEWPORT_CLEARANCE;
      const canOpenUp = anchorRect.top - ANCHOR_GAP - panelHeight >= VIEWPORT_CLEARANCE;
      const placement: 'top' | 'bottom' = !canOpenDown && canOpenUp ? 'top' : 'bottom';

      // Clamp: nawet po flipie panel nie wychodzi poza viewport (1280×720 — §9).
      const top =
        placement === 'bottom'
          ? Math.min(
              window.innerHeight - VIEWPORT_CLEARANCE - panelHeight,
              anchorRect.bottom + ANCHOR_GAP
            )
          : Math.max(VIEWPORT_CLEARANCE, anchorRect.top - ANCHOR_GAP - panelHeight);

      // Anchor the panel's RIGHT edge to the button's right edge. The panel grows leftward,
      // so its width never affects horizontal placement. Clamp width so it can't overflow left.
      const right = Math.max(VIEWPORT_CLEARANCE, Math.round(window.innerWidth - anchorRect.right));
      // Górna granica 320 px (§7), zawężana gdy do lewej krawędzi jest bliżej.
      // Dolna granica 220 px trzyma CSS (`min-w-[220px]`) — przy skrajnie wąskim
      // viewporcie wygrywa ona, bo wąskie menu jest lepsze od obciętej etykiety.
      const available = Math.round(anchorRect.right - VIEWPORT_CLEARANCE);
      const maxWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, available));

      setPanelPos({ top: Math.max(VIEWPORT_CLEARANCE, top), right, maxWidth, placement });
    };

    reposition();
    const ro = new ResizeObserver(reposition);
    ro.observe(panel);
    return () => ro.disconnect();
  }, [isOpen, anchorRect]);

  const visibleSections = useMemo<RowActionSection[]>(() => {
    // Jedno wejście dla obu ścieżek: sekcje albo płaska tablica legacy.
    // Płaska tablica NIE jest już filtrowana po `disabled` — pozycja ograniczona
    // regułą ma zostać widoczna (§1, §7 Manage, §10 Disabled). Znikają wyłącznie
    // atrapy, co robi `normalizeZones` przez `czyAtrapa`.
    const source: RowActionSection[] = sections?.length
      ? sections
      : actions.length
        ? [{ id: 'legacy', actions }]
        : [];

    return normalizeZones(source).map((group) => ({
      id: group.zone,
      kind: group.zone,
      actions: group.actions,
    }));
  }, [actions, sections]);

  /**
   * Płaska lista pozycji w kolejności wizualnej — podstawa nawigacji klawiaturą.
   * Zawiera rozwinięte submenu, żeby ArrowDown wchodził w presety Delay.
   */
  const flatItems = useMemo(() => {
    const items: Array<{ action: RowAction; isSub: boolean; parentId?: string }> = [];
    for (const section of visibleSections) {
      for (const action of section.actions) {
        items.push({ action, isSub: false });
        if (action.submenu?.length && expandedId === action.id) {
          for (const sub of action.submenu) {
            items.push({ action: sub, isSub: true, parentId: action.id });
          }
        }
      }
    }
    return items;
  }, [visibleSections, expandedId]);

  const runAction = useCallback(
    (action: RowAction, hasSub: boolean) => {
      if (action.disabled) return;
      if (hasSub) {
        setExpandedId((prev) => (prev === action.id ? null : action.id));
        return;
      }
      action.onClick();
      closeMenu();
    },
    [closeMenu]
  );

  /** Następny indeks pomijający pozycje wyłączone (widoczne, ale nieaktywne). */
  const nextEnabledIndex = useCallback(
    (from: number, step: number): number => {
      if (flatItems.length === 0) return -1;
      let index = from;
      for (let hops = 0; hops < flatItems.length; hops += 1) {
        index = (index + step + flatItems.length) % flatItems.length;
        if (!flatItems[index].action.disabled) return index;
      }
      return -1;
    },
    [flatItems]
  );

  // Klawiatura (§7): ArrowUp/ArrowDown, Home/End, Enter/Space, Esc, typeahead.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': {
          e.preventDefault();
          // Esc zamyka NAJBARDZIEJ LOKALNĄ warstwę: submenu → menu (§9).
          if (expandedId) {
            setExpandedId(null);
            return;
          }
          closeMenu();
          return;
        }
        case 'ArrowDown': {
          e.preventDefault();
          setActiveIndex((prev) => nextEnabledIndex(prev, 1));
          return;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setActiveIndex((prev) => nextEnabledIndex(prev === -1 ? 0 : prev, -1));
          return;
        }
        case 'Home': {
          e.preventDefault();
          setActiveIndex(nextEnabledIndex(-1, 1));
          return;
        }
        case 'End': {
          e.preventDefault();
          setActiveIndex(nextEnabledIndex(0, -1));
          return;
        }
        case 'Enter':
        case ' ': {
          if (activeIndex < 0 || activeIndex >= flatItems.length) return;
          e.preventDefault();
          const item = flatItems[activeIndex];
          runAction(item.action, !item.isSub && !!item.action.submenu?.length);
          return;
        }
        default:
          break;
      }

      // Typeahead — pojedyncze znaki drukowalne skaczą do pozycji po etykiecie.
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
      const now = Date.now();
      const state = typeaheadRef.current;
      state.buffer = now - state.at > 700 ? e.key : state.buffer + e.key;
      state.at = now;
      const needle = state.buffer.toLowerCase();
      const found = flatItems.findIndex(
        (item) => !item.action.disabled && item.action.label.toLowerCase().startsWith(needle)
      );
      if (found >= 0) {
        e.preventDefault();
        setActiveIndex(found);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, expandedId, activeIndex, flatItems, nextEnabledIndex, runAction, closeMenu]);

  // Roving focus — aktywna pozycja dostaje realny focus DOM.
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    itemRefs.current[activeIndex]?.focus();
  }, [isOpen, activeIndex]);

  // Focus return po zamknięciu (§7, §8).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    const target = returnFocusRef.current;
    if (target && typeof target.focus === 'function' && document.contains(target)) {
      target.focus();
    }
  }, [isOpen]);

  if (visibleSections.length === 0) return null;

  // §7 Trigger: hit target min. 32×32 px, glyph 16 px. `size` steruje wyłącznie
  // triggerem — ikona pozycji menu jest kanoniczne 16 px niezależnie od wariantu.
  const iconSize = size === 'sm' ? 16 : 16;
  const buttonHit = 'h-8 w-8 inline-flex items-center justify-center';
  const MenuIcon = iconVariant === 'vertical' ? MoreVertical : MoreHorizontal;

  // §7: wszystkie zwykłe akcje mają ten sam neutralny kolor; WYŁĄCZNIE danger
  // jest czerwony. `primary` nie wyróżnia się kolorem w menu wiersza.
  const variantStyles: Record<string, string> = {
    default: 'text-c-text hover:bg-state-hover',
    primary: 'text-c-text hover:bg-state-hover',
    danger: 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20',
  };

  let renderIndex = -1;

  return (
    <div className={`inline-block ${className}`}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`${buttonHit} rounded-md text-slate-600 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-state-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`}
        title="Actions"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <MenuIcon size={iconSize} />
      </button>

      {isOpen &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-context-menu"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeMenu();
              }}
              onContextMenu={(e) => {
                // Drugi PPM zamyka menu zamiast otwierać menu przeglądarki.
                e.preventDefault();
                e.stopPropagation();
                closeMenu();
              }}
            />
            <div
              ref={panelRef}
              data-row-actions-menu={contextMenuAnchor ? 'context' : 'kebab'}
              className="fixed z-context-menu min-w-[220px] rounded-xl border border-c-border-subtle bg-c-surface-raised shadow-lg py-1.5 animate-in fade-in-0 zoom-in-95"
              role="menu"
              style={
                panelPos
                  ? {
                      top: panelPos.top,
                      right: panelPos.right,
                      maxWidth: panelPos.maxWidth,
                      transformOrigin: panelPos.placement === 'top' ? 'bottom right' : 'top right',
                    }
                  : { top: -9999, right: -9999, maxWidth: PANEL_MAX_WIDTH }
              }
              onClick={(e) => {
                // Prevent row click/selection from firing behind the menu.
                e.stopPropagation();
              }}
            >
              {visibleSections.map((section, sectionIndex) => {
                return (
                  <React.Fragment key={section.id}>
                    {/*
                      Separator WYŁĄCZNIE między dwiema sąsiednimi wyrenderowanymi
                      strefami (§7). Trzy strefy → 2 separatory; brak strefy
                      context → 1. Więcej niż 2 jest niewyrażalne, bo stref jest 3.
                    */}
                    {sectionIndex > 0 && (
                      <div className="my-1 border-t border-c-border-subtle" role="separator" />
                    )}
                    {section.actions.map((action) => {
                      const Icon = action.icon;
                      const hasSub = !!action.submenu?.length;
                      const expanded = expandedId === action.id;
                      renderIndex += 1;
                      const myIndex = renderIndex;
                      return (
                        <React.Fragment key={action.id}>
                          <button
                            ref={(el) => {
                              itemRefs.current[myIndex] = el;
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              runAction(action, hasSub);
                            }}
                            onMouseEnter={() => setActiveIndex(myIndex)}
                            disabled={action.disabled}
                            tabIndex={-1}
                            className={`w-full flex items-center gap-2 px-3 h-9 text-left text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-45 ${variantStyles[action.variant || 'default']}`}
                            role="menuitem"
                            aria-disabled={action.disabled || undefined}
                            aria-expanded={hasSub ? expanded : undefined}
                            title={action.disabled ? undefined : action.description}
                          >
                            {Icon && <Icon size={16} className="shrink-0" />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{action.label}</span>
                              {/*
                                POWÓD BLOKADY NIE JEST PREZENTOWANY (§1, §7, §10).
                                Decyzja zarządzająca R01 (2026-08-06) rozstrzygnęła
                                konflikt na korzyść kanonu i jest NADRZĘDNA wobec
                                P-17/P-18 z 2026-07-28: pozycja ograniczona regułą
                                zostaje widoczna i jaśniejsza, ale bez dopisku i bez
                                tooltipa. Powód nadal PRZYCHODZI w `action.description`
                                i pozostaje dostępny deskryptorowi capability oraz
                                audytowi — usunięta jest wyłącznie jego PREZENTACJA,
                                nie stan biznesowy ani sama blokada.
                                Atrapy („Coming soon") tu nie docierają — odsiewa je
                                `czyAtrapa` w `normalizeZones`.
                              */}
                              {action.description && !action.disabled ? (
                                <span className="mt-0.5 block truncate text-[10px] font-normal text-c-text-muted">
                                  {action.description}
                                </span>
                              ) : null}
                            </span>
                            {action.rightLabel ? (
                              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                                {action.rightLabel}
                              </span>
                            ) : null}
                            {hasSub ? (
                              expanded ? (
                                <ChevronDown size={16} className="shrink-0 opacity-60" />
                              ) : (
                                <ChevronRight size={16} className="shrink-0 opacity-60" />
                              )
                            ) : null}
                          </button>
                          {hasSub && expanded
                            ? action.submenu!.map((sub) => {
                                const SubIcon = sub.icon;
                                renderIndex += 1;
                                const subIndex = renderIndex;
                                return (
                                  <button
                                    key={sub.id}
                                    ref={(el) => {
                                      itemRefs.current[subIndex] = el;
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      runAction(sub, false);
                                    }}
                                    onMouseEnter={() => setActiveIndex(subIndex)}
                                    disabled={sub.disabled}
                                    tabIndex={-1}
                                    className={`w-full flex items-center gap-2 py-1.5 pl-8 pr-3 h-9 text-left text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-45 ${variantStyles[sub.variant || 'default']}`}
                                    role="menuitem"
                                    aria-disabled={sub.disabled || undefined}
                                  >
                                    {SubIcon && <SubIcon size={16} className="shrink-0" />}
                                    <span className="min-w-0 flex-1 truncate">{sub.label}</span>
                                  </button>
                                );
                              })
                            : null}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </div>
  );
};

export default RowActionsMenu;
