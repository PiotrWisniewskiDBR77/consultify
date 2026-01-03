/**
 * Media Processors Index
 * 
 * Central export for all media processors in the Multimodal Content Ingestion System.
 * 
 * @version 1.0.0
 */

const docxProcessor = require('./docxProcessor');
const spreadsheetProcessor = require('./spreadsheetProcessor');
const pptxProcessor = require('./pptxProcessor');
const youtubeProcessor = require('./youtubeProcessor');
const audioProcessor = require('./audioProcessor');
const videoProcessor = require('./videoProcessor');
const imageProcessor = require('./imageProcessor');
const urlProcessor = require('./urlProcessor');

// Export all processors
export default {
    // Document Processors
    docxProcessor,
    spreadsheetProcessor,
    pptxProcessor,
    
    // Media Processors
    audioProcessor,
    videoProcessor,
    imageProcessor,
    
    // Web Processors
    youtubeProcessor,
    urlProcessor,
    
    // Helper functions
    getProcessor(type) {
        const processors = {
            docx: docxProcessor,
            doc: docxProcessor,
            spreadsheet: spreadsheetProcessor,
            xlsx: spreadsheetProcessor,
            xls: spreadsheetProcessor,
            csv: spreadsheetProcessor,
            pptx: pptxProcessor,
            audio: audioProcessor,
            video: videoProcessor,
            image: imageProcessor,
            youtube: youtubeProcessor,
            url: urlProcessor
        };
        return processors[type] || null;
    },
    
    getSupportedExtensions() {
        return {
            documents: [
                ...docxProcessor.getSupportedExtensions(),
                ...spreadsheetProcessor.getSupportedExtensions(),
                ...pptxProcessor.getSupportedExtensions()
            ],
            audio: audioProcessor.getSupportedExtensions(),
            video: videoProcessor.getSupportedExtensions(),
            images: imageProcessor.getSupportedExtensions()
        };
    },
    
    getSupportedMimeTypes() {
        return {
            documents: [
                ...docxProcessor.getSupportedMimeTypes(),
                ...spreadsheetProcessor.getSupportedMimeTypes(),
                ...pptxProcessor.getSupportedMimeTypes()
            ],
            audio: audioProcessor.getSupportedMimeTypes(),
            video: videoProcessor.getSupportedMimeTypes(),
            images: imageProcessor.getSupportedMimeTypes()
        };
    },
    
    isSupported(filePath) {
        return (
            docxProcessor.isSupported(filePath) ||
            spreadsheetProcessor.isSupported(filePath) ||
            pptxProcessor.isSupported(filePath) ||
            audioProcessor.isSupported(filePath) ||
            videoProcessor.isSupported(filePath) ||
            imageProcessor.isSupported(filePath)
        );
    }
};









