/**
 * FiscalYearSettings - Fiscal year configuration component
 *
 * Features:
 * - Start month selection
 * - End month auto-calculation
 * - Fiscal quarters display
 * - Preview of current fiscal year
 * - Info tooltip explaining fiscal year concept
 *
 * Design: Inline form with preview
 */

import { Calendar, HelpCircle, Info, RefreshCw, Save } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Month names
const MONTHS = [
  { value: 1, name: 'January' },
  { value: 2, name: 'February' },
  { value: 3, name: 'March' },
  { value: 4, name: 'April' },
  { value: 5, name: 'May' },
  { value: 6, name: 'June' },
  { value: 7, name: 'July' },
  { value: 8, name: 'August' },
  { value: 9, name: 'September' },
  { value: 10, name: 'October' },
  { value: 11, name: 'November' },
  { value: 12, name: 'December' },
];

export interface FiscalYearConfig {
  startMonth: number;
  endMonth: number;
  firstDayOfWeek?: 'sunday' | 'monday';
}

interface FiscalYearSettingsProps {
  config?: FiscalYearConfig;
  onChange: (config: FiscalYearConfig) => void;
  onSave?: () => Promise<void>;
  className?: string;
}

export const FiscalYearSettings: React.FC<FiscalYearSettingsProps> = ({
  config,
  onChange,
  onSave,
  className,
}) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<FiscalYearConfig>({
    startMonth: config?.startMonth || 1,
    endMonth: config?.endMonth || 12,
    firstDayOfWeek: config?.firstDayOfWeek || 'monday',
  });

  // Calculate end month based on start month
  const calculateEndMonth = useCallback((startMonth: number) => {
    return startMonth === 1 ? 12 : startMonth - 1;
  }, []);

  const updateStartMonth = useCallback(
    (month: number) => {
      const newConfig = {
        ...formData,
        startMonth: month,
        endMonth: calculateEndMonth(month),
      };
      setFormData(newConfig);
      onChange(newConfig);
    },
    [formData, calculateEndMonth, onChange]
  );

  const updateFirstDayOfWeek = useCallback(
    (day: 'sunday' | 'monday') => {
      const newConfig = { ...formData, firstDayOfWeek: day };
      setFormData(newConfig);
      onChange(newConfig);
    },
    [formData, onChange]
  );

  // Calculate fiscal quarters
  const fiscalQuarters = useMemo(() => {
    const quarters = [];
    const startMonth = formData.startMonth;

    for (let i = 0; i < 4; i++) {
      const quarterStart = ((startMonth - 1 + i * 3) % 12) + 1;
      const quarterEnd = ((startMonth - 1 + i * 3 + 2) % 12) + 1;

      const startMonthName = MONTHS.find((m) => m.value === quarterStart)?.name || '';
      const endMonthName = MONTHS.find((m) => m.value === quarterEnd)?.name || '';

      quarters.push({
        quarter: i + 1,
        label: `Q${i + 1}`,
        start: startMonthName,
        end: endMonthName,
        months: `${startMonthName.slice(0, 3)} - ${endMonthName.slice(0, 3)}`,
      });
    }

    return quarters;
  }, [formData.startMonth]);

  // Get current fiscal year preview
  const fiscalYearPreview = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startMonth = formData.startMonth;

    let startYear: number;
    let endYear: number;

    if (startMonth === 1) {
      // Calendar year
      startYear = currentYear;
      endYear = currentYear;
    } else if (currentMonth >= startMonth) {
      // We're in the first part of the fiscal year
      startYear = currentYear;
      endYear = currentYear + 1;
    } else {
      // We're in the second part of the fiscal year
      startYear = currentYear - 1;
      endYear = currentYear;
    }

    const startMonthName = MONTHS.find((m) => m.value === startMonth)?.name || '';
    const endMonthName = MONTHS.find((m) => m.value === formData.endMonth)?.name || '';

    return {
      label:
        startMonth === 1 ? `FY ${currentYear}` : `FY ${startYear}/${endYear.toString().slice(-2)}`,
      range: `${startMonthName} ${startYear} - ${endMonthName} ${endYear}`,
      currentQuarter:
        fiscalQuarters.find((_, index) => {
          const quarterStart = ((startMonth - 1 + index * 3) % 12) + 1;
          const quarterEnd = ((startMonth - 1 + index * 3 + 2) % 12) + 1;

          if (quarterStart <= quarterEnd) {
            return currentMonth >= quarterStart && currentMonth <= quarterEnd;
          } else {
            return currentMonth >= quarterStart || currentMonth <= quarterEnd;
          }
        })?.quarter || 1,
    };
  }, [formData.startMonth, formData.endMonth, fiscalQuarters]);

  const handleSave = useCallback(async () => {
    if (!onSave) return;

    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const startMonthName = MONTHS.find((m) => m.value === formData.startMonth)?.name || '';
  const endMonthName = MONTHS.find((m) => m.value === formData.endMonth)?.name || '';

  return (
    <div className={cn('space-y-6', className)}>
      {/* Fiscal Year Configuration Card */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-primary-500" />
            <h3 className="text-lg font-medium text-navy-900 dark:text-white">
              {t('admin.org.fiscalYear.title', 'Fiscal Year Configuration')}
            </h3>
            <Tooltip
              content={t(
                'admin.org.fiscalYear.tooltip',
                'A fiscal year is a 12-month period used for financial reporting. It may or may not align with the calendar year.'
              )}
            >
              <button className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300">
                <HelpCircle size={16} />
              </button>
            </Tooltip>
          </div>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {t(
            'admin.org.fiscalYear.description',
            "Configure your organization's fiscal year for financial reporting and planning."
          )}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Start Month */}
          <div>
            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
              {t('admin.org.fiscalYear.startMonth', 'Fiscal Year Starts In')}
            </label>
            <select
              value={formData.startMonth}
              onChange={(e) => updateStartMonth(Number(e.target.value))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-900 border border-transparent rounded-xl text-navy-900 dark:text-white transition-all duration-150 outline-none focus:ring-2 focus:border-c-focus-solid focus:ring-c-focus"
            >
              {MONTHS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t('admin.org.fiscalYear.startMonthHelper', 'First month of your fiscal year')}
            </p>
          </div>

          {/* End Month (auto-calculated) */}
          <div>
            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
              {t('admin.org.fiscalYear.endMonth', 'Fiscal Year Ends In')}
            </label>
            <div className="px-4 py-3 bg-slate-100 dark:bg-navy-900/50 border border-transparent rounded-xl text-navy-900 dark:text-white">
              {endMonthName}
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t(
                'admin.org.fiscalYear.endMonthHelper',
                'Automatically calculated (12 months from start)'
              )}
            </p>
          </div>

          {/* First Day of Week */}
          <div>
            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
              {t('admin.org.fiscalYear.firstDayOfWeek', 'First Day of Week')}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => updateFirstDayOfWeek('sunday')}
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  formData.firstDayOfWeek === 'sunday'
                    ? 'bg-c-text text-c-bg'
                    : 'bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-800'
                )}
              >
                {t('admin.org.fiscalYear.sunday', 'Sunday')}
              </button>
              <button
                onClick={() => updateFirstDayOfWeek('monday')}
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  formData.firstDayOfWeek === 'monday'
                    ? 'bg-c-text text-c-bg'
                    : 'bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-800'
                )}
              >
                {t('admin.org.fiscalYear.monday', 'Monday')}
              </button>
            </div>
          </div>
        </div>

        {/* Fiscal Year Preview */}
        <div className="mt-6 p-4 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-xl border border-primary-200 dark:border-primary-800">
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-primary-600 dark:text-primary-400" />
            <p className="text-sm font-medium text-primary-800 dark:text-primary-200">
              {t('admin.org.fiscalYear.currentFiscalYear', 'Current Fiscal Year')}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primary-900 dark:text-primary-100">
                {fiscalYearPreview.label}
              </p>
              <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">
                {fiscalYearPreview.range}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-primary-600 dark:text-primary-400">
                {t('admin.org.fiscalYear.currentQuarter', 'Current Quarter')}
              </p>
              <p className="text-lg font-semibold text-primary-900 dark:text-primary-100">
                Q{fiscalYearPreview.currentQuarter}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fiscal Quarters Card */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-4">
          {t('admin.org.fiscalYear.quartersTitle', 'Fiscal Quarters')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {t('admin.org.fiscalYear.quartersDescription', 'Based on your fiscal year configuration')}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {fiscalQuarters.map((quarter) => (
            <div
              key={quarter.quarter}
              className={cn(
                'p-4 rounded-lg border',
                quarter.quarter === fiscalYearPreview.currentQuarter
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                  : 'bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={cn(
                    'text-lg font-bold',
                    quarter.quarter === fiscalYearPreview.currentQuarter
                      ? 'text-primary-700 dark:text-primary-300'
                      : 'text-navy-900 dark:text-white'
                  )}
                >
                  {quarter.label}
                </span>
                {quarter.quarter === fiscalYearPreview.currentQuarter && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-primary-200 dark:bg-primary-800 text-primary-800 dark:text-primary-200 rounded-full">
                    {t('admin.org.fiscalYear.current', 'Current')}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{quarter.months}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      {onSave && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            icon={saving ? undefined : <Save size={16} />}
          >
            {t('common.saveChanges', 'Save Changes')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default FiscalYearSettings;
