import fs from 'fs';
import { OpenAI } from 'openai';
import path from 'path';

import logger from '../../utils/Logger.js';
import { llmConfigService } from './llmConfigService.js';

export class VoiceService {
  private static instance: VoiceService;
  private openai: OpenAI | null = null;

  private constructor() {}

  public static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  private async getClient(): Promise<OpenAI> {
    if (this.openai) return this.openai;

    const config = await llmConfigService.getProviderConfig('openai');
    const apiKey = config?.api_key || '';
    // Prevent accidental real network calls in test/dev environments where
    // we intentionally stub keys (e.g. `sk-test-*`).
    if (!config || !apiKey || String(apiKey).startsWith('sk-test')) {
      throw new Error('OpenAI API key not configured in llmConfigService');
    }

    this.openai = new OpenAI({
      apiKey,
    });

    return this.openai;
  }

  /**
   * Transcribe audio using Whisper
   */
  public async transcribe(audioFilePath: string, language?: string): Promise<string> {
    try {
      const client = await this.getClient();

      const transcription = await client.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: 'whisper-1',
        language: language || undefined, // Allow auto-detection if null
      });

      return transcription.text;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`[VoiceService] Transcription failed: ${error.message}`);
      }
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
