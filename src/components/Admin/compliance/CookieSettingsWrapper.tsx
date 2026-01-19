/**
 * CookieSettingsWrapper - Wrapper with API integration for Cookie settings
 */
import { RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { CookieSettings, CookieSettingsManager } from './CookieSettingsManager';

const API_URL = import.meta.env.VITE_API_URL || '';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const defaultSettings: CookieSettings = {
  enabled: false,
  bannerTitle: 'We use cookies',
  bannerDescription:
    'We use cookies to improve your experience on our site. By continuing to browse, you agree to our use of cookies.',
  acceptButtonText: 'Accept All',
  rejectButtonText: 'Reject All',
  customizeButtonText: 'Manage Preferences',
  privacyPolicyUrl: '/legal/privacy',
  categories: [],
  position: 'bottom',
  theme: 'auto',
};

export const CookieSettingsWrapper: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CookieSettings>(defaultSettings);

  // Load cookie settings
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/compliance/cookies`, {
        headers: getHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings({
          ...defaultSettings,
          ...data,
        });
      }
    } catch (error) {
      console.error('Failed to load cookie settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Handle settings change (local state update)
  const handleChange = useCallback((newSettings: CookieSettings) => {
    setSettings(newSettings);
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/compliance/cookies`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        toast.success(t('admin.compliance.cookies.saved', 'Cookie settings saved'));
      } else {
        toast.error(t('admin.compliance.cookies.error', 'Failed to save cookie settings'));
      }
    } catch (error) {
      toast.error(t('admin.compliance.cookies.error', 'Failed to save cookie settings'));
    } finally {
      setSaving(false);
    }
  }, [settings, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return <CookieSettingsManager settings={settings} onChange={handleChange} onSave={handleSave} />;
};

export default CookieSettingsWrapper;
