import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Globe, Handshake, Menu, Moon, Sun, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  changeLanguage,
  LANGUAGE_DISPLAY_CODES,
  LANGUAGE_NAMES,
  normalizeLanguageCode,
  SUPPORTED_LANGUAGES,
} from '../../i18n';
import { ROUTES } from '../../routes/routeConfig';
import { useAppStore } from '../../store/useAppStore';

interface EntryTopBarProps {
  onTrialClick: () => void;
  onDemoClick: () => void;
  onLoginClick: () => void;
  onRegisterClick?: () => void;
  isLoggedIn: boolean;
  hasWorkspace: boolean;
  /** Force cinematic dark variant for marketing LP */
  forceDark?: boolean;
}

export const EntryTopBar: React.FC<EntryTopBarProps> = ({
  onTrialClick,
  onDemoClick,
  onLoginClick,
  onRegisterClick,
  isLoggedIn,
  hasWorkspace,
  forceDark = false,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const currentCode =
    normalizeLanguageCode(i18n.resolvedLanguage || i18n.language) || SUPPORTED_LANGUAGES[0];

  const localizedNavLabel = (
    key: string,
    fallbackEn: string,
    fallbackPl: string,
    fallbackDe: string
  ) => {
    const translated = t(key, fallbackEn);
    if (translated !== fallbackEn) return translated;
    if (currentCode === 'pl') return fallbackPl;
    if (currentCode === 'de') return fallbackDe;
    return fallbackEn;
  };

  const navLinks = [
    {
      label: localizedNavLabel('nav.product', 'Product', 'Produkt', 'Produkt'),
      href: ROUTES.WELCOME,
    },
    {
      label: localizedNavLabel(
        'nav.knowledgeBase',
        'Knowledge Base',
        'Baza wiedzy',
        'Wissensdatenbank'
      ),
      href: ROUTES.KNOWLEDGE_BASE_PUBLIC,
    },
    {
      label: localizedNavLabel('nav.pricing', 'Pricing', 'Cennik', 'Preise'),
      href: ROUTES.PRICING,
    },
    {
      label: localizedNavLabel('nav.partners', 'Partners', 'Partnerzy', 'Partner'),
      href: ROUTES.BECOME_PARTNER,
    },
    {
      label: localizedNavLabel('nav.vector', 'Vector AI', 'Vector AI', 'Vector AI'),
      href: ROUTES.VECTOR,
    },
    {
      label: localizedNavLabel('nav.security', 'Security', 'Bezpieczeństwo', 'Sicherheit'),
      href: ROUTES.LEGAL.SECURITY,
    },
  ];
  const { theme, toggleTheme } = useAppStore();
  const effectiveTheme = forceDark ? 'dark' : theme;

  const languages = SUPPORTED_LANGUAGES.map((code) => ({
    code,
    label: LANGUAGE_NAMES[code],
    displayCode: LANGUAGE_DISPLAY_CODES[code],
  }));

  const currentLang = languages.find((l) => l.code === currentCode) || languages[0];
  const languageMatches = (code: string) =>
    currentCode === code || String(i18n.language || '').startsWith(code);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setIsNavOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLangChange = async (code: string) => {
    await changeLanguage(code);
    setIsLangOpen(false);
  };

  const isDark = effectiveTheme === 'dark';

  return (
    <header
      className="fixed top-0 left-0 right-0 h-14 z-[100] transition-colors duration-300"
      style={{
        background: isDark ? 'rgba(10, 8, 30, 0.72)' : 'rgba(255, 255, 255, 0.80)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div className="max-w-7xl mx-auto h-full px-5 flex items-center justify-between gap-4">
        {/* ── Left: Logo + Become Partner + Demo + Trial ── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Logo */}
          <a
            href="/"
            className="flex items-center transition-opacity duration-200 hover:opacity-80 mr-1"
            title="Consultify"
          >
            <img
              src={
                isDark
                  ? '/assets/logos/logo-dark.svg?v=20260319'
                  : '/assets/logos/logo-light.svg?v=20260319'
              }
              alt="Consultify"
              className="h-6 w-auto object-contain"
            />
          </a>

          {/* Ghost pill helper */}
          {(['partner', 'demo'] as const).map((id) => {
            const cfg = {
              partner: {
                label: t('partner.becomePartner', 'Become Partner'),
                icon: <Handshake size={13} />,
                onClick: () => navigate(ROUTES.BECOME_PARTNER),
              },
              demo: {
                label: t('landing.topBar.demo', 'Try demo'),
                icon: null,
                onClick: onDemoClick,
              },
            }[id];
            return (
              <button
                key={id}
                onClick={cfg.onClick}
                className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.60)',
                  border: isDark
                    ? '1px solid rgba(255,255,255,0.14)'
                    : '1px solid rgba(0,0,0,0.12)',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = isDark
                    ? 'rgba(255,255,255,0.07)'
                    : 'rgba(0,0,0,0.05)';
                  (e.currentTarget as HTMLButtonElement).style.color = isDark ? '#fff' : '#000';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = isDark
                    ? 'rgba(255,255,255,0.65)'
                    : 'rgba(0,0,0,0.60)';
                }}
              >
                {cfg.icon}
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Right: Nav hamburger + auth pills ── */}
        <div className="hidden md:flex items-center gap-2">
          {/* Hamburger nav dropdown */}
          <div className="relative" ref={navRef}>
            <button
              onClick={() => setIsNavOpen(!isNavOpen)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer"
              style={{
                color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.60)',
                border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.10)',
                background: isNavOpen
                  ? isDark
                    ? 'rgba(255,255,255,0.07)'
                    : 'rgba(0,0,0,0.05)'
                  : 'transparent',
              }}
            >
              {isNavOpen ? <X size={15} /> : <Menu size={15} />}
              <span className="text-xs font-semibold">{t('landing.topBar.menu', 'Menu')}</span>
            </button>

            <AnimatePresence>
              {isNavOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-52 py-2 z-50"
                  style={{
                    background: isDark ? 'rgba(12,8,32,0.97)' : '#fff',
                    border: isDark
                      ? '1px solid rgba(255,255,255,0.12)'
                      : '1px solid rgba(0,0,0,0.08)',
                    borderRadius: '16px',
                    boxShadow: isDark
                      ? '0 24px 48px rgba(0,0,0,0.70)'
                      : '0 12px 32px rgba(0,0,0,0.12)',
                  }}
                >
                  {navLinks.map((link) => (
                    <button
                      key={link.href}
                      onClick={() => {
                        navigate(link.href);
                        setIsNavOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between group transition-colors"
                      style={{
                        color: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.70)',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = isDark
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(0,0,0,0.04)';
                        (e.currentTarget as HTMLButtonElement).style.color = isDark
                          ? '#fff'
                          : '#000';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                        (e.currentTarget as HTMLButtonElement).style.color = isDark
                          ? 'rgba(255,255,255,0.70)'
                          : 'rgba(0,0,0,0.70)';
                      }}
                    >
                      <span className="font-medium">{link.label}</span>
                      <ChevronRight
                        size={13}
                        className="opacity-30 group-hover:opacity-70 transition-opacity"
                      />
                    </button>
                  ))}

                  <div
                    className="mx-3 my-2 h-px"
                    style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                  />

                  <div className="px-3 pb-1 flex gap-2">
                    <button
                      onClick={() => {
                        onDemoClick();
                        setIsNavOpen(false);
                      }}
                      className="flex-1 py-1.5 rounded-full text-xs font-medium text-center transition-all"
                      style={{
                        color: isDark ? 'rgba(255,255,255,0.60)' : 'rgba(0,0,0,0.55)',
                        border: isDark
                          ? '1px solid rgba(255,255,255,0.12)'
                          : '1px solid rgba(0,0,0,0.10)',
                      }}
                    >
                      {t('landing.topBar.demo', 'Try demo')}
                    </button>
                    <button
                      onClick={() => {
                        onTrialClick();
                        setIsNavOpen(false);
                      }}
                      className="flex-1 py-1.5 rounded-full text-xs font-medium text-center text-white transition-all"
                      style={{ background: 'linear-gradient(135deg, #A51C30, #851627)' }}
                    >
                      {t('landing.topBar.trial', 'Start trial')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Separator */}
          <div
            className="h-4 w-px"
            style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }}
          />

          {/* Language pill */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer"
              style={{
                color: isDark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.40)',
                border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.08)',
              }}
            >
              <Globe size={13} />
              <span>{currentLang.displayCode}</span>
              <ChevronDown
                size={11}
                className={`transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {isLangOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-44 py-1.5 z-50"
                  style={{
                    background: isDark ? 'rgba(18,12,40,0.95)' : '#fff',
                    border: isDark
                      ? '1px solid rgba(255,255,255,0.12)'
                      : '1px solid rgba(0,0,0,0.08)',
                    borderRadius: '14px',
                    boxShadow: isDark
                      ? '0 20px 40px rgba(0,0,0,0.60)'
                      : '0 12px 32px rgba(0,0,0,0.12)',
                  }}
                >
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLangChange(lang.code)}
                      className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between"
                      style={{
                        color: languageMatches(lang.code)
                          ? '#851627'
                          : isDark
                            ? 'rgba(255,255,255,0.65)'
                            : 'rgba(0,0,0,0.65)',
                        background: languageMatches(lang.code)
                          ? 'rgba(165,28,48,0.10)'
                          : 'transparent',
                        fontWeight: languageMatches(lang.code) ? 700 : 400,
                      }}
                    >
                      {lang.label}
                      {languageMatches(lang.code) && (
                        <div className="w-1.5 h-1.5 rounded-full bg-c-accent" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => toggleTheme()}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 cursor-pointer"
            style={{
              color: isDark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.40)',
              border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.08)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = isDark
                ? 'rgba(255,255,255,0.07)'
                : 'rgba(0,0,0,0.05)';
              (e.currentTarget as HTMLButtonElement).style.color = isDark ? '#fff' : '#000';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = isDark
                ? 'rgba(255,255,255,0.40)'
                : 'rgba(0,0,0,0.40)';
            }}
            aria-label={
              isDark
                ? t('landing.topBar.switchLight', 'Switch to light mode')
                : t('landing.topBar.switchDark', 'Switch to dark mode')
            }
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Separator */}
          <div
            className="h-4 w-px"
            style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }}
          />

          {/* Log in */}
          <button
            onClick={onLoginClick}
            className="px-4 py-1.5 text-sm font-medium transition-all duration-200 cursor-pointer rounded-full"
            style={{
              color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.60)',
              border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(0,0,0,0.12)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = isDark ? '#fff' : '#000';
              (e.currentTarget as HTMLButtonElement).style.background = isDark
                ? 'rgba(255,255,255,0.07)'
                : 'rgba(0,0,0,0.05)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = isDark
                ? 'rgba(255,255,255,0.65)'
                : 'rgba(0,0,0,0.60)';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            {t('landing.topBar.login', 'Log in')}
          </button>

          {/* Primary public CTA */}
          <button
            onClick={onTrialClick}
            className="px-5 py-1.5 rounded-full text-sm font-semibold text-white transition-all duration-200 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #A51C30, #851627)',
              boxShadow: '0 0 20px -6px rgba(165,28,48,0.60)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '0.88';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '1';
            }}
          >
            {t('landing.topBar.trial', 'Start trial')}
          </button>
        </div>

        {/* ── Mobile menu toggle ── */}
        <div className="md:hidden" ref={mobileMenuRef}>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-full transition-colors"
            data-testid="landing-mobile-menu-trigger"
            style={{
              color: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.60)',
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            }}
            aria-label={
              isMobileMenuOpen
                ? t('common.closeMenu', 'Close menu')
                : t('common.openMenu', 'Open menu')
            }
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="absolute top-full left-0 right-0 shadow-2xl"
                data-testid="landing-mobile-menu-panel"
                style={{
                  background: isDark ? 'rgba(10,8,30,0.96)' : 'rgba(255,255,255,0.97)',
                  borderBottom: isDark
                    ? '1px solid rgba(255,255,255,0.08)'
                    : '1px solid rgba(0,0,0,0.06)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <nav className="flex flex-col p-4 gap-2 max-w-7xl mx-auto">
                  {navLinks.map((link) => (
                    <button
                      key={link.href}
                      onClick={() => {
                        navigate(link.href);
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 rounded-full text-sm font-medium transition-all"
                      style={{
                        color: isDark ? 'rgba(255,255,255,0.68)' : 'rgba(0,0,0,0.68)',
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        border: isDark
                          ? '1px solid rgba(255,255,255,0.08)'
                          : '1px solid rgba(0,0,0,0.06)',
                      }}
                    >
                      {link.label}
                    </button>
                  ))}

                  <div
                    className="h-px my-1"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    }}
                  />

                  {[
                    {
                      label: t('partner.becomePartner', 'Become Partner'),
                      onClick: () => {
                        navigate(ROUTES.BECOME_PARTNER);
                        setIsMobileMenuOpen(false);
                      },
                    },
                    {
                      label: t('landing.topBar.demo', 'Try demo'),
                      onClick: () => {
                        onDemoClick();
                        setIsMobileMenuOpen(false);
                      },
                    },
                    {
                      label: t('landing.topBar.login', 'Log in'),
                      onClick: () => {
                        onLoginClick();
                        setIsMobileMenuOpen(false);
                      },
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.onClick}
                      className="w-full text-left px-4 py-2.5 rounded-full text-sm font-medium transition-all"
                      style={{
                        color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)',
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        border: isDark
                          ? '1px solid rgba(255,255,255,0.08)'
                          : '1px solid rgba(0,0,0,0.06)',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}

                  <button
                    onClick={() => {
                      onTrialClick();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full px-4 py-2.5 rounded-full text-sm font-semibold text-white text-center transition-all"
                    style={{ background: 'linear-gradient(135deg, #A51C30, #851627)' }}
                  >
                    {t('landing.topBar.trial', 'Start trial')}
                  </button>

                  {/* Language + theme row */}
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      onClick={() => toggleTheme()}
                      className="text-xs px-3 py-1 rounded-full border transition-colors font-medium flex items-center gap-1"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
                        color: isDark ? 'rgba(255,255,255,0.50)' : 'rgba(0,0,0,0.50)',
                      }}
                      aria-label={
                        isDark
                          ? t('landing.topBar.switchLight', 'Switch to light mode')
                          : t('landing.topBar.switchDark', 'Switch to dark mode')
                      }
                    >
                      {isDark ? <Sun size={12} /> : <Moon size={12} />}
                      <span>
                        {isDark
                          ? t('landing.topBar.lightMode', 'Light')
                          : t('landing.topBar.darkMode', 'Dark')}
                      </span>
                    </button>
                    {languages.slice(0, 3).map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleLangChange(lang.code)}
                        className="text-xs px-3 py-1 rounded-full border transition-colors font-medium"
                        style={{
                          background: languageMatches(lang.code)
                            ? 'rgba(165,28,48,0.15)'
                            : 'transparent',
                          borderColor: languageMatches(lang.code)
                            ? 'rgba(165,28,48,0.40)'
                            : isDark
                              ? 'rgba(255,255,255,0.12)'
                              : 'rgba(0,0,0,0.10)',
                          color: languageMatches(lang.code)
                            ? '#851627'
                            : isDark
                              ? 'rgba(255,255,255,0.50)'
                              : 'rgba(0,0,0,0.50)',
                        }}
                      >
                        {lang.displayCode}
                      </button>
                    ))}
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
