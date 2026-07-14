/**
 * PlatformCellRenderer — Per-FieldType cell display for the Table Platform.
 *
 * Renders cell content based on the platform FieldType (not legacy ColumnType).
 * Supports 13 visual field types with read-only display and optional edit mode.
 * Uses React.memo for performance in large grids.
 */
import {
  Barcode,
  Check,
  ExternalLink,
  FileText,
  FunctionSquare,
  Link2,
  Mail,
  Phone,
  Star,
} from 'lucide-react';
import React from 'react';

import type {
  AiClassificationFieldOptions,
  AiGeneratedSummaryFieldOptions,
  FieldType,
  PriorityFieldOptions,
  RiskScoreFieldOptions,
  SourceReferenceFieldOptions,
  TablePlatformSelectOption,
} from '@/types/tablePlatform';

import {
  AiClassificationCell,
  AiSummaryCell,
  PriorityCell,
  RiskScoreCell,
  SourceReferenceCell,
} from './cells';

// ── Props ────────────────────────────────────────────────────────────────────

export interface PlatformCellRendererProps {
  value: unknown;
  fieldType: FieldType;
  fieldOptions?: Record<string, unknown>;
  isEditing?: boolean;
  onChange?: (newValue: unknown) => void;
  record?: { data?: Record<string, unknown> };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSelectOptions(fieldOptions?: Record<string, unknown>): TablePlatformSelectOption[] {
  const opts = fieldOptions as { options?: TablePlatformSelectOption[] } | undefined;
  return opts?.options ?? [];
}

function getOptionColor(name: string, options: TablePlatformSelectOption[]): string {
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
  <span className="text-xs text-c-text truncate block px-1">{String(value ?? '')}</span>
);

const NumberDisplay: React.FC<{ value: unknown; precision?: number }> = ({
  value,
  precision = 2,
}) => {
  if (value == null || value === '') {
    return <span className="text-xs text-c-text-secondary px-1">—</span>;
  }
  const num = Number(value);
  const formatted = Number.isFinite(num)
    ? num.toLocaleString(undefined, { maximumFractionDigits: precision })
    : '—';
  return (
    <span className="text-xs text-c-text tabular-nums text-right block px-1">{formatted}</span>
  );
};

const CurrencyDisplay: React.FC<{ value: unknown; fieldOptions?: Record<string, unknown> }> = ({
  value,
  fieldOptions,
}) => {
  if (value == null || value === '') {
    return <span className="text-xs text-c-text-secondary px-1">—</span>;
  }
  const num = Number(value);
  const symbol = getCurrencySymbol(fieldOptions);
  const precision = getPrecision(fieldOptions);
  const formatted = Number.isFinite(num)
    ? `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })}`
    : '—';
  return (
    <span className="text-xs text-c-text tabular-nums text-right block px-1">{formatted}</span>
  );
};

const PercentDisplay: React.FC<{ value: unknown; fieldOptions?: Record<string, unknown> }> = ({
  value,
  fieldOptions,
}) => {
  if (value == null || value === '') {
    return <span className="text-xs text-c-text-secondary px-1">—</span>;
  }
  const num = Number(value);
  const precision = getPrecision(fieldOptions);
  const formatted = Number.isFinite(num)
    ? `${num.toLocaleString(undefined, { maximumFractionDigits: precision })}%`
    : '—';
  return (
    <span className="text-xs text-c-text tabular-nums text-right block px-1">{formatted}</span>
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
            ? 'bg-c-text border-c-text text-c-bg'
            : 'border-c-border-subtle hover:border-c-accent'
        }`}
      >
        {checked && <Check size={12} />}
      </button>
    </div>
  );
};

const DateDisplay: React.FC<{ value: unknown }> = ({ value }) => {
  if (!value) return <span className="text-xs text-c-text-secondary px-1">—</span>;
  const d = new Date(String(value));
  const str = Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  return <span className="text-xs text-c-text tabular-nums px-1">{str}</span>;
};

const SingleSelectDisplay: React.FC<{ value: unknown; fieldOptions?: Record<string, unknown> }> = ({
  value,
  fieldOptions,
}) => {
  if (!value) return <span className="text-xs text-c-text-secondary px-1">—</span>;
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
  if (items.length === 0) return <span className="text-xs text-c-text-secondary px-1">—</span>;
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
  if (!value) return <span className="text-xs text-c-text-secondary px-1">—</span>;
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
  if (!value) return <span className="text-xs text-c-text-secondary px-1">—</span>;
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
  if (!value) return <span className="text-xs text-c-text-secondary px-1">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-c-text px-1">
      <Phone size={10} className="text-c-text-secondary flex-shrink-0" />
      {String(value)}
    </span>
  );
};

const LinkedRecordDisplay: React.FC<{ value: unknown }> = ({ value }) => {
  const items: string[] = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
  if (items.length === 0) return <span className="text-xs text-c-text-secondary px-1">—</span>;
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
  if (items.length === 0) return <span className="text-xs text-c-text-secondary px-1">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-c-text-secondary px-1">
      <FileText size={12} className="text-c-text-secondary" />
      <span className="bg-c-surface-raised text-[9px] font-bold px-1.5 py-0.5 rounded-full">
        {items.length}
      </span>
    </span>
  );
};

const ButtonDisplay: React.FC<{ fieldOptions?: Record<string, unknown> }> = ({ fieldOptions }) => {
  const opts = fieldOptions as
    | {
        label?: string;
        actionType?: string;
        actionConfig?: { url?: string; automationId?: string };
      }
    | undefined;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (opts?.actionType === 'open_url' && opts.actionConfig?.url) {
          window.open(opts.actionConfig.url, '_blank');
        }
        if (opts?.actionType === 'run_automation' && opts.actionConfig?.automationId) {
          fetch(`/api/table-platform/automations/${opts.actionConfig.automationId}/trigger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }).catch(() => {});
        }
      }}
      className="px-2 py-0.5 rounded bg-c-accent-soft text-c-accent text-xs font-medium hover:bg-c-accent transition-colors"
    >
      {opts?.label || 'Action'}
    </button>
  );
};

const FormulaDisplay: React.FC<{ value: unknown; fieldOptions?: Record<string, unknown> }> = ({
  value,
  fieldOptions,
}) => {
  if (value == null || value === '') {
    return <span className="text-xs text-c-text-secondary px-1">—</span>;
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
    <span className="inline-flex items-center gap-1 text-xs text-c-text px-1">
      <FunctionSquare size={10} className="text-c-accent flex-shrink-0" />
      <span className={resultType === 'number' ? 'tabular-nums text-right' : 'truncate'}>
        {formatted}
      </span>
    </span>
  );
};

const RatingDisplay: React.FC<{ value: unknown; fieldOptions?: Record<string, unknown> }> = ({
  value,
  fieldOptions,
}) => {
  const max = Number((fieldOptions as { max?: number })?.max) || 5;
  const rating = Math.min(Math.max(0, Math.round(Number(value) || 0)), max);
  return (
    <span className="inline-flex items-center gap-px px-1">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={12}
          className={i < rating ? 'text-amber-400 fill-amber-400' : 'text-c-text-secondary'}
        />
      ))}
    </span>
  );
};

const DurationDisplay: React.FC<{ value: unknown }> = ({ value }) => {
  if (value == null || value === '') {
    return <span className="text-xs text-c-text-secondary px-1">—</span>;
  }
  const totalSeconds = Math.max(0, Math.round(Number(value) || 0));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const formatted = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return <span className="text-xs text-c-text tabular-nums px-1">{formatted}</span>;
};

const BarcodeDisplay: React.FC<{ value: unknown }> = ({ value }) => {
  if (!value) return <span className="text-xs text-c-text-secondary px-1">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-c-text px-1">
      <Barcode size={12} className="text-c-text-secondary flex-shrink-0" />
      <span className="font-mono truncate">{String(value)}</span>
    </span>
  );
};

const CreatedByDisplay: React.FC<PlatformCellRendererProps> = ({ value, record }) => {
  const name = record?.data?.__created_by_name || record?.data?.__created_by || value || '—';
  return (
    <div className="flex items-center gap-1.5 text-xs px-1">
      <div className="w-5 h-5 rounded-full bg-c-accent-soft flex items-center justify-center text-[10px] font-medium text-c-accent">
        {String(name).charAt(0).toUpperCase()}
      </div>
      <span className="truncate">{String(name)}</span>
    </div>
  );
};

const LastModifiedByDisplay: React.FC<PlatformCellRendererProps> = ({ value, record }) => {
  const name = record?.data?.__modified_by_name || record?.data?.__modified_by || value || '—';
  return (
    <div className="flex items-center gap-1.5 text-xs px-1">
      <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-800/30 flex items-center justify-center text-[10px] font-medium text-amber-700 dark:text-amber-300">
        {String(name).charAt(0).toUpperCase()}
      </div>
      <span className="truncate">{String(name)}</span>
    </div>
  );
};

// ── Main renderer ────────────────────────────────────────────────────────────

const RENDERERS: Partial<Record<FieldType, React.FC<PlatformCellRendererProps>>> = {
  singleLineText: ({ value }) => <TextDisplay value={value} />,
  longText: ({ value }) => {
    const htmlContent = String(value || '');
    const isHtml = htmlContent.includes('<');
    if (isHtml) {
      return (
        <div
          className="text-xs text-c-text truncate px-1"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      );
    }
    return <TextDisplay value={value} />;
  },
  number: ({ value, fieldOptions }) => (
    <NumberDisplay value={value} precision={getPrecision(fieldOptions)} />
  ),
  currency: ({ value, fieldOptions }) => (
    <CurrencyDisplay value={value} fieldOptions={fieldOptions} />
  ),
  percent: ({ value, fieldOptions }) => (
    <PercentDisplay value={value} fieldOptions={fieldOptions} />
  ),
  checkbox: ({ value, onChange }) => <CheckboxDisplay value={value} onChange={onChange} />,
  date: ({ value }) => <DateDisplay value={value} />,
  singleSelect: ({ value, fieldOptions }) => (
    <SingleSelectDisplay value={value} fieldOptions={fieldOptions} />
  ),
  multiSelect: ({ value, fieldOptions }) => (
    <MultiSelectDisplay value={value} fieldOptions={fieldOptions} />
  ),
  url: ({ value }) => <UrlDisplay value={value} />,
  email: ({ value }) => <EmailDisplay value={value} />,
  phone: ({ value }) => <PhoneDisplay value={value} />,
  linkedRecord: ({ value }) => <LinkedRecordDisplay value={value} />,
  attachment: ({ value }) => <AttachmentDisplay value={value} />,
  formula: ({ value, fieldOptions }) => (
    <FormulaDisplay value={value} fieldOptions={fieldOptions} />
  ),
  button: ({ fieldOptions }) => <ButtonDisplay fieldOptions={fieldOptions} />,
  rating: ({ value, fieldOptions }) => <RatingDisplay value={value} fieldOptions={fieldOptions} />,
  duration: ({ value }) => <DurationDisplay value={value} />,
  barcode: ({ value }) => <BarcodeDisplay value={value} />,
  createdBy: (props) => <CreatedByDisplay {...props} />,
  lastModifiedBy: (props) => <LastModifiedByDisplay {...props} />,
  // Specialized consulting field types (EPIC-T7 · Sprint A-S5).
  risk_score: ({ value, fieldOptions }) => (
    <RiskScoreCell value={value} fieldOptions={fieldOptions as RiskScoreFieldOptions | undefined} />
  ),
  priority: ({ value, fieldOptions }) => (
    <PriorityCell value={value} fieldOptions={fieldOptions as PriorityFieldOptions | undefined} />
  ),
  ai_generated_summary: ({ value, fieldOptions, record }) => (
    <AiSummaryCell
      value={value}
      fieldOptions={fieldOptions as AiGeneratedSummaryFieldOptions | undefined}
      manualOverride={Boolean(
        (record?.data as { __manual_override?: boolean } | undefined)?.__manual_override
      )}
    />
  ),
  ai_classification: ({ value, fieldOptions, record }) => (
    <AiClassificationCell
      value={value}
      fieldOptions={fieldOptions as AiClassificationFieldOptions | undefined}
      manualOverride={Boolean(
        (record?.data as { __manual_override?: boolean } | undefined)?.__manual_override
      )}
    />
  ),
  source_reference: ({ value, fieldOptions }) => (
    <SourceReferenceCell
      value={value}
      fieldOptions={fieldOptions as SourceReferenceFieldOptions | undefined}
    />
  ),
};

export const PlatformCellRenderer: React.FC<PlatformCellRendererProps> = React.memo((props) => {
  const Renderer = RENDERERS[props.fieldType];
  if (Renderer) return <Renderer {...props} />;
  return <TextDisplay value={props.value} />;
});

PlatformCellRenderer.displayName = 'PlatformCellRenderer';

export default PlatformCellRenderer;
