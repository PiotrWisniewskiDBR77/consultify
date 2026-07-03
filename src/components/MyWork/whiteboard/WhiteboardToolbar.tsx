import {
  Circle,
  Diamond,
  ExternalLink,
  Frame,
  Grid3X3,
  Hexagon,
  Image as ImageIcon,
  Keyboard,
  LayoutGrid,
  Link2,
  Loader2,
  MoreHorizontal,
  Pen,
  Plus,
  Redo2,
  Save,
  Shapes,
  Square,
  StickyNote,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Type,
  Undo2,
  Workflow,
} from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import type { CanvasBgPattern } from '../ideaSelectionTypes';
import { STICKY_COLORS } from './nodes/whiteboardNodeHelpers';
import type { WhiteboardSessionState, WhiteboardSharePolicy } from './whiteboardContracts';
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

interface OverflowItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}

/**
 * Editor Shell Canon §2 GÓRNA — the overflow "…" that collapses the whiteboard's
 * secondary tools (session/collab + export/shortcuts/background) so the command
 * row keeps a clear primary/secondary/overflow hierarchy instead of a flat row.
 * Menu is portaled to `body` so the toolbar's `overflow-x-auto` can't clip it.
 */
const ToolbarOverflow: React.FC<{ label: string; items: OverflowItem[] }> = ({ label, items }) => {
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const position = React.useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setCoords({ top: r.bottom + 4, left: Math.max(8, r.right - 200) });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open, position]);

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        data-testid="whiteboard-toolbar-overflow"
        onClick={() => {
          setOpen((p) => {
            const next = !p;
            if (next) position();
            return next;
          });
        }}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors shrink-0 ${
          open
            ? 'bg-c-surface-raised text-c-text'
            : 'text-c-text-secondary hover:bg-c-surface-raised'
        }`}
      >
        <MoreHorizontal size={14} />
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            data-testid="whiteboard-toolbar-overflow-menu"
            role="menu"
            className="fixed z-[1000] w-[200px] bg-c-surface border border-c-border-subtle rounded-xl shadow-lg dark:shadow-[0_0_20px_rgba(0,0,0,0.4)] py-1 max-h-[70vh] overflow-y-auto"
            style={{ top: coords.top, left: coords.left }}
          >
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <button
                  key={it.id}
                  type="button"
                  role="menuitem"
                  disabled={it.disabled}
                  onClick={() => {
                    it.onClick();
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors disabled:opacity-40 ${
                    it.danger
                      ? 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20'
                      : it.active
                        ? 'text-primary-600 dark:text-primary-400 bg-primary-500/10'
                        : 'text-c-text-secondary hover:bg-c-surface-raised'
                  }`}
                >
                  <Icon size={12} /> <span>{it.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};

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
      className="flex items-center gap-1 px-3 py-1.5 border-b border-c-border-subtle bg-c-surface-raised backdrop-blur-sm flex-shrink-0 overflow-x-auto"
      role="toolbar"
      aria-label={t('myWork.whiteboard.toolbarExtra.ariaLabel')}
    >
      <div className="text-xs font-semibold text-c-text-secondary mr-1.5 shrink-0">
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
            id: 'shape_rectangle',
            label: t('myWork.whiteboard.shapes.rectangle'),
            icon: Square,
            onClick: () => onAddElement('shape_rectangle'),
          },
          {
            id: 'shape_circle',
            label: t('myWork.whiteboard.shapes.circle'),
            icon: Circle,
            onClick: () => onAddElement('shape_circle'),
          },
          {
            id: 'shape_diamond',
            label: t('myWork.whiteboard.shapes.diamond'),
            icon: Diamond,
            onClick: () => onAddElement('shape_diamond'),
          },
          {
            id: 'shape_hexagon',
            label: t('myWork.whiteboard.shapes.hexagon'),
            icon: Hexagon,
            onClick: () => onAddElement('shape_hexagon'),
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

      <div className="w-px h-5 bg-c-surface-raised mx-0.5 shrink-0" />

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

      <div className="w-px h-5 bg-c-surface-raised mx-0.5 shrink-0" />

      {/*
       * Editor Shell Canon §2 GÓRNA — secondary tools (session/collab, export,
       * shortcuts, background) collapse under one overflow "…" so the row keeps a
       * primary (Create/Draw/Save) → secondary (undo/redo) → overflow hierarchy.
       */}
      <ToolbarOverflow
        label={t('myWork.whiteboard.toolbarExtra.more')}
        items={[
          {
            id: 'voting',
            label: t('myWork.whiteboard.toolbar.voting'),
            icon: ThumbsUp,
            onClick: onToggleVoting,
            disabled: locked,
            active: sessionState.votingOpen,
          },
          {
            id: 'role',
            label: t('myWork.whiteboard.toolbarExtra.role'),
            icon: Workflow,
            onClick: onCycleRole,
            disabled: locked,
          },
          {
            id: 'follow',
            label: t('myWork.whiteboard.toolbarExtra.follow'),
            icon: TrendingUp,
            onClick: onToggleFollow,
            disabled: locked,
            active: sessionState.followMe,
          },
          {
            id: 'export',
            label: t('myWork.whiteboard.toolbar.export'),
            icon: ExternalLink,
            onClick: onExport,
          },
          {
            id: 'shortcuts',
            label: t('myWork.whiteboard.toolbar.shortcuts'),
            icon: Keyboard,
            onClick: onToggleShortcuts,
          },
          {
            id: 'bg-dots',
            label: `${t('myWork.whiteboard.toolbar.background')}: ${t('myWork.whiteboard.toolbarExtra.bgDots')}`,
            icon: Circle,
            onClick: () => onSetBgPattern('dots'),
            active: bgPattern === 'dots',
          },
          {
            id: 'bg-grid',
            label: `${t('myWork.whiteboard.toolbar.background')}: ${t('myWork.whiteboard.toolbarExtra.bgGrid')}`,
            icon: Grid3X3,
            onClick: () => onSetBgPattern('grid'),
            active: bgPattern === 'grid',
          },
          {
            id: 'bg-lines',
            label: `${t('myWork.whiteboard.toolbar.background')}: ${t('myWork.whiteboard.toolbarExtra.bgLines')}`,
            icon: LayoutGrid,
            onClick: () => onSetBgPattern('lines'),
            active: bgPattern === 'lines',
          },
          {
            id: 'bg-blank',
            label: `${t('myWork.whiteboard.toolbar.background')}: ${t('myWork.whiteboard.toolbarExtra.bgBlank')}`,
            icon: Shapes,
            onClick: () => onSetBgPattern('blank'),
            active: bgPattern === 'blank',
          },
        ]}
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
            ? 'bg-c-surface-raised text-c-text-muted'
            : 'bg-c-accent text-white hover:brightness-110'
        }`}
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? t('myWork.whiteboard.toolbarExtra.saving') : t('myWork.whiteboard.toolbar.save')}
      </button>
      <span className="text-[11px] text-c-text-muted">{saveStatusLabel}</span>
    </div>
  );
};
