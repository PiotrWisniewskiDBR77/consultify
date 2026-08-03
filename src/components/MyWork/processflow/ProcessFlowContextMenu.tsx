import {
  ArrowLeftRight,
  Check,
  ClipboardPaste,
  Copy,
  GitBranch,
  LayoutGrid,
  Pencil,
  Plus,
  Rocket,
  Settings,
  Sparkles,
  Split,
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
    // Faza przechwytywania — obowiązkowa: d3-zoom pod ReactFlow woła
    // `stopImmediatePropagation()` na `mousedown` w `.react-flow__pane`, więc
    // zwykły listener nigdy się nie odpali (patrz NodeContextMenu).
    window.addEventListener('mousedown', handler, true);
    return () => window.removeEventListener('mousedown', handler, true);
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
  /** P1-4: bez kopiowania schowek nie ma jak sie zapelnic, a „Wklej" jest atrapa. */
  onCopy?: () => void;
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

  if (opts.onCopy) {
    items.splice(items.length - 1, 0, {
      id: 'copy',
      label: tr(opts.isPl, 'copy', 'Copy'),
      icon: <Copy size={14} />,
      onClick: opts.onCopy,
      disabled: opts.locked,
    });
  }

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

// Kolejnosc warunkow krawedzi = ta sama lista co CONDITION_TYPES w
// FlowEdgeComponent ('' | 'yes' | 'no' | 'default' | 'exception'). Etykieta
// per jezyk; '' = krawedz sekwencyjna (bez warunku).
const EDGE_CONDITIONS: Array<{ id: string; plKey: string; pl: string; en: string }> = [
  { id: '', plKey: 'condNone', pl: 'Bez warunku', en: 'No condition' },
  { id: 'yes', plKey: 'condYes', pl: 'Tak', en: 'Yes' },
  { id: 'no', plKey: 'condNo', pl: 'Nie', en: 'No' },
  { id: 'default', plKey: 'condDefault', pl: 'Domyślny', en: 'Default' },
  { id: 'exception', plKey: 'condException', pl: 'Wyjątek', en: 'Exception' },
];

// Helper to build EDGE context menu actions (prawy klik na krawedzi).
// Kanon rozdz. 08 §4: etykieta/styl -> wstaw wezel -> odwroc kierunek ->
// (typ warunku) -> usun. Kazda pozycja ma realny handler (Z3) — nie ma atrap.
// „Usuń" i „Wstaw węzeł" korzystaja z istniejacych deleteSelected/insertBetween
// (krawedz jest zaznaczana przy otwarciu menu), nie duplikuja ich logiki.
export function getEdgeContextActions(opts: {
  edgeId: string;
  isPl: boolean;
  locked: boolean;
  currentCondition: string;
  /** Otwiera EdgeStylePopover (etykieta + kolor + styl linii + strzalka). */
  onEditProps: () => void;
  /** insertBetween() — dziala na zaznaczonej krawedzi (D2). */
  onInsertNode: () => void;
  /** Zamienia source<->target krawedzi. */
  onReverse: () => void;
  /** handleEdgeConditionChange(edgeId, cond). */
  onSetCondition: (condition: string) => void;
  /** deleteSelected() — krawedz jest zaznaczona przy otwarciu menu (D3). */
  onDelete: () => void;
}): ContextMenuAction[] {
  const items: ContextMenuAction[] = [
    {
      id: 'edge-props',
      label: tr(opts.isPl, 'edgeProps', 'Label & style'),
      icon: <Pencil size={14} />,
      onClick: opts.onEditProps,
    },
    {
      id: 'edge-insert',
      label: tr(opts.isPl, 'edgeInsertNode', 'Insert node on connection'),
      icon: <Split size={14} />,
      onClick: opts.onInsertNode,
      disabled: opts.locked,
    },
    {
      id: 'edge-reverse',
      label: tr(opts.isPl, 'edgeReverse', 'Reverse direction'),
      icon: <ArrowLeftRight size={14} />,
      onClick: opts.onReverse,
      disabled: opts.locked,
    },
  ];

  // Grupa: typ warunku (PF wspiera przez data.conditionType). Aktywny = Check.
  EDGE_CONDITIONS.forEach((c, idx) => {
    const active = (opts.currentCondition ?? '') === c.id;
    items.push({
      id: `edge-cond-${c.id || 'none'}`,
      label: `${tr(opts.isPl, 'edgeCondition', 'Condition')}: ${opts.isPl ? c.pl : c.en}`,
      icon: active ? <Check size={14} /> : <span style={{ width: 14, display: 'inline-block' }} />,
      onClick: () => opts.onSetCondition(c.id),
      disabled: opts.locked,
      separatorBefore: idx === 0,
    });
  });

  items.push({
    id: 'edge-delete',
    label: tr(opts.isPl, 'edgeDelete', 'Delete connection'),
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
  /** P1-4: pusty schowek = pozycja wyszarzona z powodem, nie cichy brak reakcji. */
  pasteDisabled?: boolean;
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
      disabled: opts.locked || opts.pasteDisabled === true,
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
