/**
 * AccessibilitySettings Component
 *
 * Consolidated accessibility preferences using shared SettingsSection pattern.
 * Groups: Typography, Visual, Navigation & Input, Assistive Technology
 *
 * @version 3.0
 */

import { ALargeSmall, Eye, Keyboard, Volume2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';

import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { SettingsButtonGroup, SettingsDivider, SettingsSection, SettingsToggle } from './shared';

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
  colorBlindMode: 'none',
  fontFamily: 'system',
  lineHeight: 'default',
  letterSpacing: 'default',
  voiceCommandsEnabled: false,
  textToSpeechEnabled: false,
  speechToTextEnabled: false,
  caretWidth: 'default',
  focusIndicatorStyle: 'default',
};

const FONT_FAMILY_OPTIONS = [
  {
    value: 'system',
    labelKey: 'settings.accessibility.fontFamily.system',
    label: 'System Default',
  },
  { value: 'inter', labelKey: 'settings.accessibility.fontFamily.inter', label: 'Inter' },
  { value: 'roboto', labelKey: 'settings.accessibility.fontFamily.roboto', label: 'Roboto' },
  {
    value: 'open-sans',
    labelKey: 'settings.accessibility.fontFamily.openSans',
    label: 'Open Sans',
  },
  { value: 'lato', labelKey: 'settings.accessibility.fontFamily.lato', label: 'Lato' },
  {
    value: 'dyslexic',
    labelKey: 'settings.accessibility.fontFamily.dyslexic',
    label: 'OpenDyslexic',
  },
  { value: 'mono', labelKey: 'settings.accessibility.fontFamily.mono', label: 'Monospace' },
];

const COLOR_BLIND_OPTIONS = [
  {
    value: 'none',
    labelKey: 'settings.accessibility.colorVision.none',
    label: 'None',
    descriptionKey: 'settings.accessibility.colorVision.noneDesc',
    description: 'No color adjustments',
  },
  {
    value: 'protanopia',
    labelKey: 'settings.accessibility.colorVision.protanopia',
    label: 'Protanopia',
    descriptionKey: 'settings.accessibility.colorVision.protanopiaDesc',
    description: 'Red-blind (1% of males)',
  },
  {
    value: 'deuteranopia',
    labelKey: 'settings.accessibility.colorVision.deuteranopia',
    label: 'Deuteranopia',
    descriptionKey: 'settings.accessibility.colorVision.deuteranopiaDesc',
    description: 'Green-blind (6% of males)',
  },
  {
    value: 'tritanopia',
    labelKey: 'settings.accessibility.colorVision.tritanopia',
    label: 'Tritanopia',
    descriptionKey: 'settings.accessibility.colorVision.tritanopiaDesc',
    description: 'Blue-blind (rare)',
  },
];

const applyAccessibilityPreferences = (prefs: AccessibilityPreferences) => {
  const root = document.documentElement;

  const fontSizeMap = { small: '14px', medium: '16px', large: '18px', 'extra-large': '20px' };
  root.style.setProperty('--base-font-size', fontSizeMap[prefs.fontSize]);

  root.classList.toggle('high-contrast', prefs.highContrastMode);
  root.classList.toggle('reduce-motion', prefs.reduceMotion);
  root.classList.toggle('underline-links', prefs.underlineLinks);

  root.classList.remove(
    'colorblind-protanopia',
    'colorblind-deuteranopia',
    'colorblind-tritanopia'
  );
  if (prefs.colorBlindMode !== 'none') {
    root.classList.add(`colorblind-${prefs.colorBlindMode}`);
  }

  const lineHeightMap = { default: '1.5', relaxed: '1.75', loose: '2' };
  root.style.setProperty('--line-height-base', lineHeightMap[prefs.lineHeight]);

  const letterSpacingMap = { default: '0', wide: '0.025em', wider: '0.05em' };
  root.style.setProperty('--letter-spacing-base', letterSpacingMap[prefs.letterSpacing]);

  const fontFamilyMap: Record<string, string> = {
    system: 'system-ui, -apple-system, sans-serif',
    inter: 'Inter, sans-serif',
    roboto: 'Roboto, sans-serif',
    'open-sans': '"Open Sans", sans-serif',
    lato: 'Lato, sans-serif',
    dyslexic: 'OpenDyslexic, sans-serif',
    mono: 'ui-monospace, monospace',
  };
  root.style.setProperty(
    '--font-family-base',
    fontFamilyMap[prefs.fontFamily] || fontFamilyMap['system']
  );
};

export const AccessibilitySettings: React.FC<AccessibilitySettingsProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(DEFAULT_PREFERENCES);
  const [original, setOriginal] = useState<AccessibilityPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDirty = JSON.stringify(preferences) !== JSON.stringify(original);

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await Api.getAccessibilitySettings();
      if (!data?.preferences) {
        throw new Error('Accessibility settings response was missing preferences');
      }
      const merged = { ...DEFAULT_PREFERENCES, ...data.preferences };
      setPreferences(merged);
      setOriginal(merged);
      applyAccessibilityPreferences(merged);
    } catch (error: unknown) {
      setLoadError(normalizeApiErrorMessage(error, 'Failed to load accessibility preferences'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreferences();
  }, [currentUser.id, loadPreferences]);

  const handleSave = async () => {
    setSaving(true);
    try {
      setActionError(null);
      await Api.updateAccessibilitySettings(preferences);
      const data = await Api.getAccessibilitySettings();
      if (!data?.preferences) {
        throw new Error('Accessibility preferences save was not confirmed by the server');
      }
      const next = { ...DEFAULT_PREFERENCES, ...data.preferences };
      if (JSON.stringify(next) !== JSON.stringify(preferences)) {
        throw new Error('Accessibility preferences save was not confirmed by the server');
      }
      setPreferences(next);
      setOriginal(next);
      applyAccessibilityPreferences(next);
      toast.success(t('settings.accessibility.saved', 'Accessibility preferences saved'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.accessibility.error', 'Failed to save preferences')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof AccessibilityPreferences>(
    key: K,
    value: AccessibilityPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const fontSizeOptions = [
    { value: 'small', label: t('settings.accessibility.fontSize.small', 'Small'), size: '14px' },
    { value: 'medium', label: t('settings.accessibility.fontSize.medium', 'Medium'), size: '16px' },
    { value: 'large', label: t('settings.accessibility.fontSize.large', 'Large'), size: '18px' },
    {
      value: 'extra-large',
      label: t('settings.accessibility.fontSize.extraLarge', 'Extra Large'),
      size: '20px',
    },
  ];

  if (loadError) {
    return (
      <div className="space-y-6">
        <DegradedState title="Accessibility preferences unavailable" description={loadError} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {actionError && <Banner variant="danger" title={actionError} />}

      {/* ── Section 1: Typography ── */}
      <SettingsSection
        icon={ALargeSmall}
        title={t('settings.accessibility.typographyTitle', 'Typography')}
        description={t(
          'settings.accessibility.typographyDesc',
          'Font size, family, and readability preferences'
        )}
        cardId="settings-accessibility-typography"
        isDirty={isDirty}
        onSave={handleSave}
        saving={saving}
        loading={loading}
      >
        <div className="space-y-6">
          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-3">
              {t('settings.accessibility.fontSizeTitle', 'Font Size')}
            </label>
            <div className="grid grid-cols-4 gap-3">
              {fontSizeOptions.map((opt) => {
                const isSelected = preferences.fontSize === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() =>
                      update('fontSize', opt.value as AccessibilityPreferences['fontSize'])
                    }
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all duration-200 text-center',
                      'hover:scale-[1.02] active:scale-[0.98]',
                      isSelected
                        ? 'border-primary-500 bg-primary-500/5'
                        : 'border-white/10 hover:border-white/20 bg-navy-800/50'
                    )}
                  >
                    <div
                      className={cn(
                        'font-semibold transition-colors',
                        isSelected ? 'text-primary-400' : 'text-slate-600'
                      )}
                      style={{ fontSize: opt.size }}
                    >
                      Aa
                    </div>
                    <div
                      className={cn(
                        'text-xs mt-2 transition-colors',
                        isSelected ? 'text-primary-400' : 'text-slate-500'
                      )}
                    >
                      {opt.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <SettingsDivider />

          {/* Font Family */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-3">
              {t('settings.accessibility.fontFamilyTitle', 'Font Family')}
            </label>
            <div className="grid grid-cols-4 gap-3">
              {FONT_FAMILY_OPTIONS.map((opt) => {
                const isSelected = preferences.fontFamily === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => update('fontFamily', opt.value)}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all duration-200 text-left',
                      isSelected
                        ? 'border-primary-500 bg-primary-500/5'
                        : 'border-white/10 hover:border-white/20'
                    )}
                  >
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isSelected ? 'text-primary-400' : 'text-slate-600'
                      )}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <SettingsDivider />

          {/* Line Height */}
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-sm font-medium text-white">
                {t('settings.accessibility.lineHeightTitle', 'Line Height')}
              </span>
              <span className="text-xs text-slate-500">
                {t('settings.accessibility.lineHeightDescription', 'Space between lines of text')}
              </span>
            </div>
            <SettingsButtonGroup
              options={[
                {
                  value: 'default',
                  label: t('settings.accessibility.lineHeight.default', 'Default'),
                },
                {
                  value: 'relaxed',
                  label: t('settings.accessibility.lineHeight.relaxed', 'Relaxed'),
                },
                { value: 'loose', label: t('settings.accessibility.lineHeight.loose', 'Loose') },
              ]}
              value={preferences.lineHeight}
              onChange={(v) => update('lineHeight', v as AccessibilityPreferences['lineHeight'])}
              size="sm"
            />
          </div>

          <SettingsDivider />

          {/* Letter Spacing */}
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-sm font-medium text-white">
                {t('settings.accessibility.letterSpacingTitle', 'Letter Spacing')}
              </span>
              <span className="text-xs text-slate-500">
                {t('settings.accessibility.letterSpacingDescription', 'Space between characters')}
              </span>
            </div>
            <SettingsButtonGroup
              options={[
                {
                  value: 'default',
                  label: t('settings.accessibility.letterSpacing.default', 'Default'),
                },
                { value: 'wide', label: t('settings.accessibility.letterSpacing.wide', 'Wide') },
                { value: 'wider', label: t('settings.accessibility.letterSpacing.wider', 'Wider') },
              ]}
              value={preferences.letterSpacing}
              onChange={(v) =>
                update('letterSpacing', v as AccessibilityPreferences['letterSpacing'])
              }
              size="sm"
            />
          </div>

          <SettingsDivider />

          {/* Caret Width */}
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-sm font-medium text-white">
                {t('settings.accessibility.caretWidthTitle', 'Text Cursor Width')}
              </span>
              <span className="text-xs text-slate-500">
                {t(
                  'settings.accessibility.caretWidthDescription',
                  'Make the blinking text cursor more visible'
                )}
              </span>
            </div>
            <SettingsButtonGroup
              options={[
                {
                  value: 'default',
                  label: t('settings.accessibility.caretWidth.default', 'Default'),
                },
                { value: 'thick', label: t('settings.accessibility.caretWidth.thick', 'Thick') },
              ]}
              value={preferences.caretWidth}
              onChange={(v) => update('caretWidth', v as AccessibilityPreferences['caretWidth'])}
              size="sm"
            />
          </div>
        </div>
      </SettingsSection>

      {/* ── Section 2: Visual ── */}
      <SettingsSection
        icon={Eye}
        title={t('settings.accessibility.visualTitle', 'Visual Settings')}
        description={t(
          'settings.accessibility.visualDesc',
          'Contrast, motion, color vision, and focus indicators'
        )}
        cardId="settings-accessibility-visual"
        isDirty={isDirty}
        onSave={handleSave}
        saving={saving}
        loading={loading}
      >
        <div className="space-y-1">
          <SettingsToggle
            checked={preferences.highContrastMode}
            onChange={(v) => update('highContrastMode', v)}
            label={t('settings.accessibility.highContrast', 'High Contrast Mode')}
            description={t(
              'settings.accessibility.highContrastDescription',
              'Increase contrast for better visibility'
            )}
          />

          <SettingsDivider />

          <SettingsToggle
            checked={preferences.reduceMotion}
            onChange={(v) => update('reduceMotion', v)}
            label={t('settings.accessibility.reduceMotion', 'Reduce Motion')}
            description={t(
              'settings.accessibility.reduceMotionDescription',
              'Disable animations and transitions'
            )}
          />

          <SettingsDivider />

          <SettingsToggle
            checked={preferences.underlineLinks}
            onChange={(v) => update('underlineLinks', v)}
            label={t('settings.accessibility.underlineLinks', 'Underline Links')}
            description={t(
              'settings.accessibility.underlineLinksDescription',
              'Always show underlines on clickable links'
            )}
          />

          <SettingsDivider />

          {/* Text Spacing */}
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-sm font-medium text-white">
                {t('settings.accessibility.textSpacing', 'Text Spacing')}
              </span>
              <span className="text-xs text-slate-500">
                {t(
                  'settings.accessibility.textSpacingDescription',
                  'Adjust spacing between lines and letters'
                )}
              </span>
            </div>
            <SettingsButtonGroup
              options={[
                { value: 'default', label: t('settings.accessibility.spacing.default', 'Default') },
                { value: 'relaxed', label: t('settings.accessibility.spacing.relaxed', 'Relaxed') },
                {
                  value: 'spacious',
                  label: t('settings.accessibility.spacing.spacious', 'Spacious'),
                },
              ]}
              value={preferences.textSpacing}
              onChange={(v) => update('textSpacing', v as AccessibilityPreferences['textSpacing'])}
              size="sm"
            />
          </div>

          <SettingsDivider />

          {/* Color Vision */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              {t('settings.accessibility.colorVisionTitle', 'Color Vision')}
            </label>
            <p className="text-xs text-slate-500 mb-3">
              {t(
                'settings.accessibility.colorVisionDescription',
                'Adjust colors for different types of color blindness'
              )}
            </p>
            <div className="grid grid-cols-4 gap-3">
              {COLOR_BLIND_OPTIONS.map((opt) => {
                const isSelected = preferences.colorBlindMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() =>
                      update(
                        'colorBlindMode',
                        opt.value as AccessibilityPreferences['colorBlindMode']
                      )
                    }
                    className={cn(
                      'p-3 rounded-xl border-2 transition-all duration-200 text-left',
                      isSelected
                        ? 'border-primary-500 bg-primary-500/5'
                        : 'border-white/10 hover:border-white/20'
                    )}
                  >
                    <div
                      className={cn(
                        'text-sm font-medium',
                        isSelected ? 'text-primary-400' : 'text-slate-600'
                      )}
                    >
                      {t(opt.labelKey, opt.label)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {t(opt.descriptionKey, opt.description)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <SettingsDivider />

          {/* Focus Indicator Style */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              {t('settings.accessibility.focusStyleTitle', 'Focus Indicator Style')}
            </label>
            <p className="text-xs text-slate-500 mb-3">
              {t(
                'settings.accessibility.focusStyleDescription',
                'Choose how focused elements are highlighted when using keyboard navigation'
              )}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(['default', 'high-contrast', 'animated'] as const).map((style) => {
                const isSelected = preferences.focusIndicatorStyle === style;
                const labels: Record<string, string> = {
                  default: t('settings.accessibility.focusStyle.default', 'Default'),
                  'high-contrast': t(
                    'settings.accessibility.focusStyle.highContrast',
                    'High Contrast'
                  ),
                  animated: t('settings.accessibility.focusStyle.animated', 'Animated'),
                };
                return (
                  <button
                    key={style}
                    onClick={() => update('focusIndicatorStyle', style)}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all duration-200 text-center',
                      isSelected
                        ? 'border-primary-500 bg-primary-500/5'
                        : 'border-white/10 hover:border-white/20'
                    )}
                  >
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isSelected ? 'text-primary-400' : 'text-slate-600'
                      )}
                    >
                      {labels[style]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* ── Section 3: Navigation & Input ── */}
      <SettingsSection
        icon={Keyboard}
        title={t('settings.accessibility.navigationTitle', 'Navigation & Input')}
        description={t(
          'settings.accessibility.navigationDesc',
          'Keyboard hints, focus rings, and cursor preferences'
        )}
        cardId="settings-accessibility-navigation"
        isDirty={isDirty}
        onSave={handleSave}
        saving={saving}
        loading={loading}
      >
        <div className="space-y-1">
          <SettingsToggle
            checked={preferences.showKeyboardShortcuts}
            onChange={(v) => update('showKeyboardShortcuts', v)}
            label={t('settings.accessibility.keyboardShortcuts', 'Show Keyboard Shortcuts')}
            description={t(
              'settings.accessibility.keyboardShortcutsDescription',
              'Display keyboard shortcut hints in tooltips'
            )}
          />

          <SettingsDivider />

          <SettingsToggle
            checked={preferences.focusHighlight}
            onChange={(v) => update('focusHighlight', v)}
            label={t('settings.accessibility.focusHighlight', 'Enhanced Focus Indicator')}
            description={t(
              'settings.accessibility.focusHighlightDescription',
              'Show clear visual focus rings when navigating with keyboard'
            )}
          />

          <SettingsDivider />

          {/* Cursor Size */}
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-sm font-medium text-white">
                {t('settings.accessibility.cursorSize', 'Cursor Size')}
              </span>
              <span className="text-xs text-slate-500">
                {t('settings.accessibility.cursorSizeDescription', 'Increase cursor visibility')}
              </span>
            </div>
            <SettingsButtonGroup
              options={[
                { value: 'default', label: t('settings.accessibility.cursor.default', 'Default') },
                { value: 'large', label: t('settings.accessibility.cursor.large', 'Large') },
              ]}
              value={preferences.cursorSize}
              onChange={(v) => update('cursorSize', v as AccessibilityPreferences['cursorSize'])}
              size="sm"
            />
          </div>
        </div>
      </SettingsSection>

      {/* ── Section 4: Assistive Technology ── */}
      <SettingsSection
        icon={Volume2}
        title={t('settings.accessibility.assistiveTitle', 'Assistive Technology')}
        description={t(
          'settings.accessibility.assistiveDesc',
          'Screen reader, voice control, and speech features'
        )}
        cardId="settings-accessibility-assistive"
        isDirty={isDirty}
        onSave={handleSave}
        saving={saving}
        loading={loading}
      >
        <div className="space-y-1">
          <SettingsToggle
            checked={preferences.screenReaderOptimized}
            onChange={(v) => update('screenReaderOptimized', v)}
            label={t('settings.accessibility.screenReaderOptimized', 'Screen Reader Optimizations')}
            description={t(
              'settings.accessibility.screenReaderOptimizedDescription',
              'Improve compatibility with screen readers like NVDA and VoiceOver'
            )}
          />

          <SettingsDivider />

          <SettingsToggle
            checked={preferences.textToSpeechEnabled}
            onChange={(v) => update('textToSpeechEnabled', v)}
            label={t('settings.accessibility.textToSpeech', 'Text to Speech')}
            description={t(
              'settings.accessibility.textToSpeechDescription',
              'Read selected text aloud'
            )}
          />

          <SettingsDivider />

          <SettingsToggle
            checked={preferences.speechToTextEnabled}
            onChange={(v) => update('speechToTextEnabled', v)}
            label={t('settings.accessibility.speechToText', 'Speech to Text')}
            description={t(
              'settings.accessibility.speechToTextDescription',
              'Use voice dictation for text input'
            )}
          />

          <SettingsDivider />

          <SettingsToggle
            checked={preferences.voiceCommandsEnabled}
            onChange={(v) => update('voiceCommandsEnabled', v)}
            label={t('settings.accessibility.voiceCommands', 'Voice Commands')}
            description={t(
              'settings.accessibility.voiceCommandsDescription',
              'Control the app using voice commands'
            )}
          />
        </div>
      </SettingsSection>
    </div>
  );
};

export default AccessibilitySettings;
