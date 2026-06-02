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
  unavailableReason?: string | null;
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
  voiceUnavailableReason: string | null;
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
    unavailableReason,
    systemInstruction,
    enabled,
    onTranscriptUpdate,
    onModelAudioText,
    onStatusChange,
  } = options;

  const effectiveKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : null;

  const [voiceStatus, setVoiceStatus] = useState<TeresaVoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

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
    const browserWindow = window as BrowserWindow;
    const hasAudioContext = !!(window.AudioContext || browserWindow.webkitAudioContext);
    const hasGetUserMedia = !!navigator.mediaDevices?.getUserMedia;
    setVoiceAvailable(Boolean(enabled && hasAudioContext && hasGetUserMedia && effectiveKey));
  }, [effectiveKey, enabled]);

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

  useEffect(() => {
    if (enabled) return;
    attemptRef.current += 1;
    setVoiceError(null);
    setIsMuted(false);
    updateStatus('idle');
    void teardownVoice();
  }, [enabled, teardownVoice, updateStatus]);

  const startVoiceConversation = useCallback(async () => {
    const token = attemptRef.current + 1;
    attemptRef.current = token;

    if (!voiceAvailable || !effectiveKey || typeof window === 'undefined') {
      updateStatus('error');
      setVoiceError(
        unavailableReason ||
          'Voice unavailable — check microphone permissions and server-side voice configuration.'
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

      const ai = new GoogleGenAI({
        apiKey: effectiveKey,
        httpOptions: { apiVersion: 'v1alpha' },
      });
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
              prebuiltVoiceConfig: { voiceName },
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
              void Promise.resolve(
                sessionRef.current?.sendRealtimeInput({
                  media: {
                    mimeType: `audio/pcm;rate=${TERESA_VOICE_CONFIG.sampleRateInput}`,
                    data: btoa(binary),
                  },
                })
              ).catch(() => {
                /* Realtime send failures are surfaced by the Live API error callback. */
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
            const transcriptValue = sc?.inputTranscript ?? sc?.outputTranscript;
            const userTranscript = typeof transcriptValue === 'string' ? transcriptValue : '';
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

            let binaryString = '';
            try {
              binaryString = atob(base64Audio);
            } catch {
              return;
            }
            if (binaryString.length % 2 !== 0) return;

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
    effectiveKey,
    voiceAvailable,
    voiceName,
    systemInstruction,
    unavailableReason,
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
    const tracks =
      typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : stream.getTracks();
    setIsMuted((currentMuted) => {
      const nextMuted = !currentMuted;
      tracks.forEach((track) => {
        track.enabled = !nextMuted;
      });
      return nextMuted;
    });
  }, []);

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
    voiceUnavailableReason: unavailableReason || null,
    isMuted,
    toggleMute,
    startVoiceConversation,
    stopVoiceConversation,
    sendTextHistory,
  };
}
