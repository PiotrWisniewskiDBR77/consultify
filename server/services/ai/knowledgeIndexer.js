/**
 * Knowledge Indexer
 * 
 * Indexes PDF and XLSX files from the /knowledge folder for RAG search.
 * Creates embeddings and stores them in the knowledge_docs and knowledge_chunks tables.
 * 
 * Part of the Harvard-Level Co-Thinker AI System
 */

const fs = require('fs');
const path = require('path');
const db = require('../../database');
const { v4: uuidv4 } = require('uuid');
const { aiLogger } = require('./logger');

// PDF parsing libraries - these may need to be installed
let pdfParse, xlsxParse;
try {
    pdfParse = require('pdf-parse');
} catch (e) {
    aiLogger.warn('KnowledgeIndexer', 'pdf-parse not installed, PDF indexing disabled');
}
try {
    xlsxParse = require('xlsx');
} catch (e) {
    aiLogger.warn('KnowledgeIndexer', 'xlsx not installed, Excel indexing disabled');
}

// Knowledge source configuration
const KNOWLEDGE_SOURCES = {
    methodology: {
        name: 'DRD Methodology',
        files: [
            'knowledge/0. Wprowadzenie .pdf',
            'knowledge/1. Digitlne processy.pdf',
            'knowledge/2. Digitalne produkty.pdf',
            'knowledge/3. digitlane modele .pdf',
            'knowledge/4. Big data.pdf',
            'knowledge/5. Kultura.pdf',
            'knowledge/6. Cyberbezpieczenstwo .pdf',
            'knowledge/7. Os AI opis.pdf',
            'knowledge/DRD1.pdf'
        ],
        chunkSize: 1000,
        overlap: 200,
        metadata: { type: 'methodology', weight: 1.0 }
    },
    initiatives: {
        name: 'Initiative Library',
        files: [
            'knowledge/DRD 2.0/INITIATIVE_LIBRARY.xlsx'
        ],
        parser: 'xlsx',
        metadata: { type: 'initiative_template', weight: 0.9 }
    },
    engine: {
        name: 'Assessment Engine',
        files: [
            'knowledge/DRD 2.0/MASTER_DRD_ENGINE.xlsx',
            'knowledge/DRD 2.0/MASTER_DRD_ENGINE_EN.xlsx'
        ],
        parser: 'xlsx',
        metadata: { type: 'assessment_logic', weight: 1.0 }
    },
    maturity: {
        name: 'AI Maturity Matrix',
        files: [
            'knowledge/DRD 2.0/DRD_AI_Maturity_Matrix.xlsx'
        ],
        parser: 'xlsx',
        metadata: { type: 'maturity_matrix', weight: 0.9 }
    },
    rapid: {
        name: 'Rapid Assessments',
        files: [
            'knowledge/Rapid 1.pdf'
        ],
        chunkSize: 800,
        overlap: 150,
        metadata: { type: 'rapid_assessment', weight: 0.8 }
    }
};

class KnowledgeIndexer {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '../../../');
        this.embeddingService = null;
    }

    /**
     * Initialize the indexer with embedding service
     */
    async initialize() {
        try {
            const { embeddingService } = require('./embeddingService');
            this.embeddingService = embeddingService;
            await this.ensureTables();
            return true;
        } catch (error) {
            aiLogger.error('KnowledgeIndexer', `Initialization failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Ensure required database tables exist
     */
    async ensureTables() {
        return new Promise((resolve, reject) => {
            const createDocsTable = `
                CREATE TABLE IF NOT EXISTS knowledge_docs (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    filepath TEXT,
                    source_type TEXT,
                    organization_id TEXT,
                    file_hash TEXT,
                    chunk_count INTEGER DEFAULT 0,
                    metadata TEXT,
                    indexed_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now'))
                )
            `;
            
            const createChunksTable = `
                CREATE TABLE IF NOT EXISTS knowledge_chunks (
                    id TEXT PRIMARY KEY,
                    doc_id TEXT NOT NULL,
                    chunk_index INTEGER,
                    content TEXT NOT NULL,
                    embedding TEXT,
                    metadata TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (doc_id) REFERENCES knowledge_docs(id)
                )
            `;

            db.run(createDocsTable, (err) => {
                if (err) {
                    aiLogger.error('KnowledgeIndexer', `Error creating knowledge_docs: ${err.message}`);
                }
                db.run(createChunksTable, (err2) => {
                    if (err2) {
                        aiLogger.error('KnowledgeIndexer', `Error creating knowledge_chunks: ${err2.message}`);
                    }
                    resolve();
                });
            });
        });
    }

    /**
     * Index all configured knowledge sources
     */
    async indexAll(options = {}) {
        const { forceReindex = false, sourceNames = null } = options;
        const results = {
            success: [],
            failed: [],
            skipped: []
        };

        const sources = sourceNames 
            ? Object.entries(KNOWLEDGE_SOURCES).filter(([name]) => sourceNames.includes(name))
            : Object.entries(KNOWLEDGE_SOURCES);

        for (const [sourceName, sourceConfig] of sources) {
            aiLogger.info('KnowledgeIndexer', `Processing source: ${sourceName}`);
            
            for (const relativeFilePath of sourceConfig.files) {
                const filePath = path.join(this.projectRoot, relativeFilePath);
                
                try {
                    // Check if file exists
                    if (!fs.existsSync(filePath)) {
                        aiLogger.warn('KnowledgeIndexer', `File not found: ${filePath}`);
                        results.skipped.push({ file: relativeFilePath, reason: 'File not found' });
                        continue;
                    }

                    // Check if already indexed (unless force reindex)
                    if (!forceReindex) {
                        const existing = await this.getDocByPath(relativeFilePath);
                        if (existing) {
                            aiLogger.debug('KnowledgeIndexer', `Already indexed: ${relativeFilePath}`);
                            results.skipped.push({ file: relativeFilePath, reason: 'Already indexed' });
                            continue;
                        }
                    }

                    // Index the file
                    const result = await this.indexFile(filePath, {
                        ...sourceConfig,
                        sourceName,
                        relativeFilePath
                    });

                    results.success.push({ file: relativeFilePath, chunks: result.chunkCount });
                    
                } catch (error) {
                    aiLogger.error('KnowledgeIndexer', `Error indexing ${relativeFilePath}: ${error.message}`);
                    results.failed.push({ file: relativeFilePath, error: error.message });
                }
            }
        }

        aiLogger.info('KnowledgeIndexer', `Indexing complete`, {
            success: results.success.length,
            failed: results.failed.length,
            skipped: results.skipped.length
        });

        return results;
    }

    /**
     * Index a single file
     */
    async indexFile(filePath, config) {
        const ext = path.extname(filePath).toLowerCase();
        let content;
        let chunks;

        // Extract content based on file type
        if (ext === '.pdf') {
            content = await this.extractPdfContent(filePath);
            chunks = this.chunkText(content, config.chunkSize || 1000, config.overlap || 200);
        } else if (ext === '.xlsx' || ext === '.xls') {
            const sheetContents = await this.extractExcelContent(filePath);
            chunks = this.processExcelChunks(sheetContents, config);
        } else if (ext === '.txt') {
            content = fs.readFileSync(filePath, 'utf-8');
            chunks = this.chunkText(content, config.chunkSize || 1000, config.overlap || 200);
        } else {
            throw new Error(`Unsupported file type: ${ext}`);
        }

        // Create document record
        const docId = uuidv4();
        const filename = path.basename(filePath);
        
        await this.insertDocument({
            id: docId,
            filename,
            filepath: config.relativeFilePath,
            sourceType: config.sourceName,
            metadata: config.metadata,
            chunkCount: chunks.length
        });

        // Create chunks with embeddings
        let successCount = 0;
        for (let i = 0; i < chunks.length; i++) {
            try {
                const embedding = await this.generateEmbedding(chunks[i]);
                
                await this.insertChunk({
                    id: `${docId}-chunk-${i}`,
                    docId,
                    chunkIndex: i,
                    content: chunks[i],
                    embedding,
                    metadata: { ...config.metadata, chunkIndex: i }
                });
                
                successCount++;
            } catch (error) {
                aiLogger.warn('KnowledgeIndexer', `Error creating chunk ${i}: ${error.message}`);
            }
        }

        aiLogger.info('KnowledgeIndexer', `Indexed ${filename}: ${successCount}/${chunks.length} chunks`);

        return {
            docId,
            filename,
            chunkCount: successCount
        };
    }

    /**
     * Extract text content from PDF
     */
    async extractPdfContent(filePath) {
        if (!pdfParse) {
            throw new Error('pdf-parse library not available');
        }

        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    }

    /**
     * Extract content from Excel file
     */
    async extractExcelContent(filePath) {
        if (!xlsxParse) {
            throw new Error('xlsx library not available');
        }

        const workbook = xlsxParse.readFile(filePath);
        const sheetContents = {};

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const jsonData = xlsxParse.utils.sheet_to_json(sheet, { header: 1 });
            
            // Convert to readable text
            const textContent = jsonData
                .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''))
                .map(row => row.filter(cell => cell !== null && cell !== undefined).join(' | '))
                .join('\n');
            
            sheetContents[sheetName] = textContent;
        }

        return sheetContents;
    }

    /**
     * Process Excel content into chunks
     */
    processExcelChunks(sheetContents, config) {
        const chunks = [];
        
        for (const [sheetName, content] of Object.entries(sheetContents)) {
            if (!content || content.trim().length < 50) continue;
            
            // Add sheet context to each chunk
            const sheetChunks = this.chunkText(content, config.chunkSize || 800, config.overlap || 100);
            
            for (const chunk of sheetChunks) {
                chunks.push(`[Sheet: ${sheetName}]\n${chunk}`);
            }
        }
        
        return chunks;
    }

    /**
     * Split text into overlapping chunks
     */
    chunkText(text, chunkSize = 1000, overlap = 200) {
        if (!text || text.length === 0) return [];
        
        const chunks = [];
        const sentences = text.split(/(?<=[.!?])\s+/);
        
        let currentChunk = '';
        let lastChunk = '';
        
        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > chunkSize) {
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk.trim());
                    lastChunk = currentChunk;
                    
                    // Start new chunk with overlap
                    const overlapText = lastChunk.slice(-overlap);
                    currentChunk = overlapText + ' ' + sentence;
                } else {
                    // Sentence itself is longer than chunk size
                    chunks.push(sentence.slice(0, chunkSize).trim());
                    currentChunk = sentence.slice(chunkSize - overlap);
                }
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }
        
        // Add remaining content
        if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks;
    }

    /**
     * Generate embedding for text
     */
    async generateEmbedding(text) {
        if (!this.embeddingService) {
            return null;
        }
        
        try {
            const embedding = await this.embeddingService.generateEmbedding(text);
            return JSON.stringify(embedding);
        } catch (error) {
            aiLogger.warn('KnowledgeIndexer', `Embedding generation failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Insert document record
     */
    async insertDocument(doc) {
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT OR REPLACE INTO knowledge_docs 
                (id, filename, filepath, source_type, metadata, chunk_count, indexed_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [
                doc.id,
                doc.filename,
                doc.filepath,
                doc.sourceType,
                JSON.stringify(doc.metadata || {}),
                doc.chunkCount
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    /**
     * Insert chunk record
     */
    async insertChunk(chunk) {
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT OR REPLACE INTO knowledge_chunks 
                (id, doc_id, chunk_index, content, embedding, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                chunk.id,
                chunk.docId,
                chunk.chunkIndex,
                chunk.content,
                chunk.embedding,
                JSON.stringify(chunk.metadata || {})
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    /**
     * Get document by file path
     */
    async getDocByPath(filepath) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM knowledge_docs WHERE filepath = ?', [filepath], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * Search knowledge base
     */
    async search(query, options = {}) {
        const { limit = 5, minSimilarity = 0.5, sourceTypes = null } = options;
        
        if (!this.embeddingService) {
            return this.keywordSearch(query, { limit, sourceTypes });
        }

        try {
            // Generate query embedding
            const queryEmbedding = await this.embeddingService.generateEmbedding(query);
            if (!queryEmbedding) {
                return this.keywordSearch(query, { limit, sourceTypes });
            }

            // Get all chunks with embeddings
            const chunks = await this.getAllChunksWithEmbeddings(sourceTypes);
            
            // Calculate similarities
            const scored = chunks.map(chunk => {
                let chunkEmbedding;
                try {
                    chunkEmbedding = JSON.parse(chunk.embedding);
                } catch {
                    return { ...chunk, similarity: 0 };
                }
                
                const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding);
                return { ...chunk, similarity };
            });

            // Sort by similarity and filter
            return scored
                .filter(c => c.similarity >= minSimilarity)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit)
                .map(c => ({
                    content: c.content,
                    source: c.filename,
                    sourceType: c.source_type,
                    similarity: c.similarity,
                    metadata: JSON.parse(c.metadata || '{}')
                }));

        } catch (error) {
            aiLogger.error('KnowledgeIndexer', `Search error: ${error.message}`);
            return this.keywordSearch(query, { limit, sourceTypes });
        }
    }

    /**
     * Keyword-based fallback search
     */
    async keywordSearch(query, options = {}) {
        const { limit = 5, sourceTypes = null } = options;
        
        return new Promise((resolve, reject) => {
            const keywords = query
                .toLowerCase()
                .split(/\s+/)
                .filter(w => w.length > 3);
            
            if (keywords.length === 0) {
                return resolve([]);
            }

            const whereClauses = keywords.map(() => 'c.content LIKE ?').join(' OR ');
            const params = keywords.map(w => `%${w}%`);

            let sql = `
                SELECT c.content, c.metadata, d.filename, d.source_type
                FROM knowledge_chunks c
                JOIN knowledge_docs d ON c.doc_id = d.id
                WHERE (${whereClauses})
            `;

            if (sourceTypes && sourceTypes.length > 0) {
                sql += ` AND d.source_type IN (${sourceTypes.map(() => '?').join(',')})`;
                params.push(...sourceTypes);
            }

            sql += ` LIMIT ?`;
            params.push(limit);

            db.all(sql, params, (err, rows) => {
                if (err) {
                    aiLogger.error('KnowledgeIndexer', `Keyword search error: ${err.message}`);
                    resolve([]);
                } else {
                    resolve((rows || []).map(r => ({
                        content: r.content,
                        source: r.filename,
                        sourceType: r.source_type,
                        similarity: 0.5, // Approximate for keyword match
                        metadata: JSON.parse(r.metadata || '{}')
                    })));
                }
            });
        });
    }

    /**
     * Get all chunks with embeddings
     */
    async getAllChunksWithEmbeddings(sourceTypes = null) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT c.id, c.content, c.embedding, c.metadata, d.filename, d.source_type
                FROM knowledge_chunks c
                JOIN knowledge_docs d ON c.doc_id = d.id
                WHERE c.embedding IS NOT NULL
            `;

            const params = [];
            if (sourceTypes && sourceTypes.length > 0) {
                sql += ` AND d.source_type IN (${sourceTypes.map(() => '?').join(',')})`;
                params.push(...sourceTypes);
            }

            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        
        let dot = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        
        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator === 0 ? 0 : dot / denominator;
    }

    /**
     * Get indexing statistics
     */
    async getStats() {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    d.source_type,
                    COUNT(DISTINCT d.id) as doc_count,
                    SUM(d.chunk_count) as chunk_count,
                    MAX(d.indexed_at) as last_indexed
                FROM knowledge_docs d
                GROUP BY d.source_type
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * Delete all indexed content for a source type
     */
    async deleteSource(sourceType) {
        return new Promise((resolve, reject) => {
            db.run(`
                DELETE FROM knowledge_chunks 
                WHERE doc_id IN (SELECT id FROM knowledge_docs WHERE source_type = ?)
            `, [sourceType], (err) => {
                if (err) return reject(err);
                
                db.run('DELETE FROM knowledge_docs WHERE source_type = ?', [sourceType], (err2) => {
                    if (err2) reject(err2);
                    else resolve();
                });
            });
        });
    }
}

// Singleton instance
const knowledgeIndexer = new KnowledgeIndexer();

module.exports = {
    KnowledgeIndexer,
    knowledgeIndexer,
    KNOWLEDGE_SOURCES
};

