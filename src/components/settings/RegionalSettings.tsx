/**
 * RegionalSettings - Comprehensive regional and locale preferences
 *
 * Features:
 * - Timezone selection
 * - Measurement system (metric/imperial)
 * - Currency format
 * - Number format (decimal/thousands separators)
 * - Date format
 * - Time format (12h/24h)
 */

import { Calendar, Check, Clock, DollarSign, Globe, Loader2, Ruler, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { SettingsApi } from '../../services/api/settings.api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { InfoButton } from '../shared/InfoButton';
import { SettingsHeaderActionPortal } from './SettingsHeaderActions';

interface RegionalSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface RegionalPreferences {
  timezone: string;
  units: 'metric' | 'imperial';
  currency: string;
  numberFormat: 'en-US' | 'de-DE' | 'pl-PL' | 'fr-FR';
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD.MM.YYYY';
  timeFormat: '12h' | '24h';
  firstDayOfWeek: 'monday' | 'sunday';
}

interface OrganizationRegionalDefaults {
  profile?: {
    defaultTimezone?: string | null;
    currency?: string | null;
  };
}

const DEFAULT_PREFERENCES: RegionalPreferences = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  units: 'metric',
  currency: 'USD',
  numberFormat: 'en-US',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  firstDayOfWeek: 'monday',
};

const preferencesMatch = (left: RegionalPreferences, right: RegionalPreferences) =>
  JSON.stringify(left) === JSON.stringify(right);

// Currency options with symbols
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
];

// Number format options with examples
const NUMBER_FORMATS = [
  { code: 'en-US', label: 'English (US)', example: '1,234.56' },
  { code: 'de-DE', label: 'German', example: '1.234,56' },
  { code: 'pl-PL', label: 'Polish', example: '1 234,56' },
  { code: 'fr-FR', label: 'French', example: '1 234,56' },
];

// Date format options with examples
const DATE_FORMATS = [
  { code: 'DD/MM/YYYY', label: 'Day/Month/Year', example: '31/12/2024' },
  { code: 'MM/DD/YYYY', label: 'Month/Day/Year', example: '12/31/2024' },
  { code: 'YYYY-MM-DD', label: 'ISO (Year-Month-Day)', example: '2024-12-31' },
  { code: 'DD.MM.YYYY', label: 'Day.Month.Year', example: '31.12.2024' },
];

// Time format options
const TIME_FORMATS = [
  { code: '24h', label: '24-hour', example: '14:30' },
  { code: '12h', label: '12-hour', example: '2:30 PM' },
];

export const RegionalSettings: React.FC<RegionalSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<RegionalPreferences>(DEFAULT_PREFERENCES);
  const [organizationDefaults, setOrganizationDefaults] =
    useState<OrganizationRegionalDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const timezones = Intl.supportedValuesOf('timeZone');

  useEffect(() => {
    loadPreferences();
    loadOrganizationDefaults();
  }, [currentUser.id]);

  const loadOrganizationDefaults = async () => {
    try {
      const data = (await Api.get('/organization-context')) as OrganizationRegionalDefaults;
      setOrganizationDefaults(data);
    } catch {
      setOrganizationDefaults(null);
    }
  };

  const loadPreferences = async () => {
    try {
      setLoadError(null);
      const data = await SettingsApi.getRegionalPreferences();
      if (!data?.preferences) {
        throw new Error('Regional preferences were not returned by the server');
      }
      setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
    } catch (error: unknown) {
      setLoadError(normalizeApiErrorMessage(error, 'Failed to load regional preferences'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await SettingsApi.updateRegionalPreferences(preferences);
      const data = await SettingsApi.getRegionalPreferences();
      if (!data?.preferences) {
        throw new Error('Regional preferences save was not confirmed by the server');
      }
      const persisted = { ...DEFAULT_PREFERENCES, ...data.preferences } as RegionalPreferences;
      if (!preferencesMatch(persisted, preferences)) {
        throw new Error('Regional preferences were not confirmed by the server');
      }
      setPreferences(persisted);
      // Note: we intentionally do NOT mirror timezone/units onto the user object.
      // Nothing in the app consumed that mirror, so it implied an app-wide effect
      // that does not exist. These remain personal display preferences.
      toast.success(t('settings.regional.saved', 'Regional preferences saved'));
    } catch (error: unknown) {
      toast.error(
        normalizeApiErrorMessage(error, t('settings.regional.error', 'Failed to save preferences'))
      );
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = <K extends keyof RegionalPreferences>(
    key: K,
    value: RegionalPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  // Format example number based on selected format
  const formatExampleNumber = (format: string) => {
    const num = 1234567.89;
    try {
      return new Intl.NumberFormat(format, { minimumFractionDigits: 2 }).format(num);
    } catch {
      return '1,234,567.89';
    }
  };

  // Format example currency based on selected format
  const formatExampleCurrency = () => {
    const num = 1234.56;
    try {
      return new Intl.NumberFormat(preferences.numberFormat, {
        style: 'currency',
        currency: preferences.currency,
      }).format(num);
    } catch {
      return '$1,234.56';
    }
  };

  // Get current time in selected timezone
  const getCurrentTime = () => {
    try {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: preferences.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: preferences.timeFormat === '12h',
      };
      return new Date().toLocaleTimeString(undefined, options);
    } catch {
      return '--:--';
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
        <InfoButton cardId="settings-regional" position="top-right" />
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Globe size={28} className="text-blue-500" />
            {t('settings.regional.title', 'Regional Settings')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.regional.description',
              'Configure your locale, timezone, and format preferences'
            )}
          </p>
        </div>
        <DegradedState title="Regional preferences unavailable" description={loadError} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <InfoButton cardId="settings-regional" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Globe size={28} className="text-blue-500" />
            {t('settings.regional.title', 'Regional Settings')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.regional.descriptionPersonal',
              'Your personal display preferences. The live preview below reflects these choices; broader app-wide formatting will adopt them over time.'
            )}
          </p>
          {organizationDefaults?.profile?.defaultTimezone ||
          organizationDefaults?.profile?.currency ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
              {t(
                'settings.regional.tenantDefaultsHint',
                'Organization defaults stay read-only here. Your personal preference can override them only for your own experience.'
              )}
              <div className="mt-1 text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">
                {organizationDefaults?.profile?.defaultTimezone
                  ? t('settings.regional.tenantTimezone', 'Tenant timezone: {{timezone}}', {
                      timezone: organizationDefaults.profile.defaultTimezone,
                    })
                  : null}
                {organizationDefaults?.profile?.defaultTimezone &&
                organizationDefaults?.profile?.currency
                  ? ' | '
                  : null}
                {organizationDefaults?.profile?.currency
                  ? t('settings.regional.tenantCurrency', 'Tenant currency: {{currency}}', {
                      currency: organizationDefaults.profile.currency,
                    })
                  : null}
              </div>
            </div>
          ) : null}
        </div>
        <SettingsHeaderActionPortal>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="type-control flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-white transition-colors hover:bg-navy-800 disabled:opacity-50 dark:bg-[var(--c-text)] dark:text-[var(--c-bg)]"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save Changes')}
          </button>
        </SettingsHeaderActionPortal>
      </div>

      {/* Timezone */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Globe size={20} className="text-blue-500" />
          {t('settings.regional.timezone', 'Timezone')}
        </h3>
        <p className="text-sm text-c-text-muted mb-4">
          {t(
            'settings.regional.timezoneDescription',
            'Set your local timezone for accurate dates and times across the platform.'
          )}
        </p>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <select
            value={preferences.timezone}
            onChange={(e) => updatePreference('timezone', e.target.value)}
            className="flex-1 max-w-md px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-c-text"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
            <span className="text-sm text-blue-600 dark:text-blue-400">
              {t('settings.regional.currentTime', 'Current time:')}{' '}
              <strong>{getCurrentTime()}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Date & Time Format */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-c-accent" />
          {t('settings.regional.dateTimeTitle', 'Date & Time Format')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Date Format */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {t('settings.regional.dateFormat', 'Date Format')}
            </label>
            <div className="space-y-2">
              {DATE_FORMATS.map((format) => {
                const isSelected = preferences.dateFormat === format.code;
                return (
                  <label
                    key={format.code}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-c-border-strong bg-c-surface-raised'
                        : 'border-c-border-subtle dark:border-navy-700 hover:border-c-border-strong'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="dateFormat"
                        value={format.code}
                        checked={isSelected}
                        onChange={() =>
                          updatePreference(
                            'dateFormat',
                            format.code as RegionalPreferences['dateFormat']
                          )
                        }
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-navy-900 bg-navy-900' : 'border-c-border-subtle'
                        }`}
                      >
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                      <span
                        className={`text-sm font-medium ${isSelected ? 'text-c-text' : 'text-c-text-secondary'}`}
                      >
                        {t(`settings.regional.dateFormats.${format.code}`, format.label)}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-mono ${isSelected ? 'text-c-text-secondary' : 'text-c-text-muted'}`}
                    >
                      {format.example}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Time Format */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {t('settings.regional.timeFormat', 'Time Format')}
            </label>
            <div className="space-y-2">
              {TIME_FORMATS.map((format) => {
                const isSelected = preferences.timeFormat === format.code;
                return (
                  <label
                    key={format.code}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-c-border-strong bg-c-surface-raised'
                        : 'border-c-border-subtle dark:border-navy-700 hover:border-c-border-strong'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="timeFormat"
                        value={format.code}
                        checked={isSelected}
                        onChange={() =>
                          updatePreference(
                            'timeFormat',
                            format.code as RegionalPreferences['timeFormat']
                          )
                        }
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-navy-900 bg-navy-900' : 'border-c-border-subtle'
                        }`}
                      >
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock
                          size={16}
                          className={isSelected ? 'text-c-text-secondary' : 'text-c-text-secondary'}
                        />
                        <span
                          className={`text-sm font-medium ${isSelected ? 'text-c-text' : 'text-c-text-secondary'}`}
                        >
                          {t(`settings.regional.timeFormats.${format.code}`, format.label)}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-mono ${isSelected ? 'text-c-text-secondary' : 'text-c-text-muted'}`}
                    >
                      {format.example}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* First Day of Week */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-c-text-secondary mb-2">
                {t('settings.regional.firstDayOfWeek', 'First Day of Week')}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => updatePreference('firstDayOfWeek', 'monday')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    preferences.firstDayOfWeek === 'monday'
                      ? 'bg-navy-900 text-white'
                      : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700'
                  }`}
                >
                  {t('settings.regional.monday', 'Monday')}
                </button>
                <button
                  onClick={() => updatePreference('firstDayOfWeek', 'sunday')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    preferences.firstDayOfWeek === 'sunday'
                      ? 'bg-navy-900 text-white'
                      : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700'
                  }`}
                >
                  {t('settings.regional.sunday', 'Sunday')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Currency & Number Format */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <DollarSign size={20} className="text-green-500" />
          {t('settings.regional.currencyTitle', 'Currency & Numbers')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {t('settings.regional.currency', 'Currency')}
            </label>
            <select
              value={preferences.currency}
              onChange={(e) => updatePreference('currency', e.target.value)}
              className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-c-text"
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} -{' '}
                  {t(`settings.regional.currencies.${currency.code}`, currency.name)} (
                  {currency.code})
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-c-text-muted">
              {t('settings.regional.currencyExample', 'Example:')} {formatExampleCurrency()}
            </p>
          </div>

          {/* Number Format */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {t('settings.regional.numberFormat', 'Number Format')}
            </label>
            <select
              value={preferences.numberFormat}
              onChange={(e) =>
                updatePreference(
                  'numberFormat',
                  e.target.value as RegionalPreferences['numberFormat']
                )
              }
              className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-c-text"
            >
              {NUMBER_FORMATS.map((format) => (
                <option key={format.code} value={format.code}>
                  {t(`settings.regional.numberFormats.${format.code}`, format.label)} (
                  {format.example})
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-c-text-muted">
              {t('settings.regional.numberExample', 'Large number example:')}{' '}
              {formatExampleNumber(preferences.numberFormat)}
            </p>
          </div>
        </div>
      </div>

      {/* Measurement System */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Ruler size={20} className="text-amber-500" />
          {t('settings.regional.measurementTitle', 'Measurement System')}
        </h3>
        <p className="text-sm text-c-text-muted mb-4">
          {t(
            'settings.regional.measurementDescription',
            'Choose your preferred system for weights, distances, and temperatures.'
          )}
        </p>

        <div className="grid grid-cols-2 gap-4 max-w-md">
          {[
            {
              value: 'metric' as const,
              label: t('settings.regional.metric', 'Metric'),
              details: t('settings.regional.metricDetails', 'meters, kilograms, °C'),
            },
            {
              value: 'imperial' as const,
              label: t('settings.regional.imperial', 'Imperial'),
              details: t('settings.regional.imperialDetails', 'feet, pounds, °F'),
            },
          ].map((option) => {
            const isSelected = preferences.units === option.value;
            return (
              <button
                key={option.value}
                onClick={() => updatePreference('units', option.value)}
                className={`p-4 rounded-xl border-2 transition-all text-center ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                    : 'border-c-border-subtle dark:border-navy-700 hover:border-amber-300'
                }`}
              >
                <div
                  className={`text-lg font-semibold mb-1 ${isSelected ? 'text-amber-700 dark:text-amber-300' : 'text-c-text-secondary'}`}
                >
                  {option.label}
                </div>
                <div
                  className={`text-xs ${isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-c-text-muted'}`}
                >
                  {option.details}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview Card */}
      <div className="bg-gradient-to-r from-blue-50 to-c-accent-soft dark:from-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl p-6">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">
          {t('settings.regional.preview', 'Preview of Your Settings')}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-c-text-muted block">
              {t('settings.regional.dateLabel', 'Date')}
            </span>
            <span className="font-mono text-c-text">
              {(() => {
                const d = new Date();
                switch (preferences.dateFormat) {
                  case 'MM/DD/YYYY':
                    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
                  case 'YYYY-MM-DD':
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  case 'DD.MM.YYYY':
                    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
                  default:
                    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                }
              })()}
            </span>
          </div>
          <div>
            <span className="text-c-text-muted block">
              {t('settings.regional.timeLabel', 'Time')}
            </span>
            <span className="font-mono text-c-text">{getCurrentTime()}</span>
          </div>
          <div>
            <span className="text-c-text-muted block">
              {t('settings.regional.currencyLabel', 'Currency')}
            </span>
            <span className="font-mono text-c-text">{formatExampleCurrency()}</span>
          </div>
          <div>
            <span className="text-c-text-muted block">
              {t('settings.regional.numberLabel', 'Number')}
            </span>
            <span className="font-mono text-c-text">
              {formatExampleNumber(preferences.numberFormat)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionalSettings;
