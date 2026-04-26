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
  Bug,
  Check,
  Code2,
  Copy,
  Eye,
  EyeOff,
  FileCode,
  Flag,
  Info,
  RefreshCw,
  Server,
  Sparkles,
  Terminal,
  ToggleLeft,
  ToggleRight,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';
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

interface BetaFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  releaseDate?: string;
  status: 'alpha' | 'beta' | 'stable';
}

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
  const [developerMode, setDeveloperMode] = useState(false);
  const [apiLogging, setApiLogging] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [verboseErrors, setVerboseErrors] = useState(false);

  // Beta features state
  const [betaFeatures, setBetaFeatures] = useState<BetaFeature[]>([
    {
      id: 'ai-v2',
      name: 'AI Chat V2',
      description: 'New conversational AI interface with enhanced context awareness',
      enabled: false,
      status: 'beta',
      releaseDate: '2024-03',
    },
    {
      id: 'collaborative-editing',
      name: 'Collaborative Editing',
      description: 'Real-time collaborative document editing with presence indicators',
      enabled: false,
      status: 'alpha',
    },
    {
      id: 'smart-scheduling',
      name: 'Smart Scheduling',
      description: 'AI-powered task scheduling based on your work patterns',
      enabled: true,
      status: 'beta',
      releaseDate: '2024-02',
    },
    {
      id: 'voice-commands',
      name: 'Voice Commands',
      description: 'Control the app using voice commands',
      enabled: false,
      status: 'alpha',
    },
  ]);

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
    const enabledBetaFeatures = Array.isArray(settings.betaFeatures)
      ? (settings.betaFeatures as string[])
      : [];
    setDeveloperMode(Boolean(settings.developerMode));
    setApiLogging(Boolean(settings.apiLogging));
    setShowDebugInfo(Boolean(settings.showDebugInfo));
    setVerboseErrors(Boolean(settings.verboseErrors));
    setBetaFeatures((prev) =>
      prev.map((feature) => ({
        ...feature,
        enabled: enabledBetaFeatures.includes(feature.id),
      }))
    );
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

  const getBetaFeatureName = (feature: BetaFeature) =>
    t(`settings.beta.features.${feature.id}.name`, feature.name);

  const getBetaFeatureDescription = (feature: BetaFeature) =>
    t(`settings.beta.features.${feature.id}.description`, feature.description);

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
      const enabledBetaIds = betaFeatures.filter((f) => f.enabled).map((f) => f.id);
      await Api.saveDeveloperSettings({
        developerMode,
        apiLogging,
        showDebugInfo,
        verboseErrors,
        betaFeatures: enabledBetaIds,
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
  }, [
    developerMode,
    apiLogging,
    showDebugInfo,
    verboseErrors,
    betaFeatures,
    refreshDeveloperSettings,
    toast,
    t,
  ]);

  // Toggle beta feature and save to backend
  const toggleBetaFeature = async (featureId: string) => {
    const newFeatures = betaFeatures.map((f) =>
      f.id === featureId ? { ...f, enabled: !f.enabled } : f
    );
    setBetaFeatures(newFeatures);

    try {
      const enabledBetaIds = newFeatures.filter((f) => f.enabled).map((f) => f.id);
      await Api.saveDeveloperSettings({
        developerMode,
        apiLogging,
        showDebugInfo,
        verboseErrors,
        betaFeatures: enabledBetaIds,
      });
      await refreshDeveloperSettings();
      toast({
        title: t('settings.beta.updated', 'Feature Updated'),
        description: t('settings.beta.updatedDesc', 'Beta feature setting has been saved'),
      });
    } catch (error) {
      console.error('Failed to save beta feature:', error);
      // Revert on error
      setBetaFeatures(betaFeatures);
      toast({
        title: t('settings.beta.error', 'Error'),
        description: t('settings.beta.errorDesc', 'Failed to save beta feature setting'),
        variant: 'destructive',
      });
    }
  };

  // Copy debug info
  const copyDebugInfo = () => {
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    toast({
      title: t('settings.developer.copied', 'Copied'),
      description: t('settings.developer.copiedDesc', 'Debug info copied to clipboard'),
    });
  };

  // Get status badge
  const getStatusBadge = (status: BetaFeature['status']) => {
    switch (status) {
      case 'alpha':
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
          >
            Alpha
          </Badge>
        );
      case 'beta':
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
          >
            Beta
          </Badge>
        );
      case 'stable':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
          >
            Stable
          </Badge>
        );
    }
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
                    <Terminal className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span className="font-medium">
                      {t('settings.developer.mode', 'Developer Mode')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
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
                    <Server className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span className="font-medium">
                      {t('settings.developer.apiLogging', 'API Logging')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t(
                      'settings.developer.apiLoggingDesc',
                      'Log all API requests to the browser console'
                    )}
                  </p>
                </div>
                <Switch
                  checked={apiLogging}
                  onCheckedChange={setApiLogging}
                  disabled={!developerMode}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Bug className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span className="font-medium">
                      {t('settings.developer.verboseErrors', 'Verbose Errors')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t(
                      'settings.developer.verboseErrorsDesc',
                      'Show detailed error messages and stack traces'
                    )}
                  </p>
                </div>
                <Switch
                  checked={verboseErrors}
                  onCheckedChange={setVerboseErrors}
                  disabled={!developerMode}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span className="font-medium">
                      {t('settings.developer.showDebug', 'Show Debug Info')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('settings.developer.showDebugDesc', 'Display debug panel in the app footer')}
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

          {/* Debug Info */}
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
              <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre className="text-emerald-400">{JSON.stringify(debugInfo, null, 2)}</pre>
              </div>
            </CardContent>
          </Card>

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

          <div className="space-y-4">
            {betaFeatures.map((feature) => (
              <Card key={feature.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'p-2 rounded-lg',
                          feature.enabled
                            ? 'bg-violet-100 dark:bg-violet-900/30'
                            : 'bg-slate-100 dark:bg-slate-800'
                        )}
                      >
                        <Zap
                          className={cn(
                            'w-5 h-5',
                            feature.enabled
                              ? 'text-violet-600 dark:text-violet-400'
                              : 'text-slate-400 dark:text-slate-500'
                          )}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-slate-900 dark:text-white">
                            {getBetaFeatureName(feature)}
                          </h4>
                          {getStatusBadge(feature.status)}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {getBetaFeatureDescription(feature)}
                        </p>
                        {feature.releaseDate && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                            {t('settings.beta.expectedRelease', 'Expected release: {{date}}', {
                              date: feature.releaseDate,
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={feature.enabled}
                      onCheckedChange={() => toggleBetaFeature(feature.id)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-800/50 rounded-lg"
                    >
                      <div>
                        <code className="text-sm font-mono text-violet-600 dark:text-violet-400">
                          {flag.key}
                        </code>
                        {flag.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
                            <ToggleLeft className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                          )
                        ) : (
                          <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
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
