/**
 * useNotificationPreferences Hook - Notification settings management
 * Part of My Work Module PMO Upgrade
 */

import { useState, useCallback, useEffect } from 'react';
import { Api } from '../services/api';
import type { NotificationPreferences, NotificationCategory, ChannelSettings } from '../types/myWork';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface UseNotificationPreferencesOptions {
    autoLoad?: boolean;
}

interface UseNotificationPreferencesReturn {
    // State
    preferences: NotificationPreferences | null;
    loading: boolean;
    saving: boolean;
    error: Error | null;
    
    // Actions
    loadPreferences: () => Promise<void>;
    savePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
    updateCategoryChannel: (category: NotificationCategory, channel: keyof ChannelSettings, enabled: boolean) => Promise<void>;
    updateQuietHours: (enabled: boolean, start?: string, end?: string) => Promise<void>;
    updateDigestSettings: (type: 'daily' | 'weekly', settings: { enabled?: boolean; time?: string; day?: string }) => Promise<void>;
}

/**
 * Hook for managing notification preferences
 */
export function useNotificationPreferences(options: UseNotificationPreferencesOptions = {}): UseNotificationPreferencesReturn {
    const { autoLoad = true } = options;
    const { t } = useTranslation();
    
    const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    
    // Load preferences
    const loadPreferences = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await Api.get('/notifications/preferences');
            
            if (response?.preferences) {
                setPreferences(response.preferences);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load preferences');
            setError(error);
            console.error('useNotificationPreferences load error:', error);
        } finally {
            setLoading(false);
        }
    }, []);
    
    // Save preferences
    const savePreferences = useCallback(async (prefs: Partial<NotificationPreferences>) => {
        try {
            setSaving(true);
            
            const response = await Api.put('/notifications/preferences', { preferences: prefs });
            
            if (response?.preferences) {
                setPreferences(response.preferences);
            }
            
            toast.success(t('myWork.notifications.preferencesSaved', 'Preferences saved'));
        } catch (err) {
            console.error('Save preferences error:', err);
            toast.error(t('myWork.notifications.error', 'Failed to save preferences'));
            throw err;
        } finally {
            setSaving(false);
        }
    }, [t]);
    
    // Update single category channel
    const updateCategoryChannel = useCallback(async (
        category: NotificationCategory, 
        channel: keyof ChannelSettings, 
        enabled: boolean
    ) => {
        if (!preferences) return;
        
        const currentCategory = preferences.categories[category] || { inapp: true, push: false, email: false };
        const updatedCategory = { ...currentCategory, [channel]: enabled };
        
        // Optimistic update
        setPreferences(prev => prev ? {
            ...prev,
            categories: {
                ...prev.categories,
                [category]: updatedCategory
            }
        } : null);
        
        await savePreferences({
            categories: {
                ...preferences.categories,
                [category]: updatedCategory
            }
        });
    }, [preferences, savePreferences]);
    
    // Update quiet hours
    const updateQuietHours = useCallback(async (
        enabled: boolean, 
        start?: string, 
        end?: string
    ) => {
        if (!preferences) return;
        
        const updatedQuietHours = {
            ...preferences.quietHours,
            enabled,
            ...(start && { start }),
            ...(end && { end })
        };
        
        // Optimistic update
        setPreferences(prev => prev ? {
            ...prev,
            quietHours: updatedQuietHours
        } : null);
        
        await savePreferences({ quietHours: updatedQuietHours });
    }, [preferences, savePreferences]);
    
    // Update digest settings
    const updateDigestSettings = useCallback(async (
        type: 'daily' | 'weekly',
        settings: { enabled?: boolean; time?: string; day?: string }
    ) => {
        if (!preferences) return;
        
        const key = type === 'daily' ? 'dailyDigest' : 'weeklyDigest';
        const currentSettings = preferences[key];
        const updatedSettings = { ...currentSettings, ...settings };
        
        // Optimistic update
        setPreferences(prev => prev ? {
            ...prev,
            [key]: updatedSettings
        } : null);
        
        await savePreferences({ [key]: updatedSettings });
    }, [preferences, savePreferences]);
    
    // Auto-load on mount
    useEffect(() => {
        if (autoLoad) {
            loadPreferences();
        }
    }, [loadPreferences, autoLoad]);
    
    return {
        // State
        preferences,
        loading,
        saving,
        error,
        
        // Actions
        loadPreferences,
        savePreferences,
        updateCategoryChannel,
        updateQuietHours,
        updateDigestSettings
    };
}

export default useNotificationPreferences;

