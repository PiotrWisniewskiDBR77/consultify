/**
 * VoiceToNode — Speech recognition that creates mind map nodes from voice input.
 * Uses the Web Speech API (SpeechRecognition).
 */
import { Loader2, Mic, MicOff, Sparkles, Square } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface VoiceToNodeProps {
  open: boolean;
  onClose: () => void;
  locked: boolean;
  onAddNodes: (labels: string[]) => void;
}

export const VoiceToNode: React.FC<VoiceToNodeProps> = ({ open, onClose, locked, onAddNodes }) => {
  const { i18n } = useTranslation();
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
        isPl
          ? 'Przeglądarka nie obsługuje rozpoznawania mowy'
          : 'Browser does not support speech recognition'
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
      isPl ? `Dodano ${parsedNodes.length} pomysłów` : `Added ${parsedNodes.length} ideas`,
      { duration: 1200 }
    );
    setTranscript('');
    setParsedNodes([]);
    onClose();
  }, [isPl, onAddNodes, onClose, parsedNodes]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-2">
            <Mic size={16} className="text-rose-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              {isPl ? 'Mów pomysły' : 'Voice to Node'}
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {isPl
              ? 'Mów swoje pomysły — AI rozdzieli je na osobne węzły.'
              : 'Speak your ideas — AI will split them into separate nodes.'}
          </p>
        </div>

        <div className="px-5 py-4">
          {/* Record button */}
          <div className="flex items-center justify-center mb-4">
            {listening ? (
              <button
                onClick={stopListening}
                className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all animate-pulse"
              >
                <Square size={24} />
              </button>
            ) : (
              <button
                onClick={startListening}
                disabled={locked}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 transition-all disabled:opacity-40"
              >
                <Mic size={24} />
              </button>
            )}
          </div>

          <div className="text-center text-[10px] text-slate-400 mb-4">
            {listening
              ? isPl
                ? '🔴 Nagrywam... Mów swoje pomysły'
                : '🔴 Recording... Speak your ideas'
              : isPl
                ? 'Kliknij mikrofon, aby rozpocząć'
                : 'Click microphone to start'}
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="mb-4">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1.5">
                {isPl ? 'Transkrypcja' : 'Transcript'}
              </div>
              <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-navy-950/20 border border-slate-200/30 dark:border-navy-700/30 text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed">
                {transcript}
              </div>
            </div>
          )}

          {/* Parsed nodes */}
          {parsedNodes.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1.5">
                {isPl ? 'Rozpoznane pomysły' : 'Detected ideas'} ({parsedNodes.length})
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {parsedNodes.map((label, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/5 border border-emerald-400/10"
                  >
                    <Sparkles size={10} className="text-emerald-500 shrink-0" />
                    <span className="text-[11px] text-slate-700 dark:text-slate-200">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleApply}
            disabled={parsedNodes.length === 0 || locked}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-500/15 to-green-500/10 text-emerald-700 dark:text-emerald-300 hover:from-emerald-500/25 hover:to-green-500/15 border border-emerald-500/10 transition-all disabled:opacity-40"
          >
            <Sparkles size={12} />
            {isPl ? `Dodaj ${parsedNodes.length} pomysłów` : `Add ${parsedNodes.length} ideas`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceToNode;
