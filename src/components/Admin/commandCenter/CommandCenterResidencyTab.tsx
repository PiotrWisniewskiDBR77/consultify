/**
 * Command Center — "Rezydencja danych" (F-CC4, blok Harvey-Parity HP-10…13).
 *
 * Odczyt + formularz PUT dla `dataResidencyService` — region, wymuszenie
 * tylko-UE, dozwolone/zabronione regiony. Pojedynczy rekord (nie lista) →
 * bez StandardTable, kanon formularza admina 1:1 z innymi panelami sekcji.
 *
 * Endpointy: getDataResidency · setDataResidency.
 */
import { Loader2, Save } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type DataResidencyPolicy,
  getDataResidency,
  setDataResidency,
} from '../../../services/enterpriseComplianceApi';
import { EmptyState, LoadingState } from '../../shared/states';

const inputClass =
  'w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text focus:border-c-focus focus:outline-none focus:ring-1 focus:ring-c-focus';

const toCsv = (values: string[] | undefined | null): string => (values || []).join(', ');
const fromCsv = (value: string): string[] =>
  value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

export const CommandCenterResidencyTab: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<DataResidencyPolicy | null>(null);

  const [region, setRegion] = useState('');
  const [enforceEuOnly, setEnforceEuOnly] = useState(false);
  const [allowedRegionsText, setAllowedRegionsText] = useState('');
  const [deniedRegionsText, setDeniedRegionsText] = useState('');

  const applyPolicy = (p: DataResidencyPolicy) => {
    setPolicy(p);
    setRegion(p.dataResidencyRegion || '');
    setEnforceEuOnly(!!p.enforceEuOnly);
    setAllowedRegionsText(toCsv(p.allowedRegions));
    setDeniedRegionsText(toCsv(p.deniedRegions));
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDataResidency();
      applyPolicy(data);
    } catch (err: any) {
      setError(
        err?.message ||
          t('commandCenter.residency.toasts.loadError', 'Failed to load data residency policy')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await setDataResidency({
        dataResidencyRegion: region.trim() || null,
        enforceEuOnly,
        allowedRegions: fromCsv(allowedRegionsText),
        deniedRegions: fromCsv(deniedRegionsText),
      });
      applyPolicy(updated);
      toast.success(t('commandCenter.residency.toasts.saved', 'Data residency policy updated'));
    } catch (err: any) {
      toast.error(
        err?.message ||
          t('commandCenter.residency.toasts.saveError', 'Failed to update data residency policy')
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState template="panel" />;
  }

  if (error && !policy) {
    return (
      <EmptyState
        variant="error"
        title={error}
        primaryAction={{ label: 'Retry', onClick: () => void load() }}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-c-border bg-c-surface p-5">
      <h3 className="text-base font-semibold text-c-text">
        {t('commandCenter.residency.title', 'Data residency')}
      </h3>
      <p className="mt-1 text-sm text-c-text-secondary">
        {t(
          'commandCenter.residency.description',
          'Region where organization data is processed and stored, and whether EU-only processing is enforced.'
        )}
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="residency-fields-region" className="mb-1 block text-xs font-medium text-c-text-secondary">
            {t('commandCenter.residency.fields.region', 'Data residency region')}
          </label>
          <input
                id="residency-fields-region"
            className={inputClass}
            value={region}
            placeholder={t('commandCenter.residency.fields.regionPlaceholder', 'e.g. eu, us, uk')}
            onChange={(e) => setRegion(e.target.value)}
          />
        </div>

        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm text-c-text">
            <input
              type="checkbox"
              checked={enforceEuOnly}
              onChange={(e) => setEnforceEuOnly(e.target.checked)}
              className="h-4 w-4 rounded border-c-border text-c-text focus:ring-c-focus"
            />
            {t('commandCenter.residency.fields.enforceEuOnly', 'Enforce EU-only processing')}
          </label>
        </div>

        <div>
          <label
            htmlFor="residency-allowedRegions"
            className="mb-1 block text-xs font-medium text-c-text-secondary"
          >
            {t(
              'commandCenter.residency.fields.allowedRegions',
              'Allowed regions (comma-separated)'
            )}
          </label>
          <input
            id="residency-allowedRegions"
            className={inputClass}
            value={allowedRegionsText}
            onChange={(e) => setAllowedRegionsText(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="residency-deniedRegions" className="mb-1 block text-xs font-medium text-c-text-secondary">
            {t('commandCenter.residency.fields.deniedRegions', 'Denied regions (comma-separated)')}
          </label>
          <input
            id="residency-deniedRegions"
            className={inputClass}
            value={deniedRegionsText}
            onChange={(e) => setDeniedRegionsText(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-c-text px-4 py-2 text-sm font-medium text-c-bg hover:bg-c-text-secondary disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('commandCenter.residency.actions.save', 'Save policy')}
        </button>
      </div>
    </div>
  );
};

export default CommandCenterResidencyTab;
