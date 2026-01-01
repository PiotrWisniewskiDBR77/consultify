/**
 * PPTX Processor
 * 
 * Extracts text content from PowerPoint presentations (.pptx, .ppt)
 * Parses XML structure within PPTX files to extract slide content.
 * 
 * Part of the Multimodal Content Ingestion System
 * 
 * @version 1.0.0
 */

const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

/**
 * Process a PowerPoint file and extract text content
 * 
 * @param {string} filePath - Path to the PowerPoint file
 * @param {Object} options - Processing options
 * @param {boolean} options.includeNotes - Include speaker notes
 * @param {boolean} options.includeSlideNumbers - Add slide numbers to output
 * @returns {Promise<Object>} Extracted content with metadata
 */
async function process(filePath, options = {}) {
    const { includeNotes = true, includeSlideNumbers = true } = options;

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!['.pptx', '.ppt'].includes(ext)) {
        throw new Error(`Unsupported file type: ${ext}. Expected .pptx or .ppt`);
    }

    // .ppt files are not supported (binary format)
    if (ext === '.ppt') {
        throw new Error('.ppt format is not supported. Please convert to .pptx');
    }

    try {
        const startTime = Date.now();

        // Read the PPTX file
        const fileBuffer = fs.readFileSync(filePath);
        const zip = await JSZip.loadAsync(fileBuffer);

        // Extract slides
        const slides = [];
        const slideFiles = Object.keys(zip.files)
            .filter(name => name.match(/ppt\/slides\/slide\d+\.xml/))
            .sort((a, b) => {
                const numA = parseInt(a.match(/slide(\d+)/)[1]);
                const numB = parseInt(b.match(/slide(\d+)/)[1]);
                return numA - numB;
            });

        for (const slideFile of slideFiles) {
            const slideNumber = parseInt(slideFile.match(/slide(\d+)/)[1]);
            const content = await zip.file(slideFile).async('text');
            const slideText = extractTextFromSlideXml(content);

            // Get notes if requested
            let notesText = '';
            if (includeNotes) {
                const notesFile = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
                if (zip.files[notesFile]) {
                    const notesContent = await zip.file(notesFile).async('text');
                    notesText = extractTextFromSlideXml(notesContent);
                }
            }

            slides.push({
                number: slideNumber,
                text: slideText,
                notes: notesText
            });
        }

        // Combine all slides into text
        let combinedText = '';
        for (const slide of slides) {
            if (includeSlideNumbers) {
                combinedText += `## Slide ${slide.number}\n\n`;
            }
            combinedText += slide.text + '\n';
            if (slide.notes) {
                combinedText += `\n**Speaker Notes:**\n${slide.notes}\n`;
            }
            combinedText += '\n---\n\n';
        }

        // Extract presentation metadata
        let title = '';
        let author = '';
        const coreFile = zip.files['docProps/core.xml'];
        if (coreFile) {
            const coreContent = await coreFile.async('text');
            title = extractXmlValue(coreContent, 'dc:title') || '';
            author = extractXmlValue(coreContent, 'dc:creator') || '';
        }

        // Get file metadata
        const stats = fs.statSync(filePath);
        const filename = path.basename(filePath);

        const processingTime = Date.now() - startTime;

        return {
            text: combinedText.trim(),
            slides,
            metadata: {
                type: 'pptx',
                filename,
                extension: ext,
                fileSize: stats.size,
                slideCount: slides.length,
                title,
                author,
                characterCount: combinedText.length,
                wordCount: countWords(combinedText),
                processingTimeMs: processingTime
            }
        };

    } catch (error) {
        console.error('[PptxProcessor] Error processing file:', error.message);
        throw new Error(`Failed to process PPTX file: ${error.message}`);
    }
}

/**
 * Extract text content from PowerPoint slide XML
 */
function extractTextFromSlideXml(xml) {
    if (!xml) return '';

    const textParts = [];

    // Extract all text elements (a:t tags)
    const textMatches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
    
    for (const match of textMatches) {
        const text = match.replace(/<a:t[^>]*>([^<]*)<\/a:t>/, '$1');
        if (text && text.trim()) {
            textParts.push(decodeXmlEntities(text));
        }
    }

    // Also check for text in p:txBody elements
    const bodyMatches = xml.match(/<p:txBody[^>]*>([\s\S]*?)<\/p:txBody>/g) || [];
    for (const body of bodyMatches) {
        const innerText = body.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
        for (const t of innerText) {
            const text = t.replace(/<a:t[^>]*>([^<]*)<\/a:t>/, '$1');
            if (text && text.trim() && !textParts.includes(text)) {
                textParts.push(decodeXmlEntities(text));
            }
        }
    }

    // Group text by paragraphs (a:p elements)
    let result = '';
    let currentParagraph = '';
    
    // Simple approach: join with spaces, add newlines for apparent paragraph breaks
    const uniqueText = [...new Set(textParts)];
    result = uniqueText.join(' ').replace(/\s+/g, ' ').trim();

    return result;
}

/**
 * Extract a value from XML by tag name
 */
function extractXmlValue(xml, tagName) {
    const regex = new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? decodeXmlEntities(match[1]) : null;
}

/**
 * Decode XML entities
 */
function decodeXmlEntities(text) {
    if (!text) return '';
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
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
 * Check if file is a supported PowerPoint document
 */
function isSupported(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.pptx'; // Only .pptx is supported
}

/**
 * Get supported file extensions
 */
function getSupportedExtensions() {
    return ['.pptx'];
}

/**
 * Get supported MIME types
 */
function getSupportedMimeTypes() {
    return [
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
}

module.exports = {
    process,
    isSupported,
    getSupportedExtensions,
    getSupportedMimeTypes,
    extractTextFromSlideXml,
    extractXmlValue
};

