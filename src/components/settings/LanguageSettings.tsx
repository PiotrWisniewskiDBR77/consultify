/**
 * LanguageSettings - Language/locale settings
 *
 * Uses centralized i18n configuration for consistent language support across the app.
 */

import { Check, Globe } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  changeLanguage,
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../../i18n';
import { useAppStore } from '../../store/useAppStore';

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
  const [currentLang, setCurrentLang] = useState(i18n.language || 'en');

  // SuperAdmin: only Polish and English
  // Regular users: all supported languages
  const isSuperAdmin = currentUser?.role?.toUpperCase() === 'SUPERADMIN';
  const LANGUAGES = isSuperAdmin
    ? ALL_LANGUAGES.filter((lang) => ['en', 'pl'].includes(lang.code))
    : ALL_LANGUAGES;

  const handleLanguageChange = async (langCode: string) => {
    const success = await changeLanguage(langCode);
    if (success) {
      setCurrentLang(langCode);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <Globe size={20} />
          {t('settings.appearance.languageTitle', 'Language')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t(
            'settings.appearance.languageDesc',
            'Select your preferred language for the interface.'
          )}
        </p>
      </div>

      <div className="space-y-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors ${
              currentLang === lang.code
                ? 'bg-brand/10 border-2 border-brand'
                : 'bg-slate-50 dark:bg-navy-800/50 border-2 border-transparent hover:border-slate-200 dark:border-navy-700 dark:hover:border-navy-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{lang.flag}</span>
              <span className="font-medium text-slate-900 dark:text-white">{lang.name}</span>
            </div>
            {currentLang === lang.code && <Check size={20} className="text-brand" />}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSettings;
