const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    RagService: require('./ragService')
};

const IngestionService = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },
    /**
     * Process an uploaded file
     * @param {Object} file - Multer file object
     * @param {string} organizationId - Context for the document
     * @returns {Promise<Object>} - Processed document metadata
     */
    processFile: async (file, organizationId) => {
        if (!file) throw new Error("No file provided");

        const filePath = file.path;
        const fileExt = path.extname(file.originalname).toLowerCase();
        let content = '';

        try {
            // 1. Extract Text
            if (fileExt === '.pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdf(dataBuffer);
                content = data.text;
            } else if (['.txt', '.md', '.json', '.csv'].includes(fileExt)) {
                content = fs.readFileSync(filePath, 'utf8');
            } else {
                // TODO: Add Image OCR (Vision) here later
                throw new Error("Unsupported file type for text analysis");
            }

            // 2. Metadata Extraction (Basic)
            const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const metadata = {
                id: docId,
                filename: file.originalname,
                size: file.size,
                type: file.mimetype,
                uploaded_at: new Date().toISOString()
            };

            // 3. Chunking
            const chunks = IngestionService.chunkText(content, 1000, 200); // 1000 chars, 200 overlap

            // 4. Store Document & Chunks
            await IngestionService.storeDocument(docId, organizationId, metadata, content);
            await deps.RagService.storeChunks(docId, chunks);

            // Cleanup temp file
            // fs.unlinkSync(filePath); // Keep for now or delete? Better delete to save space.
            try { fs.unlinkSync(filePath); } catch (e) { }

            return {
                docId,
                chunkCount: chunks.length,
                ...metadata
            };

        } catch (error) {
            console.error("Ingestion Error:", error);
            throw error;
        }
    },

    /**
     * Split text into overlapping chunks
     */
    chunkText: (text, chunkSize = 1000, overlap = 200) => {
        const chunks = [];
        if (!text) return chunks;

        // Normalize whitespace
        const cleanText = text.replace(/\s+/g, ' ').trim();

        for (let i = 0; i < cleanText.length; i += (chunkSize - overlap)) {
            chunks.push(cleanText.substring(i, i + chunkSize));
        }
        return chunks;
    },

    /**
     * Store raw document record
     */
    storeDocument: (docId, organizationId, metadata, fullContent) => {
        return new Promise((resolve, reject) => {
            const stmt = deps.db.prepare(`
                INSERT INTO knowledge_docs (id, organization_id, filename, file_type, file_size, content, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(
                docId,
                organizationId,
                metadata.filename,
                metadata.type,
                metadata.size,
                fullContent, // We store full content for now, might be heavy?
                metadata.uploaded_at,
                (err) => {
                    if (err) reject(err);
                    else resolve(docId);
                    stmt.finalize();
                }
            );
        });
    }
};

module.exports = IngestionService;
