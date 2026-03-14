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
import { useTranslation } from 'react-i18next';

import type {
  CanvasToolType,
  IdeaWorkspaceSelection,
  MindMapInteractionMode,
} from '../ideaSelectionTypes';
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
  onAction: (action: string) => void;
  onOpenChat: () => void;
  onApplyTemplate: (templateId: string) => void;
  onOpenTemplateGallery: () => void;
}

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

interface ToolSlot {
  id: string;
  icon: IconComponent;
  labelPl: string;
  labelEn: string;
  action?: string;
  popover?: PopoverId;
}

const SHARED_TOP: ToolSlot[] = [
  { id: 'pointer_toggle', icon: MousePointer2, labelPl: 'Tryb kursora', labelEn: 'Cursor mode', action: 'mm_toggle_pointer' },
  { id: 'templates', icon: LayoutTemplate, labelPl: 'Szablony', labelEn: 'Templates', popover: 'templates' },
];

const MM_CONTEXT_SLOTS: ToolSlot[] = [
  { id: 'frame', icon: Frame, labelPl: 'Ramka', labelEn: 'Frame', action: 'mm_add_frame' },
  { id: 'add', icon: GitBranch, labelPl: 'Dodaj węzeł', labelEn: 'Add node', popover: 'addNode' },
  { id: 'knowledge', icon: FileText, labelPl: 'Wiedza', labelEn: 'Knowledge', popover: 'knowledge' },
  { id: 'comment', icon: MessageSquare, labelPl: 'Komentarze', labelEn: 'Comments', action: 'mm_comments' },
  { id: 'connect', icon: Link2, labelPl: 'Połącz — przeciągnij z uchwytu jednego węzła do drugiego', labelEn: 'Connect — drag from one node handle to another', action: 'mm_connect_mode' },
];

const WB_CONTEXT_SLOTS: ToolSlot[] = [
  { id: 'sticky', icon: StickyNote, labelPl: 'Karteczka', labelEn: 'Sticky', action: 'wb_add_sticky' },
  { id: 'text', icon: Type, labelPl: 'Tekst', labelEn: 'Text', action: 'wb_add_text' },
  { id: 'shape', icon: Square, labelPl: 'Kształt', labelEn: 'Shape', action: 'wb_add_shape_rectangle' },
  { id: 'pen', icon: Pen, labelPl: 'Rysuj', labelEn: 'Draw', action: 'wb_mode_draw' },
  { id: 'frame', icon: Frame, labelPl: 'Ramka', labelEn: 'Frame', action: 'wb_add_frame' },
];

const PF_CONTEXT_SLOTS: ToolSlot[] = [
  { id: 'start', icon: Workflow, labelPl: 'Start/End', labelEn: 'Start/End', action: 'pf_add_start' },
  { id: 'task', icon: Square, labelPl: 'Task', labelEn: 'Task', action: 'pf_add_action' },
  { id: 'decision', icon: Diamond, labelPl: 'Decyzja', labelEn: 'Decision', action: 'pf_add_decision' },
  { id: 'lane', icon: Plus, labelPl: 'Lane', labelEn: 'Lane', action: 'pf_add_lane' },
  { id: 'frame', icon: Frame, labelPl: 'Ramka', labelEn: 'Frame', action: 'wb_add_frame' },
];

const TBL_CONTEXT_SLOTS: ToolSlot[] = [
  { id: 'row', icon: Plus, labelPl: 'Nowy wiersz', labelEn: 'Add row', action: 'tbl_add_row' },
  { id: 'cols', icon: Columns3, labelPl: 'Kolumny', labelEn: 'Columns', action: 'tbl_add_column' },
  { id: 'grid', icon: LayoutGrid, labelPl: 'Widok', labelEn: 'View', action: 'tbl_grid' },
  { id: 'filter', icon: Filter, labelPl: 'Filtruj', labelEn: 'Filter', action: 'tbl_filter' },
  { id: 'summary', icon: Frame, labelPl: 'Dashboard', labelEn: 'Dashboard', action: 'tbl_summary' },
];

const CONTEXT_SLOTS: Record<CanvasToolType, ToolSlot[]> = {
  mindmap: MM_CONTEXT_SLOTS,
  whiteboard: WB_CONTEXT_SLOTS,
  process_flow: PF_CONTEXT_SLOTS,
  table: TBL_CONTEXT_SLOTS,
};

const SHARED_BOTTOM: ToolSlot[] = [
  { id: 'import', icon: Upload, labelPl: 'Import / Eksport', labelEn: 'Import / Export', popover: 'importExport' },
  { id: 'ai', icon: Sparkles, labelPl: 'AI', labelEn: 'AI', popover: 'ai' },
  { id: 'more', icon: MoreHorizontal, labelPl: 'Więcej narzędzi', labelEn: 'More tools', popover: 'more' },
];

const UNDO_REDO: ToolSlot[] = [
  { id: 'undo', icon: Undo2, labelPl: 'Cofnij', labelEn: 'Undo', action: 'mm_undo' },
  { id: 'redo', icon: Redo2, labelPl: 'Ponów', labelEn: 'Redo', action: 'mm_redo' },
];

export const CanvasLeftToolbar: React.FC<CanvasLeftToolbarProps> = ({
  activeTool,
  interactionMode = 'select',
  selection,
  isAccepted,
  onAction,
  onOpenChat,
  onApplyTemplate,
  onOpenTemplateGallery,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [openPopover, setOpenPopover] = useState<PopoverId>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

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

  const handleSlotClick = useCallback((slot: ToolSlot) => {
    if (slot.popover) {
      setOpenPopover((cur) => (cur === slot.popover ? null : (slot.popover as PopoverId)));
    } else if (slot.action) {
      onAction(slot.action);
      setOpenPopover(null);
    }
  }, [onAction]);

  const handlePopoverAction = useCallback((action: string) => {
    onAction(action);
  }, [onAction]);

  const closePopover = useCallback(() => setOpenPopover(null), []);

  const handlePointerToggle = useCallback(() => {
    const next = interactionMode === 'select' ? 'pan' : 'select';
    onAction(next === 'select' ? 'mm_select_mode' : 'mm_pan_mode');
    setOpenPopover(null);
  }, [interactionMode, onAction]);

  const pointerTooltip = (() => {
    if (interactionMode === 'select') {
      return isPl
        ? 'Zaznaczanie — klik zaznacza, kliknij by przełączyć na przesuwanie'
        : 'Select — click to select nodes, click to switch to pan';
    }
    return isPl
      ? 'Przesuwanie — przeciągaj canvas, kliknij by przełączyć na zaznaczanie'
      : 'Pan — drag the canvas, click to switch to select';
  })();

  const renderSlot = (slot: ToolSlot, idx: number) => {
    if (slot.id === 'pointer_toggle') {
      const PointerIcon = interactionMode === 'pan' ? Hand : MousePointer2;
      return (
        <div key={slot.id} className="relative">
          <button
            onClick={handlePointerToggle}
            title={pointerTooltip}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150 bg-primary-500/10 text-primary-600 dark:text-primary-400"
          >
            <PointerIcon size={15} />
          </button>
          <div className="absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2 pointer-events-none">
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider whitespace-nowrap bg-primary-500/10 text-primary-500 dark:text-primary-400">
              {interactionMode === 'pan' ? (isPl ? 'PAN' : 'PAN') : (isPl ? 'SEL' : 'SEL')}
            </span>
          </div>
        </div>
      );
    }

    const Icon = slot.icon;
    const isModeSlot =
      activeTool === 'mindmap' &&
      (slot.id === 'connect' && interactionMode === 'connect');
    const isActive = isModeSlot || (openPopover === slot.popover && slot.popover != null);
    return (
      <div key={slot.id} className="relative">
        <button
          onClick={() => handleSlotClick(slot)}
          title={isPl ? slot.labelPl : slot.labelEn}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150 ${
            isActive
              ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-white/[0.04]'
          }`}
        >
          <Icon size={15} />
        </button>

        {isActive && slot.popover && (
          <div className="absolute left-[calc(100%+8px)] top-0 z-[100]">
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
                onAction={handlePopoverAction}
                onOpenChat={onOpenChat}
                onClose={closePopover}
              />
            )}
            {slot.popover === 'more' && (
              <MoreToolsPanel
                isPl={!!isPl}
                onAction={handlePopoverAction}
                onClose={closePopover}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={toolbarRef}
      className="absolute left-3 top-1/2 -translate-y-1/2 z-[52] flex flex-col items-center gap-0.5 rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm border border-slate-200/60 dark:border-navy-700/60 shadow-xl px-1 py-1.5 canvas-left-toolbar-enter"
    >
      {SHARED_TOP.map(renderSlot)}

      <div className="w-5 border-t border-slate-200/40 dark:border-white/[0.04] my-0.5" />

      {contextSlots.map(renderSlot)}

      <div className="w-5 border-t border-slate-200/40 dark:border-white/[0.04] my-0.5" />

      {SHARED_BOTTOM.map(renderSlot)}

      <div className="w-5 border-t border-slate-200/40 dark:border-white/[0.04] my-0.5" />

      {UNDO_REDO.map(renderSlot)}
    </div>
  );
};

export default CanvasLeftToolbar;
