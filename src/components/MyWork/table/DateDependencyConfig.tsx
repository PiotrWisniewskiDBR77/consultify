/**
 * DateDependencyConfig — Configuration panel for Airtable-style date dependencies.
 * Configures start/end date fields, duration, predecessor, dependency type, lag, weekend skipping.
 */
import { Calendar, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { DateDependencyConfigPayload } from '@/services/api/tablePlatform.api';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import type { TablePlatformField } from '@/types/tablePlatform';

const DATE_FIELD_TYPES = ['date', 'createdTime', 'lastModifiedTime'];
const NUMBER_FIELD_TYPES = ['number', 'currency', 'percent', 'duration'];

const DEPENDENCY_TYPES: Array<{
  value: 'FS' | 'SS' | 'FF' | 'SF';
  labelEn: string;
  labelPl: string;
}> = [
  { value: 'FS', labelEn: 'Finish-to-Start', labelPl: 'Koniec-Początek' },
  { value: 'SS', labelEn: 'Start-to-Start', labelPl: 'Początek-Początek' },
  { value: 'FF', labelEn: 'Finish-to-Finish', labelPl: 'Koniec-Koniec' },
  { value: 'SF', labelEn: 'Start-to-Finish', labelPl: 'Początek-Koniec' },
];

interface DateDependencyConfigProps {
  tableId: string;
  fields: TablePlatformField[];
  onConfigSaved?: () => void;
  onRecordsUpdated?: () => void;
  locked?: boolean;
}

export const DateDependencyConfig: React.FC<DateDependencyConfigProps> = ({
  tableId,
  fields,
  onConfigSaved,
  onRecordsUpdated,
  locked = false,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const dateFields = fields.filter((f) => DATE_FIELD_TYPES.includes(f.fieldType));
  const numberFields = fields.filter((f) => NUMBER_FIELD_TYPES.includes(f.fieldType));
  const linkedRecordFields = fields.filter((f) => f.fieldType === 'linkedRecord');

  const [config, setConfig] = useState<DateDependencyConfigPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [cycleWarning, setCycleWarning] = useState<{ cycleNodes: string[] } | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await TablePlatformApi.getDependencyConfig(tableId);
      setConfig(res.config ?? null);
    } catch {
      toast.error(isPl ? 'Nie udało się wczytać konfiguracji' : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, [tableId, isPl]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    if (!config || !config.startDateFieldId || !config.endDateFieldId || locked || saving) return;
    setSaving(true);
    setCycleWarning(null);
    try {
      await TablePlatformApi.putDependencyConfig(tableId, config);
      toast.success(isPl ? 'Konfiguracja zapisana' : 'Config saved');
      onConfigSaved?.();
    } catch {
      toast.error(isPl ? 'Nie udało się zapisać' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    if (!config || !config.startDateFieldId || !config.endDateFieldId || locked || recalculating)
      return;
    setRecalculating(true);
    setCycleWarning(null);

    try {
      const cycleRes = await TablePlatformApi.detectDateDependencyCycle(tableId, config);
      if (cycleRes.hasCycle && cycleRes.cycleNodes?.length) {
        setCycleWarning({ cycleNodes: cycleRes.cycleNodes });
        toast.error(
          isPl
            ? `Wykryto cykl w zależnościach: ${cycleRes.cycleNodes.length} rekordów`
            : `Cycle detected: ${cycleRes.cycleNodes.length} records affected`
        );
        return;
      }

      const recalcRes = await TablePlatformApi.recalculateDateDependencies(tableId, config);
      const count = recalcRes.updatedRecords ?? 0;
      toast.success(isPl ? `Zaktualizowano ${count} rekordów` : `${count} records updated`);
      onRecordsUpdated?.();
    } catch {
      toast.error(isPl ? 'Nie udało się przeliczyć' : 'Failed to recalculate');
    } finally {
      setRecalculating(false);
    }
  };

  const updateConfig = (updates: Partial<DateDependencyConfigPayload>) => {
    setConfig((prev) => {
      const base = prev ?? {
        startDateFieldId: '',
        endDateFieldId: '',
        defaultDependencyType: 'FS' as const,
        defaultLagDays: 0,
        skipWeekends: false,
      };
      return { ...base, ...updates };
    });
    setCycleWarning(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={16} className="animate-spin text-c-text-secondary" />
      </div>
    );
  }

  const hasValidConfig = config && config.startDateFieldId && config.endDateFieldId;

  return (
    <div className="space-y-3">
      {/* Start date */}
      <div>
        <label className="block text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-0.5">
          {isPl ? 'Pole daty początkowej' : 'Start date field'}
        </label>
        <select
          value={config?.startDateFieldId ?? ''}
          onChange={(e) => updateConfig({ startDateFieldId: e.target.value })}
          disabled={locked}
          className="w-full rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-1.5 text-[11px] text-c-text outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
        >
          <option value="">—</option>
          {dateFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* End date */}
      <div>
        <label className="block text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-0.5">
          {isPl ? 'Pole daty końcowej' : 'End date field'}
        </label>
        <select
          value={config?.endDateFieldId ?? ''}
          onChange={(e) => updateConfig({ endDateFieldId: e.target.value })}
          disabled={locked}
          className="w-full rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-1.5 text-[11px] text-c-text outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
        >
          <option value="">—</option>
          {dateFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* Duration (optional) */}
      <div>
        <label className="block text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-0.5">
          {isPl ? 'Pole czasu trwania (opcjonalnie)' : 'Duration field (optional)'}
        </label>
        <select
          value={config?.durationFieldId ?? ''}
          onChange={(e) => updateConfig({ durationFieldId: e.target.value || undefined })}
          disabled={locked}
          className="w-full rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-1.5 text-[11px] text-c-text outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
        >
          <option value="">—</option>
          {numberFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* Predecessor (optional) */}
      <div>
        <label className="block text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-0.5">
          {isPl ? 'Pole poprzednika (opcjonalnie)' : 'Predecessor field (optional)'}
        </label>
        <select
          value={config?.predecessorFieldId ?? ''}
          onChange={(e) => updateConfig({ predecessorFieldId: e.target.value || undefined })}
          disabled={locked}
          className="w-full rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-1.5 text-[11px] text-c-text outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
        >
          <option value="">—</option>
          {linkedRecordFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* Default dependency type */}
      <div>
        <label className="block text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-0.5">
          {isPl ? 'Domyślny typ zależności' : 'Default dependency type'}
        </label>
        <div className="flex flex-wrap gap-1">
          {DEPENDENCY_TYPES.map(({ value, labelEn, labelPl }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateConfig({ defaultDependencyType: value })}
              disabled={locked}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                config?.defaultDependencyType === value
                  ? 'bg-c-accent-soft text-c-accent ring-1 ring-c-focus'
                  : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle'
              } disabled:opacity-50`}
            >
              {isPl ? labelPl : labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Default lag days */}
      <div>
        <label className="block text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-0.5">
          {isPl ? 'Domyślne opóźnienie (dni)' : 'Default lag days'}
        </label>
        <input
          type="number"
          value={config?.defaultLagDays ?? 0}
          onChange={(e) => updateConfig({ defaultLagDays: Number(e.target.value) || 0 })}
          disabled={locked}
          className="w-20 rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-1.5 text-[11px] text-c-text outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
        />
      </div>

      {/* Skip weekends */}
      <div className="flex items-center gap-2">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config?.skipWeekends ?? false}
            onChange={(e) => updateConfig({ skipWeekends: e.target.checked })}
            disabled={locked}
            className="sr-only peer"
          />
          <div className="w-9 h-5 rounded-full bg-c-border-subtle peer-checked:bg-c-surface peer-disabled:opacity-50 peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-c-surface after:rounded-full after:h-4 after:w-4 after:transition-all" />
          <span className="ml-2 text-[11px] font-medium text-c-text-secondary">
            {isPl ? 'Pomijaj weekendy' : 'Skip weekends'}
          </span>
        </label>
      </div>

      {/* Cycle warning */}
      {cycleWarning && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2 text-[10px] text-amber-800 dark:text-amber-200">
          {isPl ? 'Cykl wykryty w rekordach: ' : 'Cycle detected in records: '}
          {cycleWarning.cycleNodes.slice(0, 5).join(', ')}
          {cycleWarning.cycleNodes.length > 5 && ` +${cycleWarning.cycleNodes.length - 5}`}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {!locked && (
          <button
            onClick={handleSave}
            disabled={saving || !hasValidConfig}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-c-text text-c-bg hover:bg-c-text-secondary transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 size={10} className="animate-spin" /> : null}
            {isPl ? 'Zapisz' : 'Save'}
          </button>
        )}
        <button
          onClick={handleRecalculate}
          disabled={recalculating || !hasValidConfig || locked}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-c-text text-c-bg hover:bg-c-text-secondary transition-colors disabled:opacity-40"
        >
          {recalculating ? <Loader2 size={10} className="animate-spin" /> : <Calendar size={10} />}
          {isPl ? 'Przelicz daty' : 'Recalculate'}
        </button>
      </div>
    </div>
  );
};

export default DateDependencyConfig;
