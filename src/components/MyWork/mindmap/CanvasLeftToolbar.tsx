import {
  Columns3,
  Diamond,
  FileText,
  Filter,
  Frame,
  GitBranch,
  Grid3x3,
  GripVertical,
  Hand,
  LayoutGrid,
  LayoutTemplate,
  Link2,
  Magnet,
  MessageSquare,
  MoreHorizontal,
  MousePointer2,
  Pen,
  Play,
  Plus,
  Redo2,
  Sparkles,
  Square,
  StickyNote,
  Type,
  Undo2,
  Upload,
  Workflow,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { type ActionContext, getActionsForSurface, runIdeaAction } from '@/actions/ideaActionRegistry';
import { useFullscreenPortalTarget } from '@/hooks/useFullscreenPortalTarget';

import {
  IDEA_CANVAS_CURSOR_MODE_EVENT,
  type IdeaCanvasCursorMode,
  type IdeaCanvasCursorModeDetail,
} from '../canvas/ideaCanvasCursorMode';
import { FOCUS_RING } from '../canvas/motionTokens';
import {
  PROCESS_FLOW_GRID_STATE_EVENT,
  type ProcessFlowGridStateDetail,
} from '../canvas/processFlowGridState';
import type {
  CanvasToolType,
  IdeaWorkspaceSelection,
  MindMapInteractionMode,
} from '../ideaSelectionTypes';
import { getIdeaWorkspaceToolLabel, TOOL_CONFIG } from '../IdeaWorkspaceToolbar';
import { isTableDataRailEnabled } from './ideaTableDataRailFlag';
import {
  getMindmapConnectToolbarAction,
  getMindmapPointerToggleTooltip,
} from './mindmapInteractionGrammar';
import { AddNodePopover } from './toolbar-popovers/AddNodePopover';
import { AIActionsPopover } from './toolbar-popovers/AIActionsPopover';
import { ImportExportPopover } from './toolbar-popovers/ImportExportPopover';
import { KnowledgePopover } from './toolbar-popovers/KnowledgePopover';
import { MoreToolsPanel } from './toolbar-popovers/MoreToolsPanel';
import { TemplatesPopover } from './toolbar-popovers/TemplatesPopover';

type PopoverId = 'templates' | 'addNode' | 'knowledge' | 'importExport' | 'ai' | 'more' | null;

interface CanvasLeftToolbarProps {
  /** Physical canvas edge. The component keeps its legacy name during migration. */
  side?: 'left' | 'right';
  activeTool: CanvasToolType;
  interactionMode?: MindMapInteractionMode;
  selection: IdeaWorkspaceSelection;
  isAccepted: boolean;
  ideaId?: string;
  canUndo?: boolean;
  canRedo?: boolean;
  /** DP-5: enables heuristic AI actions in the AI popover (mindmapHeuristicAiOverlays flag). */
  heuristicAiEnabled?: boolean;
  onAction: (action: string) => void;
  onOpenChat: () => void;
  onApplyTemplate: (templateId: string) => void;
  onOpenTemplateGallery: () => void;
  /**
   * #6a (zone split, 2026-07-12): switches the active canvas system
   * (mindmap/whiteboard/process_flow/table). Renders as its own icon group at
   * the top of the rail — moved here from the top-right IdeaWorkspaceToolbar
   * widget, same icons/tooltips, just relocated. Optional so existing
   * embeds that don't need the switcher (none today) keep compiling.
   */
  onToolChange?: (tool: CanvasToolType) => void;
  /** Per-tool "has content" dot, shown on inactive switcher icons. */
  familyCounts?: Record<string, number>;
  /**
   * UI-L1 (Editor Shell Canon §2 LEWA): the rail must float on the *canvas* edge,
   * not the viewport edge. The toolbar is portaled to `document.body` for z-index
   * safety, so a bare `fixed left-3` lands on top of the app sidebar and clips its
   * nav labels. We anchor the rail to this container's left edge instead, so it
   * behaves like Miro/Figma (tools belong to the canvas, not the app chrome).
   */
  canvasContainerRef?: React.RefObject<HTMLElement | null>;
}

type RailPosition = { x: number; y: number };

const railPositionKey = (tool: CanvasToolType) => `consultify:ideas:tool-rail:${tool}:v1`;

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

interface ToolSlot {
  id: string;
  icon: IconComponent;
  tkey: string;
  labelEn: string;
  action?: string;
  popover?: PopoverId;
  /**
   * P1-1 (Z3 — zero cichych braków reakcji): reprezentacje, w których ten slot
   * MA realny odbiornik. Rail jest wspólny dla czterech reprezentacji.
   * Brak pola = slot żyje wszędzie.
   *
   * Dwa różne traktowania, zależnie od PRZYCZYNY braku (2026-07-24, standard
   * `docs/standards/idea-workspace/06_LEWY_RAIL.md` §2/§7):
   *  - slot niesie prawdziwą informację dziedzinową o aktywnej reprezentacji,
   *    gdy wyłączony (dziś tylko `pointer_toggle` w Tabeli — „to siatka danych,
   *    nie płótno") → zostaje WYŁĄCZONY z `offReason*` w tooltipie;
   *  - slot to po prostu funkcja, której dana reprezentacja nie ma wcale
   *    (dziś `import`, `more` poza Mapą myśli) → slot ZNIKA z raila tej
   *    reprezentacji (patrz `usunNieobslugiwaneSloty`), nie wisi wyszarzony —
   *    to była atrapa „wkrótce", usunięta decyzją właściciela (Z3).
   */
  liveIn?: CanvasToolType[];
  /** Powód wyłączenia (PL/EN) — tylko dla slotów z prawdziwą informacją dziedzinową. */
  offReasonPl?: string;
  offReasonEn?: string;
  /**
   * D2 (2026-07-28): slot jest PSTRYCZKIEM (wł./wył.), nie jednorazową akcją —
   * rail musi pokazać, czy funkcja jest włączona, inaczej ikona jest ślepa.
   * Stan przychodzi z reprezentacji zdarzeniem (patrz `canvas/processFlowGridState`).
   */
  toggle?: 'grid' | 'snap';
}

const SHARED_TOP: ToolSlot[] = [
  {
    id: 'pointer_toggle',
    icon: MousePointer2,
    tkey: 'myWorkMindmap.toolbar.cursorMode',
    labelEn: 'Cursor mode',
    action: 'mm_toggle_pointer',
    // Z1 (rozdz. 06 §3, 2026-07-23): tryb kursora działa REALNIE w trzech
    // płótnach. Mapa myśli czyta `mindMapInteractionMode`; Tablica i Przepływ
    // przyjmują `mm_select_mode` / `mm_pan_mode` we własnych hookach quick
    // actions i tłumaczą je na propsy ReactFlow (canvas/ideaCanvasCursorMode.ts).
    // Wcześniej slot był tu wyłączony, bo poza Mapą zmieniał tylko własną ikonę.
    // Tabela zostaje wyłączona świadomie — rozdz. 06 §7 zakazuje pojęć
    // canvasowych (rączka/pan) w siatce danych.
    liveIn: ['mindmap', 'whiteboard', 'process_flow'],
    offReasonPl: 'tryb kursora dotyczy płótna — Tabela to siatka danych, nie płótno',
    offReasonEn: 'cursor mode belongs to a canvas — Table is a data grid, not a canvas',
  },
  // #6j: AI na samej górze raila, zaraz pod wskaźnikiem trybu chwytu —
  // najcenniejsza część raila, ma być widoczna od razu z góry.
  { id: 'ai', icon: Sparkles, tkey: 'myWorkMindmap.toolbar.ai', labelEn: 'AI', popover: 'ai' },
  {
    id: 'templates',
    icon: LayoutTemplate,
    tkey: 'myWorkMindmap.toolbar.templates',
    labelEn: 'Templates',
    popover: 'templates',
  },
];

const MM_CONTEXT_SLOTS: ToolSlot[] = [
  {
    id: 'frame',
    icon: Frame,
    tkey: 'myWorkMindmap.toolbar.mm.frame',
    labelEn: 'Frame',
    action: 'mm_add_frame',
  },
  {
    id: 'add',
    icon: GitBranch,
    tkey: 'myWorkMindmap.toolbar.mm.addNode',
    labelEn: 'Add node',
    popover: 'addNode',
  },
  {
    id: 'knowledge',
    icon: FileText,
    tkey: 'myWorkMindmap.toolbar.mm.knowledge',
    labelEn: 'Knowledge',
    popover: 'knowledge',
  },
  {
    id: 'comment',
    icon: MessageSquare,
    tkey: 'myWorkMindmap.toolbar.mm.comments',
    labelEn: 'Comments',
    action: 'mm_comments',
  },
  {
    id: 'connect',
    icon: Link2,
    tkey: 'myWorkMindmap.toolbar.mm.connect',
    labelEn: 'Connect — drag from one node handle to another',
    action: 'mm_connect_mode',
  },
  {
    id: 'present',
    icon: Play,
    tkey: 'myWorkMindmap.toolbar.mm.present',
    labelEn: 'Present',
    action: 'mm_presentation',
  },
];

const WB_CONTEXT_SLOTS: ToolSlot[] = [
  {
    id: 'sticky',
    icon: StickyNote,
    tkey: 'myWorkMindmap.toolbar.wb.sticky',
    labelEn: 'Sticky',
    action: 'wb_add_sticky',
  },
  {
    id: 'text',
    icon: Type,
    tkey: 'myWorkMindmap.toolbar.wb.text',
    labelEn: 'Text',
    action: 'wb_add_text',
  },
  {
    id: 'shape',
    icon: Square,
    tkey: 'myWorkMindmap.toolbar.wb.shape',
    labelEn: 'Shape',
    action: 'wb_add_shape_rectangle',
  },
  {
    id: 'pen',
    icon: Pen,
    tkey: 'myWorkMindmap.toolbar.wb.draw',
    labelEn: 'Draw',
    action: 'wb_mode_draw',
  },
  {
    id: 'frame',
    icon: Frame,
    tkey: 'myWorkMindmap.toolbar.wb.frame',
    labelEn: 'Frame',
    action: 'wb_add_frame',
  },
];

const PF_CONTEXT_SLOTS: ToolSlot[] = [
  {
    id: 'start',
    icon: Workflow,
    tkey: 'myWorkMindmap.toolbar.pf.startEnd',
    labelEn: 'Start/End',
    action: 'pf_add_start',
  },
  {
    id: 'task',
    icon: Square,
    tkey: 'myWorkMindmap.toolbar.pf.task',
    labelEn: 'Task',
    action: 'pf_add_action',
  },
  {
    id: 'decision',
    icon: Diamond,
    tkey: 'myWorkMindmap.toolbar.pf.decision',
    labelEn: 'Decision',
    action: 'pf_add_decision',
  },
  {
    id: 'lane',
    icon: Plus,
    tkey: 'myWorkMindmap.toolbar.pf.lane',
    labelEn: 'Lane',
    action: 'pf_add_lane',
  },
  // Frame removed: Process Flow has no frame concept (lanes group instead).
  // It emitted dead `wb_add_frame` (no PF handler) = no-op copy-paste from whiteboard.
];

const TBL_CONTEXT_SLOTS: ToolSlot[] = [
  {
    id: 'row',
    icon: Plus,
    tkey: 'myWorkMindmap.toolbar.tbl.addRow',
    labelEn: 'Add row',
    action: 'tbl_add_row',
  },
  {
    id: 'cols',
    icon: Columns3,
    tkey: 'myWorkMindmap.toolbar.tbl.columns',
    labelEn: 'Columns',
    action: 'tbl_add_column',
  },
  {
    id: 'grid',
    icon: LayoutGrid,
    tkey: 'myWorkMindmap.toolbar.tbl.view',
    labelEn: 'View',
    action: 'tbl_grid',
  },
  {
    id: 'filter',
    icon: Filter,
    tkey: 'myWorkMindmap.toolbar.tbl.filter',
    labelEn: 'Filter',
    action: 'tbl_filter',
  },
  {
    id: 'summary',
    icon: Frame,
    tkey: 'myWorkMindmap.toolbar.tbl.dashboard',
    labelEn: 'Dashboard',
    action: 'tbl_summary',
  },
];

const CONTEXT_SLOTS: Record<CanvasToolType, ToolSlot[]> = {
  mindmap: MM_CONTEXT_SLOTS,
  whiteboard: WB_CONTEXT_SLOTS,
  process_flow: PF_CONTEXT_SLOTS,
  table: TBL_CONTEXT_SLOTS,
};

const SHARED_BOTTOM: ToolSlot[] = [
  {
    id: 'import',
    icon: Upload,
    tkey: 'myWorkMindmap.toolbar.importExport',
    labelEn: 'Import / Export',
    popover: 'importExport',
    // ImportExportPopover wystawia wyłącznie `mm_import_*` / `mm_export_*` /
    // `mm_snapshot_history`. Poza Mapą myśli żaden z nich nie ma odbiornika.
    // Standard rozdz. 06 §2: Import/Eksport NIE jest pozycją raila narzędzi —
    // mieszka w Menu 3 / Menu 1. Decyzja właściciela (Z3, 2026-07-24): slot bez
    // implementacji w danym narzędziu ZNIKA z raila tego narzędzia, nie wisi
    // wyszarzony — stąd `liveIn` tu też steruje WIDOCZNOŚCIĄ (patrz
    // `usunNieobslugiwaneSloty` niżej), nie tylko stanem disabled.
    liveIn: ['mindmap'],
  },
  {
    id: 'more',
    icon: MoreHorizontal,
    tkey: 'myWorkMindmap.toolbar.moreTools',
    labelEn: 'More tools',
    popover: 'more',
    // MoreToolsPanel to wyłącznie narzędzia Mapy myśli (układ, struktura,
    // poziomy zwijania, prezentacja, minimapa, migawki, udostępnianie) — reszta
    // reprezentacji nie ma tu handlera. Standard rozdz. 06 §2: te narzędzia
    // dodatkowe nie należą do raila innych reprezentacji. Patrz komentarz przy
    // `import` powyżej — ten slot znika (nie wyszarza się) poza Mapą myśli.
    liveIn: ['mindmap'],
  },
  /**
   * D2 (2026-07-28) — siatka i przyciąganie Przepływu. Wcześniej wisiały jako
   * bezpodpisowa nakładka `absolute top-2 left-2` NAD płótnem Przepływu:
   * właściciel nie wiedział, co robią, a nakładka zasłaniała pstryczek zwijania
   * pierwszego toru (zmierzone `elementFromPoint`: 58/225 punktów pstryczka
   * klikalnych). Decyzja właściciela: funkcja zostaje, miejsce się zmienia.
   *
   * Siedzą w SEKCJI DOLNEJ raila, bo to ustawienia WIDOKU płótna, nie
   * elementy procesu (te są w `PF_CONTEXT_SLOTS`). `liveIn: ['process_flow']`
   * plus `usunNieobslugiwaneSloty` (patrz `dolneSloty`) sprawia, że w Mapie
   * myśli, na Tablicy i w Tabeli te sloty po prostu nie istnieją — żadna z tych
   * reprezentacji nie ma odbiornika na `pf_toggle_*`, więc wyszarzenie byłoby
   * atrapą (standard rozdz. 06 §2, decyzja Z3).
   */
  {
    // `pf_` w id, bo Tabela ma własny slot `grid` (widok siatki) — testid
    // `canvas-left-toolbar-grid` byłby wtedy dwuznaczny.
    id: 'pf_grid',
    icon: Grid3x3,
    tkey: 'myWorkMindmap.toolbar.pf.grid',
    labelEn: 'Grid (show the helper grid on the canvas)',
    action: 'pf_toggle_grid',
    liveIn: ['process_flow'],
    toggle: 'grid',
  },
  {
    id: 'pf_snap',
    icon: Magnet,
    tkey: 'myWorkMindmap.toolbar.pf.snap',
    labelEn: 'Snap (align dragged steps to the grid)',
    action: 'pf_toggle_snap',
    liveIn: ['process_flow'],
    toggle: 'snap',
  },
];

const UNDO_REDO_PREFIX: Record<CanvasToolType, string> = {
  mindmap: 'mm',
  whiteboard: 'wb',
  process_flow: 'pf',
  table: 'tbl',
};

function getUndoRedoSlots(activeTool: CanvasToolType): ToolSlot[] {
  const prefix = UNDO_REDO_PREFIX[activeTool] || 'mm';
  return [
    {
      id: 'undo',
      icon: Undo2,
      tkey: 'myWorkMindmap.toolbar.undo',
      labelEn: 'Undo',
      action: `${prefix}_undo`,
    },
    {
      id: 'redo',
      icon: Redo2,
      tkey: 'myWorkMindmap.toolbar.redo',
      labelEn: 'Redo',
      action: `${prefix}_redo`,
    },
  ];
}

export const CanvasLeftToolbar: React.FC<CanvasLeftToolbarProps> = ({
  side = 'left',
  activeTool,
  interactionMode = 'select',
  selection,
  isAccepted,
  ideaId,
  canUndo = true,
  canRedo = true,
  heuristicAiEnabled = false,
  onAction,
  onOpenChat,
  onApplyTemplate,
  onOpenTemplateGallery,
  onToolChange,
  familyCounts,
  canvasContainerRef,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [openPopover, setOpenPopover] = useState<PopoverId>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  /** Cel portalu: `body` normalnie, element pełnoekranowy w pełnym ekranie. */
  const portalTarget = useFullscreenPortalTarget();

  /**
   * Tier A rail wiring (2026-08-10, Program B/E02) — `idea.canvas.undo`/
   * `.redo`/`idea.canvas.cursor_select` są teraz `surface: 'rail'`. Ten sam
   * kształt co `WhiteboardToolbar.tsx`'s `registryActionsById`/`runAction`
   * (N7, commit 3a6ea7cd51-owa rodzina): sprawdzamy PRZED wywołaniem, czy
   * rejestr w ogóle zna tę akcję na tej powierzchni/reprezentacji — brak
   * wpisu = oryginalny callback leci bez pośrednictwa (Z3: rejestr nigdy nie
   * wycisza kliku, którego jeszcze nie zna). Rail obsługuje 4 reprezentacje w
   * JEDNYM montażu, więc — w przeciwieństwie do `WhiteboardToolbar`'s
   * jednotoolowego memo — ta lista jest przeliczana przy zmianie `activeTool`/
   * `selection`.
   */
  const registryActionsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getActionsForSurface>[number]>();
    for (const entry of getActionsForSurface('rail', { tool: activeTool, selection })) {
      map.set(entry.def.id, entry);
    }
    return map;
  }, [activeTool, selection]);

  const runRailAction = useCallback(
    (id: string, run: () => void) => {
      if (!registryActionsById.has(id)) {
        run();
        return;
      }
      const ctx: ActionContext = {
        ideaId: ideaId || '',
        tool: activeTool,
        selection,
        surface: 'rail',
        source: 'ui',
        language: isPl ? 'pl' : 'en',
        params: { run },
      };
      void runIdeaAction(id, ctx);
    },
    [registryActionsById, ideaId, activeTool, selection, isPl]
  );

  /**
   * B3 (2026-07-27) — popover NIE MOŻE być dzieckiem kolumny raila.
   *
   * Kolumna ma `overflow-y-auto` (rail bywa wyższy niż pasmo płótna, patrz
   * `railBox` niżej), a CSS nie pozwala mieć `overflow-y: auto` razem z
   * `overflow-x: visible` — druga oś ZAWSZE degraduje się do przycinania.
   * Skutkiem popover wysuwany `absolute left-[calc(100%+8px)]` był ścinany do
   * ~44px szerokości kolumny: właściciel widział „Rozbi…/Znajd…/Porów…"
   * ściśnięte w pasku zamiast panelu obok. Gorzej — autofokus pola szukania w
   * popoverze przewijał kolumnę POZIOMO (`scrollLeft` 64px), więc ikony raila
   * znikały z widoku.
   *
   * Dlatego popover renderujemy jako RODZEŃSTWO kolumny, w tym samym portalu
   * (patrz koniec pliku), pozycjonowany `fixed` z prostokąta ikony-kotwicy.
   * Świadomie NIE robimy osobnego `createPortal(…, document.body)`: rail już
   * dziś portaluje się do body i przez to znika w fullscreenie (dług A8) —
   * osobny portal pogłębiłby ten problem o kolejny węzeł. Wspólny portal
   * znaczy: popover żyje i umiera dokładnie tam, gdzie rail.
   */
  const popoverAnchorRef = useRef<HTMLButtonElement | null>(null);
  const popoverLayerRef = useRef<HTMLDivElement | null>(null);
  const [popoverPos, setPopoverPos] = useState<{
    left: number | null;
    right: number | null;
    top: number | null;
    bottom: number | null;
  } | null>(null);

  /**
   * B3: druga ofiara tego samego przycinania — wskaźnik trybu (SEL/PAN/DRW/LNK)
   * przy pstryczku. Wisiał `absolute left-[calc(100%+6px)]`, czyli zaczynał się
   * 3px ZA widoczną treścią paska, więc był niewidoczny w 100% (zmierzone:
   * start x=47, koniec treści kolumny x=44). Wędruje do tej samej warstwy obok
   * kolumny. W odróżnieniu od panelu jest widoczny CIĄGLE, więc jego pozycję
   * odświeżamy także przy przewijaniu samego paska.
   */
  const pointerButtonRef = useRef<HTMLButtonElement | null>(null);
  const [modeBadgePos, setModeBadgePos] = useState<{
    left: number | null;
    right: number | null;
    top: number;
  } | null>(null);

  /**
   * Z1 (rozdz. 06 §3): realny tryb płótna zgłaszany przez reprezentacje, które
   * trzymają go u siebie (Tablica ma dodatkowo 'draw'). Rail dostaje
   * `interactionMode` propsem z IdeaMapWorkspace — to stan Mapy myśli, więc bez
   * tego nasłuchu pstryczek pokazywałby SEL, gdy Tablica jest w trybie
   * rysowania. Pętla domknięta: rail wysyła akcję w dół, reprezentacja
   * odsyła stan, który NAPRAWDĘ przyjęła.
   */
  const [canvasCursorModes, setCanvasCursorModes] = useState<
    Partial<Record<CanvasToolType, IdeaCanvasCursorMode>>
  >({});
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as IdeaCanvasCursorModeDetail | undefined;
      if (!detail?.tool || !detail?.mode) return;
      setCanvasCursorModes((prev) =>
        prev[detail.tool] === detail.mode ? prev : { ...prev, [detail.tool]: detail.mode }
      );
    };
    window.addEventListener(IDEA_CANVAS_CURSOR_MODE_EVENT, handler);
    return () => window.removeEventListener(IDEA_CANVAS_CURSOR_MODE_EVENT, handler);
  }, []);

  /**
   * D2 (2026-07-28): stan siatki/przyciągania Przepływu. Ta sama pętla co przy
   * trybie kursora — rail wysyła `pf_toggle_*` w dół, Przepływ odsyła stan, jaki
   * NAPRAWDĘ przyjął, a rail rysuje nim wygląd „włączone". Bez tego pstryczek
   * byłby ślepy: użytkownik nie widziałby, czy siatka jest włączona.
   * Wartości początkowe = domyślne Przepływu (`showGrid`/`snapToGridEnabled`
   * startują jako `true` w IdeaProcessFlowTool), a pierwsze zdarzenie po
   * zamontowaniu płótna i tak je potwierdza lub koryguje po hydracji.
   */
  const [gridState, setGridState] = useState<ProcessFlowGridStateDetail>({
    showGrid: true,
    snap: true,
  });
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as ProcessFlowGridStateDetail | undefined;
      if (!detail || typeof detail.showGrid !== 'boolean' || typeof detail.snap !== 'boolean') {
        return;
      }
      setGridState((prev) =>
        prev.showGrid === detail.showGrid && prev.snap === detail.snap ? prev : { ...detail }
      );
    };
    window.addEventListener(PROCESS_FLOW_GRID_STATE_EVENT, handler);
    return () => window.removeEventListener(PROCESS_FLOW_GRID_STATE_EVENT, handler);
  }, []);

  /** Tryb pokazywany na pstryczku: własny stan płótna tam, gdzie płótno go zgłasza. */
  const effectiveMode: MindMapInteractionMode | 'draw' =
    activeTool === 'whiteboard' || activeTool === 'process_flow'
      ? (canvasCursorModes[activeTool] ?? 'select')
      : interactionMode;

  // UI-L1: track the canvas container's box so the portaled rail floats INSIDE the
  // canvas — not on the app sidebar (x) and not over Menu 1 / Menu 3 (y).
  // Falls back to viewport centering when no ref is given (legacy chrome path).
  const [railBox, setRailBox] = useState<{
    left: number | null;
    right: number | null;
    top: number;
    height: number;
  } | null>(null);
  const [railPosition, setRailPosition] = useState<RailPosition | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    dx: number;
    dy: number;
    canvas: DOMRect;
  } | null>(null);
  useEffect(() => {
    const el = canvasContainerRef?.current;
    if (!el || typeof window === 'undefined') {
      setRailBox(null);
      return;
    }
    const measure = () => {
      // In the EditorShell (mels) path the passed container also wraps Menu 1 /
      // Menu 3, so measuring it puts the rail ABOVE the bars. Prefer the real
      // canvas band when the shell is mounted; fall back to the legacy container.
      const shellCanvas = document.querySelector('[data-testid="mels-canvas"]');
      const rect = (shellCanvas ?? el).getBoundingClientRect();
      // +12px inset (Tailwind left-3) from the canvas's own left edge; top/height
      // bound the rail to the canvas band so it never rides over the shell bars.
      setRailBox({
        left: side === 'left' ? rect.left + 12 : null,
        right: side === 'right' ? window.innerWidth - rect.right + 12 : null,
        top: rect.top,
        height: rect.height,
      });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [canvasContainerRef, side]);

  const clampRailPosition = useCallback((point: RailPosition, canvas: DOMRect) => {
    const rail = toolbarRef.current?.getBoundingClientRect();
    const width = rail?.width ?? 52;
    const height = Math.min(rail?.height ?? 320, Math.max(44, canvas.height - 24));
    return {
      x: Math.round(Math.max(canvas.left + 12, Math.min(point.x, canvas.right - width - 12))),
      y: Math.round(Math.max(canvas.top + 12, Math.min(point.y, canvas.bottom - height - 12))),
    };
  }, []);

  // Position is intentionally local to each representation: moving the
  // Whiteboard authoring rail must not unexpectedly relocate the Table rail.
  useLayoutEffect(() => {
    if (!railBox || typeof window === 'undefined') return;
    const canvas = document
      .querySelector<HTMLElement>('[data-testid="mels-canvas"]')
      ?.getBoundingClientRect();
    if (!canvas) return;
    try {
      const stored = window.localStorage.getItem(railPositionKey(activeTool));
      if (!stored) {
        setRailPosition(null);
        return;
      }
      const parsed = JSON.parse(stored) as RailPosition;
      if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
        setRailPosition(clampRailPosition(parsed, canvas));
      }
    } catch {
      setRailPosition(null);
    }
  }, [activeTool, clampRailPosition, railBox?.top, railBox?.height]);

  const beginRailDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const rail = toolbarRef.current?.getBoundingClientRect();
    const canvas = document
      .querySelector<HTMLElement>('[data-testid="mels-canvas"]')
      ?.getBoundingClientRect();
    if (!rail || !canvas) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      dx: event.clientX - rail.left,
      dy: event.clientY - rail.top,
      canvas,
    };
    setRailPosition({ x: rail.left, y: rail.top });
  }, []);

  const moveRail = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      setRailPosition(
        clampRailPosition({ x: event.clientX - drag.dx, y: event.clientY - drag.dy }, drag.canvas)
      );
    },
    [clampRailPosition]
  );

  const finishRailDrag = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      setRailPosition((position) => {
        if (position)
          window.localStorage.setItem(railPositionKey(activeTool), JSON.stringify(position));
        return position;
      });
    },
    [activeTool]
  );

  const resetRailPosition = useCallback(() => {
    window.localStorage.removeItem(railPositionKey(activeTool));
    setRailPosition(null);
  }, [activeTool]);

  const contextSlots = CONTEXT_SLOTS[activeTool] || MM_CONTEXT_SLOTS;

  // P2-5: Tabela dostaje DATA-rail. Standard rozdz. 06 §2 — rail Tabeli nie
  // zawiera pojec plotna (tryb kursora) ani pozycji Menu 3 (Szablony/Import).
  // Za flaga (OFF = dzisiejszy rail z wyszarzonymi slotami). Filtrujemy sloty
  // gorne/dolne tylko dla Tabeli i tylko przy fladze ON.
  const dataRail = activeTool === 'table' && isTableDataRailEnabled();
  const SLOTY_SPOZA_DATA_RAILA = new Set(['pointer_toggle', 'templates', 'import']);
  const filtrujDataRail = (slots: ToolSlot[]) =>
    dataRail ? slots.filter((sl) => !SLOTY_SPOZA_DATA_RAILA.has(sl.id)) : slots;

  /**
   * Z3 (2026-07-24, standard `docs/standards/idea-workspace/06_LEWY_RAIL.md` §2):
   * usuwa CAŁKOWICIE (nie wyszarza) sloty bez odbiornika w aktywnej reprezentacji —
   * dziś `import`/`more` poza Mapą myśli. W odróżnieniu od `powodWylaczenia` (który
   * renderuje slot jako disabled z powodem — właściwe TYLKO dla `pointer_toggle` w
   * Tabeli, gdzie wyszarzenie niesie prawdziwą informację dziedzinową), te sloty po
   * prostu nie istnieją w railu tego narzędzia — zawsze aktywne (bez `liveIn`) albo
   * odfiltrowane, nigdy wyszarzone „na wiarę".
   */
  const usunNieobslugiwaneSloty = (slots: ToolSlot[]) =>
    slots.filter((sl) => !sl.liveIn || sl.liveIn.includes(activeTool));
  // D2 (2026-07-28): filtr biegnie też po slotach kontekstowych. Dziś żaden z
  // nich nie ma `liveIn` (każda reprezentacja dostaje własną listę), więc to
  // zmiana zerowa — ale bez niej `liveIn` w sekcji kontekstowej byłoby cichą
  // atrapą, gdyby ktoś je tam kiedyś dopisał.

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // B3: popover mieszka POZA kolumną raila (rodzeństwo w tym samym portalu),
      // więc sam `toolbarRef.contains` zamykałby go przy każdym kliknięciu w jego
      // własne wnętrze. Warstwa popovera liczy się jako „wewnątrz".
      const inToolbar = toolbarRef.current?.contains(target);
      const inPopover = popoverLayerRef.current?.contains(target);
      if (!inToolbar && !inPopover) {
        setOpenPopover(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /**
   * B3: popover nie jest już dzieckiem ikony, więc gdy zmiana reprezentacji
   * usunie slot-kotwicę, panel zostałby wiszący nad pustym miejscem. Zamykamy.
   */
  useEffect(() => {
    setOpenPopover(null);
    popoverAnchorRef.current = null;
  }, [activeTool]);

  /**
   * B3: pozycja panelu liczona z prostokąta ikony (rail jest `fixed`, więc
   * współrzędne viewportu zgadzają się 1:1). Przy ikonach w dolnej połowie
   * ekranu kotwiczymy DOŁEM, żeby wysoki panel (Szablony/Więcej mają ~440px)
   * nie zjeżdżał pod krawędź okna.
   */
  useLayoutEffect(() => {
    if (!openPopover || typeof window === 'undefined') {
      setPopoverPos(null);
      return;
    }
    const place = () => {
      const anchor = popoverAnchorRef.current;
      if (!anchor || !anchor.isConnected) {
        setOpenPopover(null);
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const flipUp = rect.top > viewportH / 2;
      const next = {
        left: side === 'left' ? Math.round(rect.right + 8) : null,
        right: side === 'right' ? Math.round(window.innerWidth - rect.left + 8) : null,
        top: flipUp ? null : Math.round(Math.max(8, rect.top)),
        bottom: flipUp ? Math.round(Math.max(8, viewportH - rect.bottom)) : null,
      };
      setPopoverPos((prev) =>
        prev &&
        prev.left === next.left &&
        prev.right === next.right &&
        prev.top === next.top &&
        prev.bottom === next.bottom
          ? prev
          : next
      );
    };
    place();
    // Rail wjeżdża animacją `leftToolbarSlideIn` (transform). Pomiar zrobiony w
    // jej trakcie dawałby panel przesunięty o kilkanaście px — dlatego mierzymy
    // ponownie w następnej klatce i po zakończeniu animacji.
    const raf = requestAnimationFrame(place);
    const railEl = toolbarRef.current;
    railEl?.addEventListener('animationend', place);
    window.addEventListener('resize', place);
    // `true` = faza przechwytywania: rail przewija się w środku płótna, a nie na
    // window, więc bez capture nie dostalibyśmy tego zdarzenia.
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      railEl?.removeEventListener('animationend', place);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
    // `railBox` w zależnościach: gdy powłoka przeliczy pasmo płótna, rail
    // przeskakuje — panel musi pójść za nim.
  }, [openPopover, railBox, side]);

  /**
   * B3: pozycja wskaźnika trybu. Chowamy go, gdy pstryczek wyjedzie poza
   * widoczne pasmo paska (pasek scrolluje się pionowo) — inaczej etykieta
   * wisiałaby samotnie nad Menu 1.
   */
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const place = () => {
      const btn = pointerButtonRef.current;
      const rail = toolbarRef.current;
      if (!btn || !rail || !btn.isConnected) {
        setModeBadgePos(null);
        return;
      }
      const b = btn.getBoundingClientRect();
      const r = rail.getBoundingClientRect();
      if (b.bottom <= r.top || b.top >= r.bottom) {
        setModeBadgePos(null);
        return;
      }
      const next = {
        left: side === 'left' ? Math.round(b.right + 6) : null,
        right: side === 'right' ? Math.round(window.innerWidth - b.left + 6) : null,
        top: Math.round(b.top + b.height / 2),
      };
      setModeBadgePos((prev) =>
        prev && prev.left === next.left && prev.right === next.right && prev.top === next.top
          ? prev
          : next
      );
    };
    place();
    const raf = requestAnimationFrame(place);
    const railEl = toolbarRef.current;
    railEl?.addEventListener('animationend', place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      railEl?.removeEventListener('animationend', place);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [railBox, activeTool, dataRail, effectiveMode, onToolChange, side]);

  const handleSlotClick = useCallback(
    (slot: ToolSlot, anchor?: HTMLButtonElement | null) => {
      if (slot.popover) {
        const willOpen = openPopover !== slot.popover;
        popoverAnchorRef.current = willOpen ? (anchor ?? null) : null;
        setOpenPopover(willOpen ? (slot.popover as PopoverId) : null);
      } else if (activeTool === 'mindmap' && slot.id === 'connect') {
        onAction(getMindmapConnectToolbarAction(interactionMode));
        setOpenPopover(null);
      } else if (slot.id === 'undo' || slot.id === 'redo') {
        // Tier A rail wiring (2026-08-10) — `idea.canvas.undo`/`.redo`,
        // `surface: 'rail'`. `slot.action` STAYS the existing `${prefix}_undo`/
        // `${prefix}_redo` string (getUndoRedoSlots, byte-identical); the
        // registry layer only decides WHETHER to route through
        // `runIdeaAction` first (Teresa entry point, same runtime map) — the
        // human click still ends up calling `onAction(slot.action)` exactly
        // as before via `ctx.params.run`.
        runRailAction(slot.id === 'undo' ? 'idea.canvas.undo' : 'idea.canvas.redo', () => {
          if (slot.action) onAction(slot.action);
        });
        setOpenPopover(null);
      } else if (slot.action) {
        onAction(slot.action);
        setOpenPopover(null);
      }
    },
    [activeTool, interactionMode, onAction, openPopover, runRailAction]
  );

  const handlePopoverAction = useCallback(
    (action: string) => {
      onAction(action);
    },
    [onAction]
  );

  const closePopover = useCallback(() => {
    popoverAnchorRef.current = null;
    setOpenPopover(null);
  }, []);

  const handlePointerToggle = useCallback(() => {
    // Z zaznaczania → przesuwanie; z KAŻDEGO innego trybu (przesuwanie,
    // łączenie, rysowanie w Tablicy) → powrót do zaznaczania.
    const next = effectiveMode === 'select' ? 'pan' : 'select';
    const action = next === 'select' ? 'mm_select_mode' : 'mm_pan_mode';
    // Tier A rail wiring (2026-08-10) — `idea.canvas.cursor_select`,
    // `surface: 'rail'`. This is a two-state TOGGLE, but the registry id
    // models the single well-defined Teresa action "switch to select mode"
    // (its `teresa.description`) — the UI click still ends up calling
    // `onAction(action)` byte-identically via `ctx.params.run`, for EITHER
    // direction (the registry's own runtime map is only consulted for the
    // non-UI/Teresa path, which always means "select mode", never "pan").
    runRailAction('idea.canvas.cursor_select', () => onAction(action));
    setOpenPopover(null);
  }, [effectiveMode, onAction, runRailAction]);

  const pointerTooltip =
    effectiveMode === 'draw'
      ? isPl
        ? 'Rysowanie — kliknij, aby wrócić do zaznaczania'
        : 'Draw — click to return to select'
      : getMindmapPointerToggleTooltip(effectiveMode, isPl);

  /**
   * P1-1: slot bez odbiornika w bieżącej reprezentacji. Zwraca powód (do
   * tooltipa) albo null, gdy slot jest żywy. Wzór za commitem e2ad0cc85b
   * (prawy rail: `disabledReason` + powód w tooltipie wyłączonej ikony).
   */
  const powodWylaczenia = (slot: ToolSlot): string | null => {
    if (!slot.liveIn || slot.liveIn.includes(activeTool)) return null;
    return (
      (isPl ? slot.offReasonPl : slot.offReasonEn) ??
      (isPl ? 'Niedostępne tutaj' : 'Not available here')
    );
  };

  const renderSlot = (slot: ToolSlot, idx: number) => {
    const offReason = powodWylaczenia(slot);
    if (offReason) {
      const Icon = slot.icon;
      const label = t(slot.tkey, slot.labelEn);
      const title = `${label} — ${offReason}`;
      return (
        <div key={slot.id} className="relative">
          <button
            type="button"
            disabled
            data-testid={`canvas-left-toolbar-${slot.id}`}
            title={title}
            aria-label={title}
            aria-disabled="true"
            className="flex h-11 w-11 items-center justify-center rounded-hig-xl opacity-40 cursor-not-allowed text-c-text-secondary dark:text-c-text-muted"
          >
            <Icon size={15} />
          </button>
        </div>
      );
    }
    if (slot.id === 'pointer_toggle') {
      const PointerIcon =
        effectiveMode === 'pan' ? Hand : effectiveMode === 'draw' ? Pen : MousePointer2;
      return (
        <div key={slot.id} className="relative">
          <button
            ref={pointerButtonRef}
            data-testid={`canvas-left-toolbar-${slot.id}`}
            onClick={handlePointerToggle}
            title={pointerTooltip}
            aria-label={pointerTooltip}
            className={`flex h-11 w-11 items-center justify-center rounded-hig-xl transition-all duration-150 bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text ${FOCUS_RING}`}
          >
            <PointerIcon size={15} />
          </button>
          {/* B3: sam wskaźnik trybu (SEL/PAN/DRW/LNK) renderuje się w warstwie
              obok kolumny — patrz `modeBadgeNode`. Tutaj zostaje sam przycisk,
              bo etykieta wystawała 3px poza widoczną treść paska i była ścinana
              w całości (mierzone: start x=47, koniec treści x=44 → 0% widoczna). */}
        </div>
      );
    }

    const Icon = slot.icon;
    const isModeSlot =
      activeTool === 'mindmap' && slot.id === 'connect' && interactionMode === 'connect';
    // D2: pstryczek pokazuje stan włączenia (siatka/przyciąganie Przepływu).
    const toggleOn =
      slot.toggle == null ? null : slot.toggle === 'grid' ? gridState.showGrid : gridState.snap;
    const baseTitle = t(slot.tkey, slot.labelEn);
    const slotTitle =
      activeTool === 'mindmap' && slot.id === 'connect' && interactionMode === 'connect'
        ? t('ideas.mindmap.finishConnectingReturnSelect', 'Finish connecting and return to select')
        : toggleOn == null
          ? baseTitle
          : // Sam stan „wciśnięty" widać dopiero po najechaniu na sąsiada — w
            // podpowiedzi mówimy go wprost, żeby nie trzeba było zgadywać.
            `${baseTitle} — ${toggleOn ? t('myWorkMindmap.toolbar.toggleOn', 'on') : t('myWorkMindmap.toolbar.toggleOff', 'off')}`;
    const isActive =
      isModeSlot || (openPopover === slot.popover && slot.popover != null) || toggleOn === true;
    return (
      <div key={slot.id} className="relative">
        <button
          data-testid={`canvas-left-toolbar-${slot.id}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleSlotClick(slot, event.currentTarget);
          }}
          title={slotTitle}
          aria-label={slotTitle}
          {...(toggleOn == null ? null : { 'aria-pressed': toggleOn })}
          className={`flex h-11 w-11 items-center justify-center rounded-hig-xl transition-all duration-150 ${FOCUS_RING} ${
            isActive
              ? 'bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text'
              : 'text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
          }`}
        >
          <Icon size={15} />
        </button>
      </div>
    );
  };

  /**
   * B3: treść panelu. Renderowana w warstwie-rodzeństwie kolumny raila (niżej),
   * NIE wewnątrz slotu — kolumna przycina wszystko, co z niej wystaje.
   */
  const renderPopoverContent = (popover: Exclude<PopoverId, null>) => {
    switch (popover) {
      case 'templates':
        return (
          <TemplatesPopover
            isPl={!!isPl}
            activeTool={activeTool}
            onApplyTemplate={onApplyTemplate}
            onOpenGallery={onOpenTemplateGallery}
            onClose={closePopover}
          />
        );
      case 'addNode':
        return (
          <AddNodePopover
            isPl={!!isPl}
            hasSelection={selection.type === 'node' && selection.count > 0}
            onAction={handlePopoverAction}
            onClose={closePopover}
          />
        );
      case 'knowledge':
        return (
          <KnowledgePopover isPl={!!isPl} onAction={handlePopoverAction} onClose={closePopover} />
        );
      case 'importExport':
        return (
          <ImportExportPopover
            isPl={!!isPl}
            onAction={handlePopoverAction}
            onClose={closePopover}
          />
        );
      case 'ai':
        return (
          <AIActionsPopover
            isPl={!!isPl}
            // P1-1: popover AI musi znać reprezentację — inaczej wystawia
            // generatory mm_* także w Whiteboardzie/Przepływie/Tabeli,
            // gdzie nie mają odbiornika.
            activeTool={activeTool}
            selection={selection}
            heuristicAiEnabled={heuristicAiEnabled}
            onAction={handlePopoverAction}
            onOpenChat={onOpenChat}
            onClose={closePopover}
          />
        );
      case 'more':
        return (
          <MoreToolsPanel isPl={!!isPl} onAction={handlePopoverAction} onClose={closePopover} />
        );
      default:
        return null;
    }
  };

  // Sloty dolne po odfiltrowaniu — poza Mapą myśli dziś puste (import/more nie
  // mają odbiornika, patrz komentarz przy `usunNieobslugiwaneSloty`). Pusta
  // tablica pomija swój separator niżej, żeby nie zostawić podwójnej kreski.
  const dolneSloty = usunNieobslugiwaneSloty(filtrujDataRail(SHARED_BOTTOM));

  const toolbarNode = (
    <div
      ref={toolbarRef}
      // Kontrakt z ExecutiveModuleShell: rail idzie przez `createPortal` do
      // document.body, wiec powloka NIE znajdzie go po drzewie. Po tym atrybucie
      // powloka mierzy jego szerokosc i rezerwuje rynne, zeby rail nie zaslanial
      // paskow reprezentacji. Nie usuwaj bez poprawienia pomiaru w powloce.
      data-mels-floating-rail-surface="true"
      className={`fixed z-context-menu pointer-events-auto flex flex-col items-center gap-0.5 rounded-hig-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-sm border border-c-border-subtle dark:border-c-border-subtle shadow-hig-xl px-1 py-1.5 canvas-left-toolbar-enter overflow-y-auto overflow-x-hidden${
        railBox == null
          ? ` top-1/2 -translate-y-1/2 ${side === 'right' ? 'right-3' : 'left-3'}`
          : ''
      }`}
      style={
        railBox == null
          ? undefined
          : railPosition
            ? {
                left: `${railPosition.x}px`,
                top: `${railPosition.y}px`,
                transform: 'none',
                maxHeight: `${Math.max(44, railBox.height - 24)}px`,
              }
            : {
                ...(railBox.left != null ? { left: `${railBox.left}px` } : null),
                ...(railBox.right != null ? { right: `${railBox.right}px` } : null),
                top: `${railBox.top + railBox.height / 2}px`,
                transform: 'translateY(-50%)',
                // Compact/200% layouts may leave less than 184 CSS px for the
                // canvas. A 160px floor pushed the rail outside the canvas band;
                // retain only one 44px command as the hard minimum and scroll
                // the remaining commands inside the surface.
                maxHeight: `${Math.max(44, railBox.height - 24)}px`,
              }
      }
    >
      <button
        type="button"
        data-testid="canvas-tool-rail-drag-handle"
        aria-label={isPl ? 'Przenieś pasek narzędzi' : 'Move tool rail'}
        title={
          isPl
            ? 'Przeciągnij, aby przenieść. Kliknij dwukrotnie, aby wyśrodkować.'
            : 'Drag to move. Double-click to reset.'
        }
        onPointerDown={beginRailDrag}
        onPointerMove={moveRail}
        onPointerUp={finishRailDrag}
        onPointerCancel={finishRailDrag}
        onDoubleClick={resetRailPosition}
        className={`flex h-7 w-11 touch-none cursor-grab items-center justify-center rounded-hig-xl text-c-text-muted hover:bg-c-surface-raised active:cursor-grabbing ${FOCUS_RING}`}
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>
      {/* #6a: canvas tool switcher (RAIL zone) — relocated from the top-right
          IdeaWorkspaceToolbar widget. Same icons/tooltips (TOOL_CONFIG),
          just anchored above the rest of the rail so it reads as "which
          system am I in", with everything below adapting to it. */}
      {onToolChange && (
        <>
          {TOOL_CONFIG.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            const hasContent = (familyCounts?.[tool.id] ?? 0) > 0;
            const label = getIdeaWorkspaceToolLabel(tool.id, Boolean(isPl));
            return (
              <div key={tool.id} className="relative">
                <button
                  data-testid={`canvas-left-toolbar-switch-${tool.id}`}
                  onClick={() => onToolChange(tool.id)}
                  title={label}
                  aria-label={label}
                  className={`flex h-11 w-11 items-center justify-center rounded-hig-xl transition-all duration-150 ${FOCUS_RING} ${
                    isActive
                      ? 'bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text'
                      : 'text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
                  }`}
                >
                  <Icon size={15} />
                </button>
                {hasContent && !isActive && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-c-info/60 pointer-events-none" />
                )}
              </div>
            );
          })}

          <div className="w-5 border-t border-c-border-subtle dark:border-c-border-subtle my-0.5" />
        </>
      )}

      {filtrujDataRail(SHARED_TOP).map(renderSlot)}

      <div className="w-5 border-t border-c-border-subtle dark:border-c-border-subtle my-0.5" />

      {usunNieobslugiwaneSloty(contextSlots).map(renderSlot)}

      {dolneSloty.length > 0 && (
        <>
          <div className="w-5 border-t border-c-border-subtle dark:border-c-border-subtle my-0.5" />
          {dolneSloty.map(renderSlot)}
        </>
      )}

      <div className="w-5 border-t border-c-border-subtle dark:border-c-border-subtle my-0.5" />

      {getUndoRedoSlots(activeTool).map((slot, idx) => {
        const isDisabled = (slot.id === 'undo' && !canUndo) || (slot.id === 'redo' && !canRedo);
        const Icon = slot.icon;
        return (
          <div key={slot.id} className="relative">
            <button
              onClick={() => !isDisabled && slot.action && onAction(slot.action)}
              disabled={isDisabled}
              title={t(slot.tkey, slot.labelEn)}
              aria-label={t(slot.tkey, slot.labelEn)}
              className={`flex h-11 w-11 items-center justify-center rounded-hig-xl transition-all duration-150 ${FOCUS_RING} ${
                isDisabled
                  ? 'opacity-40 cursor-not-allowed text-c-text-secondary dark:text-c-text-muted'
                  : 'text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
              }`}
            >
              <Icon size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );

  // B3: warstwa panelu — RODZEŃSTWO kolumny raila, nie jej dziecko. Dzięki temu
  // `overflow-y-auto` kolumny (a więc i wymuszone przez CSS przycinanie w poziomie)
  // jej nie dotyczy. `fixed` bo rail też jest `fixed` — ta sama przestrzeń
  // współrzędnych. Kolejność w portalu: panel PO railu, więc maluje się na wierzchu
  // przy równym `z-context-menu`.
  const popoverNode =
    openPopover && popoverPos ? (
      <div
        ref={popoverLayerRef}
        data-testid={`canvas-left-toolbar-popover-${openPopover}`}
        className="fixed z-context-menu pointer-events-auto"
        style={{
          ...(popoverPos.left != null ? { left: `${popoverPos.left}px` } : null),
          ...(popoverPos.right != null ? { right: `${popoverPos.right}px` } : null),
          ...(popoverPos.top != null ? { top: `${popoverPos.top}px` } : null),
          ...(popoverPos.bottom != null ? { bottom: `${popoverPos.bottom}px` } : null),
        }}
      >
        {renderPopoverContent(openPopover)}
      </div>
    ) : null;

  // B3: wskaźnik trybu w tej samej warstwie co panel — poza kolumną przycinającą.
  const modeBadgeNode = modeBadgePos ? (
    <div
      data-testid="canvas-left-toolbar-mode-badge"
      className="fixed z-context-menu -translate-y-1/2 pointer-events-none"
      style={{
        ...(modeBadgePos.left != null ? { left: `${modeBadgePos.left}px` } : null),
        ...(modeBadgePos.right != null ? { right: `${modeBadgePos.right}px` } : null),
        top: `${modeBadgePos.top}px`,
      }}
    >
      <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider whitespace-nowrap bg-c-surface-raised dark:bg-c-surface text-c-text-secondary dark:text-c-text">
        {effectiveMode === 'pan'
          ? 'PAN'
          : effectiveMode === 'draw'
            ? t('ideas.mindmap.drw', 'DRW')
            : effectiveMode === 'connect'
              ? t('ideas.mindmap.lnk', 'LNK')
              : t('ideas.mindmap.sel', 'SEL')}
      </span>
    </div>
  ) : null;

  const railWithPopover = (
    <>
      {toolbarNode}
      {modeBadgeNode}
      {popoverNode}
    </>
  );

  if (typeof window === 'undefined' || typeof document === 'undefined' || !portalTarget) {
    return railWithPopover;
  }

  // 2026-07-28 (zgłoszenie „w pełnym ekranie nie ma menu lewego"): cel portalu
  // to `document.body` POZA pełnym ekranem, a element pełnoekranowy W pełnym
  // ekranie — inaczej pasek jest RODZEŃSTWEM elementu pełnoekranowego i
  // przeglądarka go nie rysuje. Niezmiennik B3 zachowany: rail, wskaźnik trybu i
  // popover idą JEDNYM `createPortal` w to samo miejsce (patrz komentarz przy
  // `popoverAnchorRef`), więc żyją i umierają razem.
  return createPortal(railWithPopover, portalTarget);
};

export default CanvasLeftToolbar;
