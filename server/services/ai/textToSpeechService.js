/**
 * Text-to-Speech Service
 * 
 * Universal TTS service supporting multiple providers:
 * - OpenAI TTS (primary, best quality, 6 voices)
 * - Edge TTS (free fallback, 300+ voices)
 * - Web Speech Synthesis (client-side fallback)
 * 
 * Part of the Universal Voice Conversation System
 * 
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ============================================================================
// Configuration
// ============================================================================

const TTS_CONFIG = {
    providers: {
        openai: {
            name: 'OpenAI TTS',
            priority: 1,
            voices: [
                { id: 'alloy', name: 'Alloy', gender: 'neutral', description: 'Balanced, versatile' },
                { id: 'echo', name: 'Echo', gender: 'male', description: 'Warm, engaging' },
                { id: 'fable', name: 'Fable', gender: 'neutral', description: 'Expressive, narrative' },
                { id: 'onyx', name: 'Onyx', gender: 'male', description: 'Deep, authoritative' },
                { id: 'nova', name: 'Nova', gender: 'female', description: 'Energetic, bright' },
                { id: 'shimmer', name: 'Shimmer', gender: 'female', description: 'Soft, calming' }
            ],
            models: ['tts-1', 'tts-1-hd'],
            defaultModel: 'tts-1',
            defaultVoice: 'nova',
            maxChars: 4096,
            outputFormats: ['mp3', 'opus', 'aac', 'flac']
        },
        edge: {
            name: 'Edge TTS (Microsoft)',
            priority: 2,
            defaultVoice: 'pl-PL-ZofiaNeural',
            voicesByLanguage: {
                'pl': ['pl-PL-ZofiaNeural', 'pl-PL-MarekNeural'],
                'en': ['en-US-JennyNeural', 'en-US-GuyNeural', 'en-GB-SoniaNeural'],
                'de': ['de-DE-KatjaNeural', 'de-DE-ConradNeural'],
                'es': ['es-ES-ElviraNeural', 'es-ES-AlvaroNeural'],
                'ja': ['ja-JP-NanamiNeural', 'ja-JP-KeitaNeural'],
                'ar': ['ar-SA-ZariyahNeural', 'ar-SA-HamedNeural'],
                'fr': ['fr-FR-DeniseNeural', 'fr-FR-HenriNeural'],
                'it': ['it-IT-ElsaNeural', 'it-IT-DiegoNeural'],
                'pt': ['pt-BR-FranciscaNeural', 'pt-BR-AntonioNeural'],
                'ru': ['ru-RU-SvetlanaNeural', 'ru-RU-DmitryNeural'],
                'zh': ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'],
                'ko': ['ko-KR-SunHiNeural', 'ko-KR-InJoonNeural']
            },
            maxChars: 10000
        }
    },
    fallbackOrder: ['openai', 'edge'],
    defaultLanguage: 'pl',
    defaultSpeed: 1.0,
    cleanTextForSpeech: true
};

// ============================================================================
// Provider Health Tracking
// ============================================================================

const providerHealth = {
    openai: { healthy: true, lastError: null, errorCount: 0, latencyMs: 0 },
    edge: { healthy: true, lastError: null, errorCount: 0, latencyMs: 0 }
};

// ============================================================================
// Text Cleaning Utilities
// ============================================================================

/**
 * Clean text for speech synthesis
 * Removes markdown, code blocks, and other non-speech content
 */
function cleanTextForSpeech(text) {
    if (!text) return '';

    return text
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, ' ')
        // Remove inline code
        .replace(/`[^`]+`/g, '')
        // Remove markdown links - keep text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove markdown images
        .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
        // Remove markdown headers
        .replace(/#{1,6}\s+/g, '')
        // Remove bold/italic
        .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
        .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
        // Remove bullet points
        .replace(/^[\s-*•]+/gm, '')
        // Remove numbered lists formatting
        .replace(/^\d+\.\s+/gm, '')
        // Remove URLs
        .replace(/https?:\/\/\S+/g, '')
        // Remove emoji (basic ranges)
        .replace(/[\u{1F600}-\u{1F6FF}]/gu, '')
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        // Remove special characters
        .replace(/[#@&|<>\\]/g, ' ')
        // Replace multiple spaces/newlines with single space
        .replace(/\s+/g, ' ')
        // Clean up
        .trim();
}

/**
 * Split long text into chunks for TTS
 */
function splitTextIntoChunks(text, maxLength = 4000) {
    if (text.length <= maxLength) {
        return [text];
    }

    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = '';

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= maxLength) {
            currentChunk += sentence;
        } else {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

// ============================================================================
// Text-to-Speech Service Class
// ============================================================================

class TextToSpeechService {
    constructor() {
        this.config = TTS_CONFIG;
        this.openai = null;
        this._initOpenAI();
    }

    /**
     * Initialize OpenAI client
     */
    _initOpenAI() {
        try {
            // Initialize OpenAI client once
            if (!this.openai) {
                this.openai = new OpenAI({
                    apiKey: process.env.OPENAI_API_KEY
                });
            }
        } catch (error) {
            console.error('[TTS] Failed to initialize OpenAI:', error.message);
            providerHealth.openai.healthy = false;
            providerHealth.openai.lastError = error.message;
        }
    }

    /**
     * Main synthesis method with automatic fallback
     * 
     * @param {string} text - Text to convert to speech
     * @param {Object} options - Synthesis options
     * @param {string} options.language - Language code (e.g., 'pl', 'en')
     * @param {string} options.provider - Force specific provider
     * @param {string} options.voice - Voice ID
     * @param {number} options.speed - Speech speed (0.25 - 4.0)
     * @param {string} options.model - TTS model (for OpenAI)
     * @param {string} options.format - Output format (mp3, opus, etc.)
     * @returns {Promise<Object>} Audio result with buffer and metadata
     */
    async synthesize(text, options = {}) {
        const {
            language = this.config.defaultLanguage,
            provider = null,
            voice = null,
            speed = this.config.defaultSpeed,
            model = null,
            format = 'mp3'
        } = options;

        const startTime = Date.now();

        // Clean text if enabled
        const cleanedText = this.config.cleanTextForSpeech
            ? cleanTextForSpeech(text)
            : text;

        if (!cleanedText || cleanedText.length === 0) {
            throw new Error('No text to synthesize after cleaning');
        }

        // Get provider order
        const providers = provider
            ? [provider]
            : this._getHealthyProviders();

        if (providers.length === 0) {
            throw new Error('No TTS providers available');
        }

        let lastError = null;

        // Try each provider in order
        for (const providerId of providers) {
            try {
                console.log(`[TTS] Trying provider: ${providerId}`);

                const result = await this._synthesizeWithProvider(providerId, cleanedText, {
                    language,
                    voice,
                    speed,
                    model,
                    format
                });

                // Update health stats
                const latency = Date.now() - startTime;
                providerHealth[providerId].latencyMs = latency;
                providerHealth[providerId].errorCount = 0;
                providerHealth[providerId].healthy = true;

                console.log(`[TTS] Success with ${providerId} in ${latency}ms`);

                return {
                    audio: result.audio,
                    contentType: result.contentType,
                    provider: providerId,
                    voice: result.voice,
                    language: language,
                    latencyMs: latency,
                    textLength: cleanedText.length
                };

            } catch (error) {
                console.error(`[TTS] Provider ${providerId} failed:`, error.message);
                lastError = error;

                // Update health stats
                providerHealth[providerId].errorCount++;
                providerHealth[providerId].lastError = error.message;

                if (providerHealth[providerId].errorCount >= 3) {
                    providerHealth[providerId].healthy = false;
                    console.warn(`[TTS] Provider ${providerId} marked unhealthy after 3 failures`);
                }
            }
        }

        throw new Error(`All TTS providers failed. Last error: ${lastError?.message}`);
    }

    /**
     * Stream synthesis for real-time playback
     * 
     * @param {string} text - Text to convert
     * @param {Object} options - Same as synthesize()
     * @returns {AsyncGenerator} Yields audio chunks
     */
    async *synthesizeStream(text, options = {}) {
        const {
            language = this.config.defaultLanguage,
            voice = null,
            speed = this.config.defaultSpeed
        } = options;

        // Clean and split text
        const cleanedText = this.config.cleanTextForSpeech
            ? cleanTextForSpeech(text)
            : text;

        const chunks = splitTextIntoChunks(cleanedText);

        for (const chunk of chunks) {
            try {
                const result = await this.synthesize(chunk, {
                    language,
                    voice,
                    speed,
                    ...options
                });

                yield {
                    audio: result.audio,
                    contentType: result.contentType,
                    chunk: chunk,
                    isLast: chunk === chunks[chunks.length - 1]
                };
            } catch (error) {
                console.error('[TTS] Stream chunk failed:', error.message);
                // Continue with next chunk
            }
        }
    }

    /**
     * Synthesize with a specific provider
     */
    async _synthesizeWithProvider(providerId, text, options) {
        switch (providerId) {
            case 'openai':
                return this._synthesizeWithOpenAI(text, options);
            case 'edge':
                return this._synthesizeWithEdge(text, options);
            default:
                throw new Error(`Unknown provider: ${providerId}`);
        }
    }

    /**
     * OpenAI TTS synthesis
     */
    async _synthesizeWithOpenAI(text, options) {
        if (!this.openai) {
            throw new Error('OpenAI client not initialized');
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY not configured');
        }

        const providerConfig = this.config.providers.openai;
        const voice = options.voice || providerConfig.defaultVoice;
        const model = options.model || providerConfig.defaultModel;

        // Validate voice
        if (!providerConfig.voices.find(v => v.id === voice)) {
            console.warn(`[TTS] Unknown voice ${voice}, using default`);
        }

        const response = await this.openai.audio.speech.create({
            model: model,
            voice: voice,
            input: text,
            speed: Math.min(4.0, Math.max(0.25, options.speed || 1.0)),
            response_format: options.format || 'mp3'
        });

        // Get audio buffer
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return {
            audio: buffer,
            contentType: `audio/${options.format || 'mp3'}`,
            voice: voice
        };
    }

    /**
     * Edge TTS synthesis (Microsoft free voices)
     */
    async _synthesizeWithEdge(text, options) {
        const providerConfig = this.config.providers.edge;

        // Get voice for language
        const langVoices = providerConfig.voicesByLanguage[options.language];
        const voice = options.voice || (langVoices?.[0]) || providerConfig.defaultVoice;

        // Edge TTS requires a package or we can use a simple HTTP approach
        // For now, let's use a fallback to Web Speech API indication
        // In production, you would use the 'edge-tts' npm package

        try {
            // Try to use edge-tts package if available
            const edgeTts = require('edge-tts');

            const communicate = new edgeTts.Communicate(text, voice);
            const audioChunks = [];

            for await (const chunk of communicate.stream()) {
                if (chunk.type === 'audio') {
                    audioChunks.push(chunk.data);
                }
            }

            const buffer = Buffer.concat(audioChunks);

            return {
                audio: buffer,
                contentType: 'audio/mp3',
                voice: voice
            };
        } catch (e) {
            // edge-tts not installed, use fallback
            console.warn('[TTS] edge-tts not available, recommend installing: npm install edge-tts');
            throw new Error('Edge TTS not available. Install edge-tts package or use OpenAI.');
        }
    }

    /**
     * Get list of healthy providers in priority order
     */
    _getHealthyProviders() {
        return this.config.fallbackOrder.filter(id => {
            const health = providerHealth[id];
            return health.healthy || health.errorCount < 3;
        });
    }

    /**
     * Get available voices for a language
     */
    getVoices(language = null) {
        const voices = [];

        // OpenAI voices (universal, work for all languages)
        const openaiConfig = this.config.providers.openai;
        openaiConfig.voices.forEach(v => {
            voices.push({
                id: v.id,
                name: v.name,
                provider: 'openai',
                gender: v.gender,
                description: v.description,
                premium: true
            });
        });

        // Edge TTS voices (language-specific)
        const edgeConfig = this.config.providers.edge;
        if (language && edgeConfig.voicesByLanguage[language]) {
            edgeConfig.voicesByLanguage[language].forEach(voiceId => {
                voices.push({
                    id: voiceId,
                    name: voiceId.replace(/Neural$/, '').replace(/-/g, ' '),
                    provider: 'edge',
                    language: language,
                    premium: false
                });
            });
        } else {
            // Return all Edge voices
            Object.entries(edgeConfig.voicesByLanguage).forEach(([lang, langVoices]) => {
                langVoices.forEach(voiceId => {
                    voices.push({
                        id: voiceId,
                        name: voiceId.replace(/Neural$/, '').replace(/-/g, ' '),
                        provider: 'edge',
                        language: lang,
                        premium: false
                    });
                });
            });
        }

        return voices;
    }

    /**
     * Get best voice for a language
     */
    getBestVoice(language) {
        // Prefer OpenAI for quality
        if (providerHealth.openai.healthy) {
            return {
                provider: 'openai',
                voice: this.config.providers.openai.defaultVoice
            };
        }

        // Fallback to Edge TTS
        const edgeVoices = this.config.providers.edge.voicesByLanguage[language];
        if (edgeVoices && edgeVoices.length > 0) {
            return {
                provider: 'edge',
                voice: edgeVoices[0]
            };
        }

        return {
            provider: 'openai',
            voice: 'nova'
        };
    }

    /**
     * Get provider health status
     */
    getHealthStatus() {
        return {
            providers: Object.entries(providerHealth).map(([id, health]) => ({
                id,
                name: this.config.providers[id]?.name,
                ...health
            })),
            healthyProviders: this._getHealthyProviders(),
            primaryProvider: this._getHealthyProviders()[0] || null
        };
    }

    /**
     * Reset provider health (for recovery)
     */
    resetProviderHealth(providerId = null) {
        if (providerId) {
            providerHealth[providerId] = {
                healthy: true,
                lastError: null,
                errorCount: 0,
                latencyMs: 0
            };
        } else {
            Object.keys(providerHealth).forEach(id => {
                providerHealth[id] = {
                    healthy: true,
                    lastError: null,
                    errorCount: 0,
                    latencyMs: 0
                };
            });
        }
    }

    /**
     * Test provider connectivity
     */
    async testProvider(providerId) {
        try {
            const start = Date.now();
            await this._synthesizeWithProvider(providerId, 'Test.', {
                language: 'en',
                speed: 1.0
            });

            return {
                success: true,
                latencyMs: Date.now() - start
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// ============================================================================
// Singleton Export
// ============================================================================
// Singleton instance
const textToSpeechService = new TextToSpeechService();

export { TextToSpeechService, textToSpeechService, TTS_CONFIG, cleanTextForSpeech, splitTextIntoChunks };
export default textToSpeechService;
