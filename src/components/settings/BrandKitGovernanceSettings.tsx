/**
 * BrandKitGovernanceSettings — Presentation Brand Kit Governance
 *
 * Read/write settings panel for the org-wide presentation brand kit.
 *
 * Behavior:
 *  - Loads via GET /api/presentations/brand-kit (cookie auth).
 *  - Mutations gated on the local `canEdit` capability prop. The UI is the
 *    source of truth for whether the user can mutate; the backend response
 *    shape is not trusted to imply edit rights.
 *  - Saves via PUT /api/presentations/brand-kit and re-fetches to confirm
 *    the persisted shape matches what was submitted. Drift is surfaced to
 *    the user instead of silently swallowed.
 *  - Honest degraded states: load failure, empty 200 OK, save failure.
 */

import { AlertTriangle, CheckCircle2, Lock, Palette, Save, ShieldCheck } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

type Confidentiality = 'public' | 'internal' | 'confidential';

interface BrandKit {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  footerText: string;
  headerText: string;
  showPageNumbers: boolean;
  showConfidentiality: boolean;
  defaultConfidentiality: Confidentiality;
  disclaimer: string;
  watermark: string;
}

interface BrandKitGovernanceSettingsProps {
  /**
   * Whether the current viewer holds the `brand_change` capability.
   * Defaults to false — read-only by default to honor deny-by-default.
   */
  canEdit?: boolean;
}

const DEFAULT_BRAND_KIT: BrandKit = {
  name: '',
  primaryColor: '#1d4ed8',
  secondaryColor: '#0f172a',
  accentColor: '#22c55e',
  footerText: '',
  headerText: '',
  showPageNumbers: true,
  showConfidentiality: true,
  defaultConfidentiality: 'internal',
  disclaimer: '',
  watermark: '',
};

const CONFIDENTIALITY_OPTIONS: Array<{ value: Confidentiality; label: string }> = [
  { value: 'public', label: 'Public' },
  { value: 'internal', label: 'Internal' },
  { value: 'confidential', label: 'Confidential' },
];

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const normalizeBrandKit = (raw: unknown): BrandKit | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const inner =
    data.brandKit && typeof data.brandKit === 'object'
      ? (data.brandKit as Record<string, unknown>)
      : data;
  if (!inner || typeof inner !== 'object') return null;

  const pickString = (key: string, fallback: string): string => {
    const value = inner[key];
    return typeof value === 'string' ? value : fallback;
  };
  const pickBool = (key: string, fallback: boolean): boolean => {
    const value = inner[key];
    return typeof value === 'boolean' ? value : fallback;
  };
  const pickConfidentiality = (key: string, fallback: Confidentiality): Confidentiality => {
    const value = inner[key];
    if (value === 'public' || value === 'internal' || value === 'confidential') {
      return value;
    }
    return fallback;
  };

  return {
    name: pickString('name', DEFAULT_BRAND_KIT.name),
    primaryColor: pickString('primaryColor', DEFAULT_BRAND_KIT.primaryColor),
    secondaryColor: pickString('secondaryColor', DEFAULT_BRAND_KIT.secondaryColor),
    accentColor: pickString('accentColor', DEFAULT_BRAND_KIT.accentColor),
    footerText: pickString('footerText', DEFAULT_BRAND_KIT.footerText),
    headerText: pickString('headerText', DEFAULT_BRAND_KIT.headerText),
    showPageNumbers: pickBool('showPageNumbers', DEFAULT_BRAND_KIT.showPageNumbers),
    showConfidentiality: pickBool('showConfidentiality', DEFAULT_BRAND_KIT.showConfidentiality),
    defaultConfidentiality: pickConfidentiality(
      'defaultConfidentiality',
      DEFAULT_BRAND_KIT.defaultConfidentiality
    ),
    disclaimer: pickString('disclaimer', DEFAULT_BRAND_KIT.disclaimer),
    watermark: pickString('watermark', DEFAULT_BRAND_KIT.watermark),
  };
};

const brandKitsEqual = (a: BrandKit, b: BrandKit): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export const BrandKitGovernanceSettings: React.FC<BrandKitGovernanceSettingsProps> = ({
  canEdit = false,
}) => {
  const [brandKit, setBrandKit] = useState<BrandKit>(DEFAULT_BRAND_KIT);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [staleWarning, setStaleWarning] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [hasData, setHasData] = useState<boolean>(false);

  const fetchBrandKit = useCallback(async (): Promise<BrandKit | null> => {
    const response = await fetch('/api/presentations/brand-kit', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Brand kit request failed (${response.status})`);
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Brand kit response was not valid JSON');
    }

    return normalizeBrandKit(parsed);
  }, []);

  const loadBrandKit = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setStaleWarning(null);
    try {
      const next = await fetchBrandKit();
      if (next) {
        setBrandKit(next);
        setHasData(true);
      } else {
        setBrandKit(DEFAULT_BRAND_KIT);
        setHasData(false);
      }
    } catch {
      setLoadError('Brand kit could not be loaded. Working in degraded mode.');
      setHasData(false);
    } finally {
      setLoading(false);
    }
  }, [fetchBrandKit]);

  useEffect(() => {
    void loadBrandKit();
  }, [loadBrandKit]);

  const updateField = useCallback(<K extends keyof BrandKit>(key: K, value: BrandKit[K]) => {
    setBrandKit((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!canEdit) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    setStaleWarning(null);
    try {
      const submitted = brandKit;
      const response = await fetch('/api/presentations/brand-kit', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(submitted),
      });

      if (!response.ok) {
        throw new Error(`Brand kit save failed (${response.status})`);
      }

      const persisted = await fetchBrandKit();
      if (persisted) {
        setBrandKit(persisted);
        setHasData(true);
        if (!brandKitsEqual(persisted, submitted)) {
          setStaleWarning('Saved but read-back is stale — please refresh.');
        }
      } else {
        setStaleWarning('Saved but read-back is stale — please refresh.');
      }
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      setSaveError('Failed to save brand kit. Please retry.');
    } finally {
      setSaving(false);
    }
  }, [brandKit, canEdit, fetchBrandKit]);

  const inputDisabled = !canEdit || loading || !!loadError;

  const cardClass =
    'bg-c-surface border border-c-border-subtle dark:border-navy-700 rounded-lg p-6';
  const sectionTitleClass =
    'text-sm font-bold text-navy-900 mb-4 uppercase tracking-wider flex items-center gap-2';
  const labelClass = 'block text-sm font-medium text-c-text-secondary mb-1.5';
  const textInputClass =
    'w-full px-3 py-2 bg-c-surface border border-c-border-subtle dark:border-navy-700 rounded-md text-sm text-navy-900 placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed';
  const helperTextClass = 'text-xs text-c-text-muted mt-1';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
            <ShieldCheck size={18} className="text-blue-500" />
            Brand Kit Governance
          </h3>
          <p className="text-c-text-muted text-sm mt-1">
            Centrally manage colors, headers, footers, and confidentiality defaults applied to
            generated presentations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!canEdit && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-c-surface-raised text-c-text-secondary border border-c-border-subtle dark:border-navy-700">
              <Lock size={12} />
              Read-only
            </span>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || !!loadError}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* Load error (degraded) */}
      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200"
        >
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Read-back drift warning */}
      {staleWarning && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{staleWarning}</span>
        </div>
      )}

      {/* Save success */}
      {savedAt && !saveError && !staleWarning && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
        >
          <CheckCircle2 size={16} />
          <span>Saved at {savedAt}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !loadError && (
        <div className={cardClass}>
          <p className="text-sm text-c-text-muted">Loading brand kit...</p>
          <div className="mt-4 space-y-3 animate-pulse">
            <div className="h-9 rounded-md bg-c-surface-raised" />
            <div className="h-9 rounded-md bg-c-surface-raised" />
            <div className="h-9 rounded-md bg-c-surface-raised w-2/3" />
          </div>
        </div>
      )}

      {/* Empty 200 OK */}
      {!loading && !loadError && !hasData && (
        <div className={`${cardClass} text-sm text-c-text-secondary`}>
          No brand kit configured yet.
        </div>
      )}

      {/* Form */}
      {!loading && !loadError && (
        <>
          {/* Identity */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>
              <Palette size={14} className="text-blue-500" />
              Identity
            </h4>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="brandkit-name" className={labelClass}>
                  Name
                </label>
                <input
                  id="brandkit-name"
                  type="text"
                  className={textInputClass}
                  value={brandKit.name}
                  disabled={inputDisabled}
                  placeholder="Acme Consulting"
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(
                  [
                    {
                      id: 'brandkit-primary',
                      label: 'Primary color',
                      key: 'primaryColor' as const,
                    },
                    {
                      id: 'brandkit-secondary',
                      label: 'Secondary color',
                      key: 'secondaryColor' as const,
                    },
                    { id: 'brandkit-accent', label: 'Accent color', key: 'accentColor' as const },
                  ] satisfies Array<{
                    id: string;
                    label: string;
                    key: 'primaryColor' | 'secondaryColor' | 'accentColor';
                  }>
                ).map(({ id, label, key }) => {
                  const value = brandKit[key];
                  const isValidHex = HEX_COLOR.test(value);
                  return (
                    <div key={id}>
                      <label htmlFor={id} className={labelClass}>
                        {label}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id={id}
                          type="color"
                          aria-label={`${label} picker`}
                          className="h-9 w-12 cursor-pointer rounded-md border border-c-border-subtle dark:border-navy-700 bg-c-surface disabled:opacity-60 disabled:cursor-not-allowed"
                          value={isValidHex ? value : '#000000'}
                          disabled={inputDisabled}
                          onChange={(event) => updateField(key, event.target.value)}
                        />
                        <input
                          type="text"
                          aria-label={`${label} hex value`}
                          className={`${textInputClass} font-mono uppercase`}
                          value={value}
                          disabled={inputDisabled}
                          onChange={(event) => updateField(key, event.target.value)}
                        />
                      </div>
                      {!isValidHex && value && (
                        <p className="text-xs text-danger-500 mt-1">Invalid hex color</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Header & Footer */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>Slide Chrome</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="brandkit-header-text" className={labelClass}>
                  Header text
                </label>
                <input
                  id="brandkit-header-text"
                  type="text"
                  className={textInputClass}
                  value={brandKit.headerText}
                  disabled={inputDisabled}
                  onChange={(event) => updateField('headerText', event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="brandkit-footer-text" className={labelClass}>
                  Footer text
                </label>
                <input
                  id="brandkit-footer-text"
                  type="text"
                  className={textInputClass}
                  value={brandKit.footerText}
                  disabled={inputDisabled}
                  onChange={(event) => updateField('footerText', event.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label
                htmlFor="brandkit-show-page-numbers"
                className="flex items-start gap-3 p-3 rounded-md border border-c-border-subtle dark:border-navy-700 cursor-pointer"
              >
                <input
                  id="brandkit-show-page-numbers"
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-c-border-subtle text-blue-600 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  checked={brandKit.showPageNumbers}
                  disabled={inputDisabled}
                  onChange={(event) => updateField('showPageNumbers', event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium text-navy-900">
                    Show page numbers
                  </span>
                  <span className={helperTextClass}>Render page numbers in the slide footer.</span>
                </span>
              </label>

              <label
                htmlFor="brandkit-show-confidentiality"
                className="flex items-start gap-3 p-3 rounded-md border border-c-border-subtle dark:border-navy-700 cursor-pointer"
              >
                <input
                  id="brandkit-show-confidentiality"
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-c-border-subtle text-blue-600 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  checked={brandKit.showConfidentiality}
                  disabled={inputDisabled}
                  onChange={(event) => updateField('showConfidentiality', event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium text-navy-900">
                    Show confidentiality marker
                  </span>
                  <span className={helperTextClass}>
                    Display the confidentiality classification on every slide.
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Confidentiality / Legal */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>Confidentiality & Legal</h4>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="brandkit-default-confidentiality" className={labelClass}>
                  Default confidentiality
                </label>
                <select
                  id="brandkit-default-confidentiality"
                  className={textInputClass}
                  value={brandKit.defaultConfidentiality}
                  disabled={inputDisabled}
                  onChange={(event) =>
                    updateField('defaultConfidentiality', event.target.value as Confidentiality)
                  }
                >
                  {CONFIDENTIALITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className={helperTextClass}>
                  Applied to new presentations unless explicitly overridden.
                </p>
              </div>

              <div>
                <label htmlFor="brandkit-disclaimer" className={labelClass}>
                  Disclaimer text
                </label>
                <textarea
                  id="brandkit-disclaimer"
                  rows={3}
                  className={textInputClass}
                  value={brandKit.disclaimer}
                  disabled={inputDisabled}
                  placeholder="This document contains confidential information..."
                  onChange={(event) => updateField('disclaimer', event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="brandkit-watermark" className={labelClass}>
                  Watermark text
                </label>
                <input
                  id="brandkit-watermark"
                  type="text"
                  className={textInputClass}
                  value={brandKit.watermark}
                  disabled={inputDisabled}
                  placeholder="CONFIDENTIAL"
                  onChange={(event) => updateField('watermark', event.target.value)}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BrandKitGovernanceSettings;
