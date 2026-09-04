import { Check, ChevronDown, Globe } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  LANGUAGE_DISPLAY_CODES,
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@/i18n';

interface ChatLanguageSelectorProps {
  value: SupportedLanguage;
  onChange: (lang: SupportedLanguage) => void;
  className?: string;
  compact?: boolean;
}

export const ChatLanguageSelector: React.FC<ChatLanguageSelectorProps> = ({
  value,
  onChange,
  className = '',
  compact = true,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`
          flex items-center gap-2 rounded-lg border transition-colors
          ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'}
          bg-slate-50 dark:bg-navy-950/40
          border-slate-200 dark:border-navy-800
          text-slate-700 dark:text-slate-300
          hover:bg-slate-100 dark:hover:bg-navy-900
        `}
        title={t('aiChat.language', 'Język rozmowy')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Globe size={compact ? 14 : 16} className="text-slate-500 dark:text-slate-400" />
        <span className="font-medium tabular-nums">{LANGUAGE_DISPLAY_CODES[value] || value}</span>
        {!compact && <span className="text-slate-500">{LANGUAGE_NAMES[value] || value}</span>}
        <ChevronDown size={compact ? 14 : 16} className="text-slate-500 dark:text-slate-400" />
      </button>

      {open && (
        <div
          role="menu"
          className="
            absolute right-0 top-full mt-2 z-50 w-56
            bg-white dark:bg-navy-900
            border border-slate-200 dark:border-navy-700
            rounded-xl shadow-xl py-1
          "
        >
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('aiChat.language', 'Język rozmowy')}
          </div>
          <div className="h-px bg-slate-200 dark:bg-navy-800 my-1" />

          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(lang);
                setOpen(false);
              }}
              className={`
                w-full flex items-center justify-between gap-3 px-3 py-2 text-sm
                text-slate-700 dark:text-slate-200
                hover:bg-slate-50 dark:hover:bg-navy-800
                transition-colors
              `}
            >
              <span className="flex items-center gap-2">
                <span className="text-xs font-semibold w-10 text-slate-500 dark:text-slate-400">
                  {LANGUAGE_DISPLAY_CODES[lang] || lang}
                </span>
                <span className="truncate">{LANGUAGE_NAMES[lang] || lang}</span>
              </span>
              {value === lang && <Check size={16} className="text-c-text-secondary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatLanguageSelector;
