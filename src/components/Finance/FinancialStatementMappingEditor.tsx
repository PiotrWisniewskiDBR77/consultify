import React, { useState } from 'react';
import { Edit3 } from 'lucide-react';
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
}

interface Props {
  mappedValues: FinancialStatementMappedValue[];
  canonicalLines: FinancialStatementCanonicalLineOption[];
  onValueChange: (idx: number, field: string, val: any) => void;
  onCanonicalChange: (idx: number, canonId: string) => void;
  className?: string;
}

export const FinancialStatementMappingEditor: React.FC<Props> = ({
  mappedValues,
  canonicalLines,
  onValueChange,
  onCanonicalChange,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const confidenceBadge = (conf: number) => {
    const pct = Math.round(conf * 100);
    const color =
      pct >= 70
        ? 'text-emerald-600 bg-emerald-50'
        : pct >= 40
          ? 'text-amber-600 bg-amber-50'
          : 'text-red-600 bg-red-50';
    return <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${color}`}>{pct}%</span>;
  };

  return (
    <div className={`max-h-[65vh] overflow-auto rounded-xl border border-slate-200 bg-white dark:border-navy-700 dark:bg-navy-900 ${className}`}>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-navy-800">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-slate-500">
              {t('finance.importWizard.originalLabel', 'Original Label')}
            </th>
            <th className="text-right px-4 py-2 font-medium text-slate-500">
              {t('finance.importWizard.value', 'Value')}
            </th>
            <th className="text-center px-4 py-2 font-medium text-slate-500">
              {t('finance.importWizard.conf', 'Conf.')}
            </th>
            <th className="text-left px-4 py-2 font-medium text-slate-500">
              {t('finance.importWizard.mappedTo', 'Mapped To')}
            </th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
          {mappedValues.map((value, idx) => (
            <tr
              key={`${value.originalLabel}-${value.sourceRow || idx}`}
              className={`hover:bg-slate-50 dark:hover:bg-navy-800/50 ${!value.canonicalLineId ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}
            >
              <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{value.originalLabel}</td>
              <td className="px-4 py-2.5 text-right font-mono text-slate-900 dark:text-white">
                {editingIdx === idx ? (
                  <input
                    type="number"
                    value={value.value}
                    onChange={(event) =>
                      onValueChange(idx, 'value', parseFloat(event.target.value) || 0)
                    }
                    onBlur={() => setEditingIdx(null)}
                    autoFocus
                    className="w-28 rounded border border-blue-300 px-2 py-1 text-right text-sm"
                  />
                ) : (
                  <span
                    onClick={() => setEditingIdx(idx)}
                    className="cursor-pointer hover:text-blue-600"
                  >
                    {Number(value.value || 0).toLocaleString(isPl ? 'pl-PL' : 'en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-center">{confidenceBadge(value.confidence)}</td>
              <td className="px-4 py-2.5">
                <select
                  value={value.canonicalLineId || ''}
                  onChange={(event) => onCanonicalChange(idx, event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-800"
                >
                  <option value="">
                    {t('finance.importWizard.unmapped', 'Unmapped')}
                  </option>
                  {canonicalLines.map((canon) => (
                    <option key={canon.id} value={canon.id}>
                      {isPl ? canon.line_name_pl || canon.line_name : canon.line_name || canon.line_name_pl}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2.5">
                <button
                  onClick={() => setEditingIdx(idx)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-navy-800 dark:hover:text-slate-200"
                >
                  <Edit3 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {mappedValues.length === 0 && (
        <div className="p-6 text-sm text-slate-400">
          {t('finance.importWizard.noMappedValues', 'No lines to map')}
        </div>
      )}
    </div>
  );
};
