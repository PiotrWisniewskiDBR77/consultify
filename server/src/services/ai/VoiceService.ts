import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import { OpenAI } from 'openai';
import path from 'path';

import logger from '../../utils/Logger.js';
import { llmConfigService } from './llmConfigService.js';

/**
 * Env var names the STT path can use, in priority order.
 * Exported so health probes / startup logs can report WHICH keys are required
 * without duplicating the resolution logic (SSOT).
 */
export const STT_ENV_KEYS = [
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_AI_API_KEY',
  'GOOGLE_API_KEY',
] as const;

export interface SttProviderAvailability {
  available: boolean;
  provider: 'openai' | 'groq' | 'gemini' | null;
  /** Env var names that would enable STT (for diagnostics; never the values). */
  requiredEnv: readonly string[];
}

/**
 * Cheap, synchronous env-only check of whether the server STT path has ANY
 * usable provider key. Does NOT consult llmConfigService (DB) — it answers the
 * question "is STT wired via env on this deploy?" for health probes / startup logs.
 *
 * A key that is an OpenRouter/test placeholder (sk-or-…/sk-test…) is treated as
 * NOT a valid OpenAI Whisper key, mirroring getClient() below.
 */
export function detectSttProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env
): SttProviderAvailability {
  const openaiKey = (env.OPENAI_API_KEY || '').trim();
  if (openaiKey && !openaiKey.startsWith('sk-or-') && !openaiKey.startsWith('sk-test')) {
    return { available: true, provider: 'openai', requiredEnv: STT_ENV_KEYS };
  }
  if ((env.GROQ_API_KEY || '').trim()) {
    return { available: true, provider: 'groq', requiredEnv: STT_ENV_KEYS };
  }
  const geminiKey = (
    env.GEMINI_API_KEY ||
    env.GOOGLE_AI_API_KEY ||
    (env as Record<string, string | undefined>).GOOGLE_API_KEY ||
    ''
  ).trim();
  if (geminiKey && geminiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
    return { available: true, provider: 'gemini', requiredEnv: STT_ENV_KEYS };
  }
  return { available: false, provider: null, requiredEnv: STT_ENV_KEYS };
}

export class VoiceService {
  private static instance: VoiceService;
  private openai: OpenAI | null = null;
  private groq: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;

  private constructor() {}

  public static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  private async getClient(): Promise<{ client: OpenAI; model: string }> {
    if (this.openai) return { client: this.openai, model: 'whisper-1' };
    if (this.groq) return { client: this.groq, model: 'whisper-large-v3' };

    let openaiKey = process.env.OPENAI_API_KEY || '';
    if (!openaiKey || openaiKey.startsWith('sk-or-') || openaiKey.startsWith('sk-test')) {
      const config = await llmConfigService.getProviderConfig('openai');
      const configKey = config?.api_key || '';
      if (configKey && !configKey.startsWith('sk-or-') && !configKey.startsWith('sk-test')) {
        openaiKey = configKey;
      } else {
        openaiKey = '';
      }
    }

    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      return { client: this.openai, model: 'whisper-1' };
    }

    const groqKey = process.env.GROQ_API_KEY || '';
    if (groqKey) {
      this.groq = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });
      logger.info('[VoiceService] Using Groq Whisper as STT provider');
      return { client: this.groq, model: 'whisper-large-v3' };
    }

    const allProviders = await llmConfigService.getAllProviders();
    for (const p of allProviders) {
      const key = p.api_key || '';
      const endpoint = (p as any).endpoint || '';
      if (
        key &&
        !key.startsWith('sk-or-') &&
        !key.startsWith('sk-test') &&
        !endpoint.includes('openrouter')
      ) {
        this.openai = new OpenAI({ apiKey: key, ...(endpoint ? { baseURL: endpoint } : {}) });
        logger.info(`[VoiceService] Using provider ${p.provider || p.name} for STT`);
        return { client: this.openai, model: 'whisper-1' };
      }
    }

    throw new Error(
      'No STT provider available. Set OPENAI_API_KEY (native OpenAI) or GROQ_API_KEY for Whisper transcription.'
    );
  }

  /**
   * Resolve the Google/Gemini API key (the same key Teresa's voice uses).
   * Env first (GEMINI_API_KEY / GOOGLE_AI_API_KEY / GOOGLE_API_KEY), then llmConfig.
   */
  private async resolveGeminiKey(): Promise<string> {
    const envKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      (process.env as Record<string, string | undefined>).GOOGLE_API_KEY ||
      '';
    if (envKey && envKey !== 'YOUR_GEMINI_API_KEY_HERE') return envKey;
    for (const provider of ['google', 'gemini']) {
      try {
        const cfg = await llmConfigService.getProviderConfig(provider);
        if (cfg?.api_key) return cfg.api_key;
      } catch {
        /* provider not configured — ignore */
      }
    }
    return '';
  }

  private mimeForAudio(filePath: string): string {
    switch (path.extname(filePath).toLowerCase()) {
      case '.mp3':
        return 'audio/mp3';
      case '.wav':
        return 'audio/wav';
      case '.ogg':
      case '.oga':
        return 'audio/ogg';
      case '.m4a':
      case '.mp4':
        return 'audio/mp4';
      case '.aac':
        return 'audio/aac';
      case '.flac':
        return 'audio/flac';
      case '.webm':
        return 'audio/webm';
      default:
        return 'audio/ogg';
    }
  }

  /**
   * Transcribe audio with Gemini (reuses the Google key already powering Teresa's voice).
   * Used as the STT provider when no OpenAI/Groq Whisper key is configured.
   */
  private async transcribeWithGemini(
    audioFilePath: string,
    language: string | undefined,
    apiKey: string
  ): Promise<string> {
    if (!this.gemini) this.gemini = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_STT_MODEL || 'gemini-2.0-flash';
    const model = this.gemini.getGenerativeModel({ model: modelName });

    const base64 = fs.readFileSync(audioFilePath).toString('base64');
    const langHint = language ? ` The spoken language is "${language}".` : '';
    const prompt =
      `Transcribe the following audio recording verbatim into text.${langHint} ` +
      'Return ONLY the spoken transcript — no commentary, speaker labels, timestamps, or quotation marks. ' +
      'If there is no intelligible speech, return an empty string.';

    const result = await model.generateContent([
      { inlineData: { mimeType: this.mimeForAudio(audioFilePath), data: base64 } },
      { text: prompt },
    ]);

    return (result.response.text() || '').trim();
  }

  /**
   * Transcribe audio. Prefers Whisper (OpenAI/Groq) when a key is set;
   * otherwise falls back to Gemini using the existing Google key (Teresa's).
   */
  public async transcribe(audioFilePath: string, language?: string): Promise<string> {
    let whisper: { client: OpenAI; model: string } | null = null;
    try {
      whisper = await this.getClient();
    } catch {
      whisper = null; // no Whisper key configured — Gemini fallback below
    }

    if (whisper) {
      try {
        const transcription = await whisper.client.audio.transcriptions.create({
          file: fs.createReadStream(audioFilePath),
          model: whisper.model,
          language: language || undefined,
        });
        return transcription.text;
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`[VoiceService] Whisper transcription failed: ${error.message}`);
        }
        this.openai = null;
        this.groq = null;
        // fall through to Gemini
      }
    }

    const geminiKey = await this.resolveGeminiKey();
    if (geminiKey) {
      try {
        logger.info('[VoiceService] Using Gemini as STT provider');
        return await this.transcribeWithGemini(audioFilePath, language, geminiKey);
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`[VoiceService] Gemini transcription failed: ${error.message}`);
        }
        this.gemini = null;
        throw error;
      }
    }

    throw new Error(
      'No STT provider available. Set GEMINI_API_KEY (Google — reused from Teresa voice), OPENAI_API_KEY, or GROQ_API_KEY.'
    );
  }

  /**
   * Generate speech from text using OpenAI TTS
   */
  public async synthesize(
    text: string,
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy'
  ): Promise<Buffer> {
    try {
      const { client } = await this.getClient();

      const mp3 = await client.audio.speech.create({
        model: 'tts-1',
        voice,
        input: text,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      return buffer;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`[VoiceService] Synthesis failed: ${error.message}`);
      }
      throw error;
    }
  }
}

export const voiceService = VoiceService.getInstance();
export default voiceService;
