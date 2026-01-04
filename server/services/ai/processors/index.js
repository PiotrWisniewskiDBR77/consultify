/**
 * Media Processors Index
 * 
 * Central export for all media processors in the Multimodal Content Ingestion System.
 * 
 * @version 1.0.0
 */

import docxProcessor from './docxProcessor.js';
import spreadsheetProcessor from './spreadsheetProcessor.js';
import pptxProcessor from './pptxProcessor.js';
import youtubeProcessor from './youtubeProcessor.js';
import audioProcessor from './audioProcessor.js';
import videoProcessor from './videoProcessor.js';
import imageProcessor from './imageProcessor.js';
import urlProcessor from './urlProcessor.js';

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










