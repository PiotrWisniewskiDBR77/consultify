/**
 * AccessibilitySettings Component
 * 
 * Accessibility preferences for better user experience:
 * - Font size
 * - High contrast mode
 * - Reduce motion
 * - Screen reader optimizations
 * - Keyboard navigation hints
 */

import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { useTranslation } from 'react-i18next';
import { 
    Accessibility, 
    Type, 
    Contrast, 
    Sparkles, 
    Keyboard,
    Volume2,
    Save,
    Loader2,
    Eye,
    MousePointer
} from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { InfoButton } from '../shared/InfoButton';

interface AccessibilitySettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

interface AccessibilityPreferences {
    fontSize: 'small' | 'medium' | 'large' | 'extra-large';
    highContrastMode: boolean;
    reduceMotion: boolean;
    screenReaderOptimized: boolean;
    showKeyboardShortcuts: boolean;
    focusHighlight: boolean;
    cursorSize: 'default' | 'large' | 'extra-large';
    textSpacing: 'default' | 'relaxed' | 'spacious';
    underlineLinks: boolean;
    // New extended options
    colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
    fontFamily: string;
    lineHeight: 'default' | 'relaxed' | 'loose';
    letterSpacing: 'default' | 'wide' | 'wider';
    voiceCommandsEnabled: boolean;
    textToSpeechEnabled: boolean;
    speechToTextEnabled: boolean;
    caretWidth: 'default' | 'thick';
    focusIndicatorStyle: 'default' | 'high-contrast' | 'animated';
}

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
    fontSize: 'medium',
    highContrastMode: false,
    reduceMotion: false,
    screenReaderOptimized: false,
    showKeyboardShortcuts: true,
    focusHighlight: true,
    cursorSize: 'default',
    textSpacing: 'default',
    underlineLinks: false,
    // New defaults
    colorBlindMode: 'none',
    fontFamily: 'system',
    lineHeight: 'default',
    letterSpacing: 'default',
    voiceCommandsEnabled: false,
    textToSpeechEnabled: false,
    speechToTextEnabled: false,
    caretWidth: 'default',
    focusIndicatorStyle: 'default'
};

const FONT_FAMILY_OPTIONS = [
    { value: 'system', label: 'System Default', preview: 'font-sans' },
    { value: 'inter', label: 'Inter', preview: 'font-sans' },
    { value: 'roboto', label: 'Roboto', preview: 'font-sans' },
    { value: 'open-sans', label: 'Open Sans', preview: 'font-sans' },
    { value: 'lato', label: 'Lato', preview: 'font-sans' },
    { value: 'dyslexic', label: 'OpenDyslexic', preview: 'font-serif' },
    { value: 'mono', label: 'Monospace', preview: 'font-mono' },
];

const COLOR_BLIND_OPTIONS = [
    { value: 'none', label: 'None', description: 'No color adjustments' },
    { value: 'protanopia', label: 'Protanopia', description: 'Red-blind (1% of males)' },
    { value: 'deuteranopia', label: 'Deuteranopia', description: 'Green-blind (6% of males)' },
    { value: 'tritanopia', label: 'Tritanopia', description: 'Blue-blind (rare)' },
];

export const AccessibilitySettings: React.FC<AccessibilitySettingsProps> = ({ currentUser, onUpdateUser }) => {
    const { t } = useTranslation();
    const [preferences, setPreferences] = useState<AccessibilityPreferences>(DEFAULT_PREFERENCES);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadPreferences();
    }, [currentUser.id]);

    const loadPreferences = async () => {
        try {
            const data = await Api.get('/settings/preferences/accessibility');
            if (data.preferences) {
                setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
            }
        } catch (error) {
            console.error('Failed to load accessibility preferences:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await Api.put('/settings/preferences/accessibility', { preferences });
            toast.success(t('settings.accessibility.saved', 'Accessibility preferences saved'));
            
            // Apply preferences to document
            applyAccessibilityPreferences(preferences);
        } catch (error) {
            toast.error(t('settings.accessibility.error', 'Failed to save preferences'));
        } finally {
            setSaving(false);
        }
    };

    const applyAccessibilityPreferences = (prefs: AccessibilityPreferences) => {
        const root = document.documentElement;
        
        // Font size
        const fontSizeMap = { 'small': '14px', 'medium': '16px', 'large': '18px', 'extra-large': '20px' };
        root.style.setProperty('--base-font-size', fontSizeMap[prefs.fontSize]);
        
        // High contrast
        root.classList.toggle('high-contrast', prefs.highContrastMode);
        
        // Reduce motion
        root.classList.toggle('reduce-motion', prefs.reduceMotion);
        
        // Underline links
        root.classList.toggle('underline-links', prefs.underlineLinks);
        
        // Color blind mode
        root.classList.remove('colorblind-protanopia', 'colorblind-deuteranopia', 'colorblind-tritanopia');
        if (prefs.colorBlindMode !== 'none') {
            root.classList.add(`colorblind-${prefs.colorBlindMode}`);
        }
        
        // Line height
        const lineHeightMap = { 'default': '1.5', 'relaxed': '1.75', 'loose': '2' };
        root.style.setProperty('--line-height-base', lineHeightMap[prefs.lineHeight]);
        
        // Letter spacing
        const letterSpacingMap = { 'default': '0', 'wide': '0.025em', 'wider': '0.05em' };
        root.style.setProperty('--letter-spacing-base', letterSpacingMap[prefs.letterSpacing]);
        
        // Font family
        const fontFamilyMap: Record<string, string> = {
            'system': 'system-ui, -apple-system, sans-serif',
            'inter': 'Inter, sans-serif',
            'roboto': 'Roboto, sans-serif',
            'open-sans': '"Open Sans", sans-serif',
            'lato': 'Lato, sans-serif',
            'dyslexic': 'OpenDyslexic, sans-serif',
            'mono': 'ui-monospace, monospace'
        };
        root.style.setProperty('--font-family-base', fontFamilyMap[prefs.fontFamily] || fontFamilyMap['system']);
    };

    const updatePreference = <K extends keyof AccessibilityPreferences>(key: K, value: AccessibilityPreferences[K]) => {
        setPreferences(prev => ({ ...prev, [key]: value }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-purple-600" />
            </div>
        );
    }

    const fontSizeOptions = [
        { value: 'small', label: t('settings.accessibility.fontSize.small', 'Small'), preview: '14px' },
        { value: 'medium', label: t('settings.accessibility.fontSize.medium', 'Medium'), preview: '16px' },
        { value: 'large', label: t('settings.accessibility.fontSize.large', 'Large'), preview: '18px' },
        { value: 'extra-large', label: t('settings.accessibility.fontSize.extraLarge', 'Extra Large'), preview: '20px' }
    ];

    const textSpacingOptions = [
        { value: 'default', label: t('settings.accessibility.spacing.default', 'Default') },
        { value: 'relaxed', label: t('settings.accessibility.spacing.relaxed', 'Relaxed') },
        { value: 'spacious', label: t('settings.accessibility.spacing.spacious', 'Spacious') }
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            <InfoButton cardId="settings-profile" position="top-right" />
            
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Accessibility size={28} className="text-purple-500" />
                        {t('settings.accessibility.title', 'Accessibility')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('settings.accessibility.description', 'Customize the application to match your accessibility needs')}
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save Changes')}
                </button>
            </div>

            {/* Font Size */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Type size={20} className="text-blue-500" />
                    {t('settings.accessibility.fontSizeTitle', 'Font Size')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.accessibility.fontSizeDescription', 'Adjust the base font size for all text in the application')}
                </p>
                
                <div className="grid grid-cols-4 gap-4">
                    {fontSizeOptions.map(option => {
                        const isSelected = preferences.fontSize === option.value;
                        return (
                            <button
                                key={option.value}
                                onClick={() => updatePreference('fontSize', option.value as AccessibilityPreferences['fontSize'])}
                                className={`p-4 rounded-xl border-2 transition-all text-center ${
                                    isSelected
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                                        : 'border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/50'
                                }`}
                            >
                                <div className={`font-medium ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}
                                    style={{ fontSize: option.preview }}
                                >
                                    Aa
                                </div>
                                <div className={`text-sm mt-2 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>
                                    {option.label}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Visual Settings */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Eye size={20} className="text-green-500" />
                    {t('settings.accessibility.visualTitle', 'Visual Settings')}
                </h3>
                
                <div className="space-y-6">
                    {/* High Contrast */}
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Contrast size={16} className="text-amber-500" />
                                {t('settings.accessibility.highContrast', 'High Contrast Mode')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.accessibility.highContrastDescription', 'Increase contrast for better visibility')}
                            </p>
                        </div>
                        <button
                            onClick={() => updatePreference('highContrastMode', !preferences.highContrastMode)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.highContrastMode ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        >
                            <span className={`${preferences.highContrastMode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>

                    {/* Reduce Motion */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Sparkles size={16} className="text-purple-500" />
                                {t('settings.accessibility.reduceMotion', 'Reduce Motion')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.accessibility.reduceMotionDescription', 'Disable animations and transitions')}
                            </p>
                        </div>
                        <button
                            onClick={() => updatePreference('reduceMotion', !preferences.reduceMotion)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.reduceMotion ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        >
                            <span className={`${preferences.reduceMotion ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>

                    {/* Underline Links */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.accessibility.underlineLinks', 'Underline Links')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.accessibility.underlineLinksDescription', 'Always show underlines on clickable links')}
                            </p>
                        </div>
                        <button
                            onClick={() => updatePreference('underlineLinks', !preferences.underlineLinks)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.underlineLinks ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        >
                            <span className={`${preferences.underlineLinks ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>

                    {/* Text Spacing */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.accessibility.textSpacing', 'Text Spacing')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.accessibility.textSpacingDescription', 'Adjust spacing between lines and letters')}
                            </p>
                        </div>
                        <select
                            value={preferences.textSpacing}
                            onChange={(e) => updatePreference('textSpacing', e.target.value as AccessibilityPreferences['textSpacing'])}
                            className="px-4 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                        >
                            {textSpacingOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Navigation & Input */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Keyboard size={20} className="text-indigo-500" />
                    {t('settings.accessibility.navigationTitle', 'Navigation & Input')}
                </h3>
                
                <div className="space-y-6">
                    {/* Keyboard Shortcuts */}
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.accessibility.keyboardShortcuts', 'Show Keyboard Shortcuts')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.accessibility.keyboardShortcutsDescription', 'Display keyboard shortcut hints in tooltips')}
                            </p>
                        </div>
                        <button
                            onClick={() => updatePreference('showKeyboardShortcuts', !preferences.showKeyboardShortcuts)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.showKeyboardShortcuts ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        >
                            <span className={`${preferences.showKeyboardShortcuts ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>

                    {/* Focus Highlight */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.accessibility.focusHighlight', 'Enhanced Focus Indicator')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.accessibility.focusHighlightDescription', 'Show clear visual focus rings when navigating with keyboard')}
                            </p>
                        </div>
                        <button
                            onClick={() => updatePreference('focusHighlight', !preferences.focusHighlight)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.focusHighlight ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        >
                            <span className={`${preferences.focusHighlight ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>

                    {/* Cursor Size */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <MousePointer size={16} className="text-slate-500" />
                                {t('settings.accessibility.cursorSize', 'Cursor Size')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.accessibility.cursorSizeDescription', 'Increase cursor visibility')}
                            </p>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-lg">
                            <button
                                onClick={() => updatePreference('cursorSize', 'default')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                    preferences.cursorSize === 'default'
                                        ? 'bg-white dark:bg-navy-800 shadow text-slate-900 dark:text-white'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {t('settings.accessibility.cursor.default', 'Default')}
                            </button>
                            <button
                                onClick={() => updatePreference('cursorSize', 'large')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                    preferences.cursorSize === 'large'
                                        ? 'bg-white dark:bg-navy-800 shadow text-slate-900 dark:text-white'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {t('settings.accessibility.cursor.large', 'Large')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Screen Reader */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Volume2 size={20} className="text-red-500" />
                    {t('settings.accessibility.screenReaderTitle', 'Screen Reader')}
                </h3>
                
                <div className="flex items-center justify-between">
                    <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300">
                            {t('settings.accessibility.screenReaderOptimized', 'Screen Reader Optimizations')}
                        </label>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('settings.accessibility.screenReaderOptimizedDescription', 'Improve compatibility with screen readers like NVDA and VoiceOver')}
                        </p>
                    </div>
                    <button
                        onClick={() => updatePreference('screenReaderOptimized', !preferences.screenReaderOptimized)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            preferences.screenReaderOptimized ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                    >
                        <span className={`${preferences.screenReaderOptimized ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                    </button>
                </div>
            </div>

            {/* Color Vision */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Eye size={20} className="text-cyan-500" />
                    {t('settings.accessibility.colorVisionTitle', 'Color Vision')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.accessibility.colorVisionDescription', 'Adjust colors for different types of color blindness')}
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {COLOR_BLIND_OPTIONS.map(option => {
                        const isSelected = preferences.colorBlindMode === option.value;
                        return (
                            <button
                                key={option.value}
                                onClick={() => updatePreference('colorBlindMode', option.value as AccessibilityPreferences['colorBlindMode'])}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${
                                    isSelected
                                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
                                        : 'border-slate-200 dark:border-white/10 hover:border-cyan-300 dark:hover:border-cyan-500/50'
                                }`}
                            >
                                <div className={`font-medium ${isSelected ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {option.label}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    {option.description}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Font Family */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Type size={20} className="text-orange-500" />
                    {t('settings.accessibility.fontFamilyTitle', 'Font Family')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.accessibility.fontFamilyDescription', 'Choose a font that works best for you')}
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {FONT_FAMILY_OPTIONS.map(option => {
                        const isSelected = preferences.fontFamily === option.value;
                        return (
                            <button
                                key={option.value}
                                onClick={() => updatePreference('fontFamily', option.value)}
                                className={`p-3 rounded-lg border-2 transition-all text-left ${
                                    isSelected
                                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                                        : 'border-slate-200 dark:border-white/10 hover:border-orange-300'
                                }`}
                            >
                                <div className={`font-medium ${option.preview} ${isSelected ? 'text-orange-700 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {option.label}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Line Height & Letter Spacing */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Type size={20} className="text-pink-500" />
                    {t('settings.accessibility.readabilityTitle', 'Readability')}
                </h3>
                
                <div className="space-y-6">
                    {/* Line Height */}
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.accessibility.lineHeight', 'Line Height')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.accessibility.lineHeightDescription', 'Space between lines of text')}
                            </p>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-lg">
                            {(['default', 'relaxed', 'loose'] as const).map(value => (
                                <button
                                    key={value}
                                    onClick={() => updatePreference('lineHeight', value)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                        preferences.lineHeight === value
                                            ? 'bg-white dark:bg-navy-800 shadow text-slate-900 dark:text-white'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {t(`settings.accessibility.lineHeight.${value}`, value.charAt(0).toUpperCase() + value.slice(1))}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Letter Spacing */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.accessibility.letterSpacing', 'Letter Spacing')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.accessibility.letterSpacingDescription', 'Space between characters')}
                            </p>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-lg">
                            {(['default', 'wide', 'wider'] as const).map(value => (
                                <button
                                    key={value}
                                    onClick={() => updatePreference('letterSpacing', value)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                        preferences.letterSpacing === value
                                            ? 'bg-white dark:bg-navy-800 shadow text-slate-900 dark:text-white'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {t(`settings.accessibility.letterSpacing.${value}`, value.charAt(0).toUpperCase() + value.slice(1))}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Caret Width */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.accessibility.caretWidth', 'Text Cursor Width')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.accessibility.caretWidthDescription', 'Make the blinking text cursor more visible')}
                            </p>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-lg">
                            <button
                                onClick={() => updatePreference('caretWidth', 'default')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                    preferences.caretWidth === 'default'
                                        ? 'bg-white dark:bg-navy-800 shadow text-slate-900 dark:text-white'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {t('settings.accessibility.caretWidth.default', 'Default')}
                            </button>
                            <button
                                onClick={() => updatePreference('caretWidth', 'thick')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                    preferences.caretWidth === 'thick'
                                        ? 'bg-white dark:bg-navy-800 shadow text-slate-900 dark:text-white'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {t('settings.accessibility.caretWidth.thick', 'Thick')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Voice & Speech */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Volume2 size={20} className="text-violet-500" />
                    {t('settings.accessibility.voiceSpeechTitle', 'Voice & Speech')}
                </h3>
                
                <div className="space-y-6">
                    {/* Text to Speech */}
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.accessibility.textToSpeech', 'Text to Speech')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.accessibility.textToSpeechDescription', 'Read selected text aloud')}
                            </p>
                        </div>
                        <button
                            onClick={() => updatePreference('textToSpeechEnabled', !preferences.textToSpeechEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.textToSpeechEnabled ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        >
                            <span className={`${preferences.textToSpeechEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>

                    {/* Speech to Text */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.accessibility.speechToText', 'Speech to Text')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.accessibility.speechToTextDescription', 'Use voice dictation for text input')}
                            </p>
                        </div>
                        <button
                            onClick={() => updatePreference('speechToTextEnabled', !preferences.speechToTextEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.speechToTextEnabled ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        >
                            <span className={`${preferences.speechToTextEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>

                    {/* Voice Commands */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.accessibility.voiceCommands', 'Voice Commands')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.accessibility.voiceCommandsDescription', 'Control the app using voice commands')}
                            </p>
                        </div>
                        <button
                            onClick={() => updatePreference('voiceCommandsEnabled', !preferences.voiceCommandsEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.voiceCommandsEnabled ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        >
                            <span className={`${preferences.voiceCommandsEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Focus Indicator Style */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Keyboard size={20} className="text-teal-500" />
                    {t('settings.accessibility.focusStyleTitle', 'Focus Indicator Style')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.accessibility.focusStyleDescription', 'Choose how focused elements are highlighted when using keyboard navigation')}
                </p>
                
                <div className="grid grid-cols-3 gap-4">
                    {(['default', 'high-contrast', 'animated'] as const).map(style => {
                        const isSelected = preferences.focusIndicatorStyle === style;
                        const labels: Record<string, string> = {
                            'default': 'Default',
                            'high-contrast': 'High Contrast',
                            'animated': 'Animated'
                        };
                        return (
                            <button
                                key={style}
                                onClick={() => updatePreference('focusIndicatorStyle', style)}
                                className={`p-4 rounded-xl border-2 transition-all text-center ${
                                    isSelected
                                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                                        : 'border-slate-200 dark:border-white/10 hover:border-teal-300'
                                }`}
                            >
                                <div className={`font-medium ${isSelected ? 'text-teal-700 dark:text-teal-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {labels[style]}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AccessibilitySettings;



