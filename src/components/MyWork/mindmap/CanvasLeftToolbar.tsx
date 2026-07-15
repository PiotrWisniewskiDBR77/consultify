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

import type {
  CanvasToolType,
  IdeaWorkspaceSelection,
  MindMapInteractionMode,
} from '../ideaSelectionTypes';
import { getIdeaWorkspaceToolLabel, TOOL_CONFIG } from '../IdeaWorkspaceToolbar';
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
}

const SHARED_TOP: ToolSlot[] = [
  {
    id: 'pointer_toggle',
    icon: MousePointer2,
    tkey: 'myWorkMindmap.toolbar.cursorMode',
    labelEn: 'Cursor mode',
    action: 'mm_toggle_pointer',
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
  },
  {
    id: 'more',
    icon: MoreHorizontal,
    tkey: 'myWorkMindmap.toolbar.moreTools',
    labelEn: 'More tools',
    popover: 'more',
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

  // UI-L1: track the canvas container's left edge so the portaled rail floats on the
  // canvas — not on the app sidebar. Falls back to viewport edge when no ref is given.
  const [railLeftPx, setRailLeftPx] = useState<number | null>(null);
  useEffect(() => {
    const el = canvasContainerRef?.current;
    if (!el || typeof window === 'undefined') {
      setRailLeftPx(null);
      return;
    }
    const measure = () => {
      const rect = el.getBoundingClientRect();
      // +12px inset (Tailwind left-3) from the canvas's own left edge.
      setRailLeftPx(rect.left + 12);
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
    const next = interactionMode === 'select' ? 'pan' : 'select';
    onAction(next === 'select' ? 'mm_select_mode' : 'mm_pan_mode');
    setOpenPopover(null);
  }, [interactionMode, onAction]);

  const pointerTooltip = getMindmapPointerToggleTooltip(interactionMode, isPl);

  const renderSlot = (slot: ToolSlot, idx: number) => {
    if (slot.id === 'pointer_toggle') {
      const PointerIcon = interactionMode === 'pan' ? Hand : MousePointer2;
      return (
        <div key={slot.id} className="relative">
          <button
            onClick={handlePointerToggle}
            title={pointerTooltip}
            aria-label={pointerTooltip}
            className="flex h-9 w-9 items-center justify-center rounded-hig-xl transition-all duration-150 bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text"
          >
            <PointerIcon size={15} />
          </button>
          <div className="absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2 pointer-events-none">
            <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider whitespace-nowrap bg-c-surface-raised dark:bg-c-surface text-c-text-secondary dark:text-c-text">
              {interactionMode === 'pan'
                ? 'PAN'
                : interactionMode === 'connect'
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
          className={`flex h-9 w-9 items-center justify-center rounded-hig-xl transition-all duration-150 ${
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

  const toolbarNode = (
    <div
      ref={toolbarRef}
      className={`fixed top-1/2 -translate-y-1/2 z-context-menu pointer-events-auto flex flex-col items-center gap-0.5 rounded-hig-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-sm border border-c-border-subtle dark:border-c-border-subtle shadow-hig-xl px-1 py-1.5 canvas-left-toolbar-enter${
        railLeftPx == null ? ' left-3' : ''
      }`}
      style={railLeftPx == null ? undefined : { left: `${railLeftPx}px` }}
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
                  className={`flex h-9 w-9 items-center justify-center rounded-hig-xl transition-all duration-150 ${
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

      {SHARED_TOP.map(renderSlot)}

      <div className="w-5 border-t border-c-border-subtle dark:border-c-border-subtle my-0.5" />

      {contextSlots.map(renderSlot)}

      <div className="w-5 border-t border-c-border-subtle dark:border-c-border-subtle my-0.5" />

      {SHARED_BOTTOM.map(renderSlot)}

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
              className={`flex h-9 w-9 items-center justify-center rounded-hig-xl transition-all duration-150 ${
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
