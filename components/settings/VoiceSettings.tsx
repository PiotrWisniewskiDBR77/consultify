/**
 * VoiceSettings - Voice interaction settings
 */

import { Mic, Play, Square, Volume2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface VoiceSettingsProps {
    className?: string;
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({ className = '' }) => {
    const { t } = useTranslation();
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [autoSpeak, setAutoSpeak] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState('default');
    const [speed, setSpeed] = useState(1);
    const [testing, setTesting] = useState(false);

    const testVoice = () => {
        setTesting(true);
        const utterance = new SpeechSynthesisUtterance(
            t('settings.voice.testText', 'Hello! This is a test of the voice settings.'),
        );
        utterance.rate = speed;
        utterance.onend = () => setTesting(false);
        speechSynthesis.speak(utterance);
    };

    const stopTest = () => {
        speechSynthesis.cancel();
        setTesting(false);
    };

    return (
        <div className={`space-y-6 ${className}`}>
            <div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <Mic size={20} />
                    {t('settings.voice.title', 'Voice Settings')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('settings.voice.desc', 'Configure voice input and text-to-speech options.')}
                </p>
            </div>

            {/* Voice Input */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                    <Mic size={20} className="text-slate-400" />
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
                        checked={voiceEnabled}
                        onChange={(e) => setVoiceEnabled(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
            </div>

            {/* Auto-speak responses */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                    <Volume2 size={20} className="text-slate-400" />
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
                        checked={autoSpeak}
                        onChange={(e) => setAutoSpeak(e.target.checked)}
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
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800"
                >
                    <option value="default">{t('settings.voice.default', 'Default')}</option>
                    <option value="female">{t('settings.voice.female', 'Female')}</option>
                    <option value="male">{t('settings.voice.male', 'Male')}</option>
                </select>
            </div>

            {/* Speed */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t('settings.voice.speed', 'Speed')}: {speed}x
                </label>
                <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full"
                />
            </div>

            {/* Test Voice */}
            <button
                onClick={testing ? stopTest : testVoice}
                className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
            >
                {testing ? <Square size={16} /> : <Play size={16} />}
                {testing ? t('settings.voice.stop', 'Stop') : t('settings.voice.test', 'Test Voice')}
            </button>
        </div>
    );
};

export default VoiceSettings;



