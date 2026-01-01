/**
 * DOCX Processor
 * 
 * Extracts text content from Microsoft Word documents (.docx, .doc)
 * Uses mammoth library for reliable text extraction with structure preservation.
 * 
 * Part of the Multimodal Content Ingestion System
 * 
 * @version 1.0.0
 */

const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

/**
 * Process a DOCX/DOC file and extract text content
 * 
 * @param {string} filePath - Path to the Word document
 * @param {Object} options - Processing options
 * @param {boolean} options.preserveStructure - Keep headings and formatting markers
 * @param {boolean} options.includeImages - Extract image alt text
 * @returns {Promise<Object>} Extracted content with metadata
 */
async function process(filePath, options = {}) {
    const { preserveStructure = true, includeImages = true } = options;

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!['.docx', '.doc'].includes(ext)) {
        throw new Error(`Unsupported file type: ${ext}. Expected .docx or .doc`);
    }

    try {
        const startTime = Date.now();

        // Configure mammoth options
        const mammothOptions = {
            path: filePath
        };

        // Style map for preserving structure
        if (preserveStructure) {
            mammothOptions.styleMap = [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Heading 2'] => h2:fresh",
                "p[style-name='Heading 3'] => h3:fresh",
                "p[style-name='Title'] => h1:fresh",
                "p[style-name='Subtitle'] => h2:fresh",
                "b => strong",
                "i => em",
                "u => u"
            ];
        }

        // Extract raw text
        const textResult = await mammoth.extractRawText(mammothOptions);
        
        // Also get HTML for structure analysis if needed
        let structuredText = textResult.value;
        let htmlContent = null;

        if (preserveStructure) {
            const htmlResult = await mammoth.convertToHtml(mammothOptions);
            htmlContent = htmlResult.value;
            
            // Convert HTML headings to markdown-style markers for better chunking
            structuredText = convertHtmlToStructuredText(htmlResult.value);
        }

        // Extract metadata
        const stats = fs.statSync(filePath);
        const filename = path.basename(filePath);

        const processingTime = Date.now() - startTime;

        return {
            text: structuredText || textResult.value,
            rawText: textResult.value,
            html: htmlContent,
            metadata: {
                type: 'docx',
                filename,
                extension: ext,
                fileSize: stats.size,
                characterCount: textResult.value.length,
                wordCount: countWords(textResult.value),
                processingTimeMs: processingTime,
                warnings: textResult.messages.map(m => m.message)
            }
        };

    } catch (error) {
        console.error('[DocxProcessor] Error processing file:', error.message);
        throw new Error(`Failed to process DOCX file: ${error.message}`);
    }
}

/**
 * Convert HTML to structured text with markdown-style headers
 * This helps with semantic chunking later
 */
function convertHtmlToStructuredText(html) {
    if (!html) return '';

    let text = html
        // Convert headings to markdown
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
        .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n')
        .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n')
        .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n')
        // Convert lists
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
        .replace(/<\/ul>/gi, '\n')
        .replace(/<\/ol>/gi, '\n')
        .replace(/<ul[^>]*>/gi, '\n')
        .replace(/<ol[^>]*>/gi, '\n')
        // Convert paragraphs
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        // Convert emphasis
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
        .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
        // Remove remaining HTML tags
        .replace(/<[^>]+>/g, '')
        // Decode HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Clean up whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return text;
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
 * Check if file is a supported Word document
 */
function isSupported(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.docx', '.doc'].includes(ext);
}

/**
 * Get supported file extensions
 */
function getSupportedExtensions() {
    return ['.docx', '.doc'];
}

/**
 * Get supported MIME types
 */
function getSupportedMimeTypes() {
    return [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
    ];
}

module.exports = {
    process,
    isSupported,
    getSupportedExtensions,
    getSupportedMimeTypes,
    convertHtmlToStructuredText,
    countWords
};

