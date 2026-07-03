/**
 * TTSIndicator
 *
 * Visual indicator that shows when Text-to-Speech is active.
 * Provides a button to stop the current speech.
 *
 * @version 1.0.0
 */

import { Volume2, VolumeX } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

export const TTSIndicator: React.FC = () => {
  const { t } = useTranslation();
  const { aiConfig } = useAppStore();
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Monitor speechSynthesis speaking state
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const checkSpeaking = () => {
      setIsSpeaking(window.speechSynthesis.speaking);
    };

    // Check periodically since there's no native event for speaking state
    const interval = setInterval(checkSpeaking, 200);

    return () => clearInterval(interval);
  }, []);

  // Don't show if TTS is disabled or not speaking
  if (!(aiConfig as any).textToSpeech || !isSpeaking) {
    return null;
  }

  const handleStop = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-6 z-overlay animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      <button
        onClick={handleStop}
        className="flex items-center gap-2 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
        title={t('aiChat.stopTTS', 'Zatrzymaj czytanie')}
      >
        <Volume2 size={18} className="animate-pulse" />
        <span className="text-sm font-medium">{t('aiChat.speaking', 'Czytam...')}</span>
        <div className="w-px h-4 bg-white/30" />
        <VolumeX size={16} />
      </button>
    </div>
  );
};

export default TTSIndicator;
