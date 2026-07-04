/**
 * VSMNodeComponent — Value Stream Map node shapes for Process Flow canvas.
 *
 * Provides specialised VSM shapes: process box with data fields, inventory
 * triangle, supplier/customer icons, push/pull arrows, supermarket (kanban),
 * FIFO lane, and kaizen burst.
 *
 * Each shape renders inline data fields (C/T, C/O, uptime, batch, operators,
 * inventory, scrap rate) and supports double-click editing.
 *
 * Register the exported `vsmNodeTypes` record with React Flow.
 */
import { ArrowRight, ArrowRightLeft, Box, ShoppingCart, Truck, Users, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Handle, type NodeProps, Position } from 'reactflow';

// ── Types ────────────────────────────────────────────────────────────────────

export interface VSMDataFields {
  cycleTime?: string;
  changeoverTime?: string;
  uptimePercent?: number;
  batchSize?: number;
  operators?: number;
  inventory?: number;
  scrapRate?: number;
}

export type VSMFieldKey = keyof VSMDataFields;

export type VSMShape =
  | 'vsm_process'
  | 'vsm_inventory'
  | 'vsm_supplier'
  | 'vsm_customer'
  | 'vsm_push_arrow'
  | 'vsm_pull_arrow'
  | 'vsm_supermarket'
  | 'vsm_fifo'
  | 'vsm_kaizen';

const FIELD_LABELS: Record<VSMFieldKey, { en: string; pl: string; abbr: string }> = {
  cycleTime: { en: 'Cycle Time', pl: 'Czas cyklu', abbr: 'C/T' },
  changeoverTime: { en: 'Changeover', pl: 'Przezbrojenie', abbr: 'C/O' },
  uptimePercent: { en: 'Uptime', pl: 'Dostępność', abbr: 'Up%' },
  batchSize: { en: 'Batch Size', pl: 'Partia', abbr: 'Batch' },
  operators: { en: 'Operators', pl: 'Operatorzy', abbr: 'Ops' },
  inventory: { en: 'Inventory', pl: 'Zapas', abbr: 'Inv' },
  scrapRate: { en: 'Scrap Rate', pl: 'Odpad', abbr: 'Scrap' },
};

// ── Inline field editor ──────────────────────────────────────────────────────

interface InlineFieldProps {
  label: string;
  value: string | number | undefined;
  suffix?: string;
  locked?: boolean;
  onCommit: (next: string) => void;
}

const InlineField: React.FC<InlineFieldProps> = ({ label, value, suffix, locked, onCommit }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== String(value ?? '')) onCommit(draft);
  };

  if (value == null && !editing) return null;

  return (
    <div className="flex items-center gap-1 text-[8px] leading-tight">
      <span className="font-bold text-slate-500 dark:text-slate-400 min-w-[28px]">{label}:</span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-14 bg-white dark:bg-navy-800 border border-primary-400 rounded px-0.5 text-[8px] outline-none text-slate-700 dark:text-slate-200"
        />
      ) : (
        <span
          className="text-slate-700 dark:text-slate-200 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400"
          onDoubleClick={() => {
            if (!locked) {
              setDraft(String(value ?? ''));
              setEditing(true);
            }
          }}
        >
          {value}
          {suffix || ''}
        </span>
      )}
    </div>
  );
};

// ── Shared label editor ──────────────────────────────────────────────────────

interface LabelEditorProps {
  label: string;
  locked?: boolean;
  onLabelChange?: (next: string) => void;
  className?: string;
}

const LabelEditor: React.FC<LabelEditorProps> = ({ label, locked, onLabelChange, className }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== label && onLabelChange) onLabelChange(draft);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className={`bg-transparent text-xs font-medium text-center outline-none border-b border-primary-400 w-full ${className || 'text-slate-800 dark:text-slate-200'}`}
      />
    );
  }

  return (
    <div
      className={`text-xs font-medium text-center truncate ${className || 'text-slate-800 dark:text-slate-200'}`}
      onDoubleClick={() => {
        if (!locked) {
          setDraft(label);
          setEditing(true);
        }
      }}
    >
      {label}
    </div>
  );
};

// ── Helper: fire field change event ──────────────────────────────────────────

function emitFieldChange(nodeId: string | undefined, field: VSMFieldKey, value: string) {
  if (!nodeId) return;
  const parsed = value === '' ? undefined : isNaN(Number(value)) ? value : Number(value);
  window.dispatchEvent(
    new CustomEvent('idea-workspace-node-update', {
      detail: { nodeId, data: { [field]: parsed } },
    })
  );
}

// ── VSM Process Node ─────────────────────────────────────────────────────────

export const VSMProcessNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const label = data?.label || 'Process';
  const locked = data?.locked;

  const fieldChange = useCallback(
    (field: VSMFieldKey) => (val: string) => emitFieldChange(id, field, val),
    [id]
  );

  return (
    <div
      className={`relative min-w-[140px] rounded-lg border-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 shadow-sm transition-shadow ${
        selected ? 'ring-2 ring-slate-500/60 dark:ring-c-border shadow-md' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />

      <div className="px-3 py-2 border-b border-blue-200 dark:border-blue-700/50">
        <LabelEditor label={label} locked={locked} onLabelChange={data?.onLabelChange} />
      </div>

      <div className="px-2 py-1.5 space-y-0.5">
        <InlineField
          label="C/T"
          value={data?.cycleTime}
          locked={locked}
          onCommit={fieldChange('cycleTime')}
        />
        <InlineField
          label="C/O"
          value={data?.changeoverTime}
          locked={locked}
          onCommit={fieldChange('changeoverTime')}
        />
        <InlineField
          label="Up%"
          value={data?.uptimePercent}
          suffix="%"
          locked={locked}
          onCommit={fieldChange('uptimePercent')}
        />
        <InlineField
          label="Batch"
          value={data?.batchSize}
          locked={locked}
          onCommit={fieldChange('batchSize')}
        />
        <InlineField
          label="Ops"
          value={data?.operators}
          locked={locked}
          onCommit={fieldChange('operators')}
        />
        <InlineField
          label="Scrap"
          value={data?.scrapRate}
          suffix="%"
          locked={locked}
          onCommit={fieldChange('scrapRate')}
        />
      </div>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />
    </div>
  );
};

// ── VSM Inventory Node (triangle) ────────────────────────────────────────────

export const VSMInventoryNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const label = data?.label || 'Inventory';
  const locked = data?.locked;
  const qty = data?.inventory;

  const fieldChange = useCallback(
    (field: VSMFieldKey) => (val: string) => emitFieldChange(id, field, val),
    [id]
  );

  return (
    <div
      className={`relative flex flex-col items-center justify-end min-w-[72px] min-h-[64px] transition-shadow ${
        selected ? 'drop-shadow-lg' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />

      {/* Triangle via CSS clip-path */}
      <div
        className={`w-16 h-14 flex items-end justify-center ${
          selected ? 'ring-2 ring-slate-500/60 dark:ring-c-border rounded' : ''
        }`}
        style={{
          clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
          background: 'linear-gradient(180deg, #fef3c7 0%, #fbbf24 100%)',
        }}
      >
        <span className="text-[9px] font-bold text-amber-900 mb-1">{qty != null ? qty : '?'}</span>
      </div>

      <div className="mt-0.5">
        <InlineField
          label="Qty"
          value={data?.inventory}
          locked={locked}
          onCommit={fieldChange('inventory')}
        />
      </div>

      <LabelEditor
        label={label}
        locked={locked}
        onLabelChange={data?.onLabelChange}
        className="text-[9px] font-medium text-amber-700 dark:text-amber-300 mt-0.5"
      />

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />
    </div>
  );
};

// ── VSM Supplier Node ────────────────────────────────────────────────────────

export const VSMSupplierNode: React.FC<NodeProps> = ({ data, selected }) => {
  const label = data?.label || 'Supplier';
  const locked = data?.locked;

  return (
    <div
      className={`relative flex flex-col items-center min-w-[90px] rounded-xl border-2 border-slate-500 dark:border-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-2 shadow-sm transition-shadow ${
        selected ? 'ring-2 ring-slate-500/60 dark:ring-c-border shadow-md' : ''
      }`}
    >
      <Truck size={20} className="text-slate-600 dark:text-slate-300 mb-1" />
      <LabelEditor
        label={label}
        locked={locked}
        onLabelChange={data?.onLabelChange}
        className="text-[10px] font-semibold text-slate-700 dark:text-slate-200"
      />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />
    </div>
  );
};

// ── VSM Customer Node ────────────────────────────────────────────────────────

export const VSMCustomerNode: React.FC<NodeProps> = ({ data, selected }) => {
  const label = data?.label || 'Customer';
  const locked = data?.locked;

  return (
    <div
      className={`relative flex flex-col items-center min-w-[90px] rounded-xl border-2 border-emerald-600 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-2 shadow-sm transition-shadow ${
        selected ? 'ring-2 ring-slate-500/60 dark:ring-c-border shadow-md' : ''
      }`}
    >
      <Users size={20} className="text-emerald-600 dark:text-emerald-300 mb-1" />
      <LabelEditor
        label={label}
        locked={locked}
        onLabelChange={data?.onLabelChange}
        className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-200"
      />
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />
    </div>
  );
};

// ── VSM Push Arrow ───────────────────────────────────────────────────────────

export const VSMPushArrowNode: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    <div
      className={`relative flex items-center justify-center w-16 h-10 transition-shadow ${
        selected ? 'ring-2 ring-slate-500/60 dark:ring-c-border rounded' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />
      <div className="flex items-center gap-0.5">
        <ArrowRight size={24} className="text-slate-600 dark:text-slate-300" strokeWidth={2.5} />
      </div>
      <span className="absolute -bottom-3 text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        Push
      </span>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />
    </div>
  );
};

// ── VSM Pull Arrow ───────────────────────────────────────────────────────────

export const VSMPullArrowNode: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    <div
      className={`relative flex items-center justify-center w-16 h-10 transition-shadow ${
        selected ? 'ring-2 ring-slate-500/60 dark:ring-c-border rounded' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />
      <div className="flex items-center gap-0.5">
        <ArrowRightLeft
          size={22}
          className="text-indigo-600 dark:text-indigo-300"
          strokeWidth={2.5}
        />
      </div>
      <span className="absolute -bottom-3 text-[7px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">
        Pull
      </span>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />
    </div>
  );
};

// ── VSM Supermarket (Kanban) ─────────────────────────────────────────────────

export const VSMSupermarketNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const label = data?.label || 'Supermarket';
  const locked = data?.locked;
  const qty = data?.inventory;

  return (
    <div
      className={`relative flex flex-col items-center min-w-[80px] rounded-lg border-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 shadow-sm transition-shadow ${
        selected ? 'ring-2 ring-slate-500/60 dark:ring-c-border shadow-md' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />

      <ShoppingCart size={18} className="text-blue-600 dark:text-blue-300 mb-1" />
      <LabelEditor
        label={label}
        locked={locked}
        onLabelChange={data?.onLabelChange}
        className="text-[9px] font-semibold text-blue-700 dark:text-blue-200"
      />

      {/* Kanban slots */}
      <div className="flex gap-0.5 mt-1">
        {Array.from({ length: Math.min(qty ?? 3, 6) }).map((_, i) => (
          <div
            key={i}
            className="w-2.5 h-3 rounded-sm border border-blue-400 dark:border-blue-600 bg-blue-100 dark:bg-blue-800/50"
          />
        ))}
      </div>

      {qty != null && (
        <span className="text-[7px] font-bold text-blue-600 dark:text-blue-400 mt-0.5">
          {qty} pcs
        </span>
      )}

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />
    </div>
  );
};

// ── VSM FIFO Lane ────────────────────────────────────────────────────────────

export const VSMFifoNode: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    <div
      className={`relative flex items-center justify-center min-w-[80px] h-10 rounded border-2 border-dashed border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 transition-shadow ${
        selected ? 'ring-2 ring-slate-500/60 dark:ring-c-border shadow-md' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />
      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-300 tracking-widest">
        FIFO
      </span>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />
    </div>
  );
};

// ── VSM Kaizen Burst ─────────────────────────────────────────────────────────

export const VSMKaizenNode: React.FC<NodeProps> = ({ data, selected }) => {
  const label = data?.label || 'Kaizen';
  const locked = data?.locked;

  return (
    <div
      className={`relative flex flex-col items-center justify-center min-w-[72px] min-h-[56px] transition-shadow ${
        selected ? 'drop-shadow-lg' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />

      {/* Starburst via SVG */}
      <svg viewBox="0 0 80 80" className="w-16 h-16 absolute inset-0 m-auto" aria-hidden>
        <polygon
          points="40,2 48,26 74,26 54,42 62,68 40,52 18,68 26,42 6,26 32,26"
          className={`fill-danger-100 dark:fill-danger-900/40 stroke-danger-500 dark:stroke-danger-400 ${
            selected ? 'stroke-[3]' : 'stroke-[2]'
          }`}
        />
      </svg>

      <div className="relative z-10 flex flex-col items-center">
        <Zap size={14} className="text-danger-500 dark:text-danger-400 mb-0.5" />
        <LabelEditor
          label={label}
          locked={locked}
          onLabelChange={data?.onLabelChange}
          className="text-[8px] font-bold text-danger-700 dark:text-danger-300 max-w-[56px]"
        />
      </div>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />
    </div>
  );
};

// ── Composite wrapper (used by the existing flowNode type) ───────────────────

export const VSMNodeComponent: React.FC<NodeProps> = (props) => {
  const shape: VSMShape = props.data?.shape || 'vsm_process';
  const Comp = vsmNodeTypes[shape];
  if (!Comp) return null;
  return <Comp {...props} />;
};

// ── Node types registry ──────────────────────────────────────────────────────

export const vsmNodeTypes: Record<string, React.ComponentType<NodeProps>> = {
  vsm_process: VSMProcessNode,
  vsm_inventory: VSMInventoryNode,
  vsm_supplier: VSMSupplierNode,
  vsm_customer: VSMCustomerNode,
  vsm_push_arrow: VSMPushArrowNode,
  vsm_pull_arrow: VSMPullArrowNode,
  vsm_supermarket: VSMSupermarketNode,
  vsm_fifo: VSMFifoNode,
  vsm_kaizen: VSMKaizenNode,
};
