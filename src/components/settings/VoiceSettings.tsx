/**
 * VoiceSettings - Voice interaction & TTS settings
 *
 * Rebuilt to use unified SettingsSection pattern.
 *
 * Features:
 *  - Voice Input (STT) toggle
 *  - Text-to-Speech (TTS) toggle
 *  - Auto-speak responses toggle
 *  - Voice selection
 *  - Speed control
 *  - Test voice button
 */

import { Play, Square, Volume2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';

import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import {
  SettingsDivider,
  SettingsFormRow,
  SettingsSection,
  SettingsSelect,
  SettingsToggle,
} from './shared';

interface AIVoicePreferences {
  ttsEnabled: boolean;
  sttEnabled: boolean;
  voice: string;
  speed: number;
  autoPlay: boolean;
}

const defaultPreferences: AIVoicePreferences = {
  ttsEnabled: false,
  sttEnabled: false,
  voice: 'alloy',
  speed: 1.0,
  autoPlay: false,
};

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy' },
  { value: 'echo', label: 'Echo' },
  { value: 'fable', label: 'Fable' },
  { value: 'onyx', label: 'Onyx' },
  { value: 'nova', label: 'Nova' },
  { value: 'shimmer', label: 'Shimmer' },
];

const BROWSER_VOICE_HINTS: Record<string, string[]> = {
  alloy: ['Google US English', 'Samantha', 'Microsoft Jenny'],
  echo: ['Daniel', 'Microsoft Guy', 'Google UK English Male'],
  fable: ['Serena', 'Google UK English Female', 'Microsoft Sonia'],
  onyx: ['Alex', 'Microsoft David', 'Fred'],
  nova: ['Victoria', 'Microsoft Aria', 'Google US English'],
  shimmer: ['Karen', 'Microsoft Zira', 'Google Australian English'],
};

export const VoiceSettings: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<AIVoicePreferences>(defaultPreferences);
  const [originalPreferences, setOriginalPreferences] =
    useState<AIVoicePreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDirty = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const response = await Api.getAIVoice();
        if (!response?.preferences) {
          throw new Error('Voice settings response was missing preferences');
        }
        const merged = { ...defaultPreferences, ...response.preferences };
        setPreferences(merged);
        setOriginalPreferences(merged);
      } catch (err: unknown) {
        setLoadError(normalizeApiErrorMessage(err, 'Failed to load voice settings'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => setBrowserVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      setActionError(null);
      await Api.saveAIVoice(preferences);
      const response = await Api.getAIVoice();
      if (!response?.preferences) {
        throw new Error('Voice settings save was not confirmed by the server');
      }
      const next = { ...defaultPreferences, ...response.preferences };
      if (JSON.stringify(next) !== JSON.stringify(preferences)) {
        throw new Error('Voice settings save was not confirmed by the server');
      }
      setPreferences(next);
      setOriginalPreferences(next);
      toast.success(t('settings.voice.saved', 'Voice settings saved'));
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(
        err,
        t('settings.voice.error', 'Failed to save voice settings')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [preferences, t]);

  const testVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error(
        t('settings.voice.unsupported', 'Text-to-speech is not supported in this browser')
      );
      return;
    }
    setTesting(true);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      t('settings.voice.testText', 'Hello! This is a test of the voice settings.')
    );
    utterance.rate = preferences.speed;
    const hints = BROWSER_VOICE_HINTS[preferences.voice] || [];
    utterance.voice =
      browserVoices.find((voice) => hints.some((hint) => voice.name.includes(hint))) ||
      browserVoices.find((voice) => voice.lang?.toLowerCase().startsWith('en')) ||
      browserVoices[0] ||
      null;
    utterance.onend = () => setTesting(false);
    utterance.onerror = () => setTesting(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopTest = () => {
    window.speechSynthesis.cancel();
    setTesting(false);
  };

  const update = <K extends keyof AIVoicePreferences>(key: K, value: AIVoicePreferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const anyVoiceEnabled = preferences.ttsEnabled || preferences.sttEnabled;

  if (loadError) {
    return (
      <div className={className}>
        <DegradedState title="Voice settings unavailable" description={loadError} />
      </div>
    );
  }

  return (
    <div className={className}>
      {actionError && <Banner variant="danger" title={actionError} className="mb-4" />}

      <SettingsSection
        icon={Volume2}
        title={t('settings.voice.title', 'Voice & TTS')}
        description={t(
          'settings.voice.desc',
          'Configure voice input and text-to-speech options for AI interactions.'
        )}
        cardId="settings-ai-voice"
        isDirty={isDirty}
        onSave={handleSave}
        saving={saving}
        loading={loading}
      >
        <div className="space-y-6">
          {/* Voice Input (STT) */}
          <SettingsToggle
            checked={preferences.sttEnabled}
            onChange={(checked) => update('sttEnabled', checked)}
            label={t('settings.voice.enableInput', 'Voice Input')}
            description={t(
              'settings.voice.enableInputDesc',
              'Use microphone for voice commands and dictation.'
            )}
          />

          {/* Text-to-Speech (TTS) */}
          <SettingsToggle
            checked={preferences.ttsEnabled}
            onChange={(checked) => update('ttsEnabled', checked)}
            label={t('settings.voice.enableTTS', 'Text-to-Speech')}
            description={t('settings.voice.enableTTSDesc', 'Enable voice output for AI responses.')}
          />

          {/* Auto-speak */}
          <SettingsToggle
            checked={preferences.autoPlay}
            onChange={(checked) => update('autoPlay', checked)}
            label={t('settings.voice.autoSpeak', 'Auto-speak Responses')}
            description={t(
              'settings.voice.autoSpeakDesc',
              'AI reads responses aloud automatically when TTS is enabled.'
            )}
            disabled={!preferences.ttsEnabled}
          />

          {anyVoiceEnabled && (
            <>
              <SettingsDivider />

              {/* Voice Selection */}
              <SettingsFormRow
                label={t('settings.voice.selectVoice', 'Voice')}
                description={t(
                  'settings.voice.selectVoiceDesc',
                  'Choose the voice used for text-to-speech output.'
                )}
              >
                <SettingsSelect
                  options={VOICE_OPTIONS}
                  value={preferences.voice}
                  onChange={(e) => update('voice', e.target.value)}
                />
              </SettingsFormRow>

              {/* Speed */}
              <SettingsFormRow
                label={t('settings.voice.speed', 'Speed')}
                description={t(
                  'settings.voice.speedDesc',
                  'Adjust playback speed for text-to-speech (0.5x – 2x).'
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={preferences.speed}
                      onChange={(e) => update('speed', parseFloat(e.target.value))}
                      className="flex-1 accent-c-accent"
                    />
                    <span className="text-sm font-mono text-white w-10 text-right">
                      {preferences.speed.toFixed(1)}x
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-c-text-muted">
                    <span>0.5x</span>
                    <span>1.0x</span>
                    <span>2.0x</span>
                  </div>
                </div>
              </SettingsFormRow>

              {/* Test Voice */}
              <div>
                <button
                  onClick={testing ? stopTest : testVoice}
                  className="flex items-center gap-2 px-4 py-2
                    border border-c-border-subtle text-c-text-secondary rounded-lg
                    hover:bg-c-surface-raised hover:text-white transition-all duration-200"
                >
                  {testing ? <Square size={16} /> : <Play size={16} />}
                  {testing
                    ? t('settings.voice.stop', 'Stop')
                    : t('settings.voice.test', 'Test Voice')}
                </button>
              </div>
            </>
          )}
        </div>
      </SettingsSection>
    </div>
  );
};

export default VoiceSettings;
