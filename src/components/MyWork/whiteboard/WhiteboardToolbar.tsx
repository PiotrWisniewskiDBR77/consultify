import {
  Circle,
  Diamond,
  ExternalLink,
  Grid3X3,
  Hexagon,
  Image as ImageIcon,
  Keyboard,
  LayoutGrid,
  Link2,
  Loader2,
  MoreHorizontal,
  Redo2,
  Save,
  Shapes,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Undo2,
  Wand2,
  Workflow,
} from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import {
  type ActionContext,
  getActionsForSurface,
  runIdeaAction,
} from '@/actions/ideaActionRegistry';
import { isCanvasUndoInRailOnlyEnabled } from '@/utils/canvasUndoInRailOnlyFlag';

import { EMPTY_SELECTION, type CanvasBgPattern } from '../ideaSelectionTypes';
import type { WhiteboardSessionState, WhiteboardSharePolicy } from './whiteboardContracts';
import { ToolbarBtn, ToolbarDropdown } from './WhiteboardToolbarPrimitives';

/**
 * N7 kontynuacja (2026-08-09, Program B/E02) — te 17 lucide-icon (jeden mniej
 * niż 18 akcji: koło jest użyte dwukrotnie, insert-circle i bg-dots) już były
 * importowane lokalnie PRZED tą migracją i renderują się BEZ pośrednictwa
 * rejestru (`ideaActionRegistry.ts` niesie `icon: IconName` tylko dla
 * Teresy/manifestu i przyszłych powierzchni bez własnej ikonografii — patrz
 * `WhiteboardEdgeContextMenu.tsx` dla przykładu, gdzie TO rejestr rysuje
 * ikonę). Tutaj, żeby zachować dokładnie ten sam wygląd co przed migracją
 * (wymóg zadania: zero zmian wizualnych), ikony i etykiety i18n ZOSTAJĄ
 * lokalne — migruje wyłącznie WYKONANIE (`onClick` → `runAction` → rejestr).
 */

export interface WhiteboardToolbarProps {
  isPl: boolean;
  locked: boolean;
  saving: boolean;
  loading: boolean;
  sessionState: WhiteboardSessionState;
  sharePolicy: WhiteboardSharePolicy;
  presenceUsers: Array<{ userId: string; userName?: string }>;
  bgPattern: CanvasBgPattern;
  drawingPathCount: number;
  saveStatusLabel: string;
  shortcutsHelpOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** When true (Menu 1 owns the save indicator in the mels canvas shell), the
   *  toolbar hides its own Save button to avoid duplicating the identity-row
   *  save state. Save mechanics (autosave + onSave) are untouched. Default OFF
   *  → legacy layout renders exactly as before. */
  hideSaveIndicator?: boolean;

  onAddElement: (kind: string, extraData?: Record<string, unknown>) => void;
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
  /** WB-P2-03: "Tidy board" — arranges the whole board (or the current
   *  selection, when 2+ unlocked objects are selected) with the same
   *  collision-free placement service used for new inserts. Optional so
   *  existing call sites/tests that don't pass it keep compiling; the
   *  overflow item below no-ops via `?.()` when omitted. */
  onTidyBoard?: () => void;
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
            className="fixed z-[1000] w-[200px] bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl shadow-lg dark:shadow-[0_0_20px_rgba(0,0,0,0.4)] py-1 max-h-[70vh] overflow-y-auto"
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
                        ? 'text-c-text bg-c-surface-raised'
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
  sessionState,
  bgPattern,
  drawingPathCount,
  saveStatusLabel,
  canUndo,
  canRedo,
  onAddElement,
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
  onTidyBoard,
  hideSaveIndicator = false,
}) => {
  const { t } = useTranslation();
  /** C: Cofnij/Ponów tylko w lewym pasku (flaga, domyślnie OFF). */
  const undoRedoInRailOnly = isCanvasUndoInRailOnlyEnabled();

  /**
   * N7 kontynuacja (2026-08-09, Program B/E02) — te 18 przycisków paska są
   * teraz wpisami `surface: 'toolbar'` w `ideaActionRegistry.ts` (patrz
   * komentarz tam: 5×Wstaw, Cofnij/Ponów, 9×overflow, Zapisz, Wyczyść
   * rysunki). Layout, i18n-owe etykiety i lokalny stan `active`/`disabled`
   * (locked/saving/loading/canUndo/canRedo/sessionState/bgPattern) ZOSTAJĄ
   * DOKŁADNIE takie jak przed migracją — jedyna zmiana to WYKONANIE: zamiast
   * wołać prop-callback wprost, każdy handler idzie przez `runIdeaAction`,
   * dokładnie jak `WhiteboardEdgeContextMenu.tsx` (7b0604cd80). Rejestr
   * decyduje, CZY dana akcja istnieje na tej powierzchni (Z3) — brakujący
   * wpis odpala oryginalny callback zamiast wyciszać klik (patrz `runAction`
   * niżej), ale to sygnał do naprawy rejestru, nie zamierzona ścieżka.
   */
  const registryActionsById = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof getActionsForSurface>[number]>();
    for (const entry of getActionsForSurface('toolbar', { tool: 'whiteboard' })) {
      map.set(entry.def.id, entry);
    }
    return map;
  }, []);

  const runAction = React.useCallback(
    (id: string, run: () => void) => {
      if (!registryActionsById.has(id)) {
        run();
        return;
      }
      const ctx: ActionContext = {
        ideaId: '',
        tool: 'whiteboard',
        selection: EMPTY_SELECTION,
        surface: 'toolbar',
        source: 'ui',
        language: isPl ? 'pl' : 'en',
        params: { run },
      };
      void runIdeaAction(id, ctx);
    },
    [registryActionsById, isPl]
  );

  return (
    <div
      className="flex items-center gap-1 px-3 py-1.5 border-b border-c-border-subtle bg-c-surface-raised backdrop-blur-sm flex-shrink-0 overflow-x-auto"
      role="toolbar"
      aria-label={t('myWork.whiteboard.toolbarExtra.ariaLabel')}
      // Same shell contract as ProcessFlowToolbar (Gate 4, 720×450): reserve
      // the floating right tool rail's measured width so this bar's own
      // content never sits under it. Falls back to 0px when unset.
      style={{ paddingRight: 'var(--mels-rail-gutter, 0px)' }}
    >
      <div className="text-xs font-semibold text-c-text-secondary mr-1.5 shrink-0">
        {t('myWork.whiteboard.toolbarExtra.title')}
      </div>

      {/*
       * CB-05/RB-041/RV-005: Sticky/Text/Shape(rectangle)/Frame/Draw are now
       * owned exclusively by the left rail (CanvasLeftToolbar WB_CONTEXT_SLOTS
       * + the shared pointer-mode slot) — decision #2/#3/#4. This dropdown
       * keeps only what the rail has no equivalent for: the extra shape
       * variants, Image and Link. Renamed from "Create" to "Insert" so it
       * reads as a supplement, not a second main creation surface.
       */}
      <ToolbarDropdown
        icon={ImageIcon}
        label={t('myWork.whiteboard.toolbarExtra.insert')}
        disabled={locked}
        items={[
          {
            id: 'shape_circle',
            label: t('myWork.whiteboard.shapes.circle'),
            icon: Circle,
            onClick: () => runAction('idea.canvas.insert_shape_circle', () => onAddElement('shape_circle')),
          },
          {
            id: 'shape_diamond',
            label: t('myWork.whiteboard.shapes.diamond'),
            icon: Diamond,
            onClick: () =>
              runAction('idea.canvas.insert_shape_diamond', () => onAddElement('shape_diamond')),
          },
          {
            id: 'shape_hexagon',
            label: t('myWork.whiteboard.shapes.hexagon'),
            icon: Hexagon,
            onClick: () =>
              runAction('idea.canvas.insert_shape_hexagon', () => onAddElement('shape_hexagon')),
          },
          {
            id: 'image',
            label: t('myWork.whiteboard.toolbar.image'),
            icon: ImageIcon,
            onClick: () => runAction('idea.canvas.insert_image', () => onAddElement('image')),
          },
          {
            id: 'link',
            label: t('myWork.whiteboard.toolbar.link'),
            icon: Link2,
            onClick: () => runAction('idea.canvas.insert_link', () => onAddElement('link')),
          },
        ]}
        onMainClick={() => runAction('idea.canvas.insert_image', () => onAddElement('image'))}
      />

      {/*
       * Sprzątanie C (2026-07-28, flaga `ff_canvasUndoInRailOnly`, domyślnie OFF):
       * właściciel — „to nie jest potrzebne bo mamy to samo w panelu lewym".
       * ON = para znika RAZEM ze swoimi dzielnikami (inaczej zostałaby podwójna
       * kreska). Funkcja zostaje w lewym pasku (`wb_undo`/`wb_redo`), pod
       * Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z i w sekcji „Historia" prawego panelu.
       */}
      {undoRedoInRailOnly ? (
        <div className="w-px h-5 bg-c-surface-raised mx-0.5 shrink-0" />
      ) : (
        <>
          <div className="w-px h-5 bg-c-surface-raised mx-0.5 shrink-0" />

          <ToolbarBtn
            icon={Undo2}
            label={t('myWork.whiteboard.toolbar.undo')}
            onClick={() => runAction('idea.canvas.undo', onUndo)}
            disabled={!canUndo || locked}
            ariaLabel={t('myWork.whiteboard.toolbar.undo')}
          />
          <ToolbarBtn
            icon={Redo2}
            label={t('myWork.whiteboard.toolbar.redo')}
            onClick={() => runAction('idea.canvas.redo', onRedo)}
            disabled={!canRedo || locked}
            ariaLabel={t('myWork.whiteboard.toolbar.redo')}
          />

          <div className="w-px h-5 bg-c-surface-raised mx-0.5 shrink-0" />
        </>
      )}

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
            onClick: () => runAction('idea.canvas.toggle_voting', onToggleVoting),
            disabled: locked,
            active: sessionState.votingOpen,
          },
          {
            id: 'role',
            label: t('myWork.whiteboard.toolbarExtra.role'),
            icon: Workflow,
            onClick: () => runAction('idea.canvas.cycle_role', onCycleRole),
            disabled: locked,
          },
          {
            id: 'follow',
            label: t('myWork.whiteboard.toolbarExtra.follow'),
            icon: TrendingUp,
            onClick: () => runAction('idea.canvas.toggle_follow', onToggleFollow),
            disabled: locked,
            active: sessionState.followMe,
          },
          {
            // WB-P2-03: "Tidy board" — whole-board entry point (the
            // selection edit bar carries the "Auto arrange selection" one
            // when there's an active selection; same underlying command).
            id: 'tidy-board',
            label: t('myWork.whiteboard.toolbarExtra.tidyBoard'),
            icon: Wand2,
            onClick: () => runAction('idea.canvas.tidy_board', () => onTidyBoard?.()),
            disabled: locked,
          },
          {
            id: 'export',
            label: t('myWork.whiteboard.toolbar.export'),
            icon: ExternalLink,
            onClick: () => runAction('idea.canvas.export_view', onExport),
          },
          {
            id: 'shortcuts',
            label: t('myWork.whiteboard.toolbar.shortcuts'),
            icon: Keyboard,
            onClick: () => runAction('idea.canvas.toggle_shortcuts', onToggleShortcuts),
          },
          {
            id: 'bg-dots',
            label: `${t('myWork.whiteboard.toolbar.background')}: ${t('myWork.whiteboard.toolbarExtra.bgDots')}`,
            icon: Circle,
            onClick: () => runAction('idea.canvas.set_bg_dots', () => onSetBgPattern('dots')),
            active: bgPattern === 'dots',
          },
          {
            id: 'bg-grid',
            label: `${t('myWork.whiteboard.toolbar.background')}: ${t('myWork.whiteboard.toolbarExtra.bgGrid')}`,
            icon: Grid3X3,
            onClick: () => runAction('idea.canvas.set_bg_grid', () => onSetBgPattern('grid')),
            active: bgPattern === 'grid',
          },
          {
            id: 'bg-lines',
            label: `${t('myWork.whiteboard.toolbar.background')}: ${t('myWork.whiteboard.toolbarExtra.bgLines')}`,
            icon: LayoutGrid,
            onClick: () => runAction('idea.canvas.set_bg_lines', () => onSetBgPattern('lines')),
            active: bgPattern === 'lines',
          },
          {
            id: 'bg-blank',
            label: `${t('myWork.whiteboard.toolbar.background')}: ${t('myWork.whiteboard.toolbarExtra.bgBlank')}`,
            icon: Shapes,
            onClick: () => runAction('idea.canvas.set_bg_blank', () => onSetBgPattern('blank')),
            active: bgPattern === 'blank',
          },
        ]}
      />

      <div className="flex-1" />

      {/* Z9: gdy Menu 1 (mels canvas shell) niesie własny wskaźnik zapisu
          (IdeaSaveIndicator), toolbar chowa WŁASNY przycisk Zapisz — zero dubli.
          hideSaveIndicator=false (legacy) → renderuje jak dotąd. Mechanika
          zapisu (autosave + onSave) bez zmian.
          CB-05/RB-043/RV-004: Save moved BEFORE the destructive group below —
          Clear Drawings must be the true final, visually separated action in
          the row, not preceded by anything (including the primary CTA). */}
      {!hideSaveIndicator && (
        <button
          type="button"
          onClick={() => runAction('idea.canvas.save', onSave)}
          disabled={saving || loading || locked}
          aria-label={t('myWork.whiteboard.toolbar.save')}
          aria-busy={saving}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors shrink-0 ${
            saving || loading || locked
              ? 'bg-c-surface-raised text-c-text-muted'
              : 'bg-c-text text-c-surface hover:brightness-110'
          }`}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving
            ? t('myWork.whiteboard.toolbarExtra.saving')
            : t('myWork.whiteboard.toolbar.save')}
        </button>
      )}
      {/* #6c: "Saved Xs ago" tekst usunięty — autosave ma być cichy (dublet z Mind Map #6b/#6c).
          Mechanika sync (saveStatusLabel prop) zostaje niezmieniona, tylko nie renderujemy jej. */}

      {/* CB-05/RB-043/RV-004: destructive group — the LAST thing in the row,
          visually separated by a divider, only rendered when there's
          something to clear. `onClearDrawings` already runs a Cancel/Confirm
          dialog upstream (IdeaWhiteboardTool.tsx showConfirm) — this only
          fixes WHERE it sits in the row, not the confirmation itself. */}
      {drawingPathCount > 0 && (
        <>
          <div className="w-px h-5 bg-c-surface-raised mx-0.5 shrink-0" />
          <ToolbarBtn
            icon={Trash2}
            label={t('myWork.whiteboard.toolbar.clearDrawings')}
            onClick={() => runAction('idea.canvas.clear_drawings', onClearDrawings)}
            disabled={locked}
            danger
          />
        </>
      )}
    </div>
  );
};
