import fs from 'fs';
import { OpenAI } from 'openai';
import path from 'path';

import logger from '../../utils/Logger.js';
import { llmConfigService } from './llmConfigService.js';

export class VoiceService {
  private static instance: VoiceService;
  private openai: OpenAI | null = null;
  private groq: OpenAI | null = null;

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

    const allProviders = await llmConfigService.getActiveProviders();
    for (const p of allProviders) {
      const key = p.api_key || '';
      const endpoint = (p as any).endpoint || '';
      if (key && !key.startsWith('sk-or-') && !key.startsWith('sk-test') && !endpoint.includes('openrouter')) {
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
   * Transcribe audio using Whisper (OpenAI or Groq)
   */
  public async transcribe(audioFilePath: string, language?: string): Promise<string> {
    try {
      const { client, model } = await this.getClient();

      const transcription = await client.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model,
        language: language || undefined,
      });

      return transcription.text;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`[VoiceService] Transcription failed: ${error.message}`);
      }
      this.openai = null;
      this.groq = null;
      throw error;
    }
  }

  /**
   * Generate speech from text using OpenAI TTS
   */
  public async synthesize(
    text: string,
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy'
  ): Promise<Buffer> {
    try {
      const client = await this.getClient();

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
