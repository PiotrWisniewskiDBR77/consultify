import {
  CheckCircle,
  HardDrive,
  Image,
  Info,
  Loader2,
  Save,
  Smartphone,
  Video,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { PerformancePreferences, User } from '../../types';

interface PerformanceSettingsProps {
  currentUser: User;
  onUpdate?: () => void;
}

const IMAGE_QUALITY_OPTIONS = [
  { value: 'low', label: 'Low', desc: 'Faster loading, lower quality' },
  { value: 'medium', label: 'Medium', desc: 'Balanced quality and speed' },
  { value: 'high', label: 'High', desc: 'Best quality, slower loading' },
  { value: 'original', label: 'Original', desc: 'No compression' },
];

const VIDEO_QUALITY_OPTIONS = [
  { value: 'low', label: 'Low (480p)', desc: 'Minimal bandwidth' },
  { value: 'medium', label: 'Medium (720p)', desc: 'Good quality' },
  { value: 'high', label: 'High (1080p)', desc: 'Best quality' },
  { value: 'auto', label: 'Auto', desc: 'Adapts to connection' },
];

const CACHE_SIZE_OPTIONS = [
  { value: 100, label: '100 MB', desc: 'Minimal cache' },
  { value: 250, label: '250 MB', desc: 'Light usage' },
  { value: 500, label: '500 MB', desc: 'Recommended' },
  { value: 1000, label: '1 GB', desc: 'Heavy usage' },
  { value: 2000, label: '2 GB', desc: 'Maximum offline' },
];

export const PerformanceSettings: React.FC<PerformanceSettingsProps> = ({
  currentUser,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [performance, setPerformance] = useState<PerformancePreferences>({
    imageQuality: 'high',
    videoQuality: 'auto',
    autoLoadImages: true,
    autoLoadVideos: true,
    bandwidthSaverMode: false,
    offlineModeEnabled: false,
    offlineSyncWifiOnly: true,
    cacheSizeMb: 500,
    animationEnabled: true,
    reduceDataUsage: false,
    preloadContent: true,
  });

  // Load preferences
  useEffect(() => {
    loadPerformance();
  }, [currentUser.id]);

  const loadPerformance = async () => {
    try {
      const response = await Api.get('/settings/preferences/performance');
      if (response.preferences) {
        setPerformance((prev: any) => ({ ...prev, ...response.preferences }));
      }
    } catch (error) {
      console.error('Failed to load performance settings:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Api.put('/settings/preferences/performance', performance);
      setSaveStatus('success');
      onUpdate?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save performance settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const enableDataSaver = () => {
    setPerformance({
      imageQuality: 'low',
      videoQuality: 'low',
      autoLoadImages: false,
      autoLoadVideos: false,
      bandwidthSaverMode: true,
      offlineModeEnabled: false,
      offlineSyncWifiOnly: true,
      cacheSizeMb: 250,
      animationEnabled: false,
      reduceDataUsage: true,
      preloadContent: false,
    });
  };

  // Styling
  const cardClass =
    'bg-c-surface border border-c-border-subtle dark:border-navy-700 rounded-lg p-6';
  const sectionTitleClass =
    'text-sm font-bold text-navy-900 mb-4 uppercase tracking-wider flex items-center gap-2';
  const labelClass = 'text-xs font-medium text-c-text-muted';
  const toggleClass = (enabled: boolean) =>
    `relative w-12 h-6 rounded-full transition-colors ${
      enabled ? 'bg-c-accent' : 'bg-c-surface-raised'
    }`;
  const toggleKnobClass = (enabled: boolean) =>
    `absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${enabled ? 'left-7' : 'left-1'}`;

  const ToggleSwitch = ({
    enabled,
    onChange,
    label,
    description,
  }: {
    enabled: boolean;
    onChange: (value: boolean) => void;
    label: string;
    description: string;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-c-border-subtle dark:border-navy-700 last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-navy-900">{label}</p>
        <p className="text-xs text-c-text-muted mt-0.5">{description}</p>
      </div>
      <button onClick={() => onChange(!enabled)} className={toggleClass(enabled)}>
        <span className={toggleKnobClass(enabled)} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-navy-900">
            {t('settings.performance.title', 'Performance & Data')}
          </h3>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.performance.description',
              'Optimize app performance and manage data usage'
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-c-accent hover:bg-c-accent text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-c-accent"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
        </button>
      </div>

      {/* Quick Preset - Data Saver */}
      {!performance.bandwidthSaverMode && (
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                <Wifi size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-300">
                  {t('settings.performance.dataSaver', 'Data Saver Mode')}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-0.5">
                  {t(
                    'settings.performance.dataSaverDesc',
                    'Reduce data usage for slower connections or metered data plans'
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={enableDataSaver}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm whitespace-nowrap transition-colors"
            >
              {t('settings.performance.enableDataSaver', 'Enable')}
            </button>
          </div>
        </div>
      )}

      {performance.bandwidthSaverMode && (
        <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <WifiOff size={20} className="text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-green-900 dark:text-green-300">
                {t('settings.performance.dataSaverActive', 'Data Saver Mode is Active')}
              </p>
              <p className="text-sm text-green-700 dark:text-green-400">
                {t(
                  'settings.performance.dataSaverActiveDesc',
                  'Your settings are optimized for minimal data usage'
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Image Quality */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <Image size={16} className="text-c-accent" />
          {t('settings.performance.imageQuality', 'Image Quality')}
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {IMAGE_QUALITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() =>
                setPerformance((prev: any) => ({ ...prev, imageQuality: option.value as any }))
              }
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                performance.imageQuality === option.value
                  ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                  : 'border-c-border-subtle dark:border-navy-700 hover:border-c-border-subtle'
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  performance.imageQuality === option.value
                    ? 'text-c-accent'
                    : 'text-navy-900'
                }`}
              >
                {option.label}
              </p>
              <p className="text-xs text-c-text-muted mt-0.5">{option.desc}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-1">
          <ToggleSwitch
            enabled={performance.autoLoadImages}
            onChange={(val) => setPerformance((prev: any) => ({ ...prev, autoLoadImages: val }))}
            label={t('settings.performance.autoLoadImages', 'Auto-load images')}
            description={t(
              'settings.performance.autoLoadImagesDesc',
              'Automatically load images when scrolling'
            )}
          />
        </div>
      </div>

      {/* Video Quality */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <Video size={16} className="text-c-accent" />
          {t('settings.performance.videoQuality', 'Video Quality')}
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {VIDEO_QUALITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() =>
                setPerformance((prev: any) => ({ ...prev, videoQuality: option.value as any }))
              }
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                performance.videoQuality === option.value
                  ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                  : 'border-c-border-subtle dark:border-navy-700 hover:border-c-border-subtle'
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  performance.videoQuality === option.value
                    ? 'text-c-accent'
                    : 'text-navy-900'
                }`}
              >
                {option.label}
              </p>
              <p className="text-xs text-c-text-muted mt-0.5">{option.desc}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-1">
          <ToggleSwitch
            enabled={performance.autoLoadVideos}
            onChange={(val) => setPerformance((prev: any) => ({ ...prev, autoLoadVideos: val }))}
            label={t('settings.performance.autoLoadVideos', 'Auto-play videos')}
            description={t(
              'settings.performance.autoLoadVideosDesc',
              'Automatically start video playback'
            )}
          />
        </div>
      </div>

      {/* Cache & Offline */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <HardDrive size={16} className="text-c-accent" />
          {t('settings.performance.cacheOffline', 'Cache & Offline')}
        </h4>

        <div className="space-y-4">
          <div>
            <label className={labelClass + ' mb-2 block'}>
              {t('settings.performance.cacheSize', 'Cache Size')}
            </label>
            <div className="flex flex-wrap gap-2">
              {CACHE_SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setPerformance((prev: any) => ({ ...prev, cacheSizeMb: option.value }))
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    performance.cacheSizeMb === option.value
                      ? 'bg-c-accent-soft dark:bg-c-accent-soft text-c-accent border-2 border-c-accent'
                      : 'bg-c-surface-raised text-c-text-secondary border-2 border-transparent hover:border-c-border-subtle dark:border-navy-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 pt-4 border-t border-c-border-subtle dark:border-navy-700">
            <ToggleSwitch
              enabled={performance.offlineModeEnabled}
              onChange={(val) =>
                setPerformance((prev: any) => ({ ...prev, offlineModeEnabled: val }))
              }
              label={t('settings.performance.offlineMode', 'Enable offline mode')}
              description={t(
                'settings.performance.offlineModeDesc',
                'Cache data for offline access'
              )}
            />
            <ToggleSwitch
              enabled={performance.offlineSyncWifiOnly}
              onChange={(val) =>
                setPerformance((prev: any) => ({ ...prev, offlineSyncWifiOnly: val }))
              }
              label={t('settings.performance.wifiOnlySync', 'Sync only on Wi-Fi')}
              description={t(
                'settings.performance.wifiOnlySyncDesc',
                'Only sync offline data when connected to Wi-Fi'
              )}
            />
            <ToggleSwitch
              enabled={performance.preloadContent}
              onChange={(val) => setPerformance((prev: any) => ({ ...prev, preloadContent: val }))}
              label={t('settings.performance.preloadContent', 'Preload content')}
              description={t(
                'settings.performance.preloadContentDesc',
                'Preload data in the background for faster navigation'
              )}
            />
          </div>
        </div>
      </div>

      {/* Animations */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <Zap size={16} className="text-c-accent" />
          {t('settings.performance.animations', 'Animations & Effects')}
        </h4>

        <div className="space-y-1">
          <ToggleSwitch
            enabled={performance.animationEnabled}
            onChange={(val) => setPerformance((prev: any) => ({ ...prev, animationEnabled: val }))}
            label={t('settings.performance.enableAnimations', 'Enable animations')}
            description={t(
              'settings.performance.enableAnimationsDesc',
              'Smooth transitions and visual effects'
            )}
          />
          <ToggleSwitch
            enabled={performance.reduceDataUsage}
            onChange={(val) => setPerformance((prev: any) => ({ ...prev, reduceDataUsage: val }))}
            label={t('settings.performance.reduceDataUsage', 'Reduce data usage')}
            description={t(
              'settings.performance.reduceDataUsageDesc',
              'Minimize background data transfers'
            )}
          />
        </div>
      </div>

      {/* Info */}
      <div className="bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-c-text-secondary mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-c-text-secondary">
              {t('settings.performance.tip', 'Performance Tip')}
            </h4>
            <p className="text-sm text-c-text-muted mt-1">
              {t(
                'settings.performance.tipText',
                'Lower quality settings and disabled animations can significantly improve performance on older devices or slow connections.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {saveStatus === 'success' && (
        <div className="fixed bottom-8 right-8 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
          <CheckCircle size={16} />
          {t('common.saved', 'Saved!')}
        </div>
      )}
    </div>
  );
};

export default PerformanceSettings;
