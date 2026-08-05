import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

import { voiceService } from '../services/ai/VoiceService.js';
import logger from '../utils/Logger.js';

export class VoiceController {
  private isServiceUnavailableError(error: unknown): boolean {
    const msg = String((error as any)?.message || '').toLowerCase();
    return (
      msg.includes('api key not configured') ||
      msg.includes('not configured in llmconfigservice') ||
      msg.includes('no such table') ||
      msg.includes('does not exist') ||
      msg.includes('relation') ||
      msg.includes('database not initialized')
    );
  }

  /**
   * STT: Transcribe audio file to text
   */
  public async handleSTT(req: Request, res: Response): Promise<void> {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No audio file provided' });
      return;
    }

    try {
      const language = req.body.language || 'pl';
      const text = await voiceService.transcribe(file.path, language);
      res.status(200).json({ text });
    } catch (error) {
      if (this.isServiceUnavailableError(error)) {
        res.status(503).json({ error: 'Speech-to-text temporarily unavailable' });
        return;
      }
      if (error instanceof Error) {
        logger.error(`[VoiceController] STT Error: ${error.message}`);
      }
      res.status(500).json({ error: 'Transcription failed' });
    } finally {
      // M01-P05 (audio retention policy): the uploaded recording is deleted
      // unconditionally after the transcription attempt, success or failure.
      // Previously this only ran in the success path — a failed
      // `transcribe()` call (unavailable provider, bad audio, network error)
      // left the raw voice recording sitting in `uploads/voice/` forever.
      // That's a real retention leak, not a hypothetical one: every failed
      // STT call before this fix orphaned one file with no cleanup job
      // anywhere in this codebase to catch it later.
      fs.unlink(file.path, (err) => {
        if (err) logger.error(`[VoiceController] Failed to delete temp file: ${err.message}`);
      });
    }
  }

  /**
   * TTS: Synthesize text to speech (audio stream)
   */
  public async handleTTS(req: Request, res: Response): Promise<void> {
    const { text, voice } = req.body;

    if (!text) {
      res.status(400).json({ error: 'Text is required for synthesis' });
      return;
    }

    try {
      const audioBuffer = await voiceService.synthesize(text, voice);

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
      });

      res.status(200).send(audioBuffer);
    } catch (error) {
      if (this.isServiceUnavailableError(error)) {
        res.status(503).json({ error: 'Text-to-speech temporarily unavailable' });
        return;
      }
      if (error instanceof Error) {
        logger.error(`[VoiceController] TTS Error: ${error.message}`);
      }
      res.status(500).json({ error: 'Speech synthesis failed' });
    }
  }
}

export const voiceController = new VoiceController();
export default voiceController;
