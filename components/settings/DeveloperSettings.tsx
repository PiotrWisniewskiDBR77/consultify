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
import { User } from '../../types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
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

export const DeveloperSettings: React.FC<DeveloperSettingsProps> = ({ currentUser, showBetaFeatures = false }) => {
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
    const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([
        { key: 'ENABLE_ANALYTICS', value: true, type: 'boolean', description: 'Enable analytics tracking' },
        { key: 'MAX_UPLOAD_SIZE_MB', value: 50, type: 'number', description: 'Maximum file upload size' },
        { key: 'API_VERSION', value: 'v2', type: 'string', description: 'Current API version' },
        { key: 'ENABLE_WEBSOCKETS', value: true, type: 'boolean', description: 'Enable real-time updates' },
        { key: 'DEBUG_MODE', value: false, type: 'boolean', description: 'Enable debug mode' },
    ]);

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

    // Load settings from localStorage
    useEffect(() => {
        const savedSettings = localStorage.getItem('developerSettings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                setDeveloperMode(settings.developerMode || false);
                setApiLogging(settings.apiLogging || false);
                setShowDebugInfo(settings.showDebugInfo || false);
                setVerboseErrors(settings.verboseErrors || false);
            } catch (e) {
                console.error('Failed to parse developer settings:', e);
            }
        }
    }, []);

    // Save settings
    const saveSettings = useCallback(() => {
        localStorage.setItem(
            'developerSettings',
            JSON.stringify({
                developerMode,
                apiLogging,
                showDebugInfo,
                verboseErrors,
            }),
        );
        toast({
            title: t('settings.developer.saved', 'Settings Saved'),
            description: t('settings.developer.savedDesc', 'Developer settings have been updated'),
        });
    }, [developerMode, apiLogging, showDebugInfo, verboseErrors, toast, t]);

    // Toggle beta feature
    const toggleBetaFeature = (featureId: string) => {
        setBetaFeatures((prev) => prev.map((f) => (f.id === featureId ? { ...f, enabled: !f.enabled } : f)));
        toast({
            title: t('settings.beta.updated', 'Feature Updated'),
            description: t('settings.beta.updatedDesc', 'Beta feature setting has been changed'),
        });
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
                                'These settings are intended for developers and may affect app performance.',
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
                                        <Terminal className="w-4 h-4 text-slate-500" />
                                        <span className="font-medium">
                                            {t('settings.developer.mode', 'Developer Mode')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        {t(
                                            'settings.developer.modeDesc',
                                            'Enable developer tools and debugging features',
                                        )}
                                    </p>
                                </div>
                                <Switch checked={developerMode} onCheckedChange={setDeveloperMode} />
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Server className="w-4 h-4 text-slate-500" />
                                        <span className="font-medium">
                                            {t('settings.developer.apiLogging', 'API Logging')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        {t(
                                            'settings.developer.apiLoggingDesc',
                                            'Log all API requests to the browser console',
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
                                        <Bug className="w-4 h-4 text-slate-500" />
                                        <span className="font-medium">
                                            {t('settings.developer.verboseErrors', 'Verbose Errors')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        {t(
                                            'settings.developer.verboseErrorsDesc',
                                            'Show detailed error messages and stack traces',
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
                                        <Eye className="w-4 h-4 text-slate-500" />
                                        <span className="font-medium">
                                            {t('settings.developer.showDebug', 'Show Debug Info')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500">
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
                                            'Current session and environment details',
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
                                'Try out new features before they are released. Beta features may be unstable or change without notice.',
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
                                                        : 'bg-slate-100 dark:bg-slate-800',
                                                )}
                                            >
                                                <Zap
                                                    className={cn(
                                                        'w-5 h-5',
                                                        feature.enabled
                                                            ? 'text-violet-600 dark:text-violet-400'
                                                            : 'text-slate-400',
                                                    )}
                                                />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-medium text-slate-900 dark:text-white">
                                                        {feature.name}
                                                    </h4>
                                                    {getStatusBadge(feature.status)}
                                                </div>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                    {feature.description}
                                                </p>
                                                {feature.releaseDate && (
                                                    <p className="text-xs text-slate-400 mt-2">
                                                        {t(
                                                            'settings.beta.expectedRelease',
                                                            'Expected release: {{date}}',
                                                            { date: feature.releaseDate },
                                                        )}
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
                                'Current feature flag configuration. These are managed by administrators and cannot be changed here.',
                            )}
                        </AlertDescription>
                    </Alert>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">
                                    {t('settings.flags.current', 'Current Configuration')}
                                </CardTitle>
                                <Button variant="ghost" size="sm">
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    {t('common.refresh', 'Refresh')}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
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
                                                <p className="text-xs text-slate-500 mt-0.5">{flag.description}</p>
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
                                                    <ToggleLeft className="w-5 h-5 text-slate-400" />
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
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default DeveloperSettings;
