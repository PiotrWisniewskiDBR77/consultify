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

import Api from '../services/api';
import { useAppStore } from '../store/useAppStore';

export const useDemo = () => {
  const {
    isDemoMode,
    demoOrganization,
    demoStats,
    demoHints,
    isDemoLoading,
    demoError,
    availableTours,
    setDemoMode,
    setDemoOrganization,
    setDemoStats,
    setDemoHints,
    setDemoLoading,
    setDemoError,
    setAvailableTours,
    resetDemoState,
  } = useAppStore();

  /**
   * Toggle demo mode
   */
  const toggleDemoMode = useCallback(
    async (enabled?: boolean) => {
      const newValue = enabled ?? !isDemoMode;
      setDemoLoading(true);
      setDemoError(null);

      try {
        const response = await Api.toggleDemoMode(newValue);

        if (response.success) {
          setDemoMode(response.isDemoMode);

          if (response.isDemoMode && response.demoOrganization) {
            setDemoOrganization(response.demoOrganization);
            setDemoStats(response.stats || null);
            setDemoHints(response.hints || []);

            toast.success(
              `🎯 Tryb Demo włączony! Przeglądasz dane firmy ${response.demoOrganization.name}`,
              { duration: 4000, icon: '🏢' }
            );
          } else {
            setDemoOrganization(null);
            setDemoStats(null);
            setDemoHints([]);

            toast.success('Tryb demo wyłączony. Wróciłeś do swoich danych.', {
              duration: 3000,
            });
          }
        }
      } catch (error: any) {
        console.error('[useDemo] Toggle failed:', error);
        setDemoError(error.message || 'Nie udało się przełączyć trybu demo');
        toast.error('Błąd przełączania trybu demo');
      } finally {
        setDemoLoading(false);
      }
    },
    [
      isDemoMode,
      setDemoMode,
      setDemoOrganization,
      setDemoStats,
      setDemoHints,
      setDemoLoading,
      setDemoError,
    ]
  );

  /**
   * Fetch demo status on mount
   */
  const fetchDemoStatus = useCallback(async () => {
    try {
      const response = await Api.getDemoStatus();

      if (response.success && response.isDemoMode) {
        setDemoMode(true);
        setDemoOrganization(response.demoOrganization || null);
        setDemoStats(response.stats || null);
      }
    } catch (error) {
      console.error('[useDemo] Status fetch failed:', error);
    }
  }, [setDemoMode, setDemoOrganization, setDemoStats]);

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
   * Initialize demo state on component mount
   */
  useEffect(() => {
    if (isDemoMode) {
      fetchDemoStatus();
    }
  }, []);

  return {
    // State
    isDemoMode,
    demoOrganization,
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
