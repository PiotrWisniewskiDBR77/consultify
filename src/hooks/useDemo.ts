// @ts-nocheck
/**
 * useDemo Hook
 *
 * Manages demo mode functionality including:
 * - Toggling demo mode on/off
 * - Fetching demo organization info
 * - Tracking demo status
 */
import { useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import Api from '../services/api';
import { normalizeLanguageCode } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import type { DemoExperienceType } from '../store/slices/demoSlice';

const normalizeDemoLocaleClient = (value?: string | null): 'en' | 'pl' | null => {
  const normalized = normalizeLanguageCode(value || '');
  if (normalized === 'pl') return 'pl';
  if (normalized === 'en') return 'en';
  return null;
};

const inferDemoExperienceType = (
  source?: string | null,
  fallback: DemoExperienceType = 'sales_demo'
): DemoExperienceType => {
  const normalized = String(source || '')
    .trim()
    .toLowerCase();

  if (!normalized) return fallback;
  if (normalized.includes('profile_menu') || normalized.includes('workspace')) {
    return 'workspace_demo';
  }
  return 'sales_demo';
};

export const useDemo = () => {
  const { t, i18n } = useTranslation();
  const {
    isDemoMode,
    demoLocale,
    demoExperienceType,
    demoOrganization,
    demoStats,
    demoHints,
    isDemoLoading,
    demoError,
    availableTours,
    setDemoMode,
    setDemoSessionOrgId,
    setDemoExperienceType,
    setDemoLocale,
    setDemoOrganization,
    setDemoStats,
    setDemoHints,
    setDemoLoading,
    setDemoError,
    setAvailableTours,
    resetDemoState,
  } = useAppStore();

  const currentAppLocale = normalizeDemoLocaleClient(i18n.resolvedLanguage || i18n.language) || 'en';
  const isDemoLocaleMismatch = Boolean(demoLocale && demoLocale !== currentAppLocale);

  /**
   * Toggle demo mode
   */
  const toggleDemoMode = useCallback(
    async (enabled?: boolean, options?: { source?: string }) => {
      const newValue = enabled ?? !isDemoMode;
      const source = options?.source || 'demo_toggle';
      setDemoLoading(true);
      setDemoError(null);

      try {
        const response = await Api.toggleDemoMode(newValue, source);

        if (response.success) {
          setDemoMode(response.isDemoMode);

          if (response.isDemoMode && response.demoOrganization) {
            sessionStorage.setItem('demo_entry_source', source);
            setDemoSessionOrgId(response.demoSession?.organizationId || null);
            setDemoExperienceType(
              response.demoExperienceType || inferDemoExperienceType(source, 'workspace_demo')
            );
            setDemoLocale(response.demoLocale || response.demoSession?.locale || currentAppLocale);
            setDemoOrganization(response.demoOrganization);
            setDemoStats(response.stats || null);
            setDemoHints(response.hints || []);

            toast.success(
              t('demo.toast.enabled', {
                defaultValue: 'Demo mode enabled. You are browsing {{organization}}.',
                organization: response.demoOrganization.name,
              }),
              { duration: 4000, icon: '🏢' }
            );
          } else {
            sessionStorage.removeItem('demo_entry_source');
            setDemoSessionOrgId(null);
            setDemoExperienceType(null);
            setDemoLocale(null);
            setDemoOrganization(null);
            setDemoStats(null);
            setDemoHints([]);

            toast.success(t('demo.toast.disabled', 'Demo mode disabled. You are back in your own workspace.'), {
              duration: 3000,
            });
          }
        }
      } catch (error: any) {
        console.error('[useDemo] Toggle failed:', error);
        setDemoError(error.message || t('demo.toast.toggleError', 'Could not switch demo mode'));
        toast.error(t('demo.toast.toggleErrorShort', 'Demo mode toggle failed'));
      } finally {
        setDemoLoading(false);
      }
    },
    [
      currentAppLocale,
      isDemoMode,
      setDemoExperienceType,
      setDemoLocale,
      setDemoMode,
      setDemoSessionOrgId,
      setDemoOrganization,
      setDemoStats,
      setDemoHints,
      setDemoLoading,
      setDemoError,
      t,
    ]
  );

  const clearDemoState = useCallback(() => {
    setDemoMode(false);
    setDemoSessionOrgId(null);
    setDemoExperienceType(null);
    setDemoLocale(null);
    setDemoOrganization(null);
    setDemoStats(null);
    setDemoHints([]);
  }, [
    setDemoExperienceType,
    setDemoHints,
    setDemoLocale,
    setDemoMode,
    setDemoOrganization,
    setDemoSessionOrgId,
    setDemoStats,
  ]);

  /**
   * Fetch demo status on mount
   */
  const fetchDemoStatus = useCallback(async () => {
    try {
      const response = await Api.getDemoStatus();

      if (response.success && response.isDemoMode) {
        setDemoMode(true);
        setDemoSessionOrgId(response.demoSession?.organizationId || null);
        setDemoExperienceType(
          response.demoExperienceType ||
            inferDemoExperienceType(
              sessionStorage.getItem('demo_entry_source'),
              demoExperienceType || 'sales_demo'
            )
        );
        setDemoLocale(response.demoLocale || response.demoSession?.locale || currentAppLocale);
        setDemoOrganization(response.demoOrganization || null);
        setDemoStats(response.stats || null);
        setDemoHints(response.coverage?.map((entry) => entry.ahaMoment).filter(Boolean) || []);
      } else {
        clearDemoState();
      }
    } catch (error) {
      console.error('[useDemo] Status fetch failed:', error);
      clearDemoState();
    }
  }, [
    clearDemoState,
    currentAppLocale,
    demoExperienceType,
    setDemoHints,
    setDemoExperienceType,
    setDemoLocale,
    setDemoMode,
    setDemoOrganization,
    setDemoSessionOrgId,
    setDemoStats,
  ]);

  /**
   * Fetch available tours
   */
  const fetchTours = useCallback(async () => {
    try {
      const response = await Api.getDemoTours();
      if (response.success && response.tours) {
        setAvailableTours(response.tours);
      }
    } catch (error) {
      console.error('[useDemo] Tours fetch failed:', error);
    }
  }, [setAvailableTours]);

  /**
   * Get demo organization info
   */
  const getDemoOrganizationInfo = useCallback(async () => {
    try {
      const response = await Api.getDemoOrganization();
      return response;
    } catch (error) {
      console.error('[useDemo] Org info fetch failed:', error);
      return null;
    }
  }, []);

  /**
   * Exit demo mode
   */
  const exitDemoMode = useCallback(async () => {
    await toggleDemoMode(false);
  }, [toggleDemoMode]);

  /**
   * Always reconcile demo state from the backend after auth/store rehydration.
   * This avoids losing the demo toggle after a fast reload before persisted state lands.
   */
  useEffect(() => {
    fetchDemoStatus();
  }, [fetchDemoStatus]);

  return {
    // State
    isDemoMode,
    demoOrganization,
    demoLocale,
    demoExperienceType,
    isDemoLocaleMismatch,
    demoStats,
    demoHints,
    isDemoLoading,
    demoError,
    availableTours,

    // Actions
    toggleDemoMode,
    exitDemoMode,
    fetchDemoStatus,
    fetchTours,
    getDemoOrganizationInfo,
    resetDemoState,
  };
};

export default useDemo;
