/**
 * VoiceToNode — Speech recognition that creates mind map nodes from voice input.
 * Uses the Web Speech API (SpeechRecognition).
 */
import { Loader2, Mic, MicOff, Sparkles, Square } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

interface VoiceToNodeProps {
  open: boolean;
  onClose: () => void;
  locked: boolean;
  onAddNodes: (labels: string[]) => void;
}

export const VoiceToNode: React.FC<VoiceToNodeProps> = ({ open, onClose, locked, onAddNodes }) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedNodes, setParsedNodes] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(
        t(
          'ideas.mindmap.browserDoesNotSupportSpeechRecognition',
          'Browser does not support speech recognition'
        )
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = isPl ? 'pl-PL' : 'en-US';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        toast.error(`Speech error: ${event.error}`);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [isPl]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
  }, []);

  const parseTranscript = useCallback(() => {
    if (!transcript.trim()) return;

    // Split by common delimiters: periods, commas, "and", "also", newlines
    const delimiters = isPl
      ? /[.,;]\s*|\s+i\s+|\s+oraz\s+|\s+a\s+także\s+|\n/gi
      : /[.,;]\s*|\s+and\s+|\s+also\s+|\s+then\s+|\n/gi;

    const parts = transcript
      .split(delimiters)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);

    setParsedNodes(parts);
  }, [isPl, transcript]);

  useEffect(() => {
    if (transcript) {
      const timer = setTimeout(parseTranscript, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [parseTranscript, transcript]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const handleApply = useCallback(() => {
    if (parsedNodes.length === 0) return;
    onAddNodes(parsedNodes);
    toast.success(
      t('ideas.mindmap.addedNIdeas', 'Added {{count}} ideas', { count: parsedNodes.length }),
      { duration: 1200 }
    );
    setTranscript('');
    setParsedNodes([]);
    onClose();
  }, [onAddNodes, onClose, parsedNodes, t]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-to-node-modal-heading"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div className="flex items-center gap-2">
            <Mic size={16} className="text-c-danger" />
            <h3 className="text-sm font-bold text-c-text dark:text-c-text" id="voice-to-node-modal-heading">
              {t('ideas.mindmap.voiceNode', 'Voice to Node')}
            </h3>
          </div>
          <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted mt-1">
            {t(
              'ideas.mindmap.speakYourIdeasAiWillSplit',
              'Speak your ideas — AI will split them into separate nodes.'
            )}
          </p>
        </div>

        <div className="px-5 py-4">
          {/* Record button */}
          <div className="flex items-center justify-center mb-4">
            {listening ? (
              <button
                onClick={stopListening}
                className="w-16 h-16 rounded-full bg-c-danger hover:bg-c-danger text-c-text flex items-center justify-center shadow-lg shadow-danger-500/30 transition-all animate-pulse"
              >
                <Square size={24} />
              </button>
            ) : (
              <button
                onClick={startListening}
                disabled={locked}
                className="w-16 h-16 rounded-full bg-c-surface-raised from-danger-500 to-danger-600 hover:from-danger-600 hover:to-danger-700 text-c-text flex items-center justify-center shadow-lg shadow-danger-500/20 transition-all disabled:opacity-40"
              >
                <Mic size={24} />
              </button>
            )}
          </div>

          <div className="text-center text-[10px] text-c-text-secondary mb-4">
            {listening
              ? t('ideas.mindmap.recordingSpeakYourIdeas', '🔴 Recording... Speak your ideas')
              : t('ideas.mindmap.clickMicrophoneStart', 'Click microphone to start')}
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="mb-4">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1.5">
                {t('ideas.mindmap.transcript', 'Transcript')}
              </div>
              <div className="p-3 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle text-[11px] text-c-text-secondary dark:text-c-text leading-relaxed">
                {transcript}
              </div>
            </div>
          )}

          {/* Parsed nodes */}
          {parsedNodes.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1.5">
                {t('ideas.mindmap.detectedIdeas', 'Detected ideas')} ({parsedNodes.length})
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {parsedNodes.map((label, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-xl bg-c-surface-raised border border-c-success"
                  >
                    <Sparkles size={10} className="text-c-success shrink-0" />
                    <span className="text-[11px] text-c-text-secondary dark:text-c-text">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-c-border-subtle dark:border-c-border-subtle flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border-subtle dark:border-c-border-subtle text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            {t('ideas.mindmap.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleApply}
            disabled={parsedNodes.length === 0 || locked}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-c-surface-raised text-c-success dark:text-c-success border border-c-success transition-all disabled:opacity-40"
          >
            <Sparkles size={12} />
            {t('ideas.mindmap.addNIdeas', 'Add {{count}} ideas', { count: parsedNodes.length })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceToNode;
