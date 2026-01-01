/**
 * Image Processor
 * 
 * Extracts text from images using OCR (Tesseract.js) or GPT-4 Vision.
 * Supports various image formats: PNG, JPG, GIF, WebP, BMP, TIFF.
 * 
 * Part of the Multimodal Content Ingestion System
 * 
 * @version 1.0.0
 */

const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// Supported image formats
const SUPPORTED_FORMATS = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff'
};

// Language codes mapping for Tesseract
const TESSERACT_LANGUAGES = {
    'pl': 'pol',
    'en': 'eng',
    'de': 'deu',
    'fr': 'fra',
    'es': 'spa',
    'it': 'ita',
    'pt': 'por',
    'ru': 'rus',
    'zh': 'chi_sim',
    'ja': 'jpn',
    'ko': 'kor',
    'ar': 'ara'
};

/**
 * Process an image file and extract text using OCR
 * 
 * @param {string} filePath - Path to the image file
 * @param {Object} options - Processing options
 * @param {string} options.language - Language code (e.g., 'pl', 'en')
 * @param {string} options.method - OCR method ('tesseract' or 'vision')
 * @param {boolean} options.detectDiagrams - Describe diagrams (GPT-4 Vision only)
 * @returns {Promise<Object>} OCR result with metadata
 */
async function process(filePath, options = {}) {
    const {
        language = 'pl',
        method = 'tesseract',
        detectDiagrams = true
    } = options;

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_FORMATS[ext]) {
        throw new Error(`Unsupported image format: ${ext}. Supported: ${Object.keys(SUPPORTED_FORMATS).join(', ')}`);
    }

    try {
        if (method === 'vision') {
            return await processWithVision(filePath, { language, detectDiagrams });
        } else {
            return await processWithTesseract(filePath, { language });
        }
    } catch (error) {
        console.error('[ImageProcessor] Error processing file:', error.message);
        throw new Error(`Failed to process image: ${error.message}`);
    }
}

/**
 * Process image using Tesseract.js OCR
 */
async function processWithTesseract(filePath, options = {}) {
    const { language = 'pl' } = options;
    const startTime = Date.now();

    // Map language code to Tesseract format
    const tessLang = TESSERACT_LANGUAGES[language] || 'eng';
    
    // Try with multiple languages for better results
    const langString = tessLang === 'eng' ? 'eng' : `${tessLang}+eng`;

    try {
        const result = await Tesseract.recognize(filePath, langString, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    // Progress logging (optional)
                }
            }
        });

        const text = result.data.text.trim();
        const stats = fs.statSync(filePath);
        const filename = path.basename(filePath);
        const processingTime = Date.now() - startTime;

        return {
            text,
            metadata: {
                type: 'image',
                format: path.extname(filePath).slice(1),
                filename,
                fileSize: stats.size,
                method: 'tesseract',
                language: tessLang,
                confidence: result.data.confidence,
                characterCount: text.length,
                wordCount: countWords(text),
                processingTimeMs: processingTime
            },
            // Additional Tesseract data
            blocks: result.data.blocks?.map(b => ({
                text: b.text,
                confidence: b.confidence,
                bbox: b.bbox
            })) || []
        };

    } catch (error) {
        throw new Error(`Tesseract OCR failed: ${error.message}`);
    }
}

/**
 * Process image using GPT-4 Vision
 */
async function processWithVision(filePath, options = {}) {
    const { language = 'pl', detectDiagrams = true } = options;
    const startTime = Date.now();

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY not configured. GPT-4 Vision requires an API key.');
    }

    try {
        const openai = new OpenAI({ apiKey });

        // Read image and convert to base64
        const imageBuffer = fs.readFileSync(filePath);
        const base64Image = imageBuffer.toString('base64');
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = SUPPORTED_FORMATS[ext] || 'image/png';

        // Build prompt based on options
        let prompt = `Extract all text from this image. Output only the extracted text, preserving the original layout and structure as much as possible.`;
        
        if (detectDiagrams) {
            prompt = `Analyze this image and:
1. Extract all visible text, preserving layout
2. If there are diagrams, charts, or flowcharts, describe their structure and content
3. If there are tables, format them clearly
4. If there are handwritten notes, transcribe them

Output in ${language === 'pl' ? 'Polish' : 'the same language as the content'}.`;
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`,
                                detail: 'high'
                            }
                        }
                    ]
                }
            ],
            max_tokens: 4000
        });

        const text = response.choices[0].message.content || '';
        const stats = fs.statSync(filePath);
        const filename = path.basename(filePath);
        const processingTime = Date.now() - startTime;

        return {
            text,
            metadata: {
                type: 'image',
                format: ext.slice(1),
                filename,
                fileSize: stats.size,
                method: 'gpt-4-vision',
                model: 'gpt-4o',
                language,
                characterCount: text.length,
                wordCount: countWords(text),
                tokensUsed: response.usage?.total_tokens || 0,
                processingTimeMs: processingTime
            }
        };

    } catch (error) {
        if (error.code === 'insufficient_quota') {
            throw new Error('OpenAI API quota exceeded. Please check your billing.');
        }
        if (error.code === 'invalid_api_key') {
            throw new Error('Invalid OpenAI API key.');
        }
        throw new Error(`GPT-4 Vision failed: ${error.message}`);
    }
}

/**
 * Process image from buffer
 */
async function processBuffer(buffer, options = {}) {
    const {
        language = 'pl',
        method = 'tesseract',
        format = 'png'
    } = options;

    // For Tesseract, we need to save to temp file
    if (method === 'tesseract') {
        const tempPath = path.join(__dirname, '../../../../uploads/temp', `img_${Date.now()}.${format}`);
        
        try {
            fs.writeFileSync(tempPath, buffer);
            const result = await processWithTesseract(tempPath, { language });
            fs.unlinkSync(tempPath);
            return result;
        } catch (error) {
            if (fs.existsSync(tempPath)) {
                try { fs.unlinkSync(tempPath); } catch (e) { }
            }
            throw error;
        }
    }

    // For Vision, we can work directly with buffer
    const base64Image = buffer.toString('base64');
    const mimeType = SUPPORTED_FORMATS[`.${format}`] || 'image/png';

    // Similar to processWithVision but using buffer directly
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY not configured');
    }

    const openai = new OpenAI({ apiKey });
    const startTime = Date.now();

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'Extract all text from this image.' },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:${mimeType};base64,${base64Image}`,
                            detail: 'high'
                        }
                    }
                ]
            }
        ],
        max_tokens: 4000
    });

    const text = response.choices[0].message.content || '';
    const processingTime = Date.now() - startTime;

    return {
        text,
        metadata: {
            type: 'image',
            format,
            method: 'gpt-4-vision',
            language,
            characterCount: text.length,
            wordCount: countWords(text),
            processingTimeMs: processingTime
        }
    };
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
 * Check if file is a supported image format
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
    return [...new Set(Object.values(SUPPORTED_FORMATS))];
}

/**
 * Get available OCR languages
 */
function getAvailableLanguages() {
    return Object.keys(TESSERACT_LANGUAGES);
}

/**
 * Check if Vision API is available
 */
function isVisionAvailable() {
    return !!process.env.OPENAI_API_KEY;
}

module.exports = {
    process,
    processWithTesseract,
    processWithVision,
    processBuffer,
    isSupported,
    getSupportedExtensions,
    getSupportedMimeTypes,
    getAvailableLanguages,
    isVisionAvailable,
    SUPPORTED_FORMATS,
    TESSERACT_LANGUAGES
};


