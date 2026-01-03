/**
 * Audio Processor
 * 
 * Transcribes audio files to text using the existing Speech-to-Text service.
 * Supports various audio formats: MP3, WAV, M4A, WebM, OGG, FLAC.
 * 
 * Part of the Multimodal Content Ingestion System
 * 
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { speechToTextService } = require('../speechToTextService');

// Supported audio formats
const SUPPORTED_FORMATS = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.wma': 'audio/x-ms-wma'
};

/**
 * Process an audio file and transcribe to text
 * 
 * @param {string} filePath - Path to the audio file
 * @param {Object} options - Processing options
 * @param {string} options.language - Language code (e.g., 'pl', 'en')
 * @param {string} options.provider - Force specific STT provider ('whisper', 'deepgram')
 * @param {boolean} options.timestamps - Include word timestamps
 * @returns {Promise<Object>} Transcription result with metadata
 */
async function process(filePath, options = {}) {
    const {
        language = 'pl',
        provider = null,
        timestamps = false
    } = options;

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_FORMATS[ext]) {
        throw new Error(`Unsupported audio format: ${ext}. Supported: ${Object.keys(SUPPORTED_FORMATS).join(', ')}`);
    }

    try {
        const startTime = Date.now();

        // Get file stats
        const stats = fs.statSync(filePath);
        const filename = path.basename(filePath);

        // Check file size (Whisper limit is 25MB)
        const maxSizeBytes = 25 * 1024 * 1024;
        if (stats.size > maxSizeBytes) {
            throw new Error(`Audio file too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum size is 25MB.`);
        }

        // Transcribe using Speech-to-Text service
        const transcriptionResult = await speechToTextService.transcribe(filePath, {
            language,
            provider,
            format: ext.slice(1), // Remove leading dot
            timestamps
        });

        const processingTime = Date.now() - startTime;

        // Format the output
        let formattedText = transcriptionResult.text;

        // Add timestamps if available and requested
        if (timestamps && transcriptionResult.segments && transcriptionResult.segments.length > 0) {
            formattedText = transcriptionResult.segments.map(segment => {
                const time = formatTimestamp(segment.start);
                return `[${time}] ${segment.text}`;
            }).join('\n');
        }

        return {
            text: formattedText,
            rawText: transcriptionResult.text,
            segments: transcriptionResult.segments || [],
            words: transcriptionResult.words || [],
            metadata: {
                type: 'audio',
                format: ext.slice(1),
                filename,
                extension: ext,
                fileSize: stats.size,
                language: transcriptionResult.language || language,
                provider: transcriptionResult.provider,
                confidence: transcriptionResult.confidence,
                characterCount: transcriptionResult.text.length,
                wordCount: countWords(transcriptionResult.text),
                latencyMs: transcriptionResult.latencyMs,
                processingTimeMs: processingTime
            }
        };

    } catch (error) {
        console.error('[AudioProcessor] Error processing file:', error.message);
        
        // Provide helpful error messages
        if (error.message.includes('providers failed')) {
            throw new Error('Transcription service unavailable. Please try again later.');
        }
        if (error.message.includes('API key')) {
            throw new Error('Speech-to-text service not configured. Contact administrator.');
        }
        
        throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
}

/**
 * Process audio from buffer instead of file
 * 
 * @param {Buffer} buffer - Audio data buffer
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Transcription result
 */
async function processBuffer(buffer, options = {}) {
    const {
        language = 'pl',
        format = 'webm',
        provider = null
    } = options;

    try {
        const startTime = Date.now();

        const transcriptionResult = await speechToTextService.transcribe(buffer, {
            language,
            provider,
            format
        });

        const processingTime = Date.now() - startTime;

        return {
            text: transcriptionResult.text,
            metadata: {
                type: 'audio',
                format,
                language: transcriptionResult.language || language,
                provider: transcriptionResult.provider,
                confidence: transcriptionResult.confidence,
                characterCount: transcriptionResult.text.length,
                wordCount: countWords(transcriptionResult.text),
                latencyMs: transcriptionResult.latencyMs,
                processingTimeMs: processingTime
            }
        };

    } catch (error) {
        console.error('[AudioProcessor] Error processing buffer:', error.message);
        throw new Error(`Failed to transcribe audio buffer: ${error.message}`);
    }
}

/**
 * Estimate audio duration from file size (rough approximation)
 * More accurate duration requires parsing the audio file
 */
function estimateDuration(fileSize, format) {
    // Rough bitrate estimates by format (kbps)
    const bitrates = {
        'mp3': 128,
        'wav': 1411,
        'm4a': 128,
        'webm': 96,
        'ogg': 128,
        'flac': 900,
        'aac': 128
    };

    const bitrate = bitrates[format] || 128;
    const durationSeconds = (fileSize * 8) / (bitrate * 1000);
    
    return Math.round(durationSeconds);
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Count words in text
 */
function countWords(text) {
    if (!text) return 0;
    return text
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0)
        .length;
}

/**
 * Check if file is a supported audio format
 */
function isSupported(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return !!SUPPORTED_FORMATS[ext];
}

/**
 * Get supported file extensions
 */
function getSupportedExtensions() {
    return Object.keys(SUPPORTED_FORMATS);
}

/**
 * Get supported MIME types
 */
function getSupportedMimeTypes() {
    return Object.values(SUPPORTED_FORMATS);
}

/**
 * Get available languages for transcription
 */
function getAvailableLanguages() {
    return speechToTextService.getSupportedLanguages();
}

/**
 * Get STT service health status
 */
function getServiceHealth() {
    return speechToTextService.getHealthStatus();
}

module.exports = {
    process,
    processBuffer,
    isSupported,
    getSupportedExtensions,
    getSupportedMimeTypes,
    getAvailableLanguages,
    getServiceHealth,
    estimateDuration,
    formatTimestamp,
    SUPPORTED_FORMATS
};






