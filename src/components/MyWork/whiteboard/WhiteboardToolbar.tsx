import {
  Circle,
  ExternalLink,
  Frame,
  Grid3X3,
  Image as ImageIcon,
  Keyboard,
  LayoutGrid,
  Link2,
  Loader2,
  Pen,
  Plus,
  Redo2,
  Save,
  Shapes,
  StickyNote,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Type,
  Undo2,
  Workflow,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasBgPattern } from '../IdeaWhiteboardTool';
import type { WhiteboardSessionState, WhiteboardSharePolicy } from './whiteboardContracts';
import { STICKY_COLORS } from './nodes/whiteboardNodeHelpers';
import { ToolbarBtn, ToolbarDropdown } from './WhiteboardToolbarPrimitives';

export interface WhiteboardToolbarProps {
  isPl: boolean;
  locked: boolean;
  saving: boolean;
  loading: boolean;
  whiteboardMode: 'board' | 'draw';
  sessionState: WhiteboardSessionState;
  sharePolicy: WhiteboardSharePolicy;
  presenceUsers: Array<{ userId: string; userName?: string }>;
  bgPattern: CanvasBgPattern;
  drawingPathCount: number;
  saveStatusLabel: string;
  shortcutsHelpOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  whiteboardModeCopy: { toggleLabel: string; modeLabel: string; exitHint: string; helper: string };

  onAddElement: (kind: string, extraData?: Record<string, unknown>) => void;
  onSetBoardMode: (mode: 'board' | 'draw') => void;
  onClearDrawings: () => void;
  onToggleVoting: () => void;
  onCycleRole: () => void;
  onToggleFollow: () => void;
  onExport: () => void;
  onToggleShortcuts: () => void;
  onSetBgPattern: (p: CanvasBgPattern) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export const WhiteboardToolbar: React.FC<WhiteboardToolbarProps> = ({
  isPl,
  locked,
  saving,
  loading,
  whiteboardMode,
  sessionState,
  bgPattern,
  drawingPathCount,
  saveStatusLabel,
  canUndo,
  canRedo,
  whiteboardModeCopy,
  onAddElement,
  onSetBoardMode,
  onClearDrawings,
  onToggleVoting,
  onCycleRole,
  onToggleFollow,
  onExport,
  onToggleShortcuts,
  onSetBgPattern,
  onSave,
  onUndo,
  onRedo,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200/60 dark:border-navy-700/60 bg-slate-50/80 dark:bg-navy-900/80 backdrop-blur-sm flex-shrink-0 overflow-x-auto"
      role="toolbar"
      aria-label={t('myWork.whiteboard.toolbarExtra.ariaLabel')}
    >
      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mr-1.5 shrink-0">
        {t('myWork.whiteboard.toolbarExtra.title')}
      </div>

      <ToolbarDropdown
        icon={Plus}
        label={t('myWork.whiteboard.toolbarExtra.create')}
        disabled={locked}
        items={[
          ...STICKY_COLORS.map((c, i) => ({
            id: `sticky-${i}`,
            label: t('myWork.whiteboard.toolbar.sticky'),
            icon: StickyNote,
            swatch: c.hex,
            onClick: () => onAddElement('sticky', { colorIndex: i }),
          })),
          {
            id: 'text',
            label: t('myWork.whiteboard.toolbar.text'),
            icon: Type,
            onClick: () => onAddElement('text'),
          },
          {
            id: 'frame',
            label: t('myWork.whiteboard.toolbar.frame'),
            icon: Frame,
            onClick: () => onAddElement('frame'),
          },
          {
            id: 'shape',
            label: t('myWork.whiteboard.toolbar.shape'),
            icon: Shapes,
            onClick: () => onAddElement('shape_rectangle'),
          },
          {
            id: 'image',
            label: t('myWork.whiteboard.toolbar.image'),
            icon: ImageIcon,
            onClick: () => onAddElement('image'),
          },
          {
            id: 'link',
            label: t('myWork.whiteboard.toolbar.link'),
            icon: Link2,
            onClick: () => onAddElement('link'),
          },
        ]}
        onMainClick={() => onAddElement('sticky')}
      />
      <ToolbarBtn
        icon={Pen}
        label={whiteboardModeCopy.toggleLabel}
        onClick={() => onSetBoardMode(whiteboardMode === 'draw' ? 'board' : 'draw')}
        disabled={locked}
        active={whiteboardMode === 'draw'}
        ariaPressed={whiteboardMode === 'draw'}
      />
      {drawingPathCount > 0 && (
        <ToolbarBtn
          icon={Trash2}
          label={t('myWork.whiteboard.toolbar.clearDrawings')}
          onClick={onClearDrawings}
          disabled={locked}
          danger
        />
      )}

      <div className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-0.5 shrink-0" />

      <ToolbarBtn
        icon={Undo2}
        label={t('myWork.whiteboard.toolbar.undo')}
        onClick={onUndo}
        disabled={!canUndo || locked}
        ariaLabel={t('myWork.whiteboard.toolbar.undo')}
      />
      <ToolbarBtn
        icon={Redo2}
        label={t('myWork.whiteboard.toolbar.redo')}
        onClick={onRedo}
        disabled={!canRedo || locked}
        ariaLabel={t('myWork.whiteboard.toolbar.redo')}
      />

      <div className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-0.5 shrink-0" />

      <ToolbarBtn
        icon={ThumbsUp}
        label={t('myWork.whiteboard.toolbar.voting')}
        onClick={onToggleVoting}
        disabled={locked}
        active={sessionState.votingOpen}
        ariaPressed={sessionState.votingOpen}
      />
      <ToolbarBtn
        icon={Workflow}
        label={t('myWork.whiteboard.toolbarExtra.role')}
        onClick={onCycleRole}
        disabled={locked}
      />
      <ToolbarBtn
        icon={TrendingUp}
        label="Follow"
        onClick={onToggleFollow}
        disabled={locked}
        active={sessionState.followMe}
        ariaPressed={sessionState.followMe}
      />

      <div className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-0.5 shrink-0" />

      <ToolbarBtn
        icon={ExternalLink}
        label={t('myWork.whiteboard.toolbar.export')}
        onClick={onExport}
      />
      <ToolbarBtn
        icon={Keyboard}
        label={t('myWork.whiteboard.toolbar.shortcuts')}
        onClick={onToggleShortcuts}
      />

      <ToolbarDropdown
        icon={Grid3X3}
        label={t('myWork.whiteboard.toolbar.background')}
        disabled={false}
        items={[
          {
            id: 'dots',
            label: t('myWork.whiteboard.toolbarExtra.bgDots'),
            icon: Circle,
            onClick: () => onSetBgPattern('dots'),
          },
          {
            id: 'grid',
            label: t('myWork.whiteboard.toolbarExtra.bgGrid'),
            icon: Grid3X3,
            onClick: () => onSetBgPattern('grid'),
          },
          {
            id: 'lines',
            label: t('myWork.whiteboard.toolbarExtra.bgLines'),
            icon: LayoutGrid,
            onClick: () => onSetBgPattern('lines'),
          },
          {
            id: 'blank',
            label: t('myWork.whiteboard.toolbarExtra.bgBlank'),
            icon: Shapes,
            onClick: () => onSetBgPattern('blank'),
          },
        ]}
        onMainClick={() =>
          onSetBgPattern(
            bgPattern === 'dots'
              ? 'grid'
              : bgPattern === 'grid'
                ? 'lines'
                : bgPattern === 'lines'
                  ? 'blank'
                  : 'dots'
          )
        }
      />

      <div className="flex-1" />

      <button
        type="button"
        onClick={onSave}
        disabled={saving || loading || locked}
        aria-label={t('myWork.whiteboard.toolbar.save')}
        aria-busy={saving}
        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors shrink-0 ${
          saving || loading || locked
            ? 'bg-slate-200/60 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
            : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
        }`}
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? t('myWork.whiteboard.toolbarExtra.saving') : t('myWork.whiteboard.toolbar.save')}
      </button>
      <span className="text-[11px] text-slate-500 dark:text-slate-400">{saveStatusLabel}</span>
    </div>
  );
};
