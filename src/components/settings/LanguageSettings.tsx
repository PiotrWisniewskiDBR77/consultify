/**
 * LanguageSettings - Language/locale settings
 */

import { Check, Globe } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

interface LanguageSettingsProps {
  className?: string;
}

const ALL_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
];

export const LanguageSettings: React.FC<LanguageSettingsProps> = ({ className = '' }) => {
  const { t, i18n } = useTranslation();
  const { currentUser } = useAppStore();
  const [currentLang, setCurrentLang] = useState(i18n.language || 'en');

  // SuperAdmin: only Polish and English
  // Regular users: all 6 languages
  const isSuperAdmin = currentUser?.role?.toUpperCase() === 'SUPERADMIN';
  const LANGUAGES = isSuperAdmin
    ? ALL_LANGUAGES.filter((lang) => ['en', 'pl'].includes(lang.code))
    : ALL_LANGUAGES;

  const handleLanguageChange = (langCode: string) => {
    setCurrentLang(langCode);
    i18n.changeLanguage(langCode);
    localStorage.setItem('i18nextLng', langCode);
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
