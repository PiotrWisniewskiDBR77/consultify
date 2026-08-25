import {
  CheckSquare,
  ClipboardCheck,
  Download,
  FileText,
  History,
  Lightbulb,
  ListChecks,
  Maximize2,
  Network,
  Paperclip,
  Presentation,
  Rocket,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import i18n from '../../../i18n';
import { getNotebookActionContract, type NotebookActionContract } from './notebookActionRegistry';

/**
 * Target entity types the note can be converted into (canon: "Convert to" group).
 * Mirrors the conversion targets surfaced elsewhere in MyWork (initiative/task/decision/idea)
 * plus the deliverable targets (assessment/report/presentation).
 */
export type NotebookConvertTarget =
  | 'initiative'
  | 'task'
  | 'decision'
  | 'idea'
  | 'assessment'
  | 'report'
  | 'presentation';

/**
 * A single rendered menu item. Built internally from the grouped callbacks below —
 * exported so an integrator can build custom item sets if ever needed.
 */
export interface NotebookMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => unknown | Promise<unknown>;
  danger?: boolean;
  disabled?: boolean;
  /** Render a thin divider above this item (group boundary). */
  separatorBefore?: boolean;
  contract: NotebookActionContract;
}

export interface NotebookHamburgerMenuProps {
  /** Fixed viewport coordinates (top/left) for the dropdown. */
  x: number;
  y: number;
  /** Close the menu (Escape / outside-click / after an action fires). */
  onClose: () => void;
  /** PL/EN labels. */
  isPolish: boolean;

  // --- Group "Note" --------------------------------------------------------
  /** Export the note (PDF/Markdown/etc.). */
  onExport?: () => unknown | Promise<unknown>;
  /** Toggle the existing version-history surface. */
  onVersionHistory?: () => unknown | Promise<unknown>;
  /** Open sources & attachments panel. */
  onSources?: () => unknown | Promise<unknown>;
  /** Open verification & review panel. */
  onVerification?: () => unknown | Promise<unknown>;
  /** Share the note. */
  onShare?: () => unknown | Promise<unknown>;
  /** Expand the note into a full document deliverable. */
  onExpandDocument?: () => unknown | Promise<unknown>;
  /** Open the note connection graph. */
  onGraph?: () => unknown | Promise<unknown>;

  // --- Group "Convert to" --------------------------------------------------
  /** Convert the note into another entity. Item only renders when provided. */
  onConvert?: (target: NotebookConvertTarget) => unknown | Promise<unknown>;
  /**
   * Restrict which convert targets are offered. Defaults to all targets.
   * Ignored when `onConvert` is not provided (whole group hidden).
   */
  convertTargets?: NotebookConvertTarget[];

  // --- Group "AI" ----------------------------------------------------------
  /** Open Ask AI / command prompt. */
  onAskAI?: () => unknown | Promise<unknown>;

  // --- Group "Danger" ------------------------------------------------------
  /** Delete the note. */
  onDelete?: () => unknown | Promise<unknown>;
  /** Disable the Delete item (e.g. read-only / demo session). */
  deleteDisabled?: boolean;
  /** Durable actions stay disabled unless their backend receipt contract is proven. */
  receiptCapableActionIds?: string[];
}

const ALL_CONVERT_TARGETS: NotebookConvertTarget[] = [
  'initiative',
  'task',
  'decision',
  'idea',
  'assessment',
  'report',
  'presentation',
];

const CONVERT_META: Record<
  NotebookConvertTarget,
  { icon: React.ReactNode; pl: string; en: string }
> = {
  initiative: { icon: <Rocket size={14} />, pl: 'Inicjatywę', en: 'Initiative' },
  task: { icon: <CheckSquare size={14} />, pl: 'Zadanie', en: 'Task' },
  decision: { icon: <ClipboardCheck size={14} />, pl: 'Decyzję', en: 'Decision' },
  idea: { icon: <Lightbulb size={14} />, pl: 'Pomysł', en: 'Idea' },
  assessment: { icon: <ListChecks size={14} />, pl: 'Ocenę', en: 'Assessment' },
  report: { icon: <FileText size={14} />, pl: 'Raport', en: 'Report' },
  presentation: { icon: <Presentation size={14} />, pl: 'Prezentację', en: 'Presentation' },
};

/** Build the flat, grouped action list from the props (skips any item with no handler). */
export function buildNotebookMenuActions(props: NotebookHamburgerMenuProps): NotebookMenuAction[] {
  const {
    onExport,
    onVersionHistory,
    onSources,
    onVerification,
    onShare,
    onExpandDocument,
    onGraph,
    onConvert,
    convertTargets,
    onAskAI,
    onDelete,
    deleteDisabled,
  } = props;

  const items: Array<Omit<NotebookMenuAction, 'contract'>> = [];

  // --- Group: Note ---------------------------------------------------------
  if (onExport) {
    items.push({
      id: 'export',
      label: i18n.t('notebook.hamburgerMenu.export', 'Export'),
      icon: <Download size={14} />,
      onClick: onExport,
    });
  }
  if (onVersionHistory) {
    items.push({
      id: 'version-history',
      label: i18n.t('notebook.hamburgerMenu.versionHistory', 'Version history'),
      icon: <History size={14} />,
      onClick: onVersionHistory,
    });
  }
  if (onSources) {
    items.push({
      id: 'sources',
      label: i18n.t('notebook.hamburgerMenu.sourcesAttachments', 'Sources & attachments'),
      icon: <Paperclip size={14} />,
      onClick: onSources,
    });
  }
  if (onVerification) {
    items.push({
      id: 'verification',
      label: i18n.t('notebook.hamburgerMenu.verificationReview', 'Verification & review'),
      icon: <ShieldCheck size={14} />,
      onClick: onVerification,
    });
  }
  if (onShare) {
    items.push({
      id: 'share',
      label: i18n.t('notebook.hamburgerMenu.share', 'Share'),
      icon: <Share2 size={14} />,
      onClick: onShare,
    });
  }
  if (onExpandDocument) {
    items.push({
      id: 'expand-document',
      label: i18n.t('notebook.hamburgerMenu.expandDocument', 'Expand into document'),
      icon: <Maximize2 size={14} />,
      onClick: onExpandDocument,
    });
  }
  if (onGraph) {
    items.push({
      id: 'connection-graph',
      label: i18n.t('notebook.hamburgerMenu.connectionGraph', 'Connection graph'),
      icon: <Network size={14} />,
      onClick: onGraph,
    });
  }

  // --- Group: Convert to ---------------------------------------------------
  if (onConvert) {
    const targets =
      convertTargets && convertTargets.length > 0 ? convertTargets : ALL_CONVERT_TARGETS;
    targets.forEach((target, idx) => {
      const meta = CONVERT_META[target];
      items.push({
        id: `convert-${target}`,
        label: i18n.t(`myWorkNotebook.hamburgerMenu.convert_${target}`, meta.en),
        icon: meta.icon,
        onClick: () => onConvert(target),
        // First convert item opens the group with a separator + heading-like first entry.
        separatorBefore: idx === 0,
      });
    });
  }

  // --- Group: AI -----------------------------------------------------------
  if (onAskAI) {
    items.push({
      id: 'ask-ai',
      label: i18n.t('notebook.hamburgerMenu.askAi', 'Ask AI'),
      icon: <Sparkles size={14} />,
      onClick: onAskAI,
      separatorBefore: true,
    });
  }

  // --- Group: Danger -------------------------------------------------------
  if (onDelete) {
    items.push({
      id: 'delete',
      label: i18n.t('notebook.hamburgerMenu.deleteNote', 'Delete note'),
      icon: <Trash2 size={14} />,
      onClick: onDelete,
      danger: true,
      disabled: deleteDisabled,
      separatorBefore: true,
    });
  }

  return items.map((item) => {
    const actionContract = getNotebookActionContract(item.id);
    if (!actionContract) throw new Error(`Missing Notebook action contract: ${item.id}`);
    return { ...item, contract: actionContract };
  });
}

/** Heading label shown above the "Convert to" group (rendered inline before first convert item). */
function convertHeading(_pl: boolean): string {
  return i18n.t('notebook.hamburgerMenu.convertTo', 'Convert to');
}

/**
 * NotebookHamburgerMenu — the single ⋯ dropdown for a note (canon redesign N1).
 *
 * Groups (separated by dividers): Note · Convert to · AI · Danger.
 * Each item renders only when its handler is supplied — never a dead action.
 * Monochrome-chrome styling (slate/navy); the only color is the danger Delete item.
 * Closes on Escape, outside-click, and after any action fires.
 */
export const NotebookHamburgerMenu: React.FC<NotebookHamburgerMenuProps> = (props) => {
  const { x, y, onClose, isPolish, receiptCapableActionIds = [] } = props;
  const menuRef = useRef<HTMLDivElement>(null);
  const executionLockRef = useRef(false);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [failedAction, setFailedAction] = useState<NotebookMenuAction | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      returnFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') || []
      );
      if (items.length === 0) return;
      e.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? items.length - 1
            : e.key === 'ArrowDown'
              ? (current + 1 + items.length) % items.length
              : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const actions = buildNotebookMenuActions(props);
  const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight;
  const menuLeft = Math.max(8, Math.min(x, Math.max(8, viewportWidth - 236)));
  const menuTop = Math.max(8, Math.min(y, Math.max(8, viewportHeight - 80)));

  const executeAction = async (action: NotebookMenuAction) => {
    if (executionLockRef.current || action.disabled) return;
    executionLockRef.current = true;
    setRunningActionId(action.id);
    setExecutionError(null);
    setFailedAction(null);
    try {
      const result = await action.onClick();
      if (action.contract.outcome === 'server-receipt-required') {
        const receiptId =
          result && typeof result === 'object' && 'receiptId' in result
            ? String((result as { receiptId?: unknown }).receiptId || '')
            : '';
        if (!receiptId) throw new Error('The server did not return an action receipt.');
      }
      onClose();
    } catch (error) {
      setExecutionError(
        error instanceof Error ? error.message : 'The action failed. Your note was not changed.'
      );
      setFailedAction(action);
    } finally {
      executionLockRef.current = false;
      setRunningActionId(null);
    }
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={i18n.t('notebook.hamburgerMenu.actions', 'Note actions')}
      className="fixed z-50 min-w-[220px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border border-slate-200/60 dark:border-white/[0.03]/70 bg-c-surface py-1 shadow-xl dark:border-navy-700/70 dark:bg-navy-900"
      style={{ top: menuTop, left: menuLeft, maxHeight: 'calc(100vh - 16px)' }}
    >
      {executionError ? (
        <div role="alert" className="mx-2 mb-1 rounded-md border border-danger-300 p-2 text-xs">
          <div>{executionError}</div>
          {failedAction ? (
            <button
              type="button"
              className="mt-1 font-semibold underline"
              onClick={() => void executeAction(failedAction)}
            >
              {i18n.t('common.retry', 'Retry')}
            </button>
          ) : null}
        </div>
      ) : null}
      {actions.map((action) => (
        <React.Fragment key={action.id}>
          {action.separatorBefore && <div className="my-1 border-t border-c-border-subtle" />}
          {action.id.startsWith('convert-') && action.separatorBefore && (
            <div className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              {convertHeading(isPolish)}
            </div>
          )}
          {(() => {
            const receiptUnavailable =
              action.contract.outcome === 'server-receipt-required' &&
              !receiptCapableActionIds.includes(action.id);
            const unavailableReasonId = `notebook-action-${action.id}-unavailable`;
            const unavailableReason = i18n.t(
              'notebook.hamburgerMenu.receiptUnavailable',
              'Unavailable until the server can return a durable action receipt'
            );
            return (
              <div className={receiptUnavailable ? 'py-1' : undefined}>
                <button
                  type="button"
                  role="menuitem"
                  data-notebook-action-id={action.contract.id}
                  data-notebook-action-execution={action.contract.execution}
                  data-notebook-action-permission={action.contract.permission}
                  data-notebook-action-outcome={action.contract.outcome}
                  data-notebook-action-receipt-ready={String(!receiptUnavailable)}
                  aria-disabled={receiptUnavailable || action.disabled || undefined}
                  aria-describedby={receiptUnavailable ? unavailableReasonId : undefined}
                  onClick={() => {
                    if (receiptUnavailable) return;
                    void executeAction(action);
                  }}
                  disabled={action.disabled || runningActionId !== null}
                  aria-busy={runningActionId === action.id || undefined}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    receiptUnavailable
                      ? 'cursor-not-allowed opacity-60'
                      : action.danger
                        ? 'text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-900/20'
                        : 'text-c-text-secondary hover:bg-c-surface-raised dark:text-c-text-secondary dark:hover:bg-c-surface-raised'
                  }`}
                >
                  <span className="shrink-0 text-c-text-muted">{action.icon}</span>
                  {action.label}
                </button>
                {receiptUnavailable ? (
                  <p id={unavailableReasonId} className="px-3 pb-1 text-[10px] text-c-text-muted">
                    {unavailableReason}
                  </p>
                ) : null}
              </div>
            );
          })()}
        </React.Fragment>
      ))}
    </div>
  );
};

export default NotebookHamburgerMenu;
