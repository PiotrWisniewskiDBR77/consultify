/**
 * Speech-to-Text Service
 * 
 * Universal STT service supporting multiple providers:
 * - OpenAI Whisper (primary, best quality)
 * - Deepgram (low latency fallback)
 * - Web Speech API (client-side free fallback)
 * 
 * Part of the Universal Voice Conversation System
 * 
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

// ============================================================================
// Configuration
// ============================================================================

const STT_CONFIG = {
    providers: {
        whisper: {
            name: 'OpenAI Whisper',
            priority: 1,
            maxFileSize: 25 * 1024 * 1024, // 25MB
            supportedFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
            supportedLanguages: ['pl', 'en', 'de', 'es', 'ja', 'ar', 'fr', 'it', 'pt', 'ru', 'zh', 'ko', 'nl', 'sv', 'da', 'no', 'fi', 'cs', 'el', 'he', 'hi', 'hu', 'id', 'ms', 'ro', 'th', 'tr', 'uk', 'vi'],
            defaultModel: 'whisper-1'
        },
        deepgram: {
            name: 'Deepgram',
            priority: 2,
            maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
            supportedFormats: ['mp3', 'mp4', 'wav', 'webm', 'flac', 'ogg'],
            supportedLanguages: ['pl', 'en', 'de', 'es', 'ja', 'fr', 'it', 'pt', 'ru', 'zh', 'ko', 'nl'],
            defaultModel: 'nova-2'
        }
    },
    fallbackOrder: ['whisper', 'deepgram'],
    defaultLanguage: 'pl',
    timeoutMs: 60000
};

// ============================================================================
// Provider Health Tracking
// ============================================================================

const providerHealth = {
    whisper: { healthy: true, lastError: null, errorCount: 0, latencyMs: 0 },
    deepgram: { healthy: true, lastError: null, errorCount: 0, latencyMs: 0 }
};

// ============================================================================
// Speech-to-Text Service Class
// ============================================================================

class SpeechToTextService {
    constructor() {
        this.config = STT_CONFIG;
        this.openai = null; // Will be initialized once
        this.deepgramApiKey = process.env.DEEPGRAM_API_KEY;
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
            console.error('[STT] Failed to initialize OpenAI:', error.message);
            providerHealth.whisper.healthy = false;
            providerHealth.whisper.lastError = error.message;
        }
    }

    /**
     * Main transcription method with automatic fallback
     * 
     * @param {Buffer|string} audio - Audio data (Buffer) or file path (string)
     * @param {Object} options - Transcription options
     * @param {string} options.language - Language code (e.g., 'pl', 'en')
     * @param {string} options.provider - Force specific provider
     * @param {string} options.format - Audio format (auto-detected if not provided)
     * @param {boolean} options.timestamps - Include word timestamps
     * @returns {Promise<Object>} Transcription result
     */
    async transcribe(audio, options = {}) {
        const {
            language = this.config.defaultLanguage,
            provider = null,
            format = null,
            timestamps = false
        } = options;

        const startTime = Date.now();

        // Determine audio format
        const audioFormat = format || this._detectFormat(audio);

        // Get provider order
        const providers = provider
            ? [provider]
            : this._getHealthyProviders();

        if (providers.length === 0) {
            throw new Error('No STT providers available');
        }

        let lastError = null;

        // Try each provider in order
        for (const providerId of providers) {
            try {
                console.log(`[STT] Trying provider: ${providerId}`);

                const result = await this._transcribeWithProvider(providerId, audio, {
                    language,
                    format: audioFormat,
                    timestamps
                });

                // Update health stats
                const latency = Date.now() - startTime;
                providerHealth[providerId].latencyMs = latency;
                providerHealth[providerId].errorCount = 0;
                providerHealth[providerId].healthy = true;

                console.log(`[STT] Success with ${providerId} in ${latency}ms`);

                return {
                    text: result.text,
                    language: result.language || language,
                    provider: providerId,
                    latencyMs: latency,
                    confidence: result.confidence,
                    words: result.words || [],
                    segments: result.segments || []
                };

            } catch (error) {
                console.error(`[STT] Provider ${providerId} failed:`, error.message);
                lastError = error;

                // Update health stats
                providerHealth[providerId].errorCount++;
                providerHealth[providerId].lastError = error.message;

                if (providerHealth[providerId].errorCount >= 3) {
                    providerHealth[providerId].healthy = false;
                    console.warn(`[STT] Provider ${providerId} marked unhealthy after 3 failures`);
                }
            }
        }

        throw new Error(`All STT providers failed. Last error: ${lastError?.message}`);
    }

    /**
     * Transcribe with a specific provider
     */
    async _transcribeWithProvider(providerId, audio, options) {
        switch (providerId) {
            case 'whisper':
                return this._transcribeWithWhisper(audio, options);
            case 'deepgram':
                return this._transcribeWithDeepgram(audio, options);
            default:
                throw new Error(`Unknown provider: ${providerId}`);
        }
    }

    /**
     * OpenAI Whisper transcription
     */
    async _transcribeWithWhisper(audio, options) {
        if (!this.openai) {
            throw new Error('OpenAI client not initialized');
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY not configured');
        }

        // Prepare audio file
        let audioFile;
        if (Buffer.isBuffer(audio)) {
            // Create a File-like object from buffer
            const blob = new Blob([audio], { type: `audio/${options.format || 'webm'}` });
            audioFile = new File([blob], `audio.${options.format || 'webm'}`, {
                type: `audio/${options.format || 'webm'}`
            });
        } else if (typeof audio === 'string') {
            // File path
            audioFile = fs.createReadStream(audio);
        } else {
            throw new Error('Invalid audio input');
        }

        const response = await this.openai.audio.transcriptions.create({
            file: audioFile,
            model: this.config.providers.whisper.defaultModel,
            language: options.language,
            response_format: options.timestamps ? 'verbose_json' : 'json',
            timestamp_granularities: options.timestamps ? ['word', 'segment'] : undefined
        });

        return {
            text: response.text,
            language: response.language,
            confidence: 1.0, // Whisper doesn't provide confidence
            words: response.words || [],
            segments: response.segments || []
        };
    }

    /**
     * Deepgram transcription
     */
    async _transcribeWithDeepgram(audio, options) {
        if (!this.deepgramApiKey) {
            throw new Error('DEEPGRAM_API_KEY not configured');
        }

        // Prepare audio data
        let audioData;
        if (Buffer.isBuffer(audio)) {
            audioData = audio;
        } else if (typeof audio === 'string') {
            audioData = fs.readFileSync(audio);
        } else {
            throw new Error('Invalid audio input');
        }

        const url = 'https://api.deepgram.com/v1/listen';
        const params = new URLSearchParams({
            model: this.config.providers.deepgram.defaultModel,
            language: options.language,
            punctuate: 'true',
            diarize: 'false'
        });

        const response = await fetch(`${url}?${params}`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${this.deepgramApiKey}`,
                'Content-Type': `audio/${options.format || 'webm'}`
            },
            body: audioData
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Deepgram API error: ${error}`);
        }

        const result = await response.json();
        const transcript = result.results?.channels?.[0]?.alternatives?.[0];

        if (!transcript) {
            throw new Error('No transcription result from Deepgram');
        }

        return {
            text: transcript.transcript,
            language: options.language,
            confidence: transcript.confidence,
            words: transcript.words?.map(w => ({
                word: w.word,
                start: w.start,
                end: w.end,
                confidence: w.confidence
            })) || []
        };
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
     * Detect audio format from buffer or filename
     */
    _detectFormat(audio) {
        if (typeof audio === 'string') {
            const ext = path.extname(audio).toLowerCase().slice(1);
            return ext || 'webm';
        }

        if (Buffer.isBuffer(audio)) {
            // Check magic bytes
            if (audio[0] === 0x1A && audio[1] === 0x45 && audio[2] === 0xDF && audio[3] === 0xA3) {
                return 'webm';
            }
            if (audio[0] === 0x52 && audio[1] === 0x49 && audio[2] === 0x46 && audio[3] === 0x46) {
                return 'wav';
            }
            if (audio[0] === 0xFF && (audio[1] & 0xE0) === 0xE0) {
                return 'mp3';
            }
            if (audio[0] === 0x4F && audio[1] === 0x67 && audio[2] === 0x67 && audio[3] === 0x53) {
                return 'ogg';
            }
        }

        return 'webm'; // Default
    }

    /**
     * Check if a language is supported
     */
    isLanguageSupported(language, provider = null) {
        if (provider) {
            return this.config.providers[provider]?.supportedLanguages?.includes(language) || false;
        }

        // Check all providers
        return Object.values(this.config.providers).some(
            p => p.supportedLanguages?.includes(language)
        );
    }

    /**
     * Get supported languages
     */
    getSupportedLanguages() {
        const languages = new Set();
        Object.values(this.config.providers).forEach(p => {
            p.supportedLanguages?.forEach(lang => languages.add(lang));
        });
        return Array.from(languages).sort();
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
            // Create a small test audio (silence)
            const silentAudio = this._createSilentAudio();

            const start = Date.now();
            await this._transcribeWithProvider(providerId, silentAudio, {
                language: 'en',
                format: 'wav'
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

    /**
     * Create a minimal silent WAV for testing
     */
    _createSilentAudio() {
        // Create a minimal WAV file header with 0.1s of silence
        const sampleRate = 16000;
        const numSamples = sampleRate * 0.1; // 0.1 second
        const dataSize = numSamples * 2; // 16-bit
        const fileSize = 44 + dataSize;

        const buffer = Buffer.alloc(fileSize);

        // RIFF header
        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(fileSize - 8, 4);
        buffer.write('WAVE', 8);

        // fmt chunk
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16); // chunk size
        buffer.writeUInt16LE(1, 20); // PCM
        buffer.writeUInt16LE(1, 22); // mono
        buffer.writeUInt32LE(sampleRate, 24);
        buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
        buffer.writeUInt16LE(2, 32); // block align
        buffer.writeUInt16LE(16, 34); // bits per sample

        // data chunk
        buffer.write('data', 36);
        buffer.writeUInt32LE(dataSize, 40);
        // Data is already zero (silence)

        return buffer;
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

const speechToTextService = new SpeechToTextService();

export {
SpeechToTextService,
    speechToTextService,
    STT_CONFIG
};

export default {
    SpeechToTextService,
    speechToTextService,
    STT_CONFIG
};

