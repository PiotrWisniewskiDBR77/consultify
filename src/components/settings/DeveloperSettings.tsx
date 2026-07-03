/**
 * DeveloperSettings - Developer mode and beta features settings
 *
 * Features:
 * - Developer mode toggle
 * - API logging toggle
 * - Debug info display
 * - Beta features management
 * - Feature flags viewer
 */

import {
  AlertTriangle,
  Beaker,
  Check,
  Code2,
  Copy,
  Eye,
  Flag,
  Info,
  RefreshCw,
  Sparkles,
  Terminal,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Api from '../../services/api';
import { User } from '../../types';
import { DegradedState } from '../Admin/AdminState';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/primitives/Button';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useToast } from '../ui/use-toast';

interface FeatureFlag {
  key: string;
  value: boolean | string | number;
  type: 'boolean' | 'string' | 'number';
  description?: string;
}

interface DeveloperSettingsProps {
  currentUser: User;
  showBetaFeatures?: boolean;
}

export const DeveloperSettings: React.FC<DeveloperSettingsProps> = ({
  currentUser,
  showBetaFeatures = false,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(showBetaFeatures ? 'beta' : 'developer');

  // Developer settings state
  // Only toggles with a real runtime consumer are kept:
  //  - developerMode gates the debug controls
  //  - showDebugInfo controls whether the Debug Information card is shown
  // apiLogging / verboseErrors were removed (no interceptor / error-boundary
  // wiring consumed them, so they were fake switches).
  const [developerMode, setDeveloperMode] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Feature flags state
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [featureFlagsLoadError, setFeatureFlagsLoadError] = useState<string | null>(null);

  // Debug info
  const debugInfo = {
    userId: currentUser.id,
    email: currentUser.email,
    role: currentUser.role,
    organizationId: currentUser.organizationId,
    timezone: currentUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
    userAgent: navigator.userAgent.substring(0, 50) + '...',
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    buildVersion: process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev',
    apiEndpoint: process.env.NEXT_PUBLIC_API_URL || '/api',
  };

  const applyPersistedSettings = useCallback((settings: Record<string, unknown>) => {
    setDeveloperMode(Boolean(settings.developerMode));
    setShowDebugInfo(Boolean(settings.showDebugInfo));
  }, []);

  const refreshDeveloperSettings = useCallback(async () => {
    const response = await Api.getDeveloperSettings();
    if (response?.settings) {
      applyPersistedSettings(response.settings);
    }
  }, [applyPersistedSettings]);

  const refreshFeatureFlags = useCallback(async () => {
    setFeatureFlagsLoadError(null);
    const response = await Api.getFeatureFlags();
    const flags = Array.isArray(response) ? response : response?.flags;
    if (!Array.isArray(flags)) {
      throw new Error('Feature flags response was invalid');
    }
    setFeatureFlags(
      flags.map((flag: any) => ({
        key: flag.key || flag.name,
        value: flag.value ?? flag.enabled,
        type:
          flag.type ||
          (typeof (flag.value ?? flag.enabled) === 'number'
            ? 'number'
            : typeof (flag.value ?? flag.enabled) === 'string'
              ? 'string'
              : 'boolean'),
        description: flag.description,
      }))
    );
  }, []);

  const getFeatureFlagDescription = (flag: FeatureFlag) =>
    t(`settings.flags.descriptions.${flag.key}`, flag.description || '');

  // Load settings from backend API
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [developerResult, flagsResult] = await Promise.allSettled([
          refreshDeveloperSettings(),
          refreshFeatureFlags(),
        ]);
        if (developerResult.status === 'rejected') {
          throw developerResult.reason;
        }
        if (flagsResult.status === 'rejected') {
          setFeatureFlags([]);
          setFeatureFlagsLoadError(
            flagsResult.reason instanceof Error
              ? flagsResult.reason.message
              : 'Failed to load feature flags'
          );
        }
      } catch (e) {
        console.error('Failed to load developer settings:', e);
      }
    };
    loadSettings();
  }, [refreshDeveloperSettings, refreshFeatureFlags]);

  // Save settings to backend API
  const saveSettings = useCallback(async () => {
    try {
      await Api.saveDeveloperSettings({
        developerMode,
        showDebugInfo,
      });
      await refreshDeveloperSettings();
      toast({
        title: t('settings.developer.saved', 'Settings Saved'),
        description: t(
          'settings.developer.savedDesc',
          'Developer settings have been saved to your account'
        ),
      });
    } catch (error) {
      console.error('Failed to save developer settings:', error);
      toast({
        title: t('settings.developer.error', 'Error'),
        description: t('settings.developer.errorDesc', 'Failed to save developer settings'),
        variant: 'destructive',
      });
    }
  }, [developerMode, showDebugInfo, refreshDeveloperSettings, toast, t]);

  // Copy debug info
  const copyDebugInfo = () => {
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    toast({
      title: t('settings.developer.copied', 'Copied'),
      description: t('settings.developer.copiedDesc', 'Debug info copied to clipboard'),
    });
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="developer" className="flex items-center gap-2">
            <Code2 className="w-4 h-4" />
            {t('settings.developer.tab', 'Developer Mode')}
          </TabsTrigger>
          <TabsTrigger value="beta" className="flex items-center gap-2">
            <Beaker className="w-4 h-4" />
            {t('settings.beta.tab', 'Beta Features')}
          </TabsTrigger>
          <TabsTrigger value="flags" className="flex items-center gap-2">
            <Flag className="w-4 h-4" />
            {t('settings.flags.tab', 'Feature Flags')}
          </TabsTrigger>
        </TabsList>

        {/* Developer Mode Tab */}
        <TabsContent value="developer" className="space-y-6 mt-6">
          <Alert
            variant="default"
            className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
          >
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">
              {t('settings.developer.warning', 'Developer Mode')}
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              {t(
                'settings.developer.warningDesc',
                'These settings are intended for developers and may affect app performance.'
              )}
            </AlertDescription>
          </Alert>

          {/* Developer Options */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.developer.options', 'Developer Options')}</CardTitle>
              <CardDescription>
                {t('settings.developer.optionsDesc', 'Configure developer-specific settings')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-c-text-muted" />
                    <span className="font-medium">
                      {t('settings.developer.mode', 'Developer Mode')}
                    </span>
                  </div>
                  <p className="text-sm text-c-text-muted">
                    {t(
                      'settings.developer.modeDesc',
                      'Enable developer tools and debugging features'
                    )}
                  </p>
                </div>
                <Switch checked={developerMode} onCheckedChange={setDeveloperMode} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-c-text-muted" />
                    <span className="font-medium">
                      {t('settings.developer.showDebug', 'Show Debug Info')}
                    </span>
                  </div>
                  <p className="text-sm text-c-text-muted">
                    {t(
                      'settings.developer.showDebugDesc',
                      'Display the debug information panel below'
                    )}
                  </p>
                </div>
                <Switch
                  checked={showDebugInfo}
                  onCheckedChange={setShowDebugInfo}
                  disabled={!developerMode}
                />
              </div>
            </CardContent>
          </Card>

          {/* Debug Info — only shown when the Show Debug Info toggle is on */}
          {developerMode && showDebugInfo && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('settings.developer.debugInfo', 'Debug Information')}</CardTitle>
                    <CardDescription>
                      {t(
                        'settings.developer.debugInfoDesc',
                        'Current session and environment details'
                      )}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyDebugInfo}>
                    <Copy className="w-4 h-4 mr-2" />
                    {t('common.copy', 'Copy')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-c-surface rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <pre className="text-emerald-400">{JSON.stringify(debugInfo, null, 2)}</pre>
                </div>
              </CardContent>
            </Card>
          )}

          <Button onClick={saveSettings}>
            <Check className="w-4 h-4 mr-2" />
            {t('settings.developer.save', 'Save Developer Settings')}
          </Button>
        </TabsContent>

        {/* Beta Features Tab */}
        <TabsContent value="beta" className="space-y-6 mt-6">
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>{t('settings.beta.title', 'Beta Features')}</AlertTitle>
            <AlertDescription>
              {t(
                'settings.beta.description',
                'Try out new features before they are released. Beta features may be unstable or change without notice.'
              )}
            </AlertDescription>
          </Alert>

          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="p-3 rounded-full bg-c-surface-raised">
                <Beaker className="w-6 h-6 text-c-text-muted" />
              </div>
              <h4 className="font-medium text-c-text">
                {t('settings.beta.emptyTitle', 'No beta features available right now')}
              </h4>
              <p className="max-w-sm text-sm text-c-text-muted">
                {t(
                  'settings.beta.emptyDesc',
                  'There are no opt-in beta features for your account at the moment. New experimental features will appear here when they become available.'
                )}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Flags Tab */}
        <TabsContent value="flags" className="space-y-6 mt-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>{t('settings.flags.title', 'Feature Flags')}</AlertTitle>
            <AlertDescription>
              {t(
                'settings.flags.description',
                'Current feature flag configuration. These are managed by administrators and cannot be changed here.'
              )}
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {t('settings.flags.current', 'Current Configuration')}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    refreshFeatureFlags().catch((error) => {
                      setFeatureFlags([]);
                      setFeatureFlagsLoadError(
                        error instanceof Error ? error.message : 'Failed to load feature flags'
                      );
                    })
                  }
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('common.refresh', 'Refresh')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {featureFlagsLoadError ? (
                <DegradedState
                  title="Feature flags unavailable"
                  description={featureFlagsLoadError}
                />
              ) : (
                <div className="space-y-3">
                  {featureFlags.map((flag) => (
                    <div
                      key={flag.key}
                      className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg"
                    >
                      <div>
                        <code className="text-sm font-mono text-c-accent">
                          {flag.key}
                        </code>
                        {flag.description && (
                          <p className="text-xs text-c-text-muted mt-0.5">
                            {getFeatureFlagDescription(flag)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {flag.type}
                        </Badge>
                        {flag.type === 'boolean' ? (
                          flag.value ? (
                            <ToggleRight className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-c-text-secondary" />
                          )
                        ) : (
                          <span className="text-sm font-mono text-c-text-secondary">
                            {String(flag.value)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DeveloperSettings;
