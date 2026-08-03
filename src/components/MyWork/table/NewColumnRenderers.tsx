/**
 * NewColumnRenderers — Cell renderers for the extended column types:
 * file, relation, rollup, emoji, color, currency, phone, email.
 */
import { DollarSign, File, Globe, Link2, Mail, Palette, Phone, Sigma, Smile } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef } from './tableTypes';
import { ROW_ACCENT_COLORS } from './tableTypes';

interface CellProps {
  value: any;
  onChange: (val: any) => void;
  locked?: boolean;
  /** Kolumna i nazwa rekordu — do budowy nazw dostępności (aria-label) kontrolek bez widocznego tekstu. */
  column?: ColumnDef;
  rowLabel?: string;
}

/** Nazwa dostępności "kolumna — wiersz" dla kontrolek bez własnego tekstu (przyciski-ikony, inputy). */
function cellA11yName(t: any, column?: ColumnDef, rowLabel?: string): string {
  if (!column) return rowLabel || '';
  return rowLabel
    ? t('ideas.table.a11y.editCellFor', '{{column}} — {{row}}', {
        column: column.header,
        row: rowLabel,
      })
    : column.header;
}

const EMOJI_QUICK = [
  '💡',
  '🔥',
  '⭐',
  '🚀',
  '✅',
  '⚠️',
  '❌',
  '💎',
  '🎯',
  '📌',
  '🧩',
  '💬',
  '📊',
  '🔗',
  '🏆',
];
const COLOR_QUICK = [
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#6366f1',
  '#ec4899',
  '#3b82f6',
  '#84cc16',
  '#f59e0b',
  '#6366f1',
];

export const FileCell: React.FC<CellProps> = ({ value, onChange, locked }) => {
  const files: { name: string; url?: string }[] = Array.isArray(value)
    ? value
    : value
      ? [{ name: String(value) }]
      : [];
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-1">
      {files.map((f, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-c-surface-raised text-[10px] text-c-text-secondary max-w-[120px] truncate"
        >
          <File size={9} className="flex-shrink-0" />
          {f.url ? (
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline truncate"
            >
              {f.name}
            </a>
          ) : (
            <span className="truncate">{f.name}</span>
          )}
        </span>
      ))}
      {!locked && (
        <button
          onClick={() => {
            const name = prompt(t('ideas.table.fileNamePrompt', 'File name:'));
            if (!name) return;
            const url = prompt(t('ideas.table.fileUrlPrompt', 'URL (optional):'));
            onChange([...files, { name, url: url || undefined }]);
          }}
          className="text-[9px] text-c-text-secondary hover:text-c-text font-semibold"
        >
          + {t('ideas.table.file', 'File')}
        </button>
      )}
    </div>
  );
};

export const RelationCell: React.FC<CellProps & { allNodes?: { id: string; label: string }[] }> = ({
  value,
  onChange,
  locked,
  allNodes = [],
}) => {
  const relations: string[] = Array.isArray(value) ? value : value ? [String(value)] : [];
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-1">
      {relations.map((relId, i) => {
        const node = allNodes.find((n) => n.id === relId);
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-[10px] text-indigo-600 dark:text-indigo-400"
          >
            <Link2 size={9} />
            <span className="truncate max-w-[80px]">{node?.label || relId}</span>
          </span>
        );
      })}
      {!locked && (
        <button
          onClick={() => {
            const id = prompt(t('ideas.table.itemIdPrompt', 'Item ID:'));
            if (id) onChange([...relations, id]);
          }}
          className="text-[9px] text-indigo-500 hover:text-indigo-600 font-semibold"
        >
          + {t('ideas.table.relation', 'Relation')}
        </button>
      )}
    </div>
  );
};

export const RollupCell: React.FC<CellProps> = ({ value }) => {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-c-text-secondary font-mono">
      <Sigma size={10} className="text-c-text-secondary" />
      {value != null ? String(value) : '—'}
    </span>
  );
};

export const EmojiCell: React.FC<CellProps> = ({ value, onChange, locked, column, rowLabel }) => {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => !locked && setShowPicker(!showPicker)}
        aria-label={
          value
            ? cellA11yName(t, column, rowLabel)
            : t('ideas.table.a11y.emojiPickerFor', '{{column}}: choose emoji — {{row}}', {
                column: column?.header || '',
                row: rowLabel || column?.header || '',
              })
        }
        className="text-lg hover:scale-110 transition-transform"
      >
        {value || <Smile size={14} className="text-c-text-secondary" aria-hidden="true" />}
      </button>
      {showPicker && !locked && (
        <div className="absolute left-0 top-full mt-1 z-50 p-2 rounded-xl bg-c-surface shadow-xl border border-slate-200/60 dark:border-white/[0.03] flex flex-wrap gap-1 w-[180px]">
          {EMOJI_QUICK.map((e) => (
            <button
              key={e}
              onClick={() => {
                onChange(e);
                setShowPicker(false);
              }}
              aria-label={t('ideas.table.a11y.emojiOption', 'Choose emoji {{emoji}}', { emoji: e })}
              className="text-lg hover:scale-125 transition-transform p-0.5"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ColorCell: React.FC<CellProps> = ({ value, onChange, locked, column, rowLabel }) => {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="relative flex items-center gap-1.5">
      <button
        onClick={() => !locked && setShowPicker(!showPicker)}
        aria-label={t('ideas.table.a11y.colorSwatchFor', '{{column}}: color {{hex}} — {{row}}', {
          column: column?.header || '',
          hex: value || '#—',
          row: rowLabel || column?.header || '',
        })}
        className="w-5 h-5 rounded-md border-2 border-c-border-subtle shadow-sm hover:scale-110 transition-transform"
        style={{ backgroundColor: value || '#e2e8f0' }}
      />
      <span className="text-[10px] text-c-text-muted font-mono">{value || '#—'}</span>
      {showPicker && !locked && (
        <div className="absolute left-0 top-full mt-1 z-50 p-2 rounded-xl bg-c-surface shadow-xl border border-slate-200/60 dark:border-white/[0.03] flex flex-wrap gap-1 w-[140px]">
          {COLOR_QUICK.map((c) => (
            <button
              key={c}
              onClick={() => {
                onChange(c);
                setShowPicker(false);
              }}
              aria-label={t('ideas.table.a11y.colorOption', 'Set color {{hex}}', { hex: c })}
              className="w-5 h-5 rounded-md border-2 border-c-border-subtle hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const CurrencyCell: React.FC<CellProps> = ({
  value,
  onChange,
  locked,
  column,
  rowLabel,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <DollarSign size={10} className="text-emerald-500 flex-shrink-0" />
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        disabled={locked}
        aria-label={cellA11yName(t, column, rowLabel)}
        className="w-full bg-transparent border-0 outline-none text-[11px] text-c-text font-mono text-right"
        placeholder={t('ideas.table.currencyPlaceholder', '0.00')}
      />
    </div>
  );
};

export const PhoneCell: React.FC<CellProps> = ({ value, onChange, locked, column, rowLabel }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <Phone size={10} className="text-c-text-secondary flex-shrink-0" />
      <input
        type="tel"
        value={String(value || '')}
        onChange={(e) => onChange(e.target.value)}
        disabled={locked}
        aria-label={cellA11yName(t, column, rowLabel)}
        className="w-full bg-transparent border-0 outline-none text-[11px] text-c-text"
        placeholder={t('ideas.table.phonePlaceholder', '+48...')}
      />
    </div>
  );
};

export const EmailCell: React.FC<CellProps> = ({ value, onChange, locked, column, rowLabel }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <Mail size={10} className="text-c-text-secondary flex-shrink-0" />
      <input
        type="email"
        value={String(value || '')}
        onChange={(e) => onChange(e.target.value)}
        disabled={locked}
        aria-label={cellA11yName(t, column, rowLabel)}
        className="w-full bg-transparent border-0 outline-none text-[11px] text-blue-600 dark:text-blue-400"
        placeholder={t('ideas.table.emailPlaceholder', 'email@...')}
      />
    </div>
  );
};
