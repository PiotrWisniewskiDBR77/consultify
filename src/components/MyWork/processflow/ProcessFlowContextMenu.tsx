import React, { useEffect, useRef } from 'react';
import { Pencil, Copy, Trash2, Plus, LayoutGrid, ClipboardPaste, GitBranch, Settings } from 'lucide-react';

interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ProcessFlowContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export const ProcessFlowContextMenu: React.FC<ProcessFlowContextMenuProps> = ({
  x, y, actions, onClose,
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
        <button
          key={action.id}
          onClick={() => { action.onClick(); onClose(); }}
          disabled={action.disabled}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors disabled:opacity-40 ${
            action.danger
              ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
          }`}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
};

// Helper to build node context menu actions
export function getNodeContextActions(opts: {
  nodeId: string;
  isPl: boolean;
  locked: boolean;
  onEditLabel: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenProperties: () => void;
}): ContextMenuAction[] {
  return [
    { id: 'edit', label: opts.isPl ? 'Edytuj etykietę' : 'Edit label', icon: <Pencil size={14} />, onClick: opts.onEditLabel, disabled: opts.locked },
    { id: 'duplicate', label: opts.isPl ? 'Duplikuj' : 'Duplicate', icon: <Copy size={14} />, onClick: opts.onDuplicate, disabled: opts.locked },
    { id: 'properties', label: opts.isPl ? 'Właściwości' : 'Properties', icon: <Settings size={14} />, onClick: opts.onOpenProperties },
    { id: 'delete', label: opts.isPl ? 'Usuń' : 'Delete', icon: <Trash2 size={14} />, onClick: opts.onDelete, danger: true, disabled: opts.locked },
  ];
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
    { id: 'add-action', label: opts.isPl ? 'Dodaj akcję' : 'Add action', icon: <Plus size={14} />, onClick: () => opts.onAddNode('action'), disabled: opts.locked },
    { id: 'add-decision', label: opts.isPl ? 'Dodaj decyzję' : 'Add decision', icon: <GitBranch size={14} />, onClick: () => opts.onAddNode('decision'), disabled: opts.locked },
    { id: 'paste', label: opts.isPl ? 'Wklej' : 'Paste', icon: <ClipboardPaste size={14} />, onClick: opts.onPaste, disabled: opts.locked },
    { id: 'layout', label: opts.isPl ? 'Auto-układ' : 'Auto-layout', icon: <LayoutGrid size={14} />, onClick: opts.onAutoLayout, disabled: opts.locked },
  ];
}
