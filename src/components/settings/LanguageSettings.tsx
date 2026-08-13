/**
 * LanguageSettings - Language/locale settings
 *
 * Uses centralized i18n configuration for consistent language support across the app.
 */

import { Check, Globe } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  LANGUAGE_NAMES,
  normalizeLanguageCode,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../../i18n';
import { Api } from '../../services/api';
import { changeLanguageAndPersist } from '../../services/languagePreference';
import { useAppStore } from '../../store/useAppStore';
import { normalizeApiErrorMessage } from '../../utils/apiError';

interface LanguageSettingsProps {
  className?: string;
}

// Language flags mapping
const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  en: '🇬🇧',
  pl: '🇵🇱',
  de: '🇩🇪',
  es: '🇪🇸',
  ar: '🇸🇦',
  ja: '🇯🇵',
};

// Build language list from centralized configuration
const ALL_LANGUAGES = SUPPORTED_LANGUAGES.map((code) => ({
  code,
  name: LANGUAGE_NAMES[code],
  flag: LANGUAGE_FLAGS[code],
}));

export const LanguageSettings: React.FC<LanguageSettingsProps> = ({ className = '' }) => {
  const { t, i18n } = useTranslation();
  const { currentUser } = useAppStore();
  const currentLang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language) || 'en';
  const [tenantDefaultLanguage, setTenantDefaultLanguage] = useState<string | null>(null);
  const [tenantLoadError, setTenantLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadTenantDefault = async () => {
      try {
        const context = (await Api.get('/organization-context')) as {
          profile?: { defaultLanguage?: string | null };
        };
        if (!cancelled) {
          setTenantLoadError(null);
          setTenantDefaultLanguage(context?.profile?.defaultLanguage || null);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setTenantDefaultLanguage(null);
          setTenantLoadError(
            normalizeApiErrorMessage(error, 'Organization language default unavailable')
          );
        }
      }
    };

    loadTenantDefault();
    return () => {
      cancelled = true;
    };
  }, []);

  // SuperAdmin: only Polish and English
  // Regular users: all supported languages
  const isSuperAdmin = currentUser?.role?.toUpperCase() === 'SUPERADMIN';
  const LANGUAGES = isSuperAdmin
    ? ALL_LANGUAGES.filter((lang) => ['en', 'pl'].includes(lang.code))
    : ALL_LANGUAGES;

  const handleLanguageChange = async (langCode: string) => {
    setActionError(null);
    // P0.3: write-through to the account so this survives across devices —
    // the first manual switch is what seeds users.language for accounts
    // that never had a preference before.
    const changed = await changeLanguageAndPersist(currentUser?.id, langCode);
    if (!changed) {
      setActionError(t('settings.appearance.languageChangeError', 'Failed to change language'));
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
          <Globe size={20} />
          {t('settings.appearance.languageTitle', 'Language')}
        </h3>
        <p className="text-sm text-c-text-muted mt-1">
          {t(
            'settings.appearance.languageDesc',
            'Select your preferred language for the interface.'
          )}
        </p>
        {tenantDefaultLanguage ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
            {t(
              'settings.appearance.languageTenantHint',
              'Organization language defaults stay read-only here. You can still override the interface language for your own account.'
            )}
            <div className="mt-1 text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Tenant default language: {tenantDefaultLanguage}
            </div>
          </div>
        ) : null}
        {tenantLoadError ? (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100"
          >
            {tenantLoadError}
          </div>
        ) : null}
        {actionError ? (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200"
          >
            {actionError}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors ${
              currentLang === lang.code
                ? 'bg-c-surface-raised border-2 border-[var(--c-info)]'
                : 'bg-c-surface-raised border-2 border-transparent hover:border-c-border-subtle dark:border-navy-700 dark:hover:border-navy-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{lang.flag}</span>
              <span className="font-medium text-c-text">{lang.name}</span>
            </div>
            {currentLang === lang.code && <Check size={20} className="text-[var(--c-info)]" />}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSettings;
