/**
 * YouTube Processor
 * 
 * Extracts transcripts and metadata from YouTube videos.
 * Supports automatic and manual captions in multiple languages.
 * 
 * Part of the Multimodal Content Ingestion System
 * 
 * @version 1.0.0
 */

const { YoutubeTranscript } = require('youtube-transcript');

/**
 * Process a YouTube URL and extract transcript
 * 
 * @param {string} url - YouTube video URL
 * @param {Object} options - Processing options
 * @param {string} options.language - Preferred language for transcript (e.g., 'pl', 'en')
 * @param {boolean} options.includeTimestamps - Include timestamps in output
 * @param {boolean} options.fetchMetadata - Fetch video metadata via oEmbed
 * @returns {Promise<Object>} Extracted content with metadata
 */
async function process(url, options = {}) {
    const {
        language = null,
        includeTimestamps = false,
        fetchMetadata = true
    } = options;

    // Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
        throw new Error('Invalid YouTube URL. Could not extract video ID.');
    }

    try {
        const startTime = Date.now();

        // Fetch transcript
        let transcript;
        try {
            if (language) {
                transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: language });
            } else {
                transcript = await YoutubeTranscript.fetchTranscript(videoId);
            }
        } catch (transcriptError) {
            // Try without language preference if specific language fails
            if (language) {
                console.warn(`[YouTubeProcessor] Language '${language}' not available, trying default`);
                transcript = await YoutubeTranscript.fetchTranscript(videoId);
            } else {
                throw transcriptError;
            }
        }

        if (!transcript || transcript.length === 0) {
            throw new Error('No transcript available for this video');
        }

        // Format transcript text
        let text = '';
        if (includeTimestamps) {
            text = transcript.map(segment => {
                const time = formatTimestamp(segment.offset / 1000);
                return `[${time}] ${segment.text}`;
            }).join('\n');
        } else {
            text = transcript.map(segment => segment.text).join(' ');
            // Clean up the text
            text = text
                .replace(/\s+/g, ' ')
                .replace(/\[.*?\]/g, '') // Remove [Music], [Applause], etc.
                .trim();
        }

        // Fetch video metadata
        let metadata = {
            videoId,
            url,
            type: 'youtube'
        };

        if (fetchMetadata) {
            const videoMeta = await fetchVideoMetadata(url);
            metadata = {
                ...metadata,
                title: videoMeta.title,
                author: videoMeta.author_name,
                authorUrl: videoMeta.author_url,
                thumbnailUrl: videoMeta.thumbnail_url,
                duration: estimateDuration(transcript)
            };
        }

        // Add title to text if available
        let fullText = text;
        if (metadata.title) {
            fullText = `# ${metadata.title}\n\n**Author:** ${metadata.author || 'Unknown'}\n\n${text}`;
        }

        const processingTime = Date.now() - startTime;

        return {
            text: fullText,
            transcript: transcript.map(s => ({
                text: s.text,
                start: s.offset / 1000,
                duration: s.duration / 1000
            })),
            metadata: {
                ...metadata,
                segmentCount: transcript.length,
                characterCount: text.length,
                wordCount: countWords(text),
                processingTimeMs: processingTime
            }
        };

    } catch (error) {
        console.error('[YouTubeProcessor] Error processing video:', error.message);
        
        // Provide more helpful error messages
        if (error.message.includes('Transcript is disabled')) {
            throw new Error('Transcripts are disabled for this video. The uploader has not enabled captions.');
        }
        if (error.message.includes('No transcript')) {
            throw new Error('No transcript available for this video. It may not have captions.');
        }
        if (error.message.includes('Video unavailable')) {
            throw new Error('Video is unavailable. It may be private, deleted, or region-locked.');
        }
        
        throw new Error(`Failed to process YouTube video: ${error.message}`);
    }
}

/**
 * Extract video ID from various YouTube URL formats
 */
function extractVideoId(url) {
    if (!url) return null;

    // Handle direct video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
        return url;
    }

    // Standard youtube.com URLs
    let match = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.+&v=)([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];

    // Short youtu.be URLs
    match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];

    // Embed URLs
    match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];

    // YouTube Shorts
    match = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];

    // Live streams
    match = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];

    return null;
}

/**
 * Fetch video metadata using oEmbed API
 */
async function fetchVideoMetadata(url) {
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await fetch(oembedUrl);
        
        if (!response.ok) {
            throw new Error(`oEmbed request failed: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.warn('[YouTubeProcessor] Could not fetch metadata:', error.message);
        return {
            title: null,
            author_name: null
        };
    }
}

/**
 * Estimate video duration from transcript
 */
function estimateDuration(transcript) {
    if (!transcript || transcript.length === 0) return 0;
    
    const lastSegment = transcript[transcript.length - 1];
    return Math.ceil((lastSegment.offset + lastSegment.duration) / 1000);
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
 * Check if URL is a valid YouTube URL
 */
function isYouTubeUrl(url) {
    if (!url) return false;
    return /(?:youtube\.com|youtu\.be)/.test(url);
}

/**
 * Get available transcript languages for a video
 */
async function getAvailableLanguages(url) {
    // Note: youtube-transcript library doesn't expose this directly
    // This is a placeholder for future implementation
    return ['en']; // Default assumption
}

module.exports = {
    process,
    extractVideoId,
    isYouTubeUrl,
    fetchVideoMetadata,
    getAvailableLanguages,
    formatTimestamp
};

