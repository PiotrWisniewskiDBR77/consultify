/**
 * PlatformCellRenderer — Per-FieldType cell display for the Table Platform.
 *
 * Renders cell content based on the platform FieldType (not legacy ColumnType).
 * Supports 13 visual field types with read-only display and optional edit mode.
 * Uses React.memo for performance in large grids.
 */
import {
  Check,
  ExternalLink,
  FileText,
  FunctionSquare,
  Link2,
  Mail,
  Phone,
} from 'lucide-react';
import React from 'react';

import type { FieldType, SelectOption } from '@/types/tablePlatform';

// ── Props ────────────────────────────────────────────────────────────────────

export interface PlatformCellRendererProps {
  value: unknown;
  fieldType: FieldType;
  fieldOptions?: Record<string, unknown>;
  isEditing?: boolean;
  onChange?: (newValue: unknown) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSelectOptions(fieldOptions?: Record<string, unknown>): SelectOption[] {
  const opts = fieldOptions as { options?: SelectOption[] } | undefined;
  return opts?.options ?? [];
}

function getOptionColor(name: string, options: SelectOption[]): string {
  const opt = options.find((o) => o.name === name || o.id === name);
  return opt?.color ?? '#e0e7ff';
}

function getCurrencySymbol(fieldOptions?: Record<string, unknown>): string {
  return (fieldOptions as { currencySymbol?: string })?.currencySymbol ?? '$';
}

function getPrecision(fieldOptions?: Record<string, unknown>): number {
  return (fieldOptions as { precision?: number })?.precision ?? 2;
}

// ── Sub-renderers ────────────────────────────────────────────────────────────

const TextDisplay: React.FC<{ value: unknown }> = ({ value }) => (
  <span className="text-xs text-slate-800 dark:text-slate-200 truncate block px-1">
    {String(value ?? '')}
  </span>
);

const NumberDisplay: React.FC<{ value: unknown; precision?: number }> = ({ value, precision = 2 }) => {
  if (value == null || value === '') {
    return <span className="text-xs text-slate-400 px-1">—</span>;
  }
  const num = Number(value);
  const formatted = Number.isFinite(num) ? num.toLocaleString(undefined, { maximumFractionDigits: precision }) : '—';
  return (
    <span className="text-xs text-slate-800 dark:text-slate-200 tabular-nums text-right block px-1">
      {formatted}
    </span>
  );
};

const CurrencyDisplay: React.FC<{ value: unknown; fieldOptions?: Record<string, unknown> }> = ({
  value,
  fieldOptions,
}) => {
  if (value == null || value === '') {
    return <span className="text-xs text-slate-400 px-1">—</span>;
  }
  const num = Number(value);
  const symbol = getCurrencySymbol(fieldOptions);
  const precision = getPrecision(fieldOptions);
  const formatted = Number.isFinite(num)
    ? `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })}`
    : '—';
  return (
    <span className="text-xs text-slate-800 dark:text-slate-200 tabular-nums text-right block px-1">
      {formatted}
    </span>
  );
};

const PercentDisplay: React.FC<{ value: unknown; fieldOptions?: Record<string, unknown> }> = ({
  value,
  fieldOptions,
}) => {
  if (value == null || value === '') {
    return <span className="text-xs text-slate-400 px-1">—</span>;
  }
  const num = Number(value);
  const precision = getPrecision(fieldOptions);
  const formatted = Number.isFinite(num)
    ? `${num.toLocaleString(undefined, { maximumFractionDigits: precision })}%`
    : '—';
  return (
    <span className="text-xs text-slate-800 dark:text-slate-200 tabular-nums text-right block px-1">
      {formatted}
    </span>
  );
};

const CheckboxDisplay: React.FC<{ value: unknown; onChange?: (v: unknown) => void }> = ({
  value,
  onChange,
}) => {
  const checked = Boolean(value);
  return (
    <div className="flex items-center justify-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onChange?.(!checked);
        }}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
          checked
            ? 'bg-violet-500 border-violet-500 text-white'
            : 'border-slate-300 dark:border-navy-600 hover:border-violet-400'
        }`}
      >
        {checked && <Check size={12} />}
      </button>
    </div>
  );
};

const DateDisplay: React.FC<{ value: unknown }> = ({ value }) => {
  if (!value) return <span className="text-xs text-slate-400 px-1">—</span>;
  const d = new Date(String(value));
  const str = Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  return (
    <span className="text-xs text-slate-800 dark:text-slate-200 tabular-nums px-1">
      {str}
    </span>
  );
};

const SingleSelectDisplay: React.FC<{ value: unknown; fieldOptions?: Record<string, unknown> }> = ({
  value,
  fieldOptions,
}) => {
  if (!value) return <span className="text-xs text-slate-400 px-1">—</span>;
  const options = getSelectOptions(fieldOptions);
  const color = getOptionColor(String(value), options);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold"
      style={{ backgroundColor: color, color: '#334155' }}
    >
      {String(value)}
    </span>
  );
};

const MultiSelectDisplay: React.FC<{ value: unknown; fieldOptions?: Record<string, unknown> }> = ({
  value,
  fieldOptions,
}) => {
  const items: string[] = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
  if (items.length === 0) return <span className="text-xs text-slate-400 px-1">—</span>;
  const options = getSelectOptions(fieldOptions);
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold"
          style={{ backgroundColor: getOptionColor(item, options), color: '#334155' }}
        >
          {item}
        </span>
      ))}
    </div>
  );
};

const UrlDisplay: React.FC<{ value: unknown }> = ({ value }) => {
  if (!value) return <span className="text-xs text-slate-400 px-1">—</span>;
  const url = String(value);
  return (
    <a
      href={url.startsWith('http') ? url : `https://${url}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 px-1 truncate"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="truncate">{url}</span>
      <ExternalLink size={10} className="flex-shrink-0" />
    </a>
  );
};

const EmailDisplay: React.FC<{ value: unknown }> = ({ value }) => {
  if (!value) return <span className="text-xs text-slate-400 px-1">—</span>;
  const email = String(value);
  return (
    <a
      href={`mailto:${email}`}
      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 px-1 truncate"
      onClick={(e) => e.stopPropagation()}
    >
      <Mail size={10} className="flex-shrink-0" />
      <span className="truncate">{email}</span>
    </a>
  );
};

const PhoneDisplay: React.FC<{ value: unknown }> = ({ value }) => {
  if (!value) return <span className="text-xs text-slate-400 px-1">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-800 dark:text-slate-200 px-1">
      <Phone size={10} className="text-slate-400 flex-shrink-0" />
      {String(value)}
    </span>
  );
};

const LinkedRecordDisplay: React.FC<{ value: unknown }> = ({ value }) => {
  const items: string[] = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
  if (items.length === 0) return <span className="text-xs text-slate-400 px-1">—</span>;
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
        >
          <Link2 size={8} />
          {item}
        </span>
      ))}
    </div>
  );
};

const AttachmentDisplay: React.FC<{ value: unknown }> = ({ value }) => {
  const items: unknown[] = Array.isArray(value) ? value : value ? [value] : [];
  if (items.length === 0) return <span className="text-xs text-slate-400 px-1">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 px-1">
      <FileText size={12} className="text-slate-400" />
      <span className="bg-slate-100 dark:bg-navy-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
        {items.length}
      </span>
    </span>
  );
};

const FormulaDisplay: React.FC<{ value: unknown; fieldOptions?: Record<string, unknown> }> = ({
  value,
  fieldOptions,
}) => {
  if (value == null || value === '') {
    return <span className="text-xs text-slate-400 px-1">—</span>;
  }

  const resultType = (fieldOptions as { resultType?: string })?.resultType;

  let formatted: string;
  if (resultType === 'number' || typeof value === 'number') {
    const num = Number(value);
    formatted = Number.isFinite(num) ? num.toLocaleString() : String(value);
  } else if (resultType === 'date') {
    const d = new Date(String(value));
    formatted = Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  } else if (resultType === 'boolean' || typeof value === 'boolean') {
    formatted = value ? '✓' : '✗';
  } else {
    formatted = String(value);
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-800 dark:text-slate-200 px-1">
      <FunctionSquare size={10} className="text-violet-400 dark:text-violet-500 flex-shrink-0" />
      <span className={resultType === 'number' ? 'tabular-nums text-right' : 'truncate'}>
        {formatted}
      </span>
    </span>
  );
};

// ── Main renderer ────────────────────────────────────────────────────────────

const RENDERERS: Partial<Record<FieldType, React.FC<PlatformCellRendererProps>>> = {
  singleLineText: ({ value }) => <TextDisplay value={value} />,
  longText: ({ value }) => <TextDisplay value={value} />,
  number: ({ value, fieldOptions }) => <NumberDisplay value={value} precision={getPrecision(fieldOptions)} />,
  currency: ({ value, fieldOptions }) => <CurrencyDisplay value={value} fieldOptions={fieldOptions} />,
  percent: ({ value, fieldOptions }) => <PercentDisplay value={value} fieldOptions={fieldOptions} />,
  checkbox: ({ value, onChange }) => <CheckboxDisplay value={value} onChange={onChange} />,
  date: ({ value }) => <DateDisplay value={value} />,
  singleSelect: ({ value, fieldOptions }) => <SingleSelectDisplay value={value} fieldOptions={fieldOptions} />,
  multiSelect: ({ value, fieldOptions }) => <MultiSelectDisplay value={value} fieldOptions={fieldOptions} />,
  url: ({ value }) => <UrlDisplay value={value} />,
  email: ({ value }) => <EmailDisplay value={value} />,
  phone: ({ value }) => <PhoneDisplay value={value} />,
  linkedRecord: ({ value }) => <LinkedRecordDisplay value={value} />,
  attachment: ({ value }) => <AttachmentDisplay value={value} />,
  formula: ({ value, fieldOptions }) => <FormulaDisplay value={value} fieldOptions={fieldOptions} />,
};

export const PlatformCellRenderer: React.FC<PlatformCellRendererProps> = React.memo(
  (props) => {
    const Renderer = RENDERERS[props.fieldType];
    if (Renderer) return <Renderer {...props} />;
    return <TextDisplay value={props.value} />;
  },
);

PlatformCellRenderer.displayName = 'PlatformCellRenderer';

export default PlatformCellRenderer;
