import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

import { voiceService } from '../services/ai/VoiceService.js';
import logger from '../utils/Logger.js';

export class VoiceController {
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

      // Clean up uploaded file
      fs.unlink(file.path, (err) => {
        if (err) logger.error(`[VoiceController] Failed to delete temp file: ${err.message}`);
      });

      res.status(200).json({ text });
    } catch (error: any) {
      logger.error(`[VoiceController] STT Error: ${error.message}`);
      res.status(500).json({ error: 'Transcription failed' });
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
    } catch (error: any) {
      logger.error(`[VoiceController] TTS Error: ${error.message}`);
      res.status(500).json({ error: 'Speech synthesis failed' });
    }
  }
}

export const voiceController = new VoiceController();
export default voiceController;
