/**
 * TrustedDevicesSettings - Manage trusted devices for MFA
 *
 * Features:
 * - List all trusted devices with fingerprint info
 * - Device location, browser, last used
 * - Revoke individual or all devices
 * - Trust duration settings
 */

import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Clock,
  Globe,
  Laptop,
  Loader2,
  MapPin,
  Monitor,
  RefreshCw,
  Settings,
  Shield,
  Smartphone,
  Tablet,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed';
import { LoadingState, StatusChip } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { User } from '../../types';

interface TrustedDevicesSettingsProps {
  currentUser: User;
  className?: string;
}

interface TrustedDevice {
  id: string;
  name: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'laptop' | 'unknown';
  browser: string;
  os: string;
  location: string;
  ip: string;
  fingerprint: string;
  trustedAt: string;
  lastUsed: string;
  expiresAt: string;
  isCurrent: boolean;
}

interface TrustDurationOption {
  value: number;
  label: string;
}

export const TrustedDevicesSettings: React.FC<TrustedDevicesSettingsProps> = ({
  currentUser,
  className = '',
}) => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [trustDuration, setTrustDuration] = useState(30);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [savingDuration, setSavingDuration] = useState(false);

  const durationOptions: TrustDurationOption[] = [
    { value: 7, label: t('security.devices.duration7', '7 days') },
    { value: 14, label: t('security.devices.duration14', '14 days') },
    { value: 30, label: t('security.devices.duration30', '30 days') },
    { value: 60, label: t('security.devices.duration60', '60 days') },
    { value: 90, label: t('security.devices.duration90', '90 days') },
    { value: 0, label: t('security.devices.durationNever', 'Never expire') },
  ];

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const response = await Api.get('/api/mfa/devices');
      if (response?.devices) {
        setDevices(response.devices);
      }
    } catch (error) {
      console.error('Failed to fetch trusted devices:', error);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (
      !confirm(
        t(
          'security.devices.revokeConfirm',
          'Are you sure you want to remove this trusted device? You will need to verify again on next login.'
        )
      )
    ) {
      return;
    }

    setRevoking(deviceId);
    try {
      await Api.delete(`/api/mfa/devices/${deviceId}`);
      setDevices(devices.filter((d) => d.id !== deviceId));
      toast.success(t('security.devices.revokeSuccess', 'Device removed from trusted list'));
    } catch (error) {
      toast.error(t('security.devices.revokeError', 'Failed to remove device'));
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    if (
      !confirm(
        t(
          'security.devices.revokeAllConfirm',
          'Are you sure you want to remove all trusted devices? You will need to verify 2FA on all devices.'
        )
      )
    ) {
      return;
    }

    setRevokingAll(true);
    try {
      await Api.delete('/api/mfa/devices');
      setDevices([]);
      toast.success(
        t('security.devices.revokeAllSuccess', 'All devices removed from trusted list')
      );
    } catch (error) {
      toast.error(t('security.devices.revokeAllError', 'Failed to remove devices'));
    } finally {
      setRevokingAll(false);
    }
  };

  const handleSaveTrustDuration = async (duration: number) => {
    setSavingDuration(true);
    setTrustDuration(duration);
    setShowDurationDropdown(false);

    try {
      await Api.put('/api/mfa/settings', { trustDuration: duration });
      toast.success(t('security.devices.durationSaved', 'Trust duration updated'));
    } catch (error) {
      toast.error(t('security.devices.durationError', 'Failed to update trust duration'));
    } finally {
      setSavingDuration(false);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-6 h-6" />;
      case 'tablet':
        return <Tablet className="w-6 h-6" />;
      case 'laptop':
        return <Laptop className="w-6 h-6" />;
      case 'desktop':
        return <Monitor className="w-6 h-6" />;
      default:
        return <Globe className="w-6 h-6" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) {
      // Future date (expires at)
      const futureDays = Math.abs(diffDays);
      if (futureDays === 0) return t('common.today', 'Today');
      if (futureDays === 1) return t('common.tomorrow', 'Tomorrow');
      return t('common.inDays', 'in {{count}} days', { count: futureDays });
    }

    if (diffHours < 1) return t('common.justNow', 'Just now');
    if (diffHours < 24) return t('common.hoursAgo', '{{count}}h ago', { count: diffHours });
    if (diffDays < 7) return t('common.daysAgo', '{{count}}d ago', { count: diffDays });
    return formatDate(dateString);
  };

  const isExpiringSoon = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffDays = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7 && diffDays > 0;
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Shield className="w-6 h-6 text-c-text" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-c-text">
              {t('security.devices.title', 'Trusted Devices')}
            </h3>
            <p className="text-sm text-c-text-muted">
              {t('security.devices.description', 'Devices that can skip 2FA verification')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDevices}
            className="p-2 text-c-text-muted hover:text-c-text-secondary rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          {devices.length > 0 && (
            <button
              onClick={handleRevokeAll}
              disabled={revokingAll}
              className="px-4 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
            >
              {revokingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('security.devices.revokeAll', 'Revoke All')
              )}
            </button>
          )}
        </div>
      </div>

      {/* Trust Duration Setting */}
      <div className="bg-c-surface-raised rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-c-text-muted" />
            <div>
              <p className="font-medium text-c-text">
                {t('security.devices.trustDuration', 'Trust Duration')}
              </p>
              <p className="text-sm text-c-text-muted">
                {t(
                  'security.devices.trustDurationDesc',
                  'How long devices stay trusted after verification'
                )}
              </p>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowDurationDropdown(!showDurationDropdown)}
              disabled={savingDuration}
              className="flex items-center gap-2 px-4 py-2 bg-c-surface border border-c-border-subtle dark:border-navy-700 rounded-lg hover:border-c-accent dark:hover:border-c-accent transition-colors"
            >
              {savingDuration ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="text-sm font-medium text-c-text-secondary">
                    {durationOptions.find((o) => o.value === trustDuration)?.label}
                  </span>
                  <ChevronDown className="w-4 h-4 text-c-text-muted" />
                </>
              )}
            </button>
            {showDurationDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-c-surface border border-c-border-subtle dark:border-navy-700 rounded-lg shadow-lg z-10">
                {durationOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSaveTrustDuration(option.value)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      trustDuration === option.value
                        ? 'text-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                        : 'text-c-text-secondary'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Devices List */}
      {devices.length === 0 ? (
        <EmptyState
          icon={<Smartphone />}
          title={t('security.devices.noDevices', 'No Trusted Devices')}
          description={t(
            'security.devices.noDevicesDesc',
            'When you verify 2FA and choose to trust a device, it will appear here. Trusted devices can skip 2FA for the trust duration.'
          )}
        />
      ) : (
        <div className="space-y-3">
          {devices.map((device) => (
            <div
              key={device.id}
              className={`bg-c-surface rounded-xl border ${
                device.isCurrent
                  ? 'border-emerald-200 dark:border-emerald-500/30'
                  : isExpiringSoon(device.expiresAt)
                    ? 'border-amber-200 dark:border-amber-500/30'
                    : 'border-c-border-subtle dark:border-navy-700'
              } p-4 transition-all hover:shadow-md`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-xl ${
                      device.isCurrent
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-c-surface-raised text-c-text-muted'
                    }`}
                  >
                    {getDeviceIcon(device.deviceType)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-c-text">
                        {device.name}
                      </h4>
                      {device.isCurrent && (
                        <StatusChip
                          tone="success"
                          label={t('security.devices.current', 'Current Device')}
                        />
                      )}
                      {isExpiringSoon(device.expiresAt) && !device.isCurrent && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {t('security.devices.expiringSoon', 'Expiring soon')}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      <div className="flex items-center gap-2 text-c-text-muted">
                        <Globe className="w-4 h-4" />
                        <span>
                          {device.browser} • {device.os}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-c-text-muted">
                        <MapPin className="w-4 h-4" />
                        <span>{device.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-c-text-muted">
                        <Clock className="w-4 h-4" />
                        <span>
                          {t('security.devices.lastUsed', 'Last used')}:{' '}
                          {formatRelativeTime(device.lastUsed)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-c-text-muted">
                        <CheckCircle className="w-4 h-4" />
                        <span>
                          {t('security.devices.expires', 'Expires')}:{' '}
                          {formatRelativeTime(device.expiresAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {!device.isCurrent && (
                  <button
                    onClick={() => handleRevokeDevice(device.id)}
                    disabled={revoking === device.id}
                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title={t('security.devices.revoke', 'Remove trusted device')}
                  >
                    {revoking === device.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800 dark:text-blue-400 mb-1">
              {t('security.devices.infoTitle', 'About Trusted Devices')}
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t(
                'security.devices.infoDesc',
                'Trusted devices allow you to skip 2FA verification when logging in. If you lose access to a device or suspect unauthorized access, revoke it immediately. We recommend reviewing your trusted devices regularly.'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrustedDevicesSettings;
