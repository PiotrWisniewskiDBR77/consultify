import { AlertTriangle, Edit3, Search, X } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface FinancialStatementCanonicalLineOption {
  id: string;
  line_name: string;
  line_name_pl?: string;
}

export interface FinancialStatementMappedValue {
  originalLabel: string;
  value: number;
  confidence: number;
  canonicalLineId: string | null;
  canonicalLabel?: string;
  mappingStatus: string;
  sourceRow?: number;
  isNonFinancial?: boolean;
  classificationReason?: string;
  mappingTier?: 'auto' | 'llm_confirmed' | 'review_required' | 'excluded';
  userVerified?: boolean;
}

interface Props {
  mappedValues: FinancialStatementMappedValue[];
  canonicalLines: FinancialStatementCanonicalLineOption[];
  onValueChange: (idx: number, field: string, val: any) => void;
  onCanonicalChange: (idx: number, canonId: string) => void;
  onVerifiedChange?: (idx: number, verified: boolean) => void;
  className?: string;
}

function ConfidenceDot({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-danger-500';
  const bgColor =
    pct >= 70
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
      : pct >= 40
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
        : 'bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-300';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${bgColor}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {pct}%
    </span>
  );
}

function TierBadge({ tier }: { tier?: string }) {
  const { t } = useTranslation();
  if (!tier || tier === 'auto') return null;

  if (tier === 'review_required') {
    return (
      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={9} />
        {t('finance.mappingEditor.tierReview', 'review')}
      </span>
    );
  }

  if (tier === 'llm_confirmed') {
    return (
      <span className="ml-1.5 rounded bg-blue-50 px-1 py-0.5 text-[9px] font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
        AI
      </span>
    );
  }

  if (tier === 'excluded') {
    return (
      <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-white/[0.06] dark:text-slate-500">
        {t('finance.mappingEditor.tierExcluded', 'excluded')}
      </span>
    );
  }

  return null;
}

function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: FinancialStatementCanonicalLineOption[];
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.line_name.toLowerCase().includes(q) ||
        (opt.line_name_pl || '').toLowerCase().includes(q) ||
        opt.id.toLowerCase().includes(q)
    );
  }, [options, search]);

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const opt = options.find((o) => o.id === value);
    return opt
      ? isPl
        ? opt.line_name_pl || opt.line_name
        : opt.line_name || opt.line_name_pl || ''
      : '';
  }, [value, options, isPl]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setSearch('');
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={`w-full truncate rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
          value
            ? 'border-slate-200/70 bg-white text-slate-800 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-200'
            : 'border-amber-300/60 bg-amber-50/50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300'
        }`}
      >
        {selectedLabel || placeholder}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-lg dark:border-white/[0.08] dark:bg-navy-900">
            <div className="flex items-center gap-2 border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
              <Search size={12} className="text-slate-600" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('finance.mappingEditor.searchLines', 'Search lines...')}
                className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none dark:text-slate-200"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-slate-600 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="max-h-48 overflow-auto">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs text-amber-600 hover:bg-slate-50 dark:text-amber-400 dark:hover:bg-white/[0.04]"
              >
                {placeholder}
              </button>
              {filtered.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04] ${
                    opt.id === value
                      ? 'bg-blue-50/60 text-blue-700 font-medium dark:bg-blue-500/10 dark:text-blue-300'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {isPl ? opt.line_name_pl || opt.line_name : opt.line_name || opt.line_name_pl}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-slate-600">
                  {t('finance.mappingEditor.noResults', 'No results')}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export const FinancialStatementMappingEditor: React.FC<Props> = ({
  mappedValues,
  canonicalLines,
  onValueChange,
  onCanonicalChange,
  onVerifiedChange,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const fmtNumber = useMemo(
    () =>
      new Intl.NumberFormat(isPl ? 'pl-PL' : 'en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    [isPl]
  );

  const mappedCount = mappedValues.filter((v) => v.canonicalLineId).length;
  const unmappedCount = mappedValues.length - mappedCount;
  const reviewCount = mappedValues.filter((v) => v.mappingTier === 'review_required').length;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-white/[0.08] dark:bg-navy-900 ${className}`}
    >
      {/* Summary bar */}
      {mappedValues.length > 0 && (
        <div className="flex items-center gap-3 border-b border-slate-200/60 px-4 py-2 dark:border-white/[0.06]">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {mappedCount}/{mappedValues.length} {t('finance.mappingEditor.mapped', 'mapped')}
          </span>
          {unmappedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {unmappedCount} {t('finance.mappingEditor.unmappedCount', 'unmapped')}
            </span>
          )}
          {reviewCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle size={10} />
              {reviewCount} {t('finance.mappingEditor.toReview', 'to review')}
            </span>
          )}
          <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-slate-200/60 dark:bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{
                width: `${mappedValues.length > 0 ? (mappedCount / mappedValues.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="max-h-[65vh] overflow-auto">
        <table
          /* §27-exempt: edytor komorkowy/workspace, edycja cell-by-cell */ className="w-full text-sm"
          role="grid"
        >
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm dark:bg-navy-900/95">
            <tr>
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                {t('finance.importWizard.originalLabel', 'Original Label')}
              </th>
              <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                {t('finance.importWizard.value', 'Value')}
              </th>
              <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                {t('finance.importWizard.conf', 'Conf.')}
              </th>
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                {t('finance.importWizard.mappedTo', 'Mapped To')}
              </th>
              <th className="w-10" />
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                {t('finance.mappingEditor.verified', 'Verified')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 dark:divide-white/[0.04]">
            {mappedValues.map((value, idx) => (
              <tr
                key={`${value.originalLabel}-${value.sourceRow || idx}`}
                className={`group transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.03] ${
                  value.mappingTier === 'review_required'
                    ? 'bg-amber-50/30 dark:bg-amber-500/[0.04]'
                    : !value.canonicalLineId
                      ? 'bg-amber-50/20 dark:bg-amber-500/[0.03]'
                      : ''
                }`}
              >
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                  <span className="text-xs">{value.originalLabel}</span>
                  {value.isNonFinancial && (
                    <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                      non-fin
                    </span>
                  )}
                  <TierBadge tier={value.mappingTier} />
                </td>
                <td className="px-4 py-2 text-right">
                  {editingIdx === idx ? (
                    <input
                      type="number"
                      value={value.value}
                      onChange={(event) => {
                        const parsed = parseFloat(event.target.value);
                        if (Number.isFinite(parsed)) {
                          onValueChange(idx, 'value', parsed);
                        }
                      }}
                      onBlur={() => setEditingIdx(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingIdx(null);
                        if (e.key === 'Escape') setEditingIdx(null);
                      }}
                      autoFocus
                      className="w-28 rounded-lg border border-blue-400 bg-white px-2 py-1 text-right font-mono text-xs text-slate-900 shadow-sm outline-none ring-2 ring-blue-100 dark:border-blue-500/40 dark:bg-navy-800 dark:text-white dark:ring-blue-500/10"
                      aria-label={`${value.originalLabel} value`}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingIdx(idx)}
                      className="cursor-pointer font-mono text-xs tabular-nums text-slate-800 transition-colors hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
                      aria-label={`Edit ${value.originalLabel} value`}
                    >
                      {fmtNumber.format(value.value)}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <ConfidenceDot confidence={value.confidence} />
                </td>
                <td className="px-4 py-2">
                  <SearchableSelect
                    value={value.canonicalLineId || ''}
                    options={canonicalLines}
                    onChange={(id) => onCanonicalChange(idx, id)}
                    placeholder={t('finance.importWizard.unmapped', 'Unmapped')}
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => setEditingIdx(idx)}
                    className="rounded-lg p-1.5 text-slate-600 opacity-0 transition-all hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
                    aria-label={`Edit ${value.originalLabel}`}
                  >
                    <Edit3 size={12} />
                  </button>
                </td>
                <td className="px-3 py-2 text-center">
                  <label className="inline-flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(value.userVerified)}
                      disabled={!value.canonicalLineId}
                      onChange={(event) => onVerifiedChange?.(idx, event.target.checked)}
                      aria-label={`${value.originalLabel} ${t('finance.mappingEditor.verified', 'Verified')}`}
                    />
                    {value.userVerified
                      ? t('finance.mappingEditor.userVerified', 'User verified')
                      : ''}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {mappedValues.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-slate-600 dark:text-slate-500">
            <Search size={20} />
            {t('finance.importWizard.noMappedValues', 'No lines to map')}
          </div>
        )}
      </div>
    </div>
  );
};
