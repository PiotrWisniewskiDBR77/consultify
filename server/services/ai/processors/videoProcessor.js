/**
 * Video Processor
 * 
 * Extracts and transcribes audio from video files.
 * Uses FFmpeg for audio extraction and Whisper for transcription.
 * 
 * Part of the Multimodal Content Ingestion System
 * 
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const audioProcessor = require('./audioProcessor');

const execAsync = promisify(exec);

// Supported video formats
const SUPPORTED_FORMATS = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.m4v': 'video/x-m4v'
};

// Temp directory for extracted audio
const TEMP_DIR = path.join(__dirname, '../../../../uploads/temp');

/**
 * Process a video file and transcribe its audio
 * 
 * @param {string} filePath - Path to the video file
 * @param {Object} options - Processing options
 * @param {string} options.language - Language code for transcription
 * @param {boolean} options.timestamps - Include timestamps
 * @param {boolean} options.extractFrames - Extract key frames for OCR (future)
 * @returns {Promise<Object>} Transcription result with metadata
 */
async function process(filePath, options = {}) {
    const {
        language = 'pl',
        timestamps = false,
        extractFrames = false
    } = options;

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_FORMATS[ext]) {
        throw new Error(`Unsupported video format: ${ext}. Supported: ${Object.keys(SUPPORTED_FORMATS).join(', ')}`);
    }

    // Ensure temp directory exists
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    let audioPath = null;

    try {
        const startTime = Date.now();

        // Get file stats
        const stats = fs.statSync(filePath);
        const filename = path.basename(filePath);

        // Check FFmpeg availability
        const ffmpegAvailable = await checkFFmpeg();
        if (!ffmpegAvailable) {
            throw new Error('FFmpeg is not installed. Video processing requires FFmpeg.');
        }

        // Get video duration
        const duration = await getVideoDuration(filePath);

        // Extract audio from video
        audioPath = path.join(TEMP_DIR, `audio_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);
        await extractAudio(filePath, audioPath);

        // Transcribe the extracted audio
        const transcriptionResult = await audioProcessor.process(audioPath, {
            language,
            timestamps
        });

        // Clean up temp audio file
        try {
            fs.unlinkSync(audioPath);
        } catch (e) {
            console.warn('[VideoProcessor] Could not clean up temp file:', e.message);
        }

        const processingTime = Date.now() - startTime;

        return {
            text: transcriptionResult.text,
            rawText: transcriptionResult.rawText,
            segments: transcriptionResult.segments,
            metadata: {
                type: 'video',
                format: ext.slice(1),
                filename,
                extension: ext,
                fileSize: stats.size,
                duration,
                language: transcriptionResult.metadata.language,
                provider: transcriptionResult.metadata.provider,
                confidence: transcriptionResult.metadata.confidence,
                characterCount: transcriptionResult.text.length,
                wordCount: transcriptionResult.metadata.wordCount,
                processingTimeMs: processingTime,
                audioExtractionMethod: 'ffmpeg'
            }
        };

    } catch (error) {
        // Clean up on error
        if (audioPath && fs.existsSync(audioPath)) {
            try { fs.unlinkSync(audioPath); } catch (e) { }
        }

        console.error('[VideoProcessor] Error processing file:', error.message);
        throw new Error(`Failed to process video: ${error.message}`);
    }
}

/**
 * Check if FFmpeg is available
 */
async function checkFFmpeg() {
    try {
        await execAsync('ffmpeg -version');
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Extract audio track from video using FFmpeg
 * 
 * @param {string} videoPath - Path to video file
 * @param {string} audioPath - Output path for audio file
 */
async function extractAudio(videoPath, audioPath) {
    return new Promise((resolve, reject) => {
        // FFmpeg command to extract audio as WAV (best for Whisper)
        const args = [
            '-i', videoPath,
            '-vn',                    // No video
            '-acodec', 'pcm_s16le',   // PCM 16-bit
            '-ar', '16000',           // 16kHz sample rate (Whisper optimal)
            '-ac', '1',               // Mono
            '-y',                     // Overwrite output
            audioPath
        ];

        const ffmpeg = spawn('ffmpeg', args);
        let stderr = '';

        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
            }
        });

        ffmpeg.on('error', (error) => {
            reject(new Error(`FFmpeg spawn error: ${error.message}`));
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            ffmpeg.kill();
            reject(new Error('Audio extraction timed out'));
        }, 5 * 60 * 1000);
    });
}

/**
 * Get video duration in seconds using FFprobe
 */
async function getVideoDuration(videoPath) {
    try {
        const { stdout } = await execAsync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
        );
        const duration = parseFloat(stdout.trim());
        return isNaN(duration) ? 0 : Math.round(duration);
    } catch (error) {
        console.warn('[VideoProcessor] Could not get video duration:', error.message);
        return 0;
    }
}

/**
 * Get video metadata using FFprobe
 */
async function getVideoMetadata(videoPath) {
    try {
        const { stdout } = await execAsync(
            `ffprobe -v error -show_entries format=duration,size,bit_rate:stream=width,height,codec_name,codec_type -of json "${videoPath}"`
        );
        return JSON.parse(stdout);
    } catch (error) {
        console.warn('[VideoProcessor] Could not get video metadata:', error.message);
        return null;
    }
}

/**
 * Extract key frames from video (for future OCR processing)
 * 
 * @param {string} videoPath - Path to video file
 * @param {string} outputDir - Directory for frame images
 * @param {number} interval - Seconds between frames
 * @returns {Promise<string[]>} Array of frame file paths
 */
async function extractKeyFrames(videoPath, outputDir, interval = 30) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const framePattern = path.join(outputDir, 'frame_%04d.jpg');

    try {
        await execAsync(
            `ffmpeg -i "${videoPath}" -vf "fps=1/${interval}" -q:v 2 "${framePattern}"`
        );

        // Get list of generated frames
        const files = fs.readdirSync(outputDir)
            .filter(f => f.startsWith('frame_') && f.endsWith('.jpg'))
            .map(f => path.join(outputDir, f))
            .sort();

        return files;
    } catch (error) {
        console.error('[VideoProcessor] Error extracting frames:', error.message);
        return [];
    }
}

/**
 * Check if file is a supported video format
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
 * Format duration to human-readable string
 */
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

module.exports = {
    process,
    extractAudio,
    extractKeyFrames,
    getVideoDuration,
    getVideoMetadata,
    checkFFmpeg,
    isSupported,
    getSupportedExtensions,
    getSupportedMimeTypes,
    formatDuration,
    SUPPORTED_FORMATS
};



