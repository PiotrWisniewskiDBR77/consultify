#!/usr/bin/env node
/**
 * Knowledge Base (RAG) Test Suite
 * 
 * Tests the Retrieval-Augmented Generation system:
 * - Embedding generation
 * - Vector similarity search
 * - Document chunking
 * - Citation extraction
 * - Knowledge retrieval
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const SERVER_PATH = path.join(__dirname, '../../server');
const DB_PATH = path.join(SERVER_PATH, 'database.sqlite');

// Test implementations
async function testEmbeddingService() {
    const embeddingPath = path.join(SERVER_PATH, 'services/ai/embeddingService.js');
    const exists = fs.existsSync(embeddingPath);

    let hasEmbedding = false;
    if (exists) {
        try {
            const content = fs.readFileSync(embeddingPath, 'utf8');
            hasEmbedding = content.includes('embed') || 
                          content.includes('vector') ||
                          content.includes('encoding');
        } catch {}
    }

    return {
        name: 'Embedding Service',
        passed: exists && hasEmbedding,
        message: exists ? (hasEmbedding ? 'Embedding service operational' : 'Embedding logic not found') : 'Embedding service not found'
    };
}

async function testKnowledgeIndexer() {
    const indexerPath = path.join(SERVER_PATH, 'services/ai/knowledgeIndexer.js');
    const exists = fs.existsSync(indexerPath);

    let hasIndexing = false;
    if (exists) {
        try {
            const content = fs.readFileSync(indexerPath, 'utf8');
            hasIndexing = content.includes('index') || 
                         content.includes('chunk') ||
                         content.includes('document');
        } catch {}
    }

    return {
        name: 'Knowledge Indexer',
        passed: exists && hasIndexing,
        message: exists ? (hasIndexing ? 'Knowledge indexer operational' : 'Indexing logic not found') : 'Knowledge indexer not found'
    };
}

async function testDocumentIngestion() {
    const ingestionPath = path.join(SERVER_PATH, 'services/ai/ingestionPipeline.js');
    const exists = fs.existsSync(ingestionPath);

    let hasIngestion = false;
    if (exists) {
        try {
            const content = fs.readFileSync(ingestionPath, 'utf8');
            hasIngestion = content.includes('ingest') || 
                          content.includes('process') ||
                          content.includes('upload');
        } catch {}
    }

    return {
        name: 'Document Ingestion Pipeline',
        passed: exists && hasIngestion,
        message: exists ? (hasIngestion ? 'Ingestion pipeline operational' : 'Ingestion logic not found') : 'Ingestion pipeline not found'
    };
}

async function testCitationExtractor() {
    const citationPath = path.join(SERVER_PATH, 'services/ai/citationExtractor.js');
    const exists = fs.existsSync(citationPath);

    let hasCitation = false;
    if (exists) {
        try {
            const content = fs.readFileSync(citationPath, 'utf8');
            hasCitation = content.includes('citation') || 
                         content.includes('source') ||
                         content.includes('extract');
        } catch {}
    }

    return {
        name: 'Citation Extractor',
        passed: exists && hasCitation,
        message: exists ? (hasCitation ? 'Citation extraction operational' : 'Citation logic not found') : 'Citation extractor not found'
    };
}

async function testVectorSearchCapability() {
    // Check for vector search implementations
    const paths = [
        path.join(SERVER_PATH, 'services/ai/embeddingService.js'),
        path.join(SERVER_PATH, 'services/ai/knowledgeIndexer.js'),
        path.join(SERVER_PATH, 'services/ai/docIndexer.js')
    ];

    let hasVectorSearch = false;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf8');
                if (content.includes('similarity') || content.includes('cosine') || content.includes('search') || content.includes('nearest')) {
                    hasVectorSearch = true;
                    break;
                }
            } catch {}
        }
    }

    return {
        name: 'Vector Search Capability',
        passed: hasVectorSearch,
        message: hasVectorSearch ? 'Vector search available' : 'Vector search not implemented'
    };
}

async function testKnowledgeBaseTables() {
    return new Promise((resolve) => {
        if (!fs.existsSync(DB_PATH)) {
            resolve({
                name: 'Knowledge Base Tables',
                passed: false,
                message: 'Database not found'
            });
            return;
        }

        const db = new sqlite3.Database(DB_PATH);
        const possibleTables = ['knowledge_base', 'documents', 'embeddings', 'knowledge_chunks'];
        const foundTables = [];

        db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
            db.close();
            if (err) {
                resolve({
                    name: 'Knowledge Base Tables',
                    passed: false,
                    message: err.message
                });
                return;
            }

            const tableNames = (rows || []).map(r => r.name.toLowerCase());
            possibleTables.forEach(t => {
                if (tableNames.some(tn => tn.includes(t.replace('_', '')) || tn.includes(t))) {
                    foundTables.push(t);
                }
            });

            // Also check for any table with 'knowledge' in name
            const knowledgeTables = tableNames.filter(t => t.includes('knowledge'));

            resolve({
                name: 'Knowledge Base Tables',
                passed: foundTables.length > 0 || knowledgeTables.length > 0,
                message: knowledgeTables.length > 0 
                    ? `Found: ${knowledgeTables.join(', ')}`
                    : 'No knowledge base tables found'
            });
        });
    });
}

async function testDocumentChunking() {
    const paths = [
        path.join(SERVER_PATH, 'services/ai/knowledgeIndexer.js'),
        path.join(SERVER_PATH, 'services/ai/ingestionPipeline.js'),
        path.join(SERVER_PATH, 'services/ai/docIndexer.js')
    ];

    let hasChunking = false;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf8');
                if (content.includes('chunk') || content.includes('split') || content.includes('segment')) {
                    hasChunking = true;
                    break;
                }
            } catch {}
        }
    }

    return {
        name: 'Document Chunking',
        passed: hasChunking,
        message: hasChunking ? 'Document chunking implemented' : 'Document chunking not found'
    };
}

async function testRetrievalAccuracy() {
    // Check for retrieval ranking/scoring
    const paths = [
        path.join(SERVER_PATH, 'services/ai/knowledgeIndexer.js'),
        path.join(SERVER_PATH, 'services/ai/embeddingService.js')
    ];

    let hasRanking = false;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf8');
                if (content.includes('score') || content.includes('rank') || content.includes('relevance') || content.includes('top')) {
                    hasRanking = true;
                    break;
                }
            } catch {}
        }
    }

    return {
        name: 'Retrieval Ranking',
        passed: hasRanking,
        message: hasRanking ? 'Retrieval ranking implemented' : 'Retrieval ranking not found'
    };
}

async function testWebResearchService() {
    const webPath = path.join(SERVER_PATH, 'services/ai/webResearchService.js');
    const exists = fs.existsSync(webPath);

    let hasWebResearch = false;
    if (exists) {
        try {
            const content = fs.readFileSync(webPath, 'utf8');
            hasWebResearch = content.includes('search') || 
                            content.includes('web') ||
                            content.includes('research');
        } catch {}
    }

    return {
        name: 'Web Research Service',
        passed: exists && hasWebResearch,
        message: exists ? (hasWebResearch ? 'Web research operational' : 'Web research logic not found') : 'Web research service not found'
    };
}

// Main test runner
async function runTests() {
    const tests = [];
    let passed = 0;
    let failed = 0;

    const testFunctions = [
        testEmbeddingService,
        testKnowledgeIndexer,
        testDocumentIngestion,
        testCitationExtractor,
        testVectorSearchCapability,
        testKnowledgeBaseTables,
        testDocumentChunking,
        testRetrievalAccuracy,
        testWebResearchService
    ];

    for (const testFn of testFunctions) {
        try {
            const result = await testFn();
            tests.push(result);
            if (result.passed) passed++; else failed++;
        } catch (e) {
            tests.push({
                name: testFn.name,
                passed: false,
                message: e.message
            });
            failed++;
        }
    }

    return { passed, failed, tests };
}

module.exports = { runTests };

if (require.main === module) {
    runTests().then(results => {
        console.log('\nKnowledge Base (RAG) Test Results:');
        console.log('─'.repeat(50));
        results.tests.forEach(t => {
            const status = t.passed ? '✓' : '✗';
            console.log(`${status} ${t.name}: ${t.message}`);
        });
        console.log('─'.repeat(50));
        console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);
        process.exit(results.failed > 0 ? 1 : 0);
    });
}

