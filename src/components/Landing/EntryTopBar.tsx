import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Globe, Handshake, Menu, Moon, Sun, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { changeLanguage, LANGUAGE_DISPLAY_CODES, LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';

interface EntryTopBarProps {
  onTrialClick: () => void;
  onDemoClick: () => void;
  onLoginClick: () => void;
  onRegisterClick?: () => void;
  isLoggedIn: boolean;
  hasWorkspace: boolean;
}

export const EntryTopBar: React.FC<EntryTopBarProps> = ({
  onTrialClick,
  onDemoClick,
  onLoginClick,
  onRegisterClick,
  isLoggedIn,
  hasWorkspace,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useAppStore();

  // Use centralized language configuration
  const languages = SUPPORTED_LANGUAGES.map((code) => ({
    code,
    label: LANGUAGE_NAMES[code],
    displayCode: LANGUAGE_DISPLAY_CODES[code],
  }));

  const currentLang = languages.find((l) => l.code === i18n.language.split('-')[0]) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLangChange = async (code: string) => {
    await changeLanguage(code);
    setIsLangOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-20 bg-white/70 dark:bg-navy-950/70 backdrop-blur-xl border-b border-white/20 dark:border-navy-700 z-[100] transition-colors duration-300">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        {/* Logo + Brand Name */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            {/* DBR77 Logo - links to company website */}
            <a
              href="https://dbr77.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group"
              title="DBR77 Robotics - Company Website"
            >
              <img
                src="/assets/logos/logo-dark.png"
                alt="DBR77"
                className="h-8 transition-transform duration-300 group-hover:scale-110 group-hover:brightness-110"
              />
            </a>
            {/* Consultinity - links to homepage */}
            <a
              href="/"
              className="text-xl font-black tracking-tight text-navy-950 dark:text-white uppercase font-sans hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              Consultinity
            </a>
          </div>

          {/* Partner Program Button - Desktop Only */}
          <button
            onClick={() => navigate('/become-partner')}
            className="hidden md:inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 rounded-lg transition-all duration-300 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-105 group"
          >
            <Handshake
              size={18}
              className="group-hover:rotate-12 transition-transform duration-300"
            />
            <span>{t('partner.becomePartner', 'Become Partner')}</span>
          </button>
        </div>

        {/* Right Navigation - Demo, Trial, Auth & Settings */}
        <div className="hidden md:flex items-center gap-3">
          {/* Demo Button */}
          <button
            onClick={onDemoClick}
            className="min-w-24 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all border border-slate-200 dark:border-navy-700 cursor-pointer"
          >
            {t('landing.topBar.demo', 'Demo')}
          </button>

          {/* Trial Button */}
          <button
            onClick={onTrialClick}
            className="min-w-24 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all border border-slate-200 dark:border-navy-700 cursor-pointer mr-8"
          >
            {t('landing.topBar.trial', 'Trial')}
          </button>

          {/* Log in Button - using useNavigate for reliable navigation */}
          <button
            onClick={() => {
              console.log('[EntryTopBar] Log in clicked - navigating to /login');
              navigate('/login');
            }}
            className="px-5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all border border-slate-200 dark:border-navy-700 cursor-pointer"
          >
            {t('landing.topBar.login', 'Log in')}
          </button>

          {/* Sign up Button - using useNavigate for reliable navigation */}
          <button
            onClick={() => {
              console.log('[EntryTopBar] Sign up clicked - navigating to /register');
              navigate('/register');
            }}
            className="px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-all shadow-lg shadow-purple-500/25 dark:shadow-purple-900/25 cursor-pointer"
          >
            {t('landing.topBar.signUp', 'Sign up')}
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

          {/* Theme Toggle */}
          <button
            onClick={() => toggleTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-navy-950 dark:hover:text-white transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>

          {/* Language Selector */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-navy-950 dark:hover:text-white transition-colors py-2"
            >
              <Globe size={18} />
              <span>{currentLang.displayCode}</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {isLangOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl py-2 z-50 overflow-hidden"
                >
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLangChange(lang.code)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                        i18n.language.startsWith(lang.code)
                          ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      {lang.label}
                      {i18n.language.startsWith(lang.code) && (
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="md:hidden" ref={mobileMenuRef}>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-navy-950 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Mobile Menu Dropdown */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-0 right-0 bg-white dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700 shadow-xl"
              >
                <nav className="flex flex-col p-4 gap-2 max-w-7xl mx-auto">
                  {/* Partner Program Button - Featured */}
                  <button
                    onClick={() => {
                      navigate('/become-partner');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-base font-semibold text-white bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 rounded-lg transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
                  >
                    <Handshake size={20} />
                    <span>{t('partner.becomePartner', 'Become Partner')}</span>
                  </button>

                  <div className="h-px bg-slate-200 dark:bg-white/10 my-2" />

                  {/* Navigation Links */}
                  <button
                    onClick={() => {
                      onDemoClick();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-base font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                  >
                    {t('landing.topBar.demo', 'Demo')}
                  </button>
                  <button
                    onClick={() => {
                      onTrialClick();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-base font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                  >
                    {t('landing.topBar.trial', 'Trial')}
                  </button>

                  <div className="h-px bg-slate-200 dark:bg-white/10 my-2" />

                  <button
                    onClick={() => {
                      onLoginClick();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-base font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                  >
                    {t('landing.topBar.login', 'Log in')}
                  </button>
                  <button
                    onClick={() => {
                      onRegisterClick?.();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-base font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-all text-center"
                  >
                    {t('auth.createOne', 'Sign up')}
                  </button>

                  <div className="h-px bg-slate-200 dark:bg-white/10 my-2" />

                  {/* Theme & Language Row */}
                  <div className="flex items-center justify-between px-4 py-2">
                    {/* Theme Toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Theme:</span>
                      <button
                        onClick={() => toggleTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="p-2 text-slate-600 dark:text-slate-400 hover:text-navy-950 dark:hover:text-white transition-colors bg-slate-100 dark:bg-white/10 rounded-lg"
                      >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                      </button>
                    </div>

                    {/* Language Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Lang:</span>
                      <div className="flex gap-1">
                        {languages.slice(0, 3).map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => handleLangChange(lang.code)}
                            className={`text-xs px-2 py-1.5 rounded-lg border transition-colors font-medium ${
                              i18n.language.startsWith(lang.code)
                                ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-500/30 dark:text-purple-300'
                                : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-navy-700 dark:hover:bg-white/5 dark:text-slate-400'
                            }`}
                          >
                            {lang.displayCode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
