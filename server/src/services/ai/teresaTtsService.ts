/**
 * teresaTtsService — unidirectional Text-to-Speech for Teresa (Phase 1A).
 *
 * Uses the Gemini generative TTS model via @google/genai, reusing the same
 * server-side Gemini key resolution as the Live voice path. Returns a ready-to-play
 * WAV buffer (Gemini TTS emits raw signed 16-bit little-endian PCM @ 24kHz mono;
 * we wrap it in a minimal WAV header so the browser can decode it with the
 * standard AudioContext / <audio> element — no client-side PCM plumbing needed).
 *
 * This is intentionally simpler than the full-duplex Gemini Live path
 * (geminiLiveTokenService): it is a request/response synth for reading back
 * Teresa's text answers aloud, and degrades gracefully (returns null) when no
 * server key is configured.
 */

import { GoogleGenAI } from '@google/genai';

import logger from '../../utils/Logger.js';
import { resolveGeminiLiveServerKey } from './geminiLiveTokenService.js';

const DEFAULT_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const DEFAULT_VOICE_NAME = 'Kore';
const PCM_SAMPLE_RATE = 24_000;
const PCM_CHANNELS = 1;
const PCM_BITS_PER_SAMPLE = 16;
const MAX_TTS_INPUT_CHARS = 4_000;

export interface TeresaTtsRequest {
  text: string;
  language?: string | null;
  voiceName?: string | null;
}

export interface TeresaTtsResult {
  audio: Buffer;
  contentType: 'audio/wav';
  voiceName: string;
  model: string;
}

export type TeresaTtsUnavailableReason =
  | 'server_missing_gemini_live_key'
  | 'empty_input'
  | 'provider_no_audio'
  | 'provider_error';

export class TeresaTtsUnavailableError extends Error {
  reason: TeresaTtsUnavailableReason;
  constructor(reason: TeresaTtsUnavailableReason, message: string) {
    super(message);
    this.name = 'TeresaTtsUnavailableError';
    this.reason = reason;
  }
}

export const isTeresaTtsConfigured = (): boolean => Boolean(resolveGeminiLiveServerKey());

/**
 * Strip markdown / control noise so the synth reads clean prose, and clamp length.
 */
export const sanitizeTtsInput = (raw: string): string => {
  return String(raw || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TTS_INPUT_CHARS);
};

/**
 * Wrap raw little-endian PCM in a 44-byte canonical WAV header.
 */
const pcmToWav = (pcm: Buffer): Buffer => {
  const byteRate = (PCM_SAMPLE_RATE * PCM_CHANNELS * PCM_BITS_PER_SAMPLE) / 8;
  const blockAlign = (PCM_CHANNELS * PCM_BITS_PER_SAMPLE) / 8;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(PCM_CHANNELS, 22);
  header.writeUInt32LE(PCM_SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(PCM_BITS_PER_SAMPLE, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
};

/**
 * Synthesize Teresa speech. Throws TeresaTtsUnavailableError for known,
 * recoverable conditions; the route maps these to honest HTTP statuses.
 */
export const synthesizeTeresaSpeech = async (req: TeresaTtsRequest): Promise<TeresaTtsResult> => {
  const apiKey = resolveGeminiLiveServerKey();
  if (!apiKey) {
    throw new TeresaTtsUnavailableError(
      'server_missing_gemini_live_key',
      'Teresa text-to-speech requires a server-side Gemini key.'
    );
  }

  const text = sanitizeTtsInput(req.text);
  if (!text) {
    throw new TeresaTtsUnavailableError('empty_input', 'No speakable text was provided.');
  }

  const voiceName =
    (typeof req.voiceName === 'string' && req.voiceName.trim()) ||
    String(process.env.TERESA_VOICE_NAME || '').trim() ||
    DEFAULT_VOICE_NAME;
  const model = String(process.env.TERESA_TTS_MODEL || '').trim() || DEFAULT_TTS_MODEL;

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      } as Record<string, unknown>,
    });

    const inlineData = response?.candidates?.[0]?.content?.parts?.find(
      (part: any) => part?.inlineData?.data
    )?.inlineData;
    const base64 = inlineData?.data;

    if (!base64) {
      throw new TeresaTtsUnavailableError(
        'provider_no_audio',
        'The speech provider returned no audio.'
      );
    }

    const pcm = Buffer.from(base64, 'base64');
    return {
      audio: pcmToWav(pcm),
      contentType: 'audio/wav',
      voiceName,
      model,
    };
  } catch (error) {
    if (error instanceof TeresaTtsUnavailableError) throw error;
    logger.error('[TeresaTTS] synthesis failed', {
      message: error instanceof Error ? error.message : String(error),
      model,
    });
    throw new TeresaTtsUnavailableError(
      'provider_error',
      'Teresa text-to-speech is temporarily unavailable.'
    );
  }
};
