/**
 * ROIAssumptionEditor — V3-H02
 * Inline editor for ROI assumptions (plan)
 * Maps to backend roi_assumptions (single record per initiative)
 * Fields: revenue delta, cost delta, capex, opex + confidence, source
 */

import { Edit3 } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ROIAssumptionsData {
  expectedRevenueDelta?: number;
  expectedCostDelta?: number;
  capex?: number;
  opexAnnual?: number;
  horizonMonths?: number;
  effectStartDate?: string;
  confidence?: 'high' | 'medium' | 'low';
  assumptionsOwner?: string;
  assumptionsText?: string;
}

const CONFIDENCE_OPTIONS = [
  { value: 'high', labelKey: 'results.roi.confidenceHigh' },
  { value: 'medium', labelKey: 'results.roi.confidenceMedium' },
  { value: 'low', labelKey: 'results.roi.confidenceLow' },
] as const;

const ROW_DEFS: { id: string; descKey: string; field: keyof ROIAssumptionsData }[] = [
  { id: 'rev', descKey: 'results.roi.rowRevenueDelta', field: 'expectedRevenueDelta' },
  { id: 'cost', descKey: 'results.roi.rowCostDelta', field: 'expectedCostDelta' },
  { id: 'capex', descKey: 'results.roi.rowCapex', field: 'capex' },
  { id: 'opex', descKey: 'results.roi.rowOpex', field: 'opexAnnual' },
];

interface ROIAssumptionEditorProps {
  data: ROIAssumptionsData | null;
  onChange: (data: ROIAssumptionsData) => void;
  onSave: () => Promise<void>;
  disabled?: boolean;
}

export const ROIAssumptionEditor: React.FC<ROIAssumptionEditorProps> = ({
  data,
  onChange,
  onSave,
  disabled,
}) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const inputCls =
    'h-9 px-3 text-sm rounded-lg border border-navy-600 bg-navy-800 text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus:ring-c-focus focus-visible:border-c-focus-solid transition-colors w-full';

  const updateField = useCallback(
    (field: keyof ROIAssumptionsData, value: number | string | undefined) => {
      onChange({ ...data, [field]: value });
    },
    [data, onChange]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const total =
    (data?.expectedRevenueDelta || 0) +
    (data?.expectedCostDelta || 0) +
    (data?.capex || 0) +
    (data?.opexAnnual || 0);

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-slate-500 uppercase">
        {t('results.roi.assumptionsTitle', 'ROI Assumptions')}
      </h4>

      <div className="border border-navy-700 rounded-lg overflow-hidden">
        {/* §27-exempt: financial-calculation — editable form table with per-row number inputs, confidence selects, and a computed tfoot total row */}
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy-800/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                {t('results.roi.assumptionDescription', 'Description')}
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                {t('results.roi.assumptionAmount', 'Amount')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                {t('results.roi.assumptionPeriod', 'Period')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                {t('results.roi.assumptionConfidence', 'Confidence')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                {t('results.roi.assumptionSource', 'Source')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/50">
            {ROW_DEFS.map((def) => (
              <tr key={def.id} className="hover:bg-navy-800/30">
                <td className="px-3 py-2 text-slate-600">{t(def.descKey)}</td>
                <td className="px-3 py-2">
                  <input
                    className={`${inputCls} text-right`}
                    type="number"
                    step="any"
                    value={(data as any)?.[def.field] ?? ''}
                    onChange={(e) =>
                      updateField(def.field, parseFloat(e.target.value) || undefined)
                    }
                    disabled={disabled}
                  />
                </td>
                <td className="px-3 py-2 text-slate-600">{t('results.roi.periodYear')}</td>
                <td className="px-3 py-2">
                  <select
                    className={inputCls}
                    value={data?.confidence || 'medium'}
                    onChange={(e) => updateField('confidence', e.target.value as any)}
                    disabled={disabled}
                  >
                    {CONFIDENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {t(o.labelKey)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-slate-600">{t('results.roi.sourceManual')}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-navy-800/70 border-t border-navy-700">
              <td className="px-3 py-2 text-sm font-medium text-slate-600" colSpan={4}>
                {t('results.roi.total', 'Total')}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-white">
                {new Intl.NumberFormat(undefined, {
                  style: 'currency',
                  currency: 'EUR',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!disabled && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-9 px-4 text-sm font-medium rounded-full bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-50 flex items-center gap-2"
        >
          <Edit3 size={14} />
          {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
        </button>
      )}
    </div>
  );
};

export default ROIAssumptionEditor;
