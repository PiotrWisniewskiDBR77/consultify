import {
  Columns3,
  Diamond,
  FileText,
  Filter,
  Frame,
  GitBranch,
  Hand,
  LayoutGrid,
  LayoutTemplate,
  Link2,
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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import {
  IDEA_CANVAS_CURSOR_MODE_EVENT,
  type IdeaCanvasCursorMode,
  type IdeaCanvasCursorModeDetail,
} from '../canvas/ideaCanvasCursorMode';
import { FOCUS_RING } from '../canvas/motionTokens';
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
  activeTool,
  interactionMode = 'select',
  selection,
  isAccepted,
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

  /** Tryb pokazywany na pstryczku: własny stan płótna tam, gdzie płótno go zgłasza. */
  const effectiveMode: MindMapInteractionMode | 'draw' =
    activeTool === 'whiteboard' || activeTool === 'process_flow'
      ? (canvasCursorModes[activeTool] ?? 'select')
      : interactionMode;

  // UI-L1: track the canvas container's box so the portaled rail floats INSIDE the
  // canvas — not on the app sidebar (x) and not over Menu 1 / Menu 3 (y).
  // Falls back to viewport centering when no ref is given (legacy chrome path).
  const [railBox, setRailBox] = useState<{ left: number; top: number; height: number } | null>(
    null
  );
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
      setRailBox({ left: rect.left + 12, top: rect.top, height: rect.height });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [canvasContainerRef]);

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenPopover(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSlotClick = useCallback(
    (slot: ToolSlot) => {
      if (slot.popover) {
        setOpenPopover((cur) => (cur === slot.popover ? null : (slot.popover as PopoverId)));
      } else if (activeTool === 'mindmap' && slot.id === 'connect') {
        onAction(getMindmapConnectToolbarAction(interactionMode));
        setOpenPopover(null);
      } else if (slot.action) {
        onAction(slot.action);
        setOpenPopover(null);
      }
    },
    [activeTool, interactionMode, onAction]
  );

  const handlePopoverAction = useCallback(
    (action: string) => {
      onAction(action);
    },
    [onAction]
  );

  const closePopover = useCallback(() => setOpenPopover(null), []);

  const handlePointerToggle = useCallback(() => {
    // Z zaznaczania → przesuwanie; z KAŻDEGO innego trybu (przesuwanie,
    // łączenie, rysowanie w Tablicy) → powrót do zaznaczania.
    const next = effectiveMode === 'select' ? 'pan' : 'select';
    onAction(next === 'select' ? 'mm_select_mode' : 'mm_pan_mode');
    setOpenPopover(null);
  }, [effectiveMode, onAction]);

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
            className="flex h-9 w-9 items-center justify-center rounded-hig-xl opacity-40 cursor-not-allowed text-c-text-secondary dark:text-c-text-muted"
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
            data-testid={`canvas-left-toolbar-${slot.id}`}
            onClick={handlePointerToggle}
            title={pointerTooltip}
            aria-label={pointerTooltip}
            className={`flex h-9 w-9 items-center justify-center rounded-hig-xl transition-all duration-150 bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text ${FOCUS_RING}`}
          >
            <PointerIcon size={15} />
          </button>
          <div className="absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2 pointer-events-none">
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
        </div>
      );
    }

    const Icon = slot.icon;
    const isModeSlot =
      activeTool === 'mindmap' && slot.id === 'connect' && interactionMode === 'connect';
    const slotTitle =
      activeTool === 'mindmap' && slot.id === 'connect' && interactionMode === 'connect'
        ? t('ideas.mindmap.finishConnectingReturnSelect', 'Finish connecting and return to select')
        : t(slot.tkey, slot.labelEn);
    const isActive = isModeSlot || (openPopover === slot.popover && slot.popover != null);
    return (
      <div key={slot.id} className="relative">
        <button
          data-testid={`canvas-left-toolbar-${slot.id}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleSlotClick(slot);
          }}
          title={slotTitle}
          aria-label={slotTitle}
          className={`flex h-9 w-9 items-center justify-center rounded-hig-xl transition-all duration-150 ${FOCUS_RING} ${
            isActive
              ? 'bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text'
              : 'text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
          }`}
        >
          <Icon size={15} />
        </button>

        {isActive && slot.popover && (
          <div className="absolute left-[calc(100%+8px)] top-0 z-dropdown">
            {slot.popover === 'templates' && (
              <TemplatesPopover
                isPl={!!isPl}
                activeTool={activeTool}
                onApplyTemplate={onApplyTemplate}
                onOpenGallery={onOpenTemplateGallery}
                onClose={closePopover}
              />
            )}
            {slot.popover === 'addNode' && (
              <AddNodePopover
                isPl={!!isPl}
                hasSelection={selection.type === 'node' && selection.count > 0}
                onAction={handlePopoverAction}
                onClose={closePopover}
              />
            )}
            {slot.popover === 'knowledge' && (
              <KnowledgePopover
                isPl={!!isPl}
                onAction={handlePopoverAction}
                onClose={closePopover}
              />
            )}
            {slot.popover === 'importExport' && (
              <ImportExportPopover
                isPl={!!isPl}
                onAction={handlePopoverAction}
                onClose={closePopover}
              />
            )}
            {slot.popover === 'ai' && (
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
            )}
            {slot.popover === 'more' && (
              <MoreToolsPanel isPl={!!isPl} onAction={handlePopoverAction} onClose={closePopover} />
            )}
          </div>
        )}
      </div>
    );
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
        railBox == null ? ' top-1/2 -translate-y-1/2 left-3' : ''
      }`}
      style={
        railBox == null
          ? undefined
          : {
              left: `${railBox.left}px`,
              // Anchor to the TOP of the canvas band (Miro-style) instead of
              // centring on the viewport. The rail can be taller than the canvas
              // (many tools), so centring always spilled upward over Menu 1 /
              // Menu 3 and clipped their first characters. Top-anchoring makes
              // the overlap structurally impossible; the overflow scrolls.
              top: `${railBox.top + 12}px`,
              transform: 'none',
              maxHeight: `${Math.max(160, railBox.height - 24)}px`,
            }
      }
    >
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
                  className={`flex h-9 w-9 items-center justify-center rounded-hig-xl transition-all duration-150 ${FOCUS_RING} ${
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

      {contextSlots.map(renderSlot)}

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
              className={`flex h-9 w-9 items-center justify-center rounded-hig-xl transition-all duration-150 ${FOCUS_RING} ${
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

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return toolbarNode;
  }

  return createPortal(toolbarNode, document.body);
};

export default CanvasLeftToolbar;
