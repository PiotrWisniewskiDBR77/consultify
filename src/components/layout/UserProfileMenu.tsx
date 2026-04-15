import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  CreditCard,
  Eye,
  FlaskConical,
  Languages,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Sun,
  UserCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDemo } from '../../hooks/useDemo';
import { changeLanguage, normalizeLanguageCode, SUPPORTED_LANGUAGES } from '../../i18n';
import { tokenService } from '../../services/tokenService';
import { useAppStore } from '../../store/useAppStore';
import { AppView, SessionMode } from '../../types';

interface OrgItem {
  id: string;
  name: string;
  role: string;
  access_type?: string;
  is_current?: boolean;
}

interface UserProfileMenuProps {
  className?: string;
  showName?: boolean;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({
  className = '',
  showName = true,
}) => {
  const { currentUser, setCurrentView, logout, theme, toggleTheme, sessionMode, setSessionMode } =
    useAppStore();
  const { isDemoMode, demoExperienceType, demoOrganization, isDemoLoading, toggleDemoMode } = useDemo();
  const setCurrentOrganization = useAppStore((s) => s.setCurrentOrganization);
  const currentOrganization = useAppStore((s) => s.currentOrganization);

  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [showOrgList, setShowOrgList] = useState(false);
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowOrgList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchOrgs = useCallback(async () => {
    if (orgsLoading || orgs.length > 0) return;
    setOrgsLoading(true);
    try {
      const token = tokenService.getToken();
      const res = await fetch('/api/organizations/current', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      const list: OrgItem[] = data.organizations || data || [];
      setOrgs(list);
    } catch {
      // silent
    } finally {
      setOrgsLoading(false);
    }
  }, [orgsLoading, orgs.length]);

  const handleSwitchOrg = useCallback(async (orgId: string, orgName: string) => {
    setSwitchingOrgId(orgId);
    try {
      const token = tokenService.getToken();
      const res = await fetch('/api/auth/switch-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ organizationId: orgId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to switch');
      }
      const data = await res.json();
      tokenService.saveTokens(data.token, data.refreshToken);
      localStorage.setItem('consultify_current_org_id', orgId);
      setCurrentOrganization({ id: data.organization.id, name: data.organization.name });
      toast.success(`Switched to ${data.organization.name}`);
      setTimeout(() => { window.location.href = window.location.pathname; }, 300);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to switch organization');
      setSwitchingOrgId(null);
    }
  }, [setCurrentOrganization]);

  const handleNavigate = (view: AppView) => {
    setCurrentView(view);
    setIsOpen(false);
  };

  const handleLanguageChange = async (lang: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    await changeLanguage(lang);
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    setCurrentView(AppView.WELCOME);
  };

  if (!currentUser) return null;

  const initials =
    `${currentUser.firstName?.[0] || ''}${currentUser.lastName?.[0] || ''}`.toUpperCase();
  const activeOrganizationName =
    (isDemoMode ? demoOrganization?.name : currentOrganization?.name) || currentUser.companyName || 'Workspace';
  const roleLabel = currentUser.role?.toLowerCase();
  const activeOrganizationId =
    (isDemoMode ? demoOrganization?.id : currentOrganization?.id) || currentUser.organizationId || null;
  const shouldShowOrgSwitcher = !isDemoMode;

  useEffect(() => {
    if (!isOpen || !shouldShowOrgSwitcher || orgsLoading || orgs.length > 0) return;
    void fetchOrgs();
  }, [fetchOrgs, isOpen, orgs.length, orgsLoading, shouldShowOrgSwitcher]);

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg p-1 transition-colors cursor-pointer text-left focus:outline-none"
      >
        {showName && (
          <div className="text-right hidden md:block">
            <div className="text-xs font-semibold text-navy-900 dark:text-white">
              {currentUser.firstName} {currentUser.lastName}
            </div>
            <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider max-w-[220px]">
              <span className="truncate">{roleLabel}</span>
              <span>·</span>
              <span className="truncate max-w-[140px]">{activeOrganizationName}</span>
            </div>
          </div>
        )}

        <div className="w-8 h-8 rounded-full bg-transparent border border-slate-300 dark:border-navy-600 flex items-center justify-center relative overflow-hidden">
          {currentUser.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt="Profile"
              className="w-full h-full rounded-full object-cover"
            />
          ) : initials ? (
            <div className="w-full h-full rounded-full bg-transparent flex items-center justify-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {initials}
            </div>
          ) : (
            <UserCircle size={20} className="text-slate-400 dark:text-slate-500" />
          )}
        </div>
      </button>

      {/* Profile Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
          {/* Header with User Info */}
          <div className="px-4 py-4 border-b border-slate-100 dark:border-navy-700 bg-slate-50/50 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center text-slate-500 dark:text-slate-400 overflow-hidden shrink-0 border border-slate-300 dark:border-navy-600">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : initials ? (
                  <div className="w-full h-full rounded-full bg-transparent flex items-center justify-center text-sm font-medium text-slate-500 dark:text-slate-400">
                    {initials}
                  </div>
                ) : (
                  <UserCircle size={24} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-navy-900 dark:text-white truncate">
                  {currentUser.firstName} {currentUser.lastName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate mb-1">
                  {currentUser.email}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 capitalize border border-purple-200 dark:border-purple-500/20">
                    {roleLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-700 max-w-full">
                    <Building2 size={11} />
                    <span className="truncate max-w-[150px]">{activeOrganizationName}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {shouldShowOrgSwitcher && (
            <div className="p-2 border-b border-slate-100 dark:border-navy-700">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!showOrgList) void fetchOrgs();
                  setShowOrgList(!showOrgList);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  showOrgList
                    ? 'bg-purple-50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-300'
                    : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {t('settings.menu.switchOrg', 'Switch Organization')}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-sm font-medium">
                      <Building2 size={14} />
                      <span className="truncate">{activeOrganizationName}</span>
                    </div>
                  </div>
                  {showOrgList ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {showOrgList && (
                <div className="mx-1 mt-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50/50 dark:bg-white/[0.02] overflow-hidden">
                  {orgsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 size={16} className="animate-spin text-slate-400" />
                      <span className="ml-2 text-xs text-slate-400">
                        {t('common.loading', 'Loading...')}
                      </span>
                    </div>
                  ) : orgs.length === 0 ? (
                    <div className="py-3 px-3 text-xs text-slate-400 dark:text-slate-500 text-center">
                      {t('common.noOrganizations', 'No organizations found')}
                    </div>
                  ) : (
                    <div className="max-h-52 overflow-y-auto py-1">
                      {orgs.map((org) => {
                        const isCurrent = org.id === activeOrganizationId || org.is_current;
                        const isSwitching = switchingOrgId === org.id;
                        return (
                          <button
                            key={org.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isCurrent && !switchingOrgId) {
                                handleSwitchOrg(org.id, org.name);
                              }
                            }}
                            disabled={!!switchingOrgId}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors
                              ${isCurrent
                                ? 'bg-purple-100/60 dark:bg-purple-900/20'
                                : 'hover:bg-white dark:hover:bg-white/5'}
                              disabled:opacity-50`}
                          >
                            <div className="w-4 shrink-0 flex items-center justify-center">
                              {isSwitching ? (
                                <Loader2 size={13} className="animate-spin text-purple-500" />
                              ) : isCurrent ? (
                                <Check size={14} className="text-purple-500" />
                              ) : null}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div
                                className={`text-sm truncate ${
                                  isCurrent
                                    ? 'font-semibold text-purple-700 dark:text-purple-300'
                                    : 'text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {org.name}
                              </div>
                            </div>

                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${
                                org.role === 'OWNER'
                                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20'
                                  : org.role === 'ADMIN'
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                                    : org.role === 'CONSULTANT'
                                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                                      : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20'
                              }`}
                            >
                              {org.role}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Settings Section */}
          <div className="p-2 border-b border-slate-100 dark:border-navy-700">
            <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              {t('settings.menu.preferences', 'Preferences')}
            </div>

            {/* Theme Toggle */}
            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Sun size={16} className="hidden dark:block" />
                <Moon size={16} className="dark:hidden" />
                <span>{t('settings.menu.theme', 'Theme')}</span>
              </div>
              <div className="flex bg-slate-100 dark:bg-navy-950 rounded-lg p-1 border border-slate-200 dark:border-navy-700">
                {(['light', 'system', 'dark'] as const).map((tMode) => (
                  <button
                    key={tMode}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTheme(tMode);
                    }}
                    className={`p-1.5 rounded-md transition-all ${
                      theme === tMode
                        ? 'bg-white dark:bg-navy-800 shadow-sm text-purple-600 dark:text-purple-400'
                        : 'text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300'
                    }`}
                    title={tMode.charAt(0).toUpperCase() + tMode.slice(1)}
                  >
                    {tMode === 'light' && <Sun size={14} />}
                    {tMode === 'dark' && <Moon size={14} />}
                    {tMode === 'system' && <Monitor size={14} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Toggle */}
            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Languages size={16} />
                <span>{t('settings.menu.language', 'Language')}</span>
              </div>
              <div className="flex gap-1">
                {(() => {
                  // SuperAdmin: only Polish and English
                  // Regular users: all supported languages
                  const isSuperAdmin = currentUser?.role?.toUpperCase() === 'SUPERADMIN';
                  const availableLanguages = isSuperAdmin
                    ? SUPPORTED_LANGUAGES.filter((lang) => ['en', 'pl'].includes(lang))
                    : SUPPORTED_LANGUAGES;
                  return availableLanguages;
                })().map((lang) => (
                  <button
                    key={lang}
                    onClick={(e) => {
                      void handleLanguageChange(lang, e);
                    }}
                    className={`text-[10px] px-2 py-1 rounded border transition-colors font-medium uppercase min-w-[32px] ${
                      (normalizeLanguageCode(i18n.resolvedLanguage || i18n.language) || 'en') ===
                      lang
                        ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-500/30 dark:text-purple-300'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-navy-700 dark:hover:bg-white/5 dark:text-slate-400'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Demo entry - available for regular workspace users */}
            {currentUser.role?.toUpperCase() !== 'SUPERADMIN' && (
              <div
                className={`rounded-lg transition-colors ${isDemoMode ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
              >
                <div className="flex items-center justify-between px-2 py-1.5">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <FlaskConical size={16} className={isDemoMode ? 'text-indigo-500' : ''} />
                    <div>
                      <span className="font-medium">
                        {isDemoMode
                          ? demoExperienceType === 'workspace_demo'
                            ? t('settings.menu.demoModeExitWorkspace', 'Exit Sample Workspace')
                            : t('settings.menu.demoModeExit', 'Exit Demo')
                          : t('settings.menu.demoMode', 'Open Sample Workspace')}
                      </span>
                      {isDemoMode && demoOrganization && (
                        <div className="text-[10px] text-indigo-500 dark:text-indigo-400 truncate max-w-[120px]">
                          {demoOrganization.name}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await toggleDemoMode(undefined, { source: 'profile_menu' });
                      setIsOpen(false);
                      setTimeout(() => {
                        window.location.href = window.location.pathname;
                      }, 450);
                    }}
                    disabled={isDemoLoading}
                    className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${
                      isDemoMode
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                        : 'bg-slate-300 dark:bg-navy-700'
                    }`}
                    title={
                      isDemoMode
                        ? t(
                            'settings.menu.demoModeOn',
                            'Sample workspace is on - you are exploring Atelier Toys'
                          )
                        : t(
                            'settings.menu.demoModeOff',
                            'Open the Atelier Toys sample workspace'
                          )
                    }
                  >
                    {isDemoLoading ? (
                      <span className="absolute top-0.5 left-0.5 w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white dark:bg-navy-900 rounded-full shadow transition-transform ${
                          isDemoMode ? 'translate-x-5' : ''
                        }`}
                      />
                    )}
                  </button>
                </div>
                {isDemoMode && (
                  <div className="px-2 pb-1.5 text-[10px] text-indigo-600 dark:text-indigo-400">
                    {t('settings.menu.demoReadOnly', 'Sample data - read only')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <div className="p-2 space-y-0.5">
            <button
              onClick={() => handleNavigate(AppView.SETTINGS_PROFILE)}
              className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 rounded-lg transition-colors"
            >
              <UserCircle size={16} />
              {t('settings.menu.myProfile', 'My Profile')}
            </button>
            <button
              onClick={() => handleNavigate(AppView.SETTINGS_BILLING)}
              className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 rounded-lg transition-colors"
            >
              <CreditCard size={16} />
              {t('settings.menu.billing', 'Billing & Plans')}
            </button>
            <button
              onClick={() => handleNavigate(AppView.SETTINGS_AI)}
              className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 rounded-lg transition-colors"
            >
              <Cpu size={16} />
              {t('settings.menu.aiConfig', 'AI Configuration')}
            </button>

            <div className="my-1 border-t border-slate-100 dark:border-navy-700 opacity-50"></div>

            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              {t('sidebar.logOut', 'Log Out')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
