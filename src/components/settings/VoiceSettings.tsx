/**
 * VoiceSettings - Voice interaction settings
 * Connected to backend API for persistence.
 */

import { Loader2, Mic, Play, Save, Square, Volume2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

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

interface VoiceSettingsProps {
  className?: string;
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<AIVoicePreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);
        const response = await Api.getAIVoice();
        if (response?.preferences) {
          setPreferences({ ...defaultPreferences, ...response.preferences });
        }
      } catch (err: any) {
        console.error('Failed to load voice settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPreferences();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Api.saveAIVoice(preferences);
      toast.success(t('settings.voice.saved', 'Voice settings saved'));
    } catch (err: any) {
      toast.error(t('settings.voice.error', 'Failed to save voice settings'));
    } finally {
      setSaving(false);
    }
  };

  const testVoice = () => {
    setTesting(true);
    const utterance = new SpeechSynthesisUtterance(
      t('settings.voice.testText', 'Hello! This is a test of the voice settings.')
    );
    utterance.rate = preferences.speed;
    utterance.onend = () => setTesting(false);
    speechSynthesis.speak(utterance);
  };

  const stopTest = () => {
    speechSynthesis.cancel();
    setTesting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Mic size={20} />
            {t('settings.voice.title', 'Voice Settings')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('settings.voice.desc', 'Configure voice input and text-to-speech options.')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
        </button>
      </div>

      {/* Voice Input (STT) */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Mic size={20} className="text-slate-400 dark:text-slate-500" />
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              {t('settings.voice.enableInput', 'Voice Input')}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('settings.voice.enableInputDesc', 'Use microphone for voice commands')}
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.sttEnabled}
            onChange={(e) => setPreferences({ ...preferences, sttEnabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>

      {/* Text-to-Speech (TTS) */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Volume2 size={20} className="text-slate-400 dark:text-slate-500" />
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              {t('settings.voice.enableTTS', 'Text-to-Speech')}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('settings.voice.enableTTSDesc', 'Enable voice output for AI responses')}
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.ttsEnabled}
            onChange={(e) => setPreferences({ ...preferences, ttsEnabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>

      {/* Auto-play responses */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Volume2 size={20} className="text-slate-400 dark:text-slate-500" />
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              {t('settings.voice.autoSpeak', 'Auto-speak Responses')}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('settings.voice.autoSpeakDesc', 'AI reads responses aloud automatically')}
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.autoPlay}
            onChange={(e) => setPreferences({ ...preferences, autoPlay: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>

      {/* Voice Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {t('settings.voice.selectVoice', 'Voice')}
        </label>
        <select
          value={preferences.voice}
          onChange={(e) => setPreferences({ ...preferences, voice: e.target.value })}
          className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        >
          <option value="alloy">Alloy</option>
          <option value="echo">Echo</option>
          <option value="fable">Fable</option>
          <option value="onyx">Onyx</option>
          <option value="nova">Nova</option>
          <option value="shimmer">Shimmer</option>
        </select>
      </div>

      {/* Speed */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {t('settings.voice.speed', 'Speed')}: {preferences.speed}x
        </label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={preferences.speed}
          onChange={(e) => setPreferences({ ...preferences, speed: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Test Voice */}
      <button
        onClick={testing ? stopTest : testVoice}
        className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
      >
        {testing ? <Square size={16} /> : <Play size={16} />}
        {testing ? t('settings.voice.stop', 'Stop') : t('settings.voice.test', 'Test Voice')}
      </button>
    </div>
  );
};

export default VoiceSettings;
