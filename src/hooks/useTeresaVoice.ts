/**
 * useTeresaVoice — Gemini Live realtime bidirectional voice for Teresa.
 *
 * Provides real-time PCM audio streaming to/from Gemini with barge-in,
 * transcript callbacks, and lifecycle management.
 */

import type { LiveServerMessage, Session } from '@google/genai';
import { GoogleGenAI, Modality } from '@google/genai';
import { useCallback, useEffect, useRef, useState } from 'react';

import { TERESA_VOICE_CONFIG } from '../config/teresaVoice';

type BrowserWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export type TeresaVoiceStatus = 'idle' | 'connecting' | 'live' | 'error';

export interface UseTeresaVoiceOptions {
  apiKey?: string | null;
  voiceName?: string;
  language: string;
  systemInstruction: string;
  enabled: boolean;
  onTranscriptUpdate?: (transcript: string) => void;
  onModelAudioText?: (text: string) => void;
  onStatusChange?: (status: TeresaVoiceStatus) => void;
}

export interface UseTeresaVoiceReturn {
  voiceStatus: TeresaVoiceStatus;
  voiceError: string | null;
  voiceAvailable: boolean;
  isMuted: boolean;
  toggleMute: () => void;
  startVoiceConversation: () => Promise<void>;
  stopVoiceConversation: () => Promise<void>;
  sendTextHistory: (turns: Array<{ role: string; content: string }>) => void;
}

export function useTeresaVoice(options: UseTeresaVoiceOptions): UseTeresaVoiceReturn {
  const {
    apiKey,
    voiceName = TERESA_VOICE_CONFIG.defaultVoiceName,
    systemInstruction,
    enabled,
    onTranscriptUpdate,
    onModelAudioText,
    onStatusChange,
  } = options;

  const [voiceStatus, setVoiceStatus] = useState<TeresaVoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [resolvedApiKey, setResolvedApiKey] = useState<string | null>(apiKey || null);
  const [resolvedVoiceName, setResolvedVoiceName] = useState<string>(
    voiceName || TERESA_VOICE_CONFIG.defaultVoiceName
  );

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef(0);
  const attemptRef = useRef(0);

  const onTranscriptRef = useRef(onTranscriptUpdate);
  onTranscriptRef.current = onTranscriptUpdate;
  const onModelAudioTextRef = useRef(onModelAudioText);
  onModelAudioTextRef.current = onModelAudioText;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const updateStatus = useCallback((s: TeresaVoiceStatus) => {
    setVoiceStatus(s);
    onStatusChangeRef.current?.(s);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    const applyVoiceConfig = (config: {
      apiKey: string | null;
      voiceName?: string | null;
      enabled?: boolean;
    }) => {
      if (cancelled) return;

      const nextApiKey = config.apiKey;
      const nextVoiceName =
        String(config.voiceName || '').trim() || voiceName || TERESA_VOICE_CONFIG.defaultVoiceName;
      const browserWindow = window as BrowserWindow;
      const hasAudioContext = !!(window.AudioContext || browserWindow.webkitAudioContext);
      const hasGetUserMedia = !!navigator.mediaDevices?.getUserMedia;

      setResolvedApiKey(nextApiKey);
      setResolvedVoiceName(nextVoiceName);
      setVoiceAvailable(
        Boolean(
          enabled && nextApiKey && config.enabled !== false && hasAudioContext && hasGetUserMedia
        )
      );
    };

    if (apiKey) {
      applyVoiceConfig({ apiKey, voiceName, enabled: true });
      return () => {
        cancelled = true;
      };
    }

    fetch('/api/v10/teresa/voice-config', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) {
          return {
            apiKey: null,
            voiceName: voiceName || TERESA_VOICE_CONFIG.defaultVoiceName,
            enabled: false,
          };
        }

        const payload = await response.json();
        const data = payload?.data ?? payload;
        return {
          apiKey:
            typeof data?.apiKey === 'string' && data.apiKey.trim()
              ? data.apiKey.trim()
              : null,
          voiceName:
            typeof data?.voiceName === 'string' && data.voiceName.trim()
              ? data.voiceName.trim()
              : voiceName || TERESA_VOICE_CONFIG.defaultVoiceName,
          enabled: data?.enabled !== false,
        };
      })
      .then((config) => applyVoiceConfig(config))
      .catch(() => {
        applyVoiceConfig({
          apiKey: null,
          voiceName: voiceName || TERESA_VOICE_CONFIG.defaultVoiceName,
          enabled: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, enabled, voiceName]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const browserWindow = window as BrowserWindow;
    const hasAudioContext = !!(window.AudioContext || browserWindow.webkitAudioContext);
    const hasGetUserMedia = !!navigator.mediaDevices?.getUserMedia;
    setVoiceAvailable(Boolean(enabled && hasAudioContext && hasGetUserMedia && resolvedApiKey));
  }, [enabled, resolvedApiKey]);

  const teardownVoice = useCallback(async () => {
    processorRef.current?.disconnect();
    if (processorRef.current) processorRef.current.onaudioprocess = null;
    processorRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    });
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch {
        /* already closed */
      }
      sessionRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {
        /* already closing */
      }
      audioContextRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      void teardownVoice();
    };
  }, [teardownVoice]);

  const startVoiceConversation = useCallback(async () => {
    const token = attemptRef.current + 1;
    attemptRef.current = token;

    setVoiceError(null);

    if (!voiceAvailable || !resolvedApiKey || typeof window === 'undefined') {
      updateStatus('error');
      setVoiceError(
        'Voice unavailable — check microphone permissions, or ensure the server has GEMINI_API_KEY configured.'
      );
      return;
    }

    setVoiceError(null);
    setIsMuted(false);
    updateStatus('connecting');
    await teardownVoice();

    const browserWindow = window as BrowserWindow;
    const AudioContextCtor = window.AudioContext || browserWindow.webkitAudioContext;

    try {
      if (!AudioContextCtor) throw new Error('AudioContext unavailable');

      const ai = new GoogleGenAI({ apiKey: resolvedApiKey });
      const audioContext = new AudioContextCtor({
        sampleRate: TERESA_VOICE_CONFIG.sampleRateInput,
      });
      audioContextRef.current = audioContext;
      nextPlayTimeRef.current = audioContext.currentTime;

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = micStream;

      const source = audioContext.createMediaStreamSource(micStream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const sessionPromise = ai.live.connect({
        model: TERESA_VOICE_CONFIG.model,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: resolvedVoiceName },
            },
          },
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            if (attemptRef.current !== token) return;
            updateStatus('live');

            processor.onaudioprocess = (event) => {
              const inputData = event.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                const sample = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
              }
              const bytes = new Uint8Array(pcm16.buffer);
              let binary = '';
              for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              sessionRef.current?.sendRealtimeInput({
                media: {
                  mimeType: `audio/pcm;rate=${TERESA_VOICE_CONFIG.sampleRateInput}`,
                  data: btoa(binary),
                },
              });
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
          },

          onmessage: (message: LiveServerMessage) => {
            if (attemptRef.current !== token) return;

            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach((s) => {
                try {
                  s.stop();
                } catch {
                  /* noop */
                }
              });
              activeSourcesRef.current = [];
              nextPlayTimeRef.current = audioContext.currentTime;
            }

            const sc = message.serverContent as Record<string, unknown> | undefined;
            const userTranscript = (sc?.inputTranscript ?? sc?.outputTranscript) as
              | string
              | undefined;
            if (userTranscript && onTranscriptRef.current) {
              onTranscriptRef.current(userTranscript);
            }

            const textPart = message.serverContent?.modelTurn?.parts?.find((p) => p.text);
            if (textPart?.text && onModelAudioTextRef.current) {
              onModelAudioTextRef.current(textPart.text);
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.find((p) => p.inlineData)
              ?.inlineData?.data;
            if (!base64Audio) return;

            const binaryString = atob(base64Audio);
            const bytesArray = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytesArray[i] = binaryString.charCodeAt(i);
            }

            const pcm16 = new Int16Array(bytesArray.buffer);
            const audioBuffer = audioContext.createBuffer(
              1,
              pcm16.length,
              TERESA_VOICE_CONFIG.sampleRateOutput
            );
            const channelData = audioBuffer.getChannelData(0);
            for (let i = 0; i < pcm16.length; i++) {
              channelData[i] = pcm16[i] / 32768;
            }

            const playSource = audioContext.createBufferSource();
            playSource.buffer = audioBuffer;
            playSource.connect(audioContext.destination);

            const startAt = Math.max(nextPlayTimeRef.current, audioContext.currentTime);
            playSource.start(startAt);
            nextPlayTimeRef.current = startAt + audioBuffer.duration;

            activeSourcesRef.current.push(playSource);
            playSource.onended = () => {
              activeSourcesRef.current = activeSourcesRef.current.filter((c) => c !== playSource);
            };
          },

          onclose: () => {
            if (attemptRef.current !== token) return;
            void teardownVoice();
            updateStatus('idle');
          },

          onerror: (liveError: unknown) => {
            if (attemptRef.current !== token) return;
            console.error('[useTeresaVoice] Gemini Live error', liveError);
            updateStatus('error');
            setVoiceError('Voice session error — try again.');
            void teardownVoice();
          },
        },
      });

      const session = await sessionPromise;
      if (attemptRef.current !== token) {
        try {
          session.close();
        } catch {
          /* noop */
        }
        return;
      }
      sessionRef.current = session;
    } catch (err) {
      if (attemptRef.current !== token) return;
      console.error('[useTeresaVoice] Failed to start voice', err);
      updateStatus('error');
      setVoiceError('Could not start voice session.');
      await teardownVoice();
    }
  }, [
    resolvedApiKey,
    resolvedVoiceName,
    voiceAvailable,
    systemInstruction,
    teardownVoice,
    updateStatus,
  ]);

  const stopVoiceConversation = useCallback(async () => {
    attemptRef.current += 1;
    setVoiceError(null);
    setIsMuted(false);
    updateStatus('idle');
    await teardownVoice();
  }, [teardownVoice, updateStatus]);

  const toggleMute = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const tracks = stream.getAudioTracks();
    const nextMuted = !isMuted;
    tracks.forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }, [isMuted]);

  const sendTextHistory = useCallback((turns: Array<{ role: string; content: string }>) => {
    const session = sessionRef.current;
    if (!session || typeof session.sendClientContent !== 'function') return;

    const geminiTurns = turns
      .filter((t) => t.content.trim())
      .slice(-TERESA_VOICE_CONFIG.maxHistoryTurns)
      .map((t) => ({
        role: t.role === 'assistant' || t.role === 'model' ? 'model' : 'user',
        parts: [{ text: t.content.trim() }],
      }));

    if (geminiTurns.length > 0) {
      void Promise.resolve(session.sendClientContent({ turns: geminiTurns, turnComplete: false }));
    }
  }, []);

  return {
    voiceStatus,
    voiceError,
    voiceAvailable,
    isMuted,
    toggleMute,
    startVoiceConversation,
    stopVoiceConversation,
    sendTextHistory,
  };
}
