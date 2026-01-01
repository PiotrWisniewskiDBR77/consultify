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
    cursorSize: 'default' | 'large';
    textSpacing: 'default' | 'relaxed' | 'spacious';
    underlineLinks: boolean;
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
    underlineLinks: false
};

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
        </div>
    );
};

export default AccessibilitySettings;


