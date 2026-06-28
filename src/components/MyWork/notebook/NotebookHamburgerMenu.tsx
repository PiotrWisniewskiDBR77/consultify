import {
  CheckSquare,
  ClipboardCheck,
  Download,
  FileText,
  Lightbulb,
  ListChecks,
  Maximize2,
  Paperclip,
  Presentation,
  Rocket,
  ShieldCheck,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useRef } from 'react';

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
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Render a thin divider above this item (group boundary). */
  separatorBefore?: boolean;
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
  onExport?: () => void;
  /** Open sources & attachments panel. */
  onSources?: () => void;
  /** Open verification & review panel. */
  onVerification?: () => void;
  /** Share the note. */
  onShare?: () => void;
  /** Expand the note into a full document deliverable. */
  onExpandDocument?: () => void;

  // --- Group "Convert to" --------------------------------------------------
  /** Convert the note into another entity. Item only renders when provided. */
  onConvert?: (target: NotebookConvertTarget) => void;
  /**
   * Restrict which convert targets are offered. Defaults to all targets.
   * Ignored when `onConvert` is not provided (whole group hidden).
   */
  convertTargets?: NotebookConvertTarget[];

  // --- Group "AI" ----------------------------------------------------------
  /** Open Ask AI / command prompt. */
  onAskAI?: () => void;

  // --- Group "Danger" ------------------------------------------------------
  /** Delete the note. */
  onDelete?: () => void;
  /** Disable the Delete item (e.g. read-only / demo session). */
  deleteDisabled?: boolean;
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
function buildActions(props: NotebookHamburgerMenuProps): NotebookMenuAction[] {
  const {
    isPolish: pl,
    onExport,
    onSources,
    onVerification,
    onShare,
    onExpandDocument,
    onConvert,
    convertTargets,
    onAskAI,
    onDelete,
    deleteDisabled,
  } = props;

  const items: NotebookMenuAction[] = [];

  // --- Group: Note ---------------------------------------------------------
  if (onExport) {
    items.push({
      id: 'export',
      label: pl ? 'Eksportuj' : 'Export',
      icon: <Download size={14} />,
      onClick: onExport,
    });
  }
  if (onSources) {
    items.push({
      id: 'sources',
      label: pl ? 'Źródła i załączniki' : 'Sources & attachments',
      icon: <Paperclip size={14} />,
      onClick: onSources,
    });
  }
  if (onVerification) {
    items.push({
      id: 'verification',
      label: pl ? 'Weryfikacja i przegląd' : 'Verification & review',
      icon: <ShieldCheck size={14} />,
      onClick: onVerification,
    });
  }
  if (onShare) {
    items.push({
      id: 'share',
      label: pl ? 'Udostępnij' : 'Share',
      icon: <Share2 size={14} />,
      onClick: onShare,
    });
  }
  if (onExpandDocument) {
    items.push({
      id: 'expand-document',
      label: pl ? 'Rozwiń do dokumentu' : 'Expand into document',
      icon: <Maximize2 size={14} />,
      onClick: onExpandDocument,
    });
  }

  // --- Group: Convert to ---------------------------------------------------
  if (onConvert) {
    const targets = convertTargets && convertTargets.length > 0 ? convertTargets : ALL_CONVERT_TARGETS;
    targets.forEach((target, idx) => {
      const meta = CONVERT_META[target];
      items.push({
        id: `convert-${target}`,
        label: pl ? meta.pl : meta.en,
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
      label: pl ? 'Zapytaj AI' : 'Ask AI',
      icon: <Sparkles size={14} />,
      onClick: onAskAI,
      separatorBefore: true,
    });
  }

  // --- Group: Danger -------------------------------------------------------
  if (onDelete) {
    items.push({
      id: 'delete',
      label: pl ? 'Usuń notatkę' : 'Delete note',
      icon: <Trash2 size={14} />,
      onClick: onDelete,
      danger: true,
      disabled: deleteDisabled,
      separatorBefore: true,
    });
  }

  return items;
}

/** Heading label shown above the "Convert to" group (rendered inline before first convert item). */
function convertHeading(pl: boolean): string {
  return pl ? 'Konwertuj na' : 'Convert to';
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
  const { x, y, onClose, isPolish } = props;
  const menuRef = useRef<HTMLDivElement>(null);

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
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const actions = buildActions(props);

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 min-w-[220px] rounded-lg border border-slate-200/70 bg-white py-1 shadow-xl dark:border-navy-700/70 dark:bg-navy-900"
      style={{ top: y, left: x }}
    >
      {actions.map((action) => (
        <React.Fragment key={action.id}>
          {action.separatorBefore && (
            <div className="my-1 border-t border-slate-200/70 dark:border-navy-700/70" />
          )}
          {action.id.startsWith('convert-') && action.separatorBefore && (
            <div className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {convertHeading(isPolish)}
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              action.onClick();
              onClose();
            }}
            disabled={action.disabled}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              action.danger
                ? 'text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-900/20'
                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-navy-800'
            }`}
          >
            <span className="shrink-0 text-slate-400 dark:text-slate-500">{action.icon}</span>
            {action.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

export default NotebookHamburgerMenu;
