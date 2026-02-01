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

export default router;
