/**
 * Voice Routes
 * API endpoints for speech-to-text and text-to-speech
 */
import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

import { voiceController } from '../controllers/voice.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { detectSttProviderFromEnv, STT_ENV_KEYS } from '../services/ai/VoiceService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../../uploads/voice');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for audio uploads
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * POST /api/voice/stt
 * Transcribe audio file to text
 */
router.post(
  '/stt',
  verifyToken,
  upload.single('audio'),
  asyncHandler(voiceController.handleSTT.bind(voiceController))
);

/**
 * POST /api/voice/tts
 * Synthesize text to speech
 */
router.post('/tts', verifyToken, asyncHandler(voiceController.handleTTS.bind(voiceController)));

/**
 * GET /api/voice/health
 * Health check for voice subsystem (STT + TTS availability)
 */
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const checks: Record<string, { status: string; detail?: string; requiredEnv?: string[] }> = {};

    // Check STT availability. STT works with ANY of Whisper (OpenAI/Groq) OR
    // Gemini (the same Google key that powers Teresa's voice) — so we must NOT
    // report "unavailable" just because OPENAI_API_KEY is missing.
    const stt = detectSttProviderFromEnv();
    checks.stt = {
      status: stt.available ? 'ok' : 'unavailable',
      detail: stt.available
        ? `STT provider configured: ${stt.provider}`
        : `No STT provider key set. Set one of: ${STT_ENV_KEYS.join(', ')}. ` +
          'Voice answers still save via the browser transcript fallback, but server transcription is disabled.',
      requiredEnv: [...STT_ENV_KEYS],
    };

    // Check TTS availability (OpenAI TTS — needs a native OpenAI key specifically).
    const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
    const openaiTtsReady =
      openaiKey.length > 0 && !openaiKey.startsWith('sk-or-') && !openaiKey.startsWith('sk-test');
    checks.tts = {
      status: openaiTtsReady ? 'ok' : 'unavailable',
      detail: openaiTtsReady
        ? 'OpenAI TTS key configured'
        : 'OPENAI_API_KEY (native OpenAI) not set — server TTS disabled',
      requiredEnv: ['OPENAI_API_KEY'],
    };

    // Check upload directory
    checks.storage = {
      status: fs.existsSync(uploadDir) ? 'ok' : 'error',
      detail: fs.existsSync(uploadDir) ? `Upload dir: ${uploadDir}` : 'Upload directory missing',
    };

    const allOk = Object.values(checks).every((c) => c.status === 'ok');

    res.json({
      status: allOk ? 'healthy' : 'degraded',
      subsystem: 'voice',
      checks,
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
