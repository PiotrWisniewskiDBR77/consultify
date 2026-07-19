import {
  ClipboardPaste,
  Copy,
  GitBranch,
  LayoutGrid,
  Pencil,
  Plus,
  Rocket,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useRef } from 'react';

import i18n from '@/i18n';

/**
 * `getNodeContextActions` / `getCanvasContextActions` below are plain
 * exported functions (not components/hooks) called from IdeaProcessFlowTool
 * with an explicit `isPl` — `tr()` forces the i18next `lng` per-call so
 * behavior stays identical to the old inline ternaries.
 */
function tr(isPl: boolean, key: string, defaultValue: string): string {
  return i18n.t(`processFlow.contextMenu.${key}`, defaultValue, { lng: isPl ? 'pl' : 'en' });
}

interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Render a thin divider above this item (canon K6: group Open → Context → AI → Danger). */
  separatorBefore?: boolean;
}

interface ProcessFlowContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export const ProcessFlowContextMenu: React.FC<ProcessFlowContextMenuProps> = ({
  x,
  y,
  actions,
  onClose,
}) => {
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

  return (
    <div
      ref={menuRef}
      className="fixed z-overlay min-w-[180px] rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl py-1"
      style={{ top: y, left: x }}
    >
      {actions.map((action) => (
        <React.Fragment key={action.id}>
          {action.separatorBefore && <div className="my-1 border-t border-c-border-subtle" />}
          <button
            onClick={() => {
              action.onClick();
              onClose();
            }}
            disabled={action.disabled}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors disabled:opacity-40 ${
              action.danger
                ? 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            }`}
          >
            {action.icon}
            {action.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

// Helper to build node context menu actions (canon K6: Open → Context → AI → Convert → Danger).
// Optional handlers (onAutoLayout/onConvertInitiative) only add their item when provided —
// never render a dead action.
export function getNodeContextActions(opts: {
  nodeId: string;
  isPl: boolean;
  locked: boolean;
  onEditLabel: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenProperties: () => void;
  onAutoLayout?: () => void;
  onConvertInitiative?: () => void;
  /** J26 (Kanał 2): open AI "rewrite this step" flow for the node. */
  onAIRewriteStep?: () => void;
}): ContextMenuAction[] {
  const items: ContextMenuAction[] = [
    // Open / inspect
    {
      id: 'properties',
      label: tr(opts.isPl, 'openProperties', 'Open properties'),
      icon: <Settings size={14} />,
      onClick: opts.onOpenProperties,
    },
    // Context edits
    {
      id: 'edit',
      label: tr(opts.isPl, 'editLabel', 'Edit label'),
      icon: <Pencil size={14} />,
      onClick: opts.onEditLabel,
      disabled: opts.locked,
      separatorBefore: true,
    },
    {
      id: 'duplicate',
      label: tr(opts.isPl, 'duplicate', 'Duplicate'),
      icon: <Copy size={14} />,
      onClick: opts.onDuplicate,
      disabled: opts.locked,
    },
  ];

  if (opts.onAutoLayout) {
    items.push({
      id: 'auto-layout',
      label: tr(opts.isPl, 'autoLayout', 'Auto-layout'),
      icon: <LayoutGrid size={14} />,
      onClick: opts.onAutoLayout,
      disabled: opts.locked,
    });
  }

  // AI group (canon K6: Open → Context → AI → Convert → Danger). J26 (Kanał 2):
  // "rewrite this step" — AI modifies the EXISTING step in place (Propose→Accept),
  // distinct from the manual "Edit label" above.
  if (opts.onAIRewriteStep) {
    items.push({
      id: 'ai-rewrite-step',
      label: tr(opts.isPl, 'aiRewriteStep', 'AI: rewrite step'),
      icon: <Sparkles size={14} />,
      onClick: opts.onAIRewriteStep,
      disabled: opts.locked,
      separatorBefore: true,
    });
  }

  if (opts.onConvertInitiative) {
    items.push({
      id: 'convert-initiative',
      label: tr(opts.isPl, 'convertToInitiative', 'Convert to initiative'),
      icon: <Rocket size={14} />,
      onClick: opts.onConvertInitiative,
      disabled: opts.locked,
      separatorBefore: true,
    });
  }

  items.push({
    id: 'delete',
    label: tr(opts.isPl, 'delete', 'Delete'),
    icon: <Trash2 size={14} />,
    onClick: opts.onDelete,
    danger: true,
    disabled: opts.locked,
    separatorBefore: true,
  });

  return items;
}

// Helper to build canvas context menu actions
export function getCanvasContextActions(opts: {
  isPl: boolean;
  locked: boolean;
  onAddNode: (shape: string) => void;
  onPaste: () => void;
  onAutoLayout: () => void;
}): ContextMenuAction[] {
  return [
    {
      id: 'add-action',
      label: tr(opts.isPl, 'addAction', 'Add action'),
      icon: <Plus size={14} />,
      onClick: () => opts.onAddNode('action'),
      disabled: opts.locked,
    },
    {
      id: 'add-decision',
      label: tr(opts.isPl, 'addDecision', 'Add decision'),
      icon: <GitBranch size={14} />,
      onClick: () => opts.onAddNode('decision'),
      disabled: opts.locked,
    },
    {
      id: 'paste',
      label: tr(opts.isPl, 'paste', 'Paste'),
      icon: <ClipboardPaste size={14} />,
      onClick: opts.onPaste,
      disabled: opts.locked,
    },
    {
      id: 'layout',
      label: tr(opts.isPl, 'autoLayout', 'Auto-layout'),
      icon: <LayoutGrid size={14} />,
      onClick: opts.onAutoLayout,
      disabled: opts.locked,
    },
  ];
}
