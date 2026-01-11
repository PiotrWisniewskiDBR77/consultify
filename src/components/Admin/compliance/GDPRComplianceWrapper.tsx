/**
 * GDPRComplianceWrapper - Wrapper with API integration for GDPR dashboard
 */
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { RefreshCw } from 'lucide-react';
import { GDPRComplianceDashboard, GDPRConfig, GDPRFeature } from './GDPRComplianceDashboard';

const API_URL = import.meta.env.VITE_API_URL || '';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

export const GDPRComplianceWrapper: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<GDPRConfig>({
    enabled: false,
    features: [],
    lastUpdated: undefined,
    updatedBy: undefined,
  });

  // Load GDPR settings
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/compliance/gdpr`, {
        headers: getHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig({
          enabled: data.enabled || false,
          features: data.features || [],
          lastUpdated: data.lastUpdated,
          updatedBy: data.updatedBy,
        });
      }
    } catch (error) {
      console.error('Failed to load GDPR settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Handle enable/disable toggle
  const handleToggle = useCallback(
    async (enabled: boolean) => {
      setSaving(true);
      try {
        const res = await fetch(`${API_URL}/api/compliance/gdpr`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            enabled,
            features: config.features,
          }),
        });

        if (res.ok) {
          setConfig((prev) => ({ ...prev, enabled }));
          toast.success(
            enabled
              ? t('admin.compliance.gdpr.enabled', 'GDPR compliance enabled')
              : t('admin.compliance.gdpr.disabled', 'GDPR compliance disabled')
          );
        } else {
          toast.error(t('admin.compliance.gdpr.error', 'Failed to update GDPR settings'));
        }
      } catch (error) {
        toast.error(t('admin.compliance.gdpr.error', 'Failed to update GDPR settings'));
      } finally {
        setSaving(false);
      }
    },
    [config.features, t]
  );

  // Handle feature configuration
  const handleConfigureFeature = useCallback(
    (featureId: string) => {
      // Navigate to feature-specific configuration
      // For now, just show a toast
      toast.success(
        t('admin.compliance.gdpr.configuring', 'Opening configuration for {{feature}}', {
          feature: featureId,
        })
      );
    },
    [t]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <GDPRComplianceDashboard
      config={config}
      onChange={handleToggle}
      onConfigureFeature={handleConfigureFeature}
    />
  );
};

export default GDPRComplianceWrapper;
