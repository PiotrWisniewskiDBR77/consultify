import { v4 as uuidv4 } from 'uuid';
/**
 * Voice API Routes
 * 
 * RESTful API for Speech-to-Text and Text-to-Speech services.
 * Part of the Universal Voice Conversation System.
 * 
 * Endpoints:
 * - POST /api/voice/stt          - Speech to text (audio upload)
 * - POST /api/voice/tts          - Text to speech (returns audio)
 * - GET  /api/voice/tts/stream   - Streaming TTS (SSE)
 * - GET  /api/voice/voices       - Available TTS voices
 * - GET  /api/voice/health       - Voice system health check
 * - POST /api/voice/settings     - Save user voice preferences
 * - GET  /api/voice/settings     - Get user voice preferences
 * 
 * @version 1.0.0
 */

import express from 'express';
const router = express.Router();
import multer from 'multer';
import verifyToken from '../middleware/authMiddleware.js';
import speechToTextService from '../services/ai/speechToTextService.js';
import textToSpeechService from '../services/ai/textToSpeechService.js';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();


// ============================================================================
// Multer Configuration for Audio Upload
// ============================================================================

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'audio/webm',
            'audio/wav',
            'audio/wave',
            'audio/x-wav',
            'audio/mp3',
            'audio/mpeg',
            'audio/mp4',
            'audio/m4a',
            'audio/ogg',
            'audio/flac'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported audio format: ${file.mimetype}`), false);
        }
    }
});

// ============================================================================
// Database Helpers
// ============================================================================

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

// ============================================================================
// Speech-to-Text Endpoint
// ============================================================================

/**
 * POST /api/voice/stt
 * Convert audio to text
 * 
 * Body: multipart/form-data
 * - audio: Audio file (webm, wav, mp3, etc.)
 * - language: Language code (optional, default: 'pl')
 * - provider: Force specific provider (optional)
 * - timestamps: Include word timestamps (optional)
 */
router.post('/stt', verifyToken, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const { language = 'pl', provider, timestamps } = req.body;

        console.log(`[Voice API] STT request: ${req.file.size} bytes, lang=${language}`);

        const result = await speechToTextService.transcribe(req.file.buffer, {
            language,
            provider: provider || null,
            timestamps: timestamps === 'true' || timestamps === true
        });

        // Log usage for analytics
        try {
            await dbRun(`
                INSERT INTO ai_audit_log (id, user_id, organization_id, action, resource_type, request_summary, response_summary, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                uuidv4(),
                req.userId,
                req.organizationId,
                'voice_stt',
                'audio',
                `STT: ${req.file.size} bytes, ${language}`,
                `Result: ${result.text.substring(0, 100)}...`,
            ]);
        } catch (logError) {
            console.warn('[Voice API] Failed to log STT usage:', logError.message);
        }

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('[Voice API] STT error:', error);
        res.status(500).json({ 
            error: error.message,
            fallback: 'web-speech' // Suggest client-side fallback
        });
    }
});

// ============================================================================
// Text-to-Speech Endpoint
// ============================================================================

/**
 * POST /api/voice/tts
 * Convert text to speech audio
 * 
 * Body: application/json
 * - text: Text to convert (required)
 * - language: Language code (optional, default: 'pl')
 * - voice: Voice ID (optional)
 * - speed: Speech speed 0.25-4.0 (optional, default: 1.0)
 * - provider: Force specific provider (optional)
 * - format: Output format mp3/opus/aac/flac (optional, default: 'mp3')
 */
router.post('/tts', verifyToken, async (req, res) => {
    try {
        const { text, language = 'pl', voice, speed = 1.0, provider, format = 'mp3' } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'No text provided' });
        }

        console.log(`[Voice API] TTS request: ${text.length} chars, lang=${language}, voice=${voice}`);

        const result = await textToSpeechService.synthesize(text, {
            language,
            voice,
            speed: parseFloat(speed),
            provider: provider || null,
            format
        });

        // Log usage for analytics
        try {
            await dbRun(`
                INSERT INTO ai_audit_log (id, user_id, organization_id, action, resource_type, request_summary, response_summary, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                uuidv4(),
                req.userId,
                req.organizationId,
                'voice_tts',
                'text',
                `TTS: ${text.length} chars, ${language}, ${voice || 'default'}`,
                `Audio: ${result.audio.length} bytes`,
            ]);
        } catch (logError) {
            console.warn('[Voice API] Failed to log TTS usage:', logError.message);
        }

        // Send audio as binary response
        res.set({
            'Content-Type': result.contentType,
            'Content-Length': result.audio.length,
            'X-Provider': result.provider,
            'X-Voice': result.voice,
            'X-Latency-Ms': result.latencyMs
        });
        
        res.send(result.audio);

    } catch (error) {
        console.error('[Voice API] TTS error:', error);
        res.status(500).json({ 
            error: error.message,
            fallback: 'web-speech' // Suggest client-side fallback
        });
    }
});

// ============================================================================
// Streaming TTS Endpoint (SSE)
// ============================================================================

/**
 * GET /api/voice/tts/stream
 * Stream TTS audio for long texts (Server-Sent Events)
 * 
 * Query params:
 * - text: Text to convert (required, URL encoded)
 * - language: Language code (optional)
 * - voice: Voice ID (optional)
 * - speed: Speech speed (optional)
 */
router.get('/tts/stream', verifyToken, async (req, res) => {
    try {
        const { text, language = 'pl', voice, speed = '1.0' } = req.query;

        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        console.log(`[Voice API] TTS Stream request: ${text.length} chars`);

        let chunkIndex = 0;

        for await (const chunk of textToSpeechService.synthesizeStream(text, {
            language,
            voice,
            speed: parseFloat(speed)
        })) {
            // Convert audio buffer to base64 for SSE transmission
            const audioBase64 = chunk.audio.toString('base64');
            
            const event = {
                index: chunkIndex++,
                audio: audioBase64,
                contentType: chunk.contentType,
                isLast: chunk.isLast
            };

            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('[Voice API] TTS Stream error:', error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});

// ============================================================================
// Available Voices Endpoint
// ============================================================================

/**
 * GET /api/voice/voices
 * Get list of available TTS voices
 * 
 * Query params:
 * - language: Filter by language (optional)
 */
router.get('/voices', verifyToken, async (req, res) => {
    try {
        const { language } = req.query;
        
        const voices = textToSpeechService.getVoices(language || null);
        const bestVoice = textToSpeechService.getBestVoice(language || 'pl');

        res.json({
            voices,
            recommended: bestVoice,
            languages: speechToTextService.getSupportedLanguages()
        });

    } catch (error) {
        console.error('[Voice API] Voices error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Health Check Endpoint
// ============================================================================

/**
 * GET /api/voice/health
 * Get voice system health status
 */
router.get('/health', verifyToken, async (req, res) => {
    try {
        const sttHealth = speechToTextService.getHealthStatus();
        const ttsHealth = textToSpeechService.getHealthStatus();

        const overallHealth = 
            sttHealth.healthyProviders.length > 0 && 
            ttsHealth.healthyProviders.length > 0;

        res.json({
            status: overallHealth ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            stt: sttHealth,
            tts: ttsHealth,
            capabilities: {
                whisper: sttHealth.providers.find(p => p.id === 'whisper')?.healthy || false,
                deepgram: sttHealth.providers.find(p => p.id === 'deepgram')?.healthy || false,
                openaiTts: ttsHealth.providers.find(p => p.id === 'openai')?.healthy || false,
                edgeTts: ttsHealth.providers.find(p => p.id === 'edge')?.healthy || false,
                webSpeech: true // Always available as client fallback
            }
        });

    } catch (error) {
        console.error('[Voice API] Health check error:', error);
        res.status(500).json({ 
            status: 'error',
            error: error.message 
        });
    }
});

// ============================================================================
// Voice Settings Endpoints
// ============================================================================

/**
 * GET /api/voice/settings
 * Get user's voice preferences
 */
router.get('/settings', verifyToken, async (req, res) => {
    try {
        const settings = await dbGet(`
            SELECT settings FROM user_preferences 
            WHERE user_id = ? AND preference_type = 'voice'
        `, [req.userId]);

        if (settings?.settings) {
            res.json(JSON.parse(settings.settings));
        } else {
            // Default settings
            res.json({
                inputMode: 'click-to-talk', // push-to-talk, click-to-talk, always-listening
                autoSendDelay: 1.5, // seconds of silence before auto-send
                ttsVoice: 'nova',
                ttsSpeed: 1.0,
                ttsProvider: 'openai',
                autoSpeakResponses: true,
                language: 'pl',
                showLiveTranscript: true
            });
        }

    } catch (error) {
        console.error('[Voice API] Get settings error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/voice/settings
 * Save user's voice preferences
 */
router.post('/settings', verifyToken, async (req, res) => {
    try {
        const settings = req.body;

        // Validate settings
        const validSettings = {
            inputMode: ['push-to-talk', 'click-to-talk', 'always-listening'].includes(settings.inputMode) 
                ? settings.inputMode : 'click-to-talk',
            autoSendDelay: Math.min(5, Math.max(0.5, parseFloat(settings.autoSendDelay) || 1.5)),
            ttsVoice: settings.ttsVoice || 'nova',
            ttsSpeed: Math.min(2.0, Math.max(0.5, parseFloat(settings.ttsSpeed) || 1.0)),
            ttsProvider: ['openai', 'edge'].includes(settings.ttsProvider) 
                ? settings.ttsProvider : 'openai',
            autoSpeakResponses: settings.autoSpeakResponses !== false,
            language: settings.language || 'pl',
            showLiveTranscript: settings.showLiveTranscript !== false
        };

        // Upsert settings
        await dbRun(`
            INSERT INTO user_preferences (user_id, preference_type, settings, updated_at)
            VALUES (?, 'voice', ?, datetime('now'))
            ON CONFLICT(user_id, preference_type) 
            DO UPDATE SET settings = ?, updated_at = datetime('now')
        `, [req.userId, JSON.stringify(validSettings), JSON.stringify(validSettings)]);

        res.json({
            success: true,
            settings: validSettings
        });

    } catch (error) {
        console.error('[Voice API] Save settings error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Provider Test Endpoints (Admin)
// ============================================================================

/**
 * POST /api/voice/test/stt
 * Test STT provider connectivity
 */
router.post('/test/stt', verifyToken, async (req, res) => {
    try {
        const { provider } = req.body;
        
        if (!provider) {
            return res.status(400).json({ error: 'Provider required' });
        }

        const result = await speechToTextService.testProvider(provider);
        res.json(result);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/voice/test/tts
 * Test TTS provider connectivity
 */
router.post('/test/tts', verifyToken, async (req, res) => {
    try {
        const { provider } = req.body;
        
        if (!provider) {
            return res.status(400).json({ error: 'Provider required' });
        }

        const result = await textToSpeechService.testProvider(provider);
        res.json(result);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/voice/reset-health
 * Reset provider health status (for recovery)
 */
router.post('/reset-health', verifyToken, async (req, res) => {
    try {
        const { provider, service } = req.body;

        if (service === 'stt' || !service) {
            speechToTextService.resetProviderHealth(provider || null);
        }
        if (service === 'tts' || !service) {
            textToSpeechService.resetProviderHealth(provider || null);
        }

        res.json({
            success: true,
            stt: speechToTextService.getHealthStatus(),
            tts: textToSpeechService.getHealthStatus()
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Error Handler
// ============================================================================

router.use((error, req, res, next) => {
    console.error('[Voice API] Error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 25MB.' });
        }
    }
    
    res.status(500).json({ error: error.message });
});

export default router;

