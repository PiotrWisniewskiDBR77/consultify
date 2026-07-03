import {
  ClipboardPaste,
  Copy,
  GitBranch,
  LayoutGrid,
  Pencil,
  Plus,
  Rocket,
  Settings,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useRef } from 'react';

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
      className="fixed z-50 min-w-[180px] rounded-xl border border-slate-200/70 bg-white dark:border-navy-700/70 dark:bg-navy-900 shadow-xl py-1"
      style={{ top: y, left: x }}
    >
      {actions.map((action) => (
        <React.Fragment key={action.id}>
          {action.separatorBefore && (
            <div className="my-1 border-t border-slate-200/70 dark:border-navy-700/70" />
          )}
          <button
            onClick={() => {
              action.onClick();
              onClose();
            }}
            disabled={action.disabled}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors disabled:opacity-40 ${
              action.danger
                ? 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
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
}): ContextMenuAction[] {
  const items: ContextMenuAction[] = [
    // Open / inspect
    {
      id: 'properties',
      label: opts.isPl ? 'Otwórz właściwości' : 'Open properties',
      icon: <Settings size={14} />,
      onClick: opts.onOpenProperties,
    },
    // Context edits
    {
      id: 'edit',
      label: opts.isPl ? 'Edytuj etykietę' : 'Edit label',
      icon: <Pencil size={14} />,
      onClick: opts.onEditLabel,
      disabled: opts.locked,
      separatorBefore: true,
    },
    {
      id: 'duplicate',
      label: opts.isPl ? 'Duplikuj' : 'Duplicate',
      icon: <Copy size={14} />,
      onClick: opts.onDuplicate,
      disabled: opts.locked,
    },
  ];

  if (opts.onAutoLayout) {
    items.push({
      id: 'auto-layout',
      label: opts.isPl ? 'Auto-układ' : 'Auto-layout',
      icon: <LayoutGrid size={14} />,
      onClick: opts.onAutoLayout,
      disabled: opts.locked,
    });
  }

  if (opts.onConvertInitiative) {
    items.push({
      id: 'convert-initiative',
      label: opts.isPl ? 'Konwertuj na inicjatywę' : 'Convert to initiative',
      icon: <Rocket size={14} />,
      onClick: opts.onConvertInitiative,
      disabled: opts.locked,
      separatorBefore: true,
    });
  }

  items.push({
    id: 'delete',
    label: opts.isPl ? 'Usuń' : 'Delete',
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
      label: opts.isPl ? 'Dodaj akcję' : 'Add action',
      icon: <Plus size={14} />,
      onClick: () => opts.onAddNode('action'),
      disabled: opts.locked,
    },
    {
      id: 'add-decision',
      label: opts.isPl ? 'Dodaj decyzję' : 'Add decision',
      icon: <GitBranch size={14} />,
      onClick: () => opts.onAddNode('decision'),
      disabled: opts.locked,
    },
    {
      id: 'paste',
      label: opts.isPl ? 'Wklej' : 'Paste',
      icon: <ClipboardPaste size={14} />,
      onClick: opts.onPaste,
      disabled: opts.locked,
    },
    {
      id: 'layout',
      label: opts.isPl ? 'Auto-układ' : 'Auto-layout',
      icon: <LayoutGrid size={14} />,
      onClick: opts.onAutoLayout,
      disabled: opts.locked,
    },
  ];
}
