import app from '../../../server/src/index.js';
import audioProcessor from '../../../server/services/ai/processors/audioProcessor';
import docxProcessor from '../../../server/services/ai/processors/docxProcessor';
import express from 'express';
import fs from 'fs';
import imageProcessor from '../../../server/services/ai/processors/imageProcessor';
import mediaIngestionRoutes from '../../../server/routes/media-ingestion';
import path from 'path';
import pptxProcessor from '../../../server/services/ai/processors/pptxProcessor';
import request from 'supertest';
import spreadsheetProcessor from '../../../server/services/ai/processors/spreadsheetProcessor';
import urlProcessor from '../../../server/services/ai/processors/urlProcessor';
import videoProcessor from '../../../server/services/ai/processors/videoProcessor';
import youtubeProcessor from '../../../server/services/ai/processors/youtubeProcessor';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { mediaIngestionService } from '../../../server/services/ai/mediaIngestionService';
import { mediaIngestionService: service } from '../../../server/services/ai/mediaIngestionService';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = ':memory:';
});

/**
 * Media Ingestion API Integration Tests
 * 
 * Tests for the unified media ingestion endpoints.
 * 
 * @version 1.0.0
 */


// Mock the auth middleware
jest.mock('../../../server/middleware/authMiddleware', () => {
    return (req, res, next) => {
        req.user = {
            id: 'test-user-id',
            organization_id: 'test-org-id'
        };
        next();
    };
});

// Mock the media ingestion service
jest.mock('../../../server/services/ai/mediaIngestionService', () => ({
    mediaIngestionService: {
        ingest: jest.fn(),
        processFile: jest.fn(),
        processYouTube: jest.fn(),
        processUrl: jest.fn(),
        getSupportedTypes: jest.fn(() => ({
            documents: ['.pdf', '.docx', '.xlsx'],
            audio: ['.mp3', '.wav'],
            video: ['.mp4'],
            images: ['.png', '.jpg']
        })),
        getCapabilities: jest.fn(() => ({
            documents: { pdf: { parser: 'pdf-parse' } }
        })),
        isSupported: jest.fn((input) => true),
        isYouTubeUrl: jest.fn((url) => /youtube\.com|youtu\.be/.test(url)),
        isUrl: jest.fn((url) => url.startsWith('http'))
    }
}));

describe('Media Ingestion API', () => {
    const db = getDatabase();
    let app;
    
    beforeAll(() => {
        // Create express app with routes
                app = express();
        app.use(express.json());
        
                app.use('/api/media-ingestion', mediaIngestionRoutes);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/media-ingestion/supported-types', () => {
    const db = getDatabase();
        it('should return list of supported types', async () => {
            const response = await request(app)
                .get('/api/media-ingestion/supported-types')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.supportedTypes).toBeDefined();
            expect(response.body.supportedTypes.documents).toContain('.pdf');
        });
    });

    describe('GET /api/media-ingestion/capabilities', () => {
    const db = getDatabase();
        it('should return processing capabilities', async () => {
            const response = await request(app)
                .get('/api/media-ingestion/capabilities')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.capabilities).toBeDefined();
        });
    });

    describe('POST /api/media-ingestion/validate', () => {
    const db = getDatabase();
        it('should validate supported file types', async () => {
            const response = await request(app)
                .post('/api/media-ingestion/validate')
                .send({ filename: 'document.pdf' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.valid).toBe(true);
            expect(response.body.type).toBe('file');
        });

        it('should validate YouTube URLs', async () => {
            const response = await request(app)
                .post('/api/media-ingestion/validate')
                .send({ youtube: 'https://youtube.com/watch?v=abc123' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.valid).toBe(true);
            expect(response.body.type).toBe('youtube');
        });

        it('should validate web URLs', async () => {
            const response = await request(app)
                .post('/api/media-ingestion/validate')
                .send({ url: 'https://example.com/article' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.valid).toBe(true);
            expect(response.body.type).toBe('url');
        });

        it('should reject request without input', async () => {
            const response = await request(app)
                .post('/api/media-ingestion/validate')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('No input');
        });
    });

    describe('POST /api/media-ingestion/ingest/youtube', () => {
    const db = getDatabase();
        it('should process YouTube URL', async () => {
            mediaIngestionService.ingest.mockResolvedValue({
                success: true,
                docId: 'test-doc-id',
                inputType: 'youtube',
                metadata: {
                    title: 'Test Video',
                    wordCount: 1000
                }
            });

            const response = await request(app)
                .post('/api/media-ingestion/ingest/youtube')
                .send({
                    url: 'https://youtube.com/watch?v=abc123',
                    language: 'pl'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.inputType).toBe('youtube');
            expect(mediaIngestionService.ingest).toHaveBeenCalledWith(
                'https://youtube.com/watch?v=abc123',
                expect.objectContaining({
                    source: 'youtube',
                    language: 'pl'
                })
            );
        });

        it('should reject invalid YouTube URL', async () => {
            const response = await request(app)
                .post('/api/media-ingestion/ingest/youtube')
                .send({
                    url: 'https://example.com/not-youtube'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid YouTube URL');
        });

        it('should reject missing URL', async () => {
            const response = await request(app)
                .post('/api/media-ingestion/ingest/youtube')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('required');
        });
    });

    describe('POST /api/media-ingestion/ingest/url', () => {
    const db = getDatabase();
        it('should process web URL', async () => {
            mediaIngestionService.ingest.mockResolvedValue({
                success: true,
                docId: 'test-doc-id',
                inputType: 'url',
                metadata: {
                    title: 'Example Article',
                    wordCount: 500
                }
            });

            const response = await request(app)
                .post('/api/media-ingestion/ingest/url')
                .send({
                    url: 'https://example.com/article'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.inputType).toBe('url');
        });

        it('should reject invalid URL', async () => {
            mediaIngestionService.isUrl.mockReturnValue(false);

            const response = await request(app)
                .post('/api/media-ingestion/ingest/url')
                .send({
                    url: 'not-a-valid-url'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/media-ingestion/ingest (file upload)', () => {
    const db = getDatabase();
        it('should reject request without file or URL', async () => {
            const response = await request(app)
                .post('/api/media-ingestion/ingest')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('No input provided');
        });
    });

    describe('Error handling', () => {
    const db = getDatabase();
        it('should handle service errors gracefully', async () => {
            mediaIngestionService.ingest.mockRejectedValue(
                new Error('Service unavailable')
            );

            const response = await request(app)
                .post('/api/media-ingestion/ingest/youtube')
                .send({
                    url: 'https://youtube.com/watch?v=abc123'
                })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Service unavailable');
        });
    });
});

describe('Processor Unit Tests', () => {
    const db = getDatabase();
    describe('DOCX Processor', () => {
    const db = getDatabase();
        
        it('should have required methods', () => {
            expect(docxProcessor.process).toBeDefined();
            expect(docxProcessor.isSupported).toBeDefined();
            expect(docxProcessor.getSupportedExtensions).toBeDefined();
        });

        it('should support .docx and .doc extensions', () => {
            expect(docxProcessor.isSupported('test.docx')).toBe(true);
            expect(docxProcessor.isSupported('test.doc')).toBe(true);
            expect(docxProcessor.isSupported('test.pdf')).toBe(false);
        });

        it('should return correct MIME types', () => {
            const mimeTypes = docxProcessor.getSupportedMimeTypes();
            expect(mimeTypes).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        });
    });

    describe('Spreadsheet Processor', () => {
    const db = getDatabase();
        
        it('should have required methods', () => {
            expect(spreadsheetProcessor.process).toBeDefined();
            expect(spreadsheetProcessor.isSupported).toBeDefined();
        });

        it('should support Excel formats', () => {
            expect(spreadsheetProcessor.isSupported('test.xlsx')).toBe(true);
            expect(spreadsheetProcessor.isSupported('test.xls')).toBe(true);
            expect(spreadsheetProcessor.isSupported('test.csv')).toBe(true);
        });

        it('should detect CSV delimiters', () => {
            const csvContent = 'a,b,c\n1,2,3';
            const delimiter = spreadsheetProcessor.detectDelimiter(csvContent);
            expect(delimiter).toBe(',');

            const tsvContent = 'a\tb\tc\n1\t2\t3';
            const tsvDelimiter = spreadsheetProcessor.detectDelimiter(tsvContent);
            expect(tsvDelimiter).toBe('\t');
        });
    });

    describe('PPTX Processor', () => {
    const db = getDatabase();
        
        it('should have required methods', () => {
            expect(pptxProcessor.process).toBeDefined();
            expect(pptxProcessor.isSupported).toBeDefined();
        });

        it('should only support .pptx', () => {
            expect(pptxProcessor.isSupported('test.pptx')).toBe(true);
            expect(pptxProcessor.isSupported('test.ppt')).toBe(false);
        });
    });

    describe('YouTube Processor', () => {
    const db = getDatabase();
        
        it('should have required methods', () => {
            expect(youtubeProcessor.process).toBeDefined();
            expect(youtubeProcessor.extractVideoId).toBeDefined();
            expect(youtubeProcessor.isYouTubeUrl).toBeDefined();
        });

        it('should extract video IDs correctly', () => {
            expect(youtubeProcessor.extractVideoId('https://youtube.com/watch?v=abc123def45')).toBe('abc123def45');
            expect(youtubeProcessor.extractVideoId('https://youtu.be/abc123def45')).toBe('abc123def45');
            expect(youtubeProcessor.extractVideoId('https://youtube.com/embed/abc123def45')).toBe('abc123def45');
            expect(youtubeProcessor.extractVideoId('https://youtube.com/shorts/abc123def45')).toBe('abc123def45');
        });

        it('should validate YouTube URLs', () => {
            expect(youtubeProcessor.isYouTubeUrl('https://youtube.com/watch?v=abc')).toBe(true);
            expect(youtubeProcessor.isYouTubeUrl('https://youtu.be/abc')).toBe(true);
            expect(youtubeProcessor.isYouTubeUrl('https://example.com')).toBe(false);
        });

        it('should format timestamps correctly', () => {
            expect(youtubeProcessor.formatTimestamp(65)).toBe('1:05');
            expect(youtubeProcessor.formatTimestamp(3665)).toBe('1:01:05');
            expect(youtubeProcessor.formatTimestamp(0)).toBe('0:00');
        });
    });

    describe('Audio Processor', () => {
    const db = getDatabase();
        
        it('should have required methods', () => {
            expect(audioProcessor.process).toBeDefined();
            expect(audioProcessor.isSupported).toBeDefined();
            expect(audioProcessor.getSupportedExtensions).toBeDefined();
        });

        it('should support audio formats', () => {
            expect(audioProcessor.isSupported('test.mp3')).toBe(true);
            expect(audioProcessor.isSupported('test.wav')).toBe(true);
            expect(audioProcessor.isSupported('test.m4a')).toBe(true);
            expect(audioProcessor.isSupported('test.txt')).toBe(false);
        });

        it('should estimate duration', () => {
            // 128 kbps MP3, 1MB = ~64 seconds
            const duration = audioProcessor.estimateDuration(1024 * 1024, 'mp3');
            expect(duration).toBeGreaterThan(50);
            expect(duration).toBeLessThan(80);
        });
    });

    describe('Video Processor', () => {
    const db = getDatabase();
        
        it('should have required methods', () => {
            expect(videoProcessor.process).toBeDefined();
            expect(videoProcessor.isSupported).toBeDefined();
            expect(videoProcessor.extractAudio).toBeDefined();
        });

        it('should support video formats', () => {
            expect(videoProcessor.isSupported('test.mp4')).toBe(true);
            expect(videoProcessor.isSupported('test.mkv')).toBe(true);
            expect(videoProcessor.isSupported('test.avi')).toBe(true);
            expect(videoProcessor.isSupported('test.mp3')).toBe(false);
        });

        it('should format duration correctly', () => {
            expect(videoProcessor.formatDuration(65)).toBe('1m 5s');
            expect(videoProcessor.formatDuration(3665)).toBe('1h 1m 5s');
            expect(videoProcessor.formatDuration(30)).toBe('30s');
        });
    });

    describe('Image Processor', () => {
    const db = getDatabase();
        
        it('should have required methods', () => {
            expect(imageProcessor.process).toBeDefined();
            expect(imageProcessor.isSupported).toBeDefined();
            expect(imageProcessor.processWithTesseract).toBeDefined();
        });

        it('should support image formats', () => {
            expect(imageProcessor.isSupported('test.png')).toBe(true);
            expect(imageProcessor.isSupported('test.jpg')).toBe(true);
            expect(imageProcessor.isSupported('test.jpeg')).toBe(true);
            expect(imageProcessor.isSupported('test.gif')).toBe(true);
            expect(imageProcessor.isSupported('test.pdf')).toBe(false);
        });

        it('should list available languages', () => {
            const languages = imageProcessor.getAvailableLanguages();
            expect(languages).toContain('pl');
            expect(languages).toContain('en');
        });
    });

    describe('URL Processor', () => {
    const db = getDatabase();
        
        it('should have required methods', () => {
            expect(urlProcessor.process).toBeDefined();
            expect(urlProcessor.isValidUrl).toBeDefined();
            expect(urlProcessor.extractMainContent).toBeDefined();
        });

        it('should validate URLs correctly', () => {
            expect(urlProcessor.isValidUrl('https://example.com')).toBe(true);
            expect(urlProcessor.isValidUrl('http://example.com')).toBe(true);
            expect(urlProcessor.isValidUrl('ftp://example.com')).toBe(false);
            expect(urlProcessor.isValidUrl('not-a-url')).toBe(false);
        });

        it('should detect JS-heavy sites', () => {
            expect(urlProcessor.needsJsRendering('https://twitter.com/user')).toBe(true);
            expect(urlProcessor.needsJsRendering('https://facebook.com/page')).toBe(true);
            expect(urlProcessor.needsJsRendering('https://example.com/article')).toBe(false);
        });

        it('should clean text properly', () => {
            const dirty = '  Multiple   spaces   and\n\n\n\nnewlines  ';
            const clean = urlProcessor.cleanText(dirty);
            expect(clean).not.toContain('   ');
            expect(clean).not.toContain('\n\n\n');
        });
    });
});

describe('Media Ingestion Service', () => {
    const db = getDatabase();
    it('should have FILE_PROCESSORS mapping', () => {
        // Import the service
                
        // Verify the service has expected methods
        expect(service.getSupportedTypes).toBeDefined();
        expect(service.getCapabilities).toBeDefined();
        expect(service.isSupported).toBeDefined();
        expect(service.ingest).toBeDefined();
        
        // Verify supported types
        const types = service.getSupportedTypes();
        expect(types.documents).toBeDefined();
        expect(types.audio).toBeDefined();
        expect(types.video).toBeDefined();
        expect(types.images).toBeDefined();
    });
});