/**
 * ThemeSettings - Theme/appearance settings
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Check } from 'lucide-react';

interface ThemeSettingsProps {
  className?: string;
}

type Theme = 'light' | 'dark' | 'system';

export const ThemeSettings: React.FC<ThemeSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  // Use lazy initialization to load from localStorage
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as Theme;
      return savedTheme || 'system';
    }
    return 'system';
  });

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
    }
  };

  const themes = [
    { id: 'light' as Theme, icon: Sun, label: t('settings.appearance.light', 'Light') },
    { id: 'dark' as Theme, icon: Moon, label: t('settings.appearance.dark', 'Dark') },
    { id: 'system' as Theme, icon: Monitor, label: t('settings.appearance.system', 'System') },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <Sun size={20} />
          {t('settings.appearance.themeTitle', 'Theme')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('settings.appearance.themeDesc', 'Choose your preferred color scheme.')}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {themes.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => handleThemeChange(id)}
            className={`p-4 rounded-xl border-2 transition-all ${
              theme === id
                ? 'border-brand bg-brand/5 dark:bg-brand/10'
                : 'border-slate-200 dark:border-navy-700 hover:border-brand/50'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`p-3 rounded-lg ${
                theme === id 
                  ? 'bg-brand text-white' 
                  : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
              }`}>
                <Icon size={24} />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900 dark:text-white">{label}</span>
                {theme === id && <Check size={16} className="text-brand" />}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="mt-6 p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
          {t('settings.appearance.preview', 'Theme changes are applied immediately.')}
        </p>
      </div>
    </div>
  );
};

export default ThemeSettings;








