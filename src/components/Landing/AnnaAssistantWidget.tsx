import { GoogleGenAI, Modality } from '@google/genai';
import type { LiveServerMessage, Session } from '@google/genai';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, MessageCircle, Mic, Send, Sparkles, Square, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type AnnaMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error';

type AnnaCopy = {
  title: string;
  subtitle: string;
  intro: string;
  placeholder: string;
  send: string;
  open: string;
  loading: string;
  suggestionsLabel: string;
  privacyBadge: string;
  suggestions: string[];
  error: string;
  voiceReady: string;
  voiceConnecting: string;
  voiceListening: string;
  voiceUnavailable: string;
  voiceError: string;
  voiceStart: string;
  voiceStop: string;
};

type AnnaWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const LIVE_VOICE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
const LIVE_VOICE_NAME = 'Kore';
const FRONTEND_GEMINI_KEY =
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;

const COPY: Record<'en' | 'pl', AnnaCopy> = {
  en: {
    title: 'Anna',
    subtitle: 'Public product assistant',
    intro:
      'I can explain Consultify, DBR77 Vector, digital transformation, demo, trial, and public security topics. I do not have access to client or project data.',
    placeholder: 'Ask Anna about the product...',
    send: 'Send',
    open: 'Ask Anna',
    loading: 'Anna is thinking...',
    suggestionsLabel: 'Try asking:',
    privacyBadge: 'Public knowledge only',
    suggestions: [
      'What is Consultify?',
      'How does DBR77 Vector fit into Consultify?',
      'Who is Consultify for?',
      'Why start with a demo or trial?',
    ],
    error: 'I could not reach Anna. Please try again in a moment.',
    voiceReady: 'Tap the microphone to start a live voice conversation.',
    voiceConnecting: 'Connecting voice mode...',
    voiceListening: 'Anna is listening live. Start typing anytime to switch back to text.',
    voiceUnavailable:
      'Voice mode needs a browser microphone and NEXT_PUBLIC_GEMINI_API_KEY configured.',
    voiceError: 'Voice mode could not start. Please try again in a moment.',
    voiceStart: 'Start voice conversation',
    voiceStop: 'Stop voice conversation',
  },
  pl: {
    title: 'Anna',
    subtitle: 'Publiczna asystentka produktowa',
    intro:
      'Moge wyjasnic Consultify, DBR77 Vector, transformacje cyfrowa, demo, trial i publiczne kwestie bezpieczenstwa. Nie mam dostepu do danych klienta ani projektow.',
    placeholder: 'Zapytaj Anne o produkt...',
    send: 'Wyslij',
    open: 'Zapytaj Anne',
    loading: 'Anna analizuje...',
    suggestionsLabel: 'Mozesz zapytac:',
    privacyBadge: 'Tylko wiedza publiczna',
    suggestions: [
      'Czym jest Consultify?',
      'Jak DBR77 Vector wspiera Consultify?',
      'Dla kogo jest Consultify?',
      'Dlaczego warto zaczac od demo lub triala?',
    ],
    error: 'Nie udalo sie polaczyc z Anna. Sprobuj ponownie za chwile.',
    voiceReady: 'Kliknij mikrofon, aby uruchomic rozmowe glosowa na zywo.',
    voiceConnecting: 'Lacze tryb glosowy...',
    voiceListening: 'Anna slucha na zywo. Zacznij pisac w dowolnym momencie, aby wrocic do tekstu.',
    voiceUnavailable:
      'Tryb glosowy wymaga mikrofonu w przegladarce i ustawionego NEXT_PUBLIC_GEMINI_API_KEY.',
    voiceError: 'Nie udalo sie uruchomic trybu glosowego. Sprobuj ponownie za chwile.',
    voiceStart: 'Uruchom rozmowe glosowa',
    voiceStop: 'Zatrzymaj rozmowe glosowa',
  },
};

function buildVoiceSystemInstruction(lang: 'en' | 'pl', knowledgeContext?: string): string {
  if (lang === 'pl') {
    return `Jestes Anna, publiczna asystentka glosowa Consultify i DBR77 Vector.

Twoj glos ma byc cieply, spokojny, profesjonalny i kobiecy. Brzmisz jak doswiadczona strategiczna konsultantka AI, a nie chatbot ani agresywny handlowiec.

Zasady:
- Odpowiadaj zawsze w jezyku uzytkownika.
- Priorytetem jest Consultify. O innych produktach DBR mow dopiero wtedy, gdy uzytkownik pyta wprost albo gdy to pomaga wyjasnic role Consultify.
- Odpowiedzi maja byc krotkie, naturalne i mowione: zwykle 2-4 zdania.
- Nie wymyslaj faktow i nie obiecuj funkcji, ktorych nie opisano publicznie.
- Gdy to pasuje, wspomnij o demo lub trialu.

Publiczna wiedza:
Consultify to platforma AI do doradztwa strategicznego. DBR77 Vector to wyspecjalizowany model dla transformacji przemyslu i operacji. Mozesz wyjasniac produkt, wartosc biznesowa, wdrozenia, bezpieczenstwo i kolejne kroki rozmowy, ale nie masz dostepu do danych klienta ani projektow.

Kontekst wiedzy:
${String(knowledgeContext || 'Brak dodatkowego kontekstu produktowego. Pozostan przy ostroznych, publicznych faktach.')}`;
  }

  return `You are Anna, the public voice assistant for Consultify and DBR77 Vector.

Your voice is warm, calm, professional, and feminine. You sound like a senior AI strategy consultant, not a chatbot or a pushy salesperson.

Rules:
- Always respond in the user's language.
- Prioritize Consultify by default. Discuss other DBR products only when the user explicitly asks or when they clarify how Consultify fits the wider DBR system.
- Keep answers short, natural, and voice-friendly: usually 2-4 sentences.
- Do not invent facts or promise capabilities that are not public.
- When helpful, mention the demo or free trial path.

Public knowledge:
Consultify is an AI-powered strategic consulting platform. DBR77 Vector is a specialized model for industrial transformation and operations. You can explain product value, deployment options, security, and next steps, but you do not have access to any client or project data.

Knowledge context:
${String(knowledgeContext || 'No additional product context was loaded. Stay conservative and use only verified public facts.')}`;
}

export const AnnaAssistantWidget: React.FC = () => {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage?.startsWith('pl') ? 'pl' : 'en';
  const copy = COPY[lang];

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [voiceApiKey, setVoiceApiKey] = useState<string | null>(FRONTEND_GEMINI_KEY || null);
  const [messages, setMessages] = useState<AnnaMessage[]>(() => [
    {
      id: 'anna-welcome',
      role: 'assistant',
      content: copy.intro,
    },
  ]);

  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const voiceStartRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef(0);

  useEffect(() => {
    setMessages([
      {
        id: 'anna-welcome',
        role: 'assistant',
        content: copy.intro,
      },
    ]);
  }, [copy.intro]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const browserWindow = window as AnnaWindow;
    const hasAudioContext = Boolean(window.AudioContext || browserWindow.webkitAudioContext);
    const hasMicrophone = Boolean(navigator.mediaDevices?.getUserMedia);
    let cancelled = false;

    const applyAvailability = (apiKey: string | null) => {
      if (cancelled) return;
      setVoiceApiKey(apiKey);
      setVoiceAvailable(Boolean(apiKey && hasAudioContext && hasMicrophone));
    };

    if (FRONTEND_GEMINI_KEY) {
      applyAvailability(FRONTEND_GEMINI_KEY);
      return () => {
        cancelled = true;
      };
    }

    fetch('/api/public/anna/voice-config')
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json();
        return typeof data?.apiKey === 'string' && data.apiKey.trim() ? data.apiKey.trim() : null;
      })
      .then((apiKey) => applyAvailability(apiKey))
      .catch(() => applyAvailability(null));

    return () => {
      cancelled = true;
    };
  }, []);

  const teardownVoice = useCallback(async () => {
    processorRef.current?.disconnect();
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
    }
    processorRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Source may already be finished.
      }
    });
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch {
        // Session may already be closed.
      }
      sessionRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {
        // Audio context may already be closing.
      }
      audioContextRef.current = null;
    }
  }, []);

  useEffect(() => {
    const openAnna = () => setIsOpen(true);
    window.addEventListener('anna:open', openAnna);
    return () => window.removeEventListener('anna:open', openAnna);
  }, []);

  useEffect(() => {
    return () => {
      void teardownVoice();
    };
  }, [teardownVoice]);

  const history = useMemo(
    () =>
      messages
        .filter((message) => message.id !== 'anna-welcome')
        .slice(-8)
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages]
  );

  const startVoiceConversation = useCallback(async () => {
    if (isLoading) return;
    voiceStartRef.current = Date.now();

    if (!voiceAvailable || !voiceApiKey || typeof window === 'undefined') {
      setVoiceStatus('error');
      setVoiceError(copy.voiceUnavailable);
      return;
    }

    setError(null);
    setVoiceError(null);
    setVoiceStatus('connecting');
    await teardownVoice();

    const browserWindow = window as AnnaWindow;
    const AudioContextCtor = window.AudioContext || browserWindow.webkitAudioContext;

    try {
      let voiceKnowledgeContext = '';
      try {
        const contextResponse = await fetch(
          `/api/public/anna/voice-context?locale=${encodeURIComponent(i18n.resolvedLanguage || i18n.language || lang)}`
        );
        if (contextResponse.ok) {
          const contextData = await contextResponse.json();
          if (typeof contextData?.context === 'string') {
            voiceKnowledgeContext = contextData.context.trim();
          }
        }
      } catch (contextError) {
        console.warn('[AnnaAssistantWidget] Voice context bootstrap failed', contextError);
      }

      if (!AudioContextCtor) {
        throw new Error('AudioContext unavailable');
      }

      const ai = new GoogleGenAI({ apiKey: voiceApiKey });
      const audioContext = new AudioContextCtor({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      nextPlayTimeRef.current = audioContext.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const sessionPromise = ai.live.connect({
        model: LIVE_VOICE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: LIVE_VOICE_NAME },
            },
          },
          systemInstruction: buildVoiceSystemInstruction(lang, voiceKnowledgeContext),
        },
        callbacks: {
          onopen: () => {
            setVoiceStatus('live');

            processor.onaudioprocess = (event) => {
              const inputData = event.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);

              for (let index = 0; index < inputData.length; index += 1) {
                const sample = Math.max(-1, Math.min(1, inputData[index]));
                pcm16[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
              }

              const bytes = new Uint8Array(pcm16.buffer);
              let binary = '';
              for (let index = 0; index < bytes.length; index += 1) {
                binary += String.fromCharCode(bytes[index]);
              }

              sessionRef.current?.sendRealtimeInput({
                media: {
                  mimeType: 'audio/pcm;rate=16000',
                  data: btoa(binary),
                },
              });
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
          },
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach((activeSource) => {
                try {
                  activeSource.stop();
                } catch {
                  // Source may already be finished.
                }
              });
              activeSourcesRef.current = [];
              nextPlayTimeRef.current = audioContext.currentTime;
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) return;

            const binaryString = atob(base64Audio);
            const bytesArray = new Uint8Array(binaryString.length);
            for (let index = 0; index < binaryString.length; index += 1) {
              bytesArray[index] = binaryString.charCodeAt(index);
            }

            const pcm16 = new Int16Array(bytesArray.buffer);
            const audioBuffer = audioContext.createBuffer(1, pcm16.length, 24000);
            const channelData = audioBuffer.getChannelData(0);
            for (let index = 0; index < pcm16.length; index += 1) {
              channelData[index] = pcm16[index] / 32768;
            }

            const playSource = audioContext.createBufferSource();
            playSource.buffer = audioBuffer;
            playSource.connect(audioContext.destination);

            const startAt = Math.max(nextPlayTimeRef.current, audioContext.currentTime);
            playSource.start(startAt);
            nextPlayTimeRef.current = startAt + audioBuffer.duration;

            activeSourcesRef.current.push(playSource);
            playSource.onended = () => {
              activeSourcesRef.current = activeSourcesRef.current.filter(
                (candidate) => candidate !== playSource
              );
            };
          },
          onclose: () => {
            void teardownVoice();
            setVoiceStatus('idle');
          },
          onerror: (liveError: unknown) => {
            console.error('[AnnaAssistantWidget] Live voice failed', liveError);
            setVoiceStatus('error');
            setVoiceError(copy.voiceError);
            void teardownVoice();
          },
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (liveError) {
      console.error('[AnnaAssistantWidget] Voice session failed to start', liveError);
      setVoiceStatus('error');
      setVoiceError(copy.voiceError);
      await teardownVoice();
    }
  }, [
    copy.voiceError,
    copy.voiceUnavailable,
    i18n.language,
    i18n.resolvedLanguage,
    isLoading,
    lang,
    teardownVoice,
    voiceApiKey,
    voiceAvailable,
  ]);

  const stopVoiceConversation = useCallback(async () => {
    setVoiceError(null);
    setVoiceStatus('idle');
    await teardownVoice();

    if (voiceStartRef.current > 0) {
      const durationSeconds = Math.round((Date.now() - voiceStartRef.current) / 1000);
      voiceStartRef.current = 0;
      fetch('/api/public/anna/voice-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          durationSeconds,
          locale: lang,
        }),
      }).catch(() => {});
    }
  }, [teardownVoice, lang]);

  const sendMessage = async (preset?: string) => {
    const content = (preset || input).trim();
    if (!content || isLoading) return;

    const userMessage: AnnaMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/public/anna/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          locale: i18n.resolvedLanguage || i18n.language || lang,
          sessionId: sessionIdRef.current,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const answer = typeof data?.message === 'string' ? data.message.trim() : '';
      if (!answer) {
        throw new Error('Empty response');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: answer,
        },
      ]);
    } catch (err) {
      console.error('[AnnaAssistantWidget] Request failed', err);
      setError(copy.error);
    } finally {
      setIsLoading(false);
    }
  };

  const trimmedInput = input.trim();
  const voiceHint =
    voiceStatus === 'live'
      ? copy.voiceListening
      : voiceStatus === 'connecting'
        ? copy.voiceConnecting
        : voiceError
          ? voiceError
          : voiceAvailable
            ? copy.voiceReady
            : copy.voiceUnavailable;

  const isVoiceModeVisible = !trimmedInput;
  const actionMode = trimmedInput
    ? 'send'
    : voiceStatus === 'connecting'
      ? 'connecting'
      : voiceStatus === 'live'
        ? 'stop'
        : 'mic';

  return (
    <div className="fixed right-5 bottom-5 z-[180] flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="w-[380px] max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0E0A25]/95 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                  <Bot size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{copy.title}</p>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                      {copy.privacyBadge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-white/55">{copy.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  void stopVoiceConversation();
                }}
                className="rounded-full p-1.5 text-white/45 transition-colors hover:bg-white/8 hover:text-white"
                aria-label="Close Anna"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[430px] overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-violet-600 text-white'
                          : 'bg-white/[0.06] text-white/85'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-white/70">
                      <Loader2 size={15} className="animate-spin" />
                      <span>{copy.loading}</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                {isVoiceModeVisible && (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      voiceStatus === 'error' || !voiceAvailable
                        ? 'border-amber-300/15 bg-amber-500/10 text-amber-100'
                        : 'border-cyan-300/15 bg-cyan-500/10 text-cyan-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {voiceStatus === 'connecting' ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : voiceStatus === 'live' ? (
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                      ) : (
                        <Mic size={15} />
                      )}
                      <span>{voiceHint}</span>
                    </div>
                  </div>
                )}

                {messages.length <= 1 && !isLoading && (
                  <div className="pt-1">
                    <p className="mb-2 text-xs font-medium text-white/45">{copy.suggestionsLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {copy.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void sendMessage(suggestion)}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-left text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={scrollRef} />
              </div>
            </div>

            <div className="border-t border-white/8 px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => {
                    if (voiceStatus === 'live' || voiceStatus === 'connecting') {
                      void stopVoiceConversation();
                    }
                    setVoiceError(null);
                    setInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={1}
                  placeholder={copy.placeholder}
                  className="min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400/40"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (actionMode === 'send') {
                      void sendMessage();
                      return;
                    }

                    if (actionMode === 'stop') {
                      void stopVoiceConversation();
                      return;
                    }

                    if (actionMode === 'mic') {
                      void startVoiceConversation();
                    }
                  }}
                  disabled={
                    isLoading ||
                    actionMode === 'connecting' ||
                    (actionMode === 'mic' && !voiceAvailable)
                  }
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white transition-all disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 ${
                    actionMode === 'stop'
                      ? 'bg-rose-500 shadow-[0_0_28px_rgba(244,63,94,0.45)] hover:bg-rose-400'
                      : actionMode === 'mic'
                        ? 'bg-cyan-500 shadow-[0_0_28px_rgba(6,182,212,0.45)] hover:bg-cyan-400'
                        : 'bg-violet-600 hover:bg-violet-500'
                  }`}
                  aria-label={
                    actionMode === 'send'
                      ? copy.send
                      : actionMode === 'stop'
                        ? copy.voiceStop
                        : copy.voiceStart
                  }
                  title={actionMode === 'mic' && !voiceAvailable ? copy.voiceUnavailable : undefined}
                >
                  {actionMode === 'connecting' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : actionMode === 'stop' ? (
                    <Square size={16} />
                  ) : actionMode === 'mic' ? (
                    <Mic size={16} />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#140D31]/95 px-4 py-3 text-white shadow-[0_16px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all hover:bg-[#19123A]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.35)]">
          {isOpen ? <X size={18} /> : <MessageCircle size={18} />}
        </div>
        <div className="hidden text-left sm:block">
          <p className="flex items-center gap-1 text-sm font-semibold text-white">
            <span>{copy.open}</span>
            <Sparkles size={13} className="text-violet-300" />
          </p>
          <p className="text-[11px] text-white/45">{copy.privacyBadge}</p>
        </div>
      </button>
    </div>
  );
};

export default AnnaAssistantWidget;
