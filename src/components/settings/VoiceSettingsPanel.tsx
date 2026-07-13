/**
 * VoiceSettingsPanel
 *
 * Voice preferences settings panel with:
 * - Input mode selection (push-to-talk, click-to-talk, always listening)
 * - Auto-send delay configuration
 * - TTS voice selection
 * - Speech rate and pitch controls
 * - Auto-speak AI responses toggle
 * - Provider selection
 *
 * Part of the Universal Voice Conversation System
 *
 * @version 1.0.0
 */

import {
  CheckCircle,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Settings2,
  Volume2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';

// ============================================================================
// Types
// ============================================================================

export type InputMode = 'push-to-talk' | 'click-to-talk' | 'always-listening';
export type TTSProvider = 'openai' | 'edge' | 'web';
export type STTProvider = 'whisper' | 'web';

export interface VoiceSettings {
  inputMode: InputMode;
  autoSendDelay: number;
  ttsVoice: string;
  ttsSpeed: number;
  ttsProvider: TTSProvider;
  sttProvider: STTProvider;
  autoSpeakResponses: boolean;
  language: string;
  showLiveTranscript: boolean;
}

interface VoiceSettingsPanelProps {
  settings?: Partial<VoiceSettings>;
  onSettingsChange?: (settings: VoiceSettings) => void;
  className?: string;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: VoiceSettings = {
  inputMode: 'click-to-talk',
  autoSendDelay: 1.5,
  ttsVoice: 'nova',
  ttsSpeed: 1.0,
  ttsProvider: 'openai',
  sttProvider: 'whisper',
  autoSpeakResponses: true,
  language: 'pl',
  showLiveTranscript: true,
};

const SETTINGS_FIELDS: Array<keyof VoiceSettings> = [
  'inputMode',
  'autoSendDelay',
  'ttsVoice',
  'ttsSpeed',
  'ttsProvider',
  'sttProvider',
  'autoSpeakResponses',
  'language',
  'showLiveTranscript',
];

const settingsMatch = (left: VoiceSettings, right: VoiceSettings) =>
  SETTINGS_FIELDS.every((field) => left[field] === right[field]);

// ============================================================================
// Voice Options
// ============================================================================

const OPENAI_VOICES = [
  { id: 'alloy', name: 'Alloy', description: 'Balanced, versatile' },
  { id: 'echo', name: 'Echo', description: 'Warm, engaging' },
  { id: 'fable', name: 'Fable', description: 'Expressive, narrative' },
  { id: 'onyx', name: 'Onyx', description: 'Deep, authoritative' },
  { id: 'nova', name: 'Nova', description: 'Energetic, bright' },
  { id: 'shimmer', name: 'Shimmer', description: 'Soft, calming' },
];

const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5x (Slow)' },
  { value: 0.75, label: '0.75x' },
  { value: 1.0, label: '1.0x (Normal)' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x (Fast)' },
  { value: 2.0, label: '2.0x (Very Fast)' },
];

const DELAY_OPTIONS = [
  { value: 0.5, label: '0.5s (Quick)' },
  { value: 1.0, label: '1.0s' },
  { value: 1.5, label: '1.5s (Recommended)' },
  { value: 2.0, label: '2.0s' },
  { value: 3.0, label: '3.0s (Slow)' },
];

// ============================================================================
// Component
// ============================================================================

export const VoiceSettingsPanel: React.FC<VoiceSettingsPanelProps> = ({
  settings: initialSettings,
  onSettingsChange,
  className = '',
}) => {
  const { t } = useTranslation();

  // State
  const [settings, setSettings] = useState<VoiceSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<{
    stt: boolean | null;
    tts: boolean | null;
  }>({ stt: null, tts: null });
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Load settings from server
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await Api.get('/voice/settings');
        if (!data) {
          throw new Error('Voice settings were not returned by the server');
        }
        setSettings({ ...DEFAULT_SETTINGS, ...initialSettings, ...data });
        setLoadError(null);
      } catch (error: unknown) {
        setLoadError(normalizeApiErrorMessage(error, 'Failed to load voice settings'));
      }
    };

    loadSettings();
  }, [initialSettings]);

  // Update setting
  const updateSetting = useCallback(
    <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
      setSettings((prev) => {
        const newSettings = { ...prev, [key]: value };
        return newSettings;
      });
    },
    []
  );

  // Save settings to server
  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await Api.post('/voice/settings', settings);
      const persisted = await Api.get('/voice/settings');
      if (!persisted) {
        throw new Error('Voice settings save was not confirmed by the server');
      }
      const next = { ...DEFAULT_SETTINGS, ...persisted };
      if (!settingsMatch(next, settings)) {
        throw new Error('Voice settings were not confirmed by the server');
      }
      setSettings(next);
      onSettingsChange?.(next);
    } catch (error: unknown) {
      setSaveError(normalizeApiErrorMessage(error, 'Failed to save voice settings'));
    } finally {
      setIsSaving(false);
    }
  }, [onSettingsChange, settings]);

  // Test voice system
  const testVoiceSystem = useCallback(async () => {
    setIsTesting(true);
    setTestResults({ stt: null, tts: null });
    setTestError(null);

    try {
      // Test STT
      const sttResult = await Api.post('/voice/test/stt', { provider: settings.sttProvider });
      setTestResults((prev) => ({ ...prev, stt: sttResult.success }));

      // Test TTS
      const ttsResult = await Api.post('/voice/test/tts', { provider: settings.ttsProvider });
      setTestResults((prev) => ({ ...prev, tts: ttsResult.success }));
    } catch (error: unknown) {
      setTestResults({ stt: false, tts: false });
      setTestError(normalizeApiErrorMessage(error, 'Failed to test voice system'));
    } finally {
      setIsTesting(false);
    }
  }, [settings.sttProvider, settings.ttsProvider]);

  // Preview voice
  const previewVoice = useCallback(async () => {
    try {
      setTestError(null);
      const response = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: t('voiceSettings.previewText', 'Hello! This is a preview of the selected voice.'),
          voice: settings.ttsVoice,
          speed: settings.ttsSpeed,
          language: settings.language,
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.onended = () => URL.revokeObjectURL(audioUrl);
        audio.play();
      } else {
        throw new Error('Voice preview request failed');
      }
    } catch (error: unknown) {
      setTestError(normalizeApiErrorMessage(error, 'Failed to preview voice'));
    }
  }, [settings.ttsVoice, settings.ttsSpeed, settings.language, t]);

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-c-accent-soft flex items-center justify-center">
            <Mic className="text-white" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-navy-900">
              {t('voiceSettings.title', 'Voice Settings')}
            </h3>
            <p className="text-sm text-c-text-muted">
              {t('voiceSettings.subtitle', 'Configure voice conversation preferences')}
            </p>
          </div>
        </div>

        <button
          onClick={testVoiceSystem}
          disabled={isTesting || !!loadError}
          className="flex items-center gap-2 px-3 py-2 bg-c-surface-raised rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised text-sm font-medium text-c-text-secondary transition-colors"
        >
          {isTesting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {t('voiceSettings.test', 'Test')}
        </button>
      </div>

      {loadError && <DegradedState title="Voice settings unavailable" description={loadError} />}

      {/* Test Results */}
      {!loadError && (testResults.stt !== null || testResults.tts !== null) && (
        <div className="flex gap-4 p-3 bg-c-surface-raised rounded-lg">
          <div className="flex items-center gap-2">
            {testResults.stt === true && <CheckCircle size={16} className="text-green-500" />}
            {testResults.stt === false && <XCircle size={16} className="text-rose-500" />}
            <span className="text-sm text-c-text-secondary">STT</span>
          </div>
          <div className="flex items-center gap-2">
            {testResults.tts === true && <CheckCircle size={16} className="text-green-500" />}
            {testResults.tts === false && <XCircle size={16} className="text-rose-500" />}
            <span className="text-sm text-c-text-secondary">TTS</span>
          </div>
        </div>
      )}

      {!loadError && testError && (
        <div
          role="alert"
          className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg text-sm text-rose-700 dark:text-rose-300"
        >
          {testError}
        </div>
      )}

      {/* Input Mode */}
      {!loadError && (
        <>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-c-text-secondary">
              <Mic size={16} />
              {t('voiceSettings.inputMode', 'Input Mode')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['click-to-talk', 'push-to-talk', 'always-listening'] as InputMode[]).map(
                (mode) => (
                  <button
                    key={mode}
                    onClick={() => updateSetting('inputMode', mode)}
                    className={`
                                px-3 py-2 rounded-lg border text-sm font-medium transition-all
                                ${
                                  settings.inputMode === mode
                                    ? 'border-c-accent bg-c-accent-soft text-c-accent'
                                    : 'border-c-border-subtle dark:border-navy-700 text-c-text-secondary hover:border-c-border-subtle dark:hover:border-white/20'
                                }
                            `}
                  >
                    {t(`voiceSettings.mode.${mode}`, mode.replace(/-/g, ' '))}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Auto-send Delay */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-c-text-secondary">
              <Settings2 size={16} />
              {t('voiceSettings.autoSendDelay', 'Auto-send after silence')}
            </label>
            <select
              value={settings.autoSendDelay}
              onChange={(e) => updateSetting('autoSendDelay', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg bg-c-surface text-c-text-secondary"
            >
              {DELAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* TTS Voice */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-c-text-secondary">
                <Volume2 size={16} />
                {t('voiceSettings.ttsVoice', 'AI Voice')}
              </label>
              <button
                onClick={previewVoice}
                className="flex items-center gap-1 text-xs text-c-accent hover:underline"
              >
                <Play size={12} />
                {t('voiceSettings.preview', 'Preview')}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {OPENAI_VOICES.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => updateSetting('ttsVoice', voice.id)}
                  className={`
                                p-3 rounded-lg border text-left transition-all
                                ${
                                  settings.ttsVoice === voice.id
                                    ? 'border-c-accent bg-c-accent-soft'
                                    : 'border-c-border-subtle dark:border-navy-700 hover:border-c-border-subtle dark:hover:border-white/20'
                                }
                            `}
                >
                  <div className="text-sm font-medium text-c-text-secondary">
                    {voice.name}
                  </div>
                  <div className="text-xs text-c-text-muted">
                    {voice.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Speech Speed */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-c-text-secondary">
              {t('voiceSettings.speechSpeed', 'Speech Speed')}
            </label>
            <select
              value={settings.ttsSpeed}
              onChange={(e) => updateSetting('ttsSpeed', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg bg-c-surface text-c-text-secondary"
            >
              {SPEED_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            {/* Auto-speak responses */}
            <label className="flex items-center justify-between">
              <span className="text-sm text-c-text-secondary">
                {t('voiceSettings.autoSpeak', 'Auto-speak AI responses')}
              </span>
              <button
                onClick={() => updateSetting('autoSpeakResponses', !settings.autoSpeakResponses)}
                className={`
                            relative w-11 h-6 rounded-full transition-colors
                            ${settings.autoSpeakResponses ? 'bg-c-focus' : 'bg-c-surface-raised'}
                        `}
              >
                <span
                  className={`
                                absolute top-0.5 w-5 h-5 bg-c-surface rounded-full shadow transition-transform
                                ${settings.autoSpeakResponses ? 'translate-x-5.5' : 'translate-x-0.5'}
                            `}
                />
              </button>
            </label>

            {/* Show live transcript */}
            <label className="flex items-center justify-between">
              <span className="text-sm text-c-text-secondary">
                {t('voiceSettings.showTranscript', 'Show live transcript')}
              </span>
              <button
                onClick={() => updateSetting('showLiveTranscript', !settings.showLiveTranscript)}
                className={`
                            relative w-11 h-6 rounded-full transition-colors
                            ${settings.showLiveTranscript ? 'bg-c-focus' : 'bg-c-surface-raised'}
                        `}
              >
                <span
                  className={`
                                absolute top-0.5 w-5 h-5 bg-c-surface rounded-full shadow transition-transform
                                ${settings.showLiveTranscript ? 'translate-x-5.5' : 'translate-x-0.5'}
                            `}
                />
              </button>
            </label>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-c-border-subtle dark:border-navy-700">
            {saveError && (
              <div
                role="alert"
                className="mb-3 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg text-sm text-rose-700 dark:text-rose-300"
              >
                {saveError}
              </div>
            )}
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-c-text hover:bg-c-text text-c-surface rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle size={16} />
              )}
              {t('voiceSettings.save', 'Save Voice Settings')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default VoiceSettingsPanel;
